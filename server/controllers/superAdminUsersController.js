import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";

const USER_ROLES = [
  "super_admin",
  "hotel_admin",
  "restaurant_admin",
  "manager",
  "staff",
  "cashier",
  "admin",
  "chef",
  "waiter",
  "delivery",
  "receptionist",
  "inventory_manager",
  "customer",
];

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (q) {
    const regex = new RegExp(String(q), "i");
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  if (role && USER_ROLES.includes(role)) {
    filter.role = role;
  }

  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    User.find(filter).select("-password -refreshToken").sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  res.status(200).json(new ApiResponse(true, "Users fetched", { items, meta: { page: pageNumber, limit: pageSize, total, totalPages } }));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password -refreshToken").lean();
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json(new ApiResponse(true, "User fetched", user));
});

export const createUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone, role, restaurant, hotelId, isActive } = req.body;
  if (!fullName || !email || !password) {
    throw new ApiError(400, "Full name, email, and password are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "Email is already in use");
  }

  const normalizeBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return true;
  };

  const user = await User.create({
    fullName,
    email,
    password,
    phone: phone || "",
    role: USER_ROLES.includes(role) ? role : "customer",
    restaurant: restaurant || null,
    hotelId: hotelId || null,
    isActive: normalizeBoolean(isActive),
  });

  await createActivity({
    action: "User Created",
    description: `User ${user.email} created by super admin`,
    performedBy: req.user._id,
    targetId: user._id,
    targetType: "user",
  });

  const safeUser = await User.findById(user._id).select("-password -refreshToken").lean();
  res.status(201).json(new ApiResponse(true, "User created", safeUser));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const update = { ...req.body };
  delete update.refreshToken;

  if (update.email && update.email !== user.email) {
    const existingUser = await User.findOne({ email: update.email });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw new ApiError(409, "Email is already in use");
    }
  }

  if (update.role && !USER_ROLES.includes(update.role)) {
    delete update.role;
  }

  if (update.password) {
    user.password = update.password;
    delete update.password;
  }

  const normalizeBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return user.isActive;
  };

  Object.entries(update).forEach(([key, value]) => {
    if (key === "restaurant" || key === "hotelId" || key === "fullName" || key === "email" || key === "phone" || key === "role" || key === "isActive") {
      if (key === "isActive") {
        user.isActive = normalizeBoolean(value);
      } else {
        user[key] = value === "" ? null : value;
      }
    }
  });

  await user.save();

  await createActivity({
    action: "User Updated",
    description: `User ${user.email} updated by super admin`,
    performedBy: req.user._id,
    targetId: user._id,
    targetType: "user",
  });

  const safeUser = await User.findById(user._id).select("-password -refreshToken").lean();
  res.status(200).json(new ApiResponse(true, "User updated", safeUser));
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  if (status !== "active" && status !== "inactive") {
    throw new ApiError(400, "Invalid status");
  }

  user.isActive = status === "active";
  await user.save();

  await createActivity({
    action: `User ${status === "active" ? "Activated" : "Deactivated"}`,
    description: `User ${user.email} ${status}`,
    performedBy: req.user._id,
    targetId: user._id,
    targetType: "user",
  });

  const safeUser = await User.findById(user._id).select("-password -refreshToken").lean();
  res.status(200).json(new ApiResponse(true, "User status updated", safeUser));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  await user.deleteOne();

  await createActivity({
    action: "User Deleted",
    description: `User ${user.email} deleted by super admin`,
    performedBy: req.user._id,
    targetId: user._id,
    targetType: "user",
  });

  res.status(200).json(new ApiResponse(true, "User deleted"));
});

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
