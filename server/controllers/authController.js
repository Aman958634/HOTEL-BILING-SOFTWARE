import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { sendEmail } from "../services/emailService.js";
import Staff from "../models/Staff.js";
import logger from "../utils/logger.js";
import { runWithTenantContext } from "../utils/tenantContext.js";
import { resolveUserTenant, tenantClaims } from "../utils/tenantResolver.js";

const resetTokenStore = new Map();

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const user = await User.create({ fullName, email, password, phone, role: "customer" });
  const safeUser = await User.findById(user._id).select("-password -refreshToken");
  res.status(201).json(new ApiResponse(true, "Registered successfully", safeUser));
});

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;
  let loginStep = "input";

  try {
  logger.info(`Login attempt email: ${email}`);

  loginStep = "user-lookup";
  const user = await runWithTenantContext(
    { role: "system", restaurantId: null, outletId: null },
    async () => await User.findOne({ email }).select("+password")
  );
  if (!user) {
    logger.warn(`Login failed: user not found (${email})`);
    throw new ApiError(401, "Invalid credentials");
  }

  logger.info(`Login user found: true, role: ${user.role}, active: ${user.isActive}`);

  if (!user.isActive) throw new ApiError(403, "Account is inactive");

  loginStep = "password-verification";
  if (!user.password || typeof user.password !== "string") {
    logger.warn(`Login failed: password hash missing (${email})`);
    throw new ApiError(401, "Invalid credentials");
  }

  let isMatch = false;
  try {
    isMatch = await user.comparePassword(password);
  } catch (error) {
    logger.error(`Login password verification error email=${email} message=${error.message}`, { stack: error.stack });
    throw new ApiError(401, "Invalid credentials");
  }
  logger.info(`Login password match: ${isMatch}`);

  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  loginStep = "token-generation";
  const tenant = await resolveUserTenant(user);
  const payload = {
    id: user._id,
    role: user.role,
    email: user.email,
    ...tenantClaims(user, tenant),
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  loginStep = "session-persistence";
  const safeUser = await runWithTenantContext(
    { role: "system", restaurantId: null, outletId: null },
    async () => {
      user.refreshToken = refreshToken;
      await user.save();
      await Staff.updateOne({ user: user._id }, { $set: { lastLogin: new Date() } });
      return await User.findById(user._id).select("-password -refreshToken");
    }
  );
  logger.info(`Login success: ${email}, role: ${user.role}, jwt: true`);
  res.status(200).json(new ApiResponse(true, "Logged in", {
    user: safeUser,
    accessToken,
    refreshToken,
    outletId: tenant.outletId,
    context: tenantClaims(user, tenant),
  }));
  } catch (error) {
    logger.error(`Login failed step=${loginStep} email=${email} message=${error.message}`, { stack: error.stack });
    throw error;
  }
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(401, "Invalid refresh token");

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await runWithTenantContext(
    { role: "system", restaurantId: null, outletId: null },
    async () => await User.findOne({ refreshToken, _id: decoded.id })
  );
  if (!user || !user.isActive) throw new ApiError(401, "Invalid refresh token");

  const tenant = await resolveUserTenant(user);
  const accessToken = generateAccessToken({
    id: user._id,
    role: user.role,
    email: user.email,
    ...tenantClaims(user, tenant),
  });
  res.status(200).json(new ApiResponse(true, "Token refreshed", { accessToken, context: tenantClaims(user, tenant) }));
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await User.updateOne({ refreshToken }, { $set: { refreshToken: "" } });
  }
  res.status(200).json(new ApiResponse(true, "Logged out"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  const token = crypto.randomBytes(20).toString("hex");
  resetTokenStore.set(token, user._id.toString());

  const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
  await sendEmail({
    to: user.email,
    subject: "Password Reset",
    html: `<p>Click to reset password: <a href=\"${resetLink}\">Reset</a></p>`,
  });

  res.status(200).json(new ApiResponse(true, "Reset email sent"));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const userId = resetTokenStore.get(token);
  if (!userId) throw new ApiError(400, "Invalid or expired token");

  const user = await User.findById(userId).select("+password");
  user.password = password;
  user.refreshToken = "";
  await user.save();

  resetTokenStore.delete(token);
  res.status(200).json(new ApiResponse(true, "Password reset successful"));
});

export const me = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(true, "User profile", req.user));
});
