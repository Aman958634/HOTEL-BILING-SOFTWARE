import mongoose from "mongoose";
import User from "../models/User.js";
import Staff from "../models/Staff.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Log } from "../models/index.js";
import {
  STAFF_DEPARTMENTS,
  STAFF_ROLES,
  STAFF_STATUSES,
  buildStaffListFilter,
  buildStaffResponse,
  ensureShiftRecord,
  generateEmployeeId,
  getHistoricalStaffRecordCount,
  getStaffActivity,
  getUserRoleFromStaffRole,
  normalizeStaffDepartment,
  normalizeStaffRole,
  normalizeStaffStatus,
  syncUserForStaff,
} from "../services/staffService.js";
import { emitStaffCreated, emitStaffStatusChanged, emitStaffUpdated } from "../socket/staffSocket.js";
import { sendEmail } from "../services/emailService.js";
import { notifyNewStaff } from "../services/notificationService.js";

const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const canAccessRecord = (user, staff) => {
  if (!user || !staff) return false;
  if (["admin", "manager"].includes(user.role)) return true;
  if (!staff.user) return false;
  return String(staff.user?._id || staff.user) === String(user._id);
};

const getStaffByIdentifier = async (identifier) => {
  if (mongoose.isValidObjectId(identifier)) {
    return Staff.findById(identifier).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
  }

  return Staff.findOne({ employeeId: identifier }).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
};

const serialize = async (staff) => {
  const data = await buildStaffResponse(staff);
  const userId = data.user?._id || data.user || null;
  const [totalOrdersHandled, recentActivity] = await Promise.all([
    userId ? Order.countDocuments({ createdBy: userId }) : Promise.resolve(0),
    getStaffActivity(userId),
  ]);

  return {
    ...data,
    totalOrdersHandled,
    currentShift: data.shift?.name || "Not available",
    lastLogin: data.lastLogin || data.user?.lastLogin || null,
    recentActivity: recentActivity.length ? recentActivity : [],
    attendance: "Attendance module not configured.",
  };
};

const withStaffHistory = async (userId) => {
  if (!userId) return 0;
  const [orders, payments, logs] = await Promise.all([
    Order.countDocuments({ $or: [{ createdBy: userId }, { servedBy: userId }, { preparedBy: userId }] }),
    Payment.countDocuments({ user: userId }),
    Log.countDocuments({ "context.userId": userId }),
  ]);
  return orders + payments + logs;
};

export const getStaffStats = asyncHandler(async (_req, res) => {
  const [totalStaff, activeStaff, inactiveStaff, chefs, waiters, deliveryStaff] = await Promise.all([
    Staff.countDocuments({}),
    Staff.countDocuments({ status: "ACTIVE" }),
    Staff.countDocuments({ status: "INACTIVE" }),
    Staff.countDocuments({ role: "CHEF" }),
    Staff.countDocuments({ role: "WAITER" }),
    Staff.countDocuments({ role: "DELIVERY" }),
  ]);

  res.status(200).json(new ApiResponse(true, "Staff stats fetched", { totalStaff, activeStaff, inactiveStaff, chefs, waiters, deliveryStaff }));
});

export const listStaff = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filters = await buildStaffListFilter(req.query);

  const [items, total] = await Promise.all([
    Staff.find(filters)
      .populate("user", "fullName email phone role isActive lastLogin")
      .populate("shift", "name startTime endTime isActive")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Staff.countDocuments(filters),
  ]);

  res.status(200).json(
    new ApiResponse(
      true,
      "Staff fetched",
      await Promise.all(items.map((item) => serialize(item))),
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    )
  );
});

export const getActiveStaff = asyncHandler(async (req, res) => {
  const items = await Staff.find({ status: "ACTIVE" })
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive")
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json(new ApiResponse(true, "Active staff fetched", await Promise.all(items.map((item) => serialize(item)))));
});

export const getStaffByRole = asyncHandler(async (req, res) => {
  const role = normalizeStaffRole(req.params.role);
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, "Invalid staff role");

  const items = await Staff.find({ role })
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive")
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json(new ApiResponse(true, "Staff by role fetched", await Promise.all(items.map((item) => serialize(item)))));
});

export const getMyStaffProfile = asyncHandler(async (req, res) => {
  const staff = await Staff.findOne({ user: req.user._id })
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  if (!staff) throw new ApiError(404, "Staff profile not found");

  res.status(200).json(new ApiResponse(true, "Staff profile fetched", await serialize(staff)));
});

export const getStaffById = asyncHandler(async (req, res) => {
  const staff = await getStaffByIdentifier(req.params.id);
  if (!staff) throw new ApiError(404, "Staff not found");
  if (!canAccessRecord(req.user, staff)) throw new ApiError(403, "Forbidden");

  res.status(200).json(new ApiResponse(true, "Staff fetched", await serialize(staff)));
});

export const createStaff = asyncHandler(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) throw new ApiError(403, "Forbidden");

  const role = normalizeStaffRole(req.body.role);
  const department = normalizeStaffDepartment(req.body.department);
  const status = normalizeStaffStatus(req.body.status || "ACTIVE");
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();

  if (!STAFF_ROLES.includes(role)) throw new ApiError(422, "Invalid staff role");
  if (!STAFF_DEPARTMENTS.includes(department)) throw new ApiError(422, "Invalid department");
  if (!STAFF_STATUSES.includes(status)) throw new ApiError(422, "Invalid status");
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) throw new ApiError(422, "Name is required");

  if (req.body.password && !email) throw new ApiError(422, "Email is required for login-enabled staff");

  if (req.user.role === "manager" && ["ADMIN", "MANAGER"].includes(role)) {
    throw new ApiError(403, "Managers cannot create admin or manager staff members");
  }

  const existingByEmail = email ? await Staff.findOne({ email }) : null;
  if (existingByEmail) throw new ApiError(409, "Staff email already exists");

  const existingByPhone = await Staff.findOne({ phone });
  if (existingByPhone) throw new ApiError(409, "Staff phone already exists");

  let user = null;
  if (req.body.password) {
    const userRole = getUserRoleFromStaffRole(role);
    if (!userRole) throw new ApiError(422, "Invalid user role mapping");

    const userExists = await User.findOne({ email });
    if (userExists) throw new ApiError(409, "Email already registered");

    user = await User.create({
      fullName: `${req.body.firstName.trim()} ${req.body.lastName.trim()}`,
      email,
      phone,
      password: req.body.password,
      role: userRole,
      restaurant: req.user.restaurant,
      outlet: req.user.outletId,
      avatar: req.body.profilePhoto || "",
    });
  }

  const shift = await ensureShiftRecord(req.body.shift);
  const employeeId = await generateEmployeeId();

  const staff = await Staff.create({
    employeeId,
    user: user?._id || null,
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    profilePhoto: req.body.profilePhoto || "",
    phone,
    email: email || undefined,
    role,
    department,
    shift: shift?._id || null,
    joiningDate: req.body.joiningDate,
    salary: req.body.salary || 0,
    address: req.body.address || "",
    emergencyContact: req.body.emergencyContact || {},
    status,
    lastLogin: null,
  });

  const saved = await Staff.findById(staff._id)
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  const staffName = `${saved.firstName} ${saved.lastName}`;
  await notifyNewStaff({
    restaurantId: req.user?.restaurant || null,
    staffId: saved._id,
    staffName,
    role: saved.role,
    actorUserId: req.user._id,
  });

  emitStaffCreated(await serialize(saved));
  res.status(201).json(new ApiResponse(true, "Staff created successfully", await serialize(saved)));
});

export const updateStaff = asyncHandler(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) throw new ApiError(403, "Forbidden");

  const staff = await Staff.findById(req.params.id).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
  if (!staff) throw new ApiError(404, "Staff not found");

  const updates = {};
  if (req.body.firstName !== undefined) updates.firstName = String(req.body.firstName).trim();
  if (req.body.lastName !== undefined) updates.lastName = String(req.body.lastName).trim();
  if (req.body.profilePhoto !== undefined) updates.profilePhoto = req.body.profilePhoto;
  if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
  if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
  if (req.body.role !== undefined) updates.role = normalizeStaffRole(req.body.role);
  if (req.body.department !== undefined) updates.department = normalizeStaffDepartment(req.body.department);
  if (req.body.joiningDate !== undefined) updates.joiningDate = req.body.joiningDate;
  if (req.body.salary !== undefined) updates.salary = Number(req.body.salary);
  if (req.body.address !== undefined) updates.address = req.body.address;
  if (req.body.emergencyContact !== undefined) updates.emergencyContact = req.body.emergencyContact;
  if (req.body.status !== undefined) updates.status = normalizeStaffStatus(req.body.status);

  if (req.body.shift !== undefined) {
    const shift = await ensureShiftRecord(req.body.shift);
    updates.shift = shift?._id || null;
  }

  if (staff.user && (updates.email !== undefined || updates.role !== undefined)) {
    await syncUserForStaff(staff, updates, req.user.role);
  }

  if (updates.email !== undefined && staff.user && req.user.role !== "admin") {
    throw new ApiError(403, "Only admin can change linked staff email");
  }

  if (updates.role !== undefined && staff.user && req.user.role !== "admin") {
    throw new ApiError(403, "Only admin can change linked staff role");
  }

  Object.assign(staff, updates);
  await staff.save();

  const populated = await Staff.findById(staff._id)
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  emitStaffUpdated(await serialize(populated));
  res.status(200).json(new ApiResponse(true, "Staff member updated successfully.", await serialize(populated)));
});

export const updateStaffStatus = asyncHandler(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) throw new ApiError(403, "Forbidden");

  const staff = await Staff.findById(req.params.id).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
  if (!staff) throw new ApiError(404, "Staff not found");

  const status = normalizeStaffStatus(req.body.status);
  staff.status = status;
  await staff.save();

  if (staff.user) {
    const isActive = ["ACTIVE", "ON_LEAVE"].includes(status);
    await User.updateOne({ _id: staff.user._id || staff.user }, { $set: { isActive } });
  }

  const populated = await Staff.findById(staff._id)
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  emitStaffStatusChanged(await serialize(populated));
  res.status(200).json(new ApiResponse(true, "Staff status updated", await serialize(populated)));
});

export const deleteStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Forbidden");

  const staff = await Staff.findById(req.params.id);
  if (!staff) throw new ApiError(404, "Staff not found");

  const userId = staff.user;
  const historyCount = await getHistoricalStaffRecordCount(userId);
  if (historyCount > 0) {
    throw new ApiError(409, "This staff member has historical activity and cannot be permanently deleted.");
  }

  await Staff.deleteOne({ _id: staff._id });
  if (userId) {
    await User.deleteOne({ _id: userId });
  }

  res.status(200).json(new ApiResponse(true, "Staff permanently deleted"));
});
