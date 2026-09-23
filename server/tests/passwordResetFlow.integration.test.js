import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";
import { setEmailSenderForTests } from "../services/emailService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const environmentNames = ["NODE_ENV", "CLIENT_URL", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "EMAIL_SECURE", "PASSWORD_RESET_OTP_SECRET"];
const originalEnvironment = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]));
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "https://reset-flow.test.invalid";
process.env.EMAIL_HOST = "smtp.test.invalid";
process.env.EMAIL_PORT = "587";
process.env.EMAIL_USER = "reset-test-sender@test.invalid";
process.env.EMAIL_PASS = "mocked-email-password";
process.env.EMAIL_SECURE = "false";
process.env.PASSWORD_RESET_OTP_SECRET = "test-only-password-reset-otp-secret";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(8).toString("hex");
const email = `password-reset-${suffix}@test.invalid`;
const sentMessages = [];
setEmailSenderForTests(async (message) => {
  sentMessages.push(message);
  return { messageId: "mocked-password-reset" };
});

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);
const postJson = (path, body) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const resetTokenFromMessage = (message) => new URL(message.text.match(/https:\/\/[^\s]+/)[0]).pathname.split("/").pop();

try {
  await User.create({ fullName: "Password Reset Test", email, password: "InitialPassword!23", refreshToken: "active-session-token", role: "customer" });

  const known = await postJson("/auth/forgot-password", { email });
  assert.equal(known.status, 200);
  assert.equal((await known.json()).message, "If an account exists, a reset email has been sent.");
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, email);
  const token = resetTokenFromMessage(sentMessages[0]);
  assert.ok(token);
  assert.equal(new URL(sentMessages[0].text.match(/https:\/\/[^\s]+/)[0]).origin, "https://reset-flow.test.invalid");

  const storedAfterRequest = await User.findOne({ email }).select("+passwordResetTokenHash +passwordResetExpiresAt");
  assert.notEqual(storedAfterRequest.passwordResetTokenHash, token);
  assert.equal(storedAfterRequest.passwordResetTokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.ok(storedAfterRequest.passwordResetExpiresAt > new Date());

  const unknown = await postJson("/auth/forgot-password", { email: `unknown-${suffix}@test.invalid` });
  assert.equal(unknown.status, 200);
  assert.equal((await unknown.json()).message, "If an account exists, a reset email has been sent.");
  assert.equal(sentMessages.length, 1);

  const invalidPassword = await postJson(`/auth/reset-password/${encodeURIComponent(token)}`, { password: "short" });
  assert.equal(invalidPassword.status, 422);
  const validReset = await postJson(`/auth/reset-password/${encodeURIComponent(token)}`, { password: "UpdatedPassword!45" });
  assert.equal(validReset.status, 200);
  const resetUser = await User.findOne({ email }).select("+password +passwordResetTokenHash +passwordResetExpiresAt");
  assert.equal(resetUser.passwordResetTokenHash, undefined);
  assert.equal(resetUser.passwordResetExpiresAt, undefined);
  assert.equal(resetUser.refreshToken, "");
  assert.equal(await resetUser.comparePassword("UpdatedPassword!45"), true);
  assert.equal(await resetUser.comparePassword("InitialPassword!23"), false);

  const reused = await postJson(`/auth/reset-password/${encodeURIComponent(token)}`, { password: "AnotherPassword!67" });
  assert.equal(reused.status, 400);
  const invalid = await postJson("/auth/reset-password/not-a-valid-reset-token", { password: "AnotherPassword!67" });
  assert.equal(invalid.status, 400);

  const expiredToken = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ email }, { $set: { passwordResetTokenHash: crypto.createHash("sha256").update(expiredToken).digest("hex"), passwordResetExpiresAt: new Date(Date.now() - 1000) } });
  const expired = await postJson(`/auth/reset-password/${encodeURIComponent(expiredToken)}`, { password: "AnotherPassword!67" });
  assert.equal(expired.status, 400);

  await User.updateOne({ email }, { $set: { refreshToken: "active-otp-session-token", password: "OtpInitialPassword!23" } });
  const otpRequest = await postJson("/auth/forgot-password/otp", { email });
  assert.equal(otpRequest.status, 200);
  assert.equal((await otpRequest.json()).message, "If an account exists, a verification code has been sent.");
  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[1].to, email);
  assert.match(sentMessages[1].text, /six-digit|\d{6}/i);
  const otp = sentMessages[1].text.match(/\b\d{6}\b/)[0];
  const storedOtp = await User.findOne({ email }).select("+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetOtpResendAvailableAt");
  assert.notEqual(storedOtp.passwordResetOtpHash, otp);
  assert.ok(storedOtp.passwordResetOtpHash);
  assert.ok(storedOtp.passwordResetOtpExpiresAt > new Date());

  const resendTooSoon = await postJson("/auth/forgot-password/otp", { email });
  assert.equal(resendTooSoon.status, 200);
  assert.equal(sentMessages.length, 2);

  const invalidOtp = await postJson("/auth/forgot-password/otp/verify", { email, otp: "000000" });
  assert.equal(invalidOtp.status, 400);
  const verified = await postJson("/auth/forgot-password/otp/verify", { email, otp });
  assert.equal(verified.status, 200);
  const verificationToken = (await verified.json()).data.verificationToken;
  assert.ok(verificationToken);

  const updatedByOtp = await postJson("/auth/forgot-password/otp/reset", { email, verificationToken, password: "OtpUpdatedPassword!45" });
  assert.equal(updatedByOtp.status, 200);
  const otpResetUser = await User.findOne({ email }).select("+password +passwordResetVerificationHash");
  assert.equal(otpResetUser.refreshToken, "");
  assert.equal(otpResetUser.passwordResetVerificationHash, undefined);
  assert.equal(await otpResetUser.comparePassword("OtpUpdatedPassword!45"), true);
  assert.equal(await otpResetUser.comparePassword("OtpInitialPassword!23"), false);

  const reusedVerification = await postJson("/auth/forgot-password/otp/reset", { email, verificationToken, password: "AnotherPassword!67" });
  assert.equal(reusedVerification.status, 400);
  const oldPasswordLogin = await postJson("/auth/login", { email, password: "OtpInitialPassword!23" });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await postJson("/auth/login", { email, password: "OtpUpdatedPassword!45" });
  assert.equal(newPasswordLogin.status, 200);

  const unknownOtp = await postJson("/auth/forgot-password/otp", { email: `unknown-otp-${suffix}@test.invalid` });
  assert.equal(unknownOtp.status, 200);
  assert.equal((await unknownOtp.json()).message, "If an account exists, a verification code has been sent.");
  assert.equal(sentMessages.length, 2);

  await User.updateOne({ email }, { $set: { passwordResetOtpHash: "expired", passwordResetOtpExpiresAt: new Date(Date.now() - 1000), passwordResetOtpAttempts: 0 } });
  const expiredOtp = await postJson("/auth/forgot-password/otp/verify", { email, otp });
  assert.equal(expiredOtp.status, 400);

  // The route shares one public, per-IP budget across reset requests and
  // submissions. Seven requests above have consumed the first seven of ten slots.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await postJson("/auth/forgot-password", { email });
    assert.equal(response.status, 200);
  }
  const limited = await postJson("/auth/forgot-password", { email });
  assert.equal(limited.status, 429);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await postJson("/auth/forgot-password/otp", { email: `unknown-limit-${attempt}-${suffix}@test.invalid` });
    assert.equal(response.status, 200);
  }
  const otpLimited = await postJson("/auth/forgot-password/otp", { email: `unknown-limit-final-${suffix}@test.invalid` });
  assert.equal(otpLimited.status, 429);

  console.log("Password reset flow integration checks passed with mocked email delivery.");
} finally {
  setEmailSenderForTests(null);
  await new Promise((resolve) => server.close(resolve));
  await User.deleteOne({ email });
  await mongoose.disconnect();
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
