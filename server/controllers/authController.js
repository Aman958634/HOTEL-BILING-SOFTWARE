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
import { safeErrorContext } from "../utils/safeLog.js";
import { ensureDefaultOutlet, getAllowedOutlets } from "../services/outletService.js";
import { resolvePermissions } from "../config/rolePermissions.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const restaurantWideRoles = new Set(["admin", "restaurant_admin", "hotel_admin", "super_admin"]);
const PASSWORD_RESET_GENERIC_MESSAGE = "If an account exists, a reset email has been sent.";

const buildPasswordResetLink = (token) => {
  const configuredOrigin = String(process.env.CLIENT_URL || "").split(",")[0].trim().replace(/\/+$/, "");
  if (!configuredOrigin) throw new Error("CLIENT_URL is required for password-reset email delivery.");

  const origin = new URL(configuredOrigin);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
    throw new Error("Production password-reset links require an HTTPS CLIENT_URL.");
  }
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("CLIENT_URL must be a single frontend origin for password-reset email delivery.");
  }
  return `${origin.origin}/reset-password/${encodeURIComponent(token)}`;
};

const buildSessionPayload = async (user) => {
  if (user?.restaurant) await ensureDefaultOutlet({ _id: user.restaurant });
  const safeUser = await User.findById(user._id).select("-password -refreshToken").lean();
  const authorizedOutlets = await getAllowedOutlets(safeUser);
  return {
    user: {
      ...safeUser,
      id: safeUser._id,
      outlets: (safeUser.outletAccess || []).filter((entry) => entry.isActive !== false).map((entry) => entry.outlet),
      allOutletsAccess: safeUser.allOutletsAccess === true || restaurantWideRoles.has(String(safeUser.role || "").toLowerCase()),
      accessLevel: safeUser.accessLevel || "ROLE_DEFAULT",
      customPermissions: safeUser.customPermissions || [],
      permissions: resolvePermissions(safeUser),
    },
    authorizedOutlets,
  };
};

export const register = asyncHandler(async (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const { password, phone } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const user = await User.create({ fullName, email, password, phone, role: "customer" });
  const safeUser = await User.findById(user._id).select("-password -refreshToken");
  res.status(201).json(new ApiResponse(true, "Registered successfully", safeUser));
});

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Keep login failures indistinguishable to callers to avoid account enumeration.
  if (!user.isActive) throw new ApiError(401, "Invalid credentials");

  const isMatch = await user.comparePassword(password);

  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  const payload = {
    id: user._id,
    role: user.role,
    email: user.email,
    hotelId: user.hotelId || null,
    restaurant: user.restaurant || null,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  await Staff.updateOne({ user: user._id }, { $set: { lastLogin: new Date() } });

  const session = await buildSessionPayload(user);
  logger.info(`Login succeeded for user=${user._id}`);
  res.status(200).json(new ApiResponse(true, "Logged in", { ...session, accessToken, refreshToken }));
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(401, "Invalid refresh token");

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await User.findOne({ refreshToken, _id: decoded.id });
  if (!user || !user.isActive) throw new ApiError(401, "Invalid refresh token");

  const accessToken = generateAccessToken({
    id: user._id,
    role: user.role,
    email: user.email,
    hotelId: user.hotelId || null,
    restaurant: user.restaurant || null,
  });
  res.status(200).json(new ApiResponse(true, "Token refreshed", { accessToken }));
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await User.updateOne({ refreshToken }, { $set: { refreshToken: "" } });
  }
  res.status(200).json(new ApiResponse(true, "Logged out"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });

  // Return the same response whether or not an account exists.
  if (!user) {
    return res.status(200).json(new ApiResponse(true, PASSWORD_RESET_GENERIC_MESSAGE));
  }

  let token;
  let resetLink;
  try {
    token = crypto.randomBytes(32).toString("hex");
    resetLink = buildPasswordResetLink(token);
  } catch (error) {
    logger.error("Password reset email configuration is unavailable", {
      event: "PASSWORD_RESET_EMAIL_CONFIGURATION_ERROR",
      error: safeErrorContext(error),
    });
    return res.status(200).json(new ApiResponse(true, PASSWORD_RESET_GENERIC_MESSAGE));
  }

  user.passwordResetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: "Password Reset",
      html: `<p>Click to reset your password: <a href=\"${resetLink}\">Reset password</a></p>`,
      text: `Reset your password: ${resetLink}`,
    });
  } catch (error) {
    // Keep the public response generic to prevent account enumeration. The
    // hashed token is never logged, and operators can diagnose configured
    // provider delivery failures without exposing account details here.
    logger.error("Password reset email dispatch failed", {
      event: "PASSWORD_RESET_EMAIL_DELIVERY_ERROR",
      error: safeErrorContext(error),
    });
  }

  res.status(200).json(new ApiResponse(true, PASSWORD_RESET_GENERIC_MESSAGE));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+password +passwordResetTokenHash +passwordResetExpiresAt");
  if (!user || !user.isActive) {
    throw new ApiError(400, "Invalid or expired token");
  }
  user.password = password;
  user.refreshToken = "";
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  res.status(200).json(new ApiResponse(true, "Password reset successful"));
});

export const me = asyncHandler(async (req, res) => {
  const session = await buildSessionPayload({ _id: req.user._id, restaurant: req.user.restaurant });
  res.status(200).json(new ApiResponse(true, "User profile", session));
});
