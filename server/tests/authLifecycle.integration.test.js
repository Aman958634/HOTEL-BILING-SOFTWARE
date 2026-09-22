import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(8).toString("hex");
const email = `auth-e2e-${suffix}@test.invalid`;
const password = "AuthE2ePassword!23";
const resetPassword = "AuthE2eReset!45";
const originalEmailUser = process.env.EMAIL_USER;
// Exercise the generic response without delivering an external email.
process.env.EMAIL_USER = "";

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

try {
  const registered = await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Auth E2E User", email, password, phone: "9876543210" }),
  });
  assert.equal(registered.status, 201);
  const registration = await registered.json();
  assert.equal(registration.data?.email, email);

  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const loginPayload = await login.json();
  assert.ok(loginPayload.data?.accessToken);
  assert.ok(loginPayload.data?.refreshToken);

  const refresh = await request("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginPayload.data.refreshToken }),
  });
  assert.equal(refresh.status, 200);
  const refreshPayload = await refresh.json();
  assert.ok(refreshPayload.data?.accessToken);

  const invalidToken = await request("/auth/me", { headers: { Authorization: "Bearer invalid-token" } });
  assert.equal(invalidToken.status, 401);

  const unauthorizedOrders = await request("/orders/");
  assert.equal(unauthorizedOrders.status, 401);

  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginPayload.data.refreshToken }),
  });
  assert.equal(logout.status, 200);

  const revokedRefresh = await request("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginPayload.data.refreshToken }),
  });
  assert.equal(revokedRefresh.status, 401);

  const forgot = await request("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(forgot.status, 200);

  const resetToken = crypto.randomBytes(20).toString("hex");
  await User.updateOne(
    { email },
    {
      $set: {
        passwordResetTokenHash: crypto.createHash("sha256").update(resetToken).digest("hex"),
        passwordResetExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    }
  );
  const reset = await request(`/auth/reset-password/${resetToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: resetPassword }),
  });
  assert.equal(reset.status, 200);

  const oldPasswordLogin = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(oldPasswordLogin.status, 401);

  const resetPasswordLogin = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: resetPassword }),
  });
  assert.equal(resetPasswordLogin.status, 200);
  console.log("Auth lifecycle integration checks passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await User.deleteOne({ email });
  await mongoose.disconnect();
  if (originalEmailUser === undefined) delete process.env.EMAIL_USER;
  else process.env.EMAIL_USER = originalEmailUser;
}
