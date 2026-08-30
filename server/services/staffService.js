import mongoose from "mongoose";
import User from "../models/User.js";
import Staff from "../models/Staff.js";
import Shift from "../models/Shift.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Reservation from "../models/Reservation.js";
import Log from "../models/Log.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";

export const STAFF_ROLES = ["ADMIN", "MANAGER", "CHEF", "WAITER", "DELIVERY", "CASHIER", "RECEPTIONIST", "INVENTORY_MANAGER"];
export const STAFF_DEPARTMENTS = ["Management", "Kitchen", "Service", "Delivery", "Billing", "Reception", "Inventory"];
export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"];

const roleToUserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  CHEF: "chef",
  WAITER: "waiter",
  DELIVERY: "delivery",
  CASHIER: "cashier",
  RECEPTIONIST: "receptionist",
  INVENTORY_MANAGER: "inventory_manager",
};

const shiftDefaults = {
  Morning: { startTime: "09:00", endTime: "17:00" },
  Evening: { startTime: "17:00", endTime: "01:00" },
  Night: { startTime: "01:00", endTime: "09:00" },
};

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeStaffRole = (role) => String(role || "").trim().toUpperCase();
export const normalizeStaffDepartment = (department) => String(department || "").trim();
export const normalizeStaffStatus = (status) => String(status || "ACTIVE").trim().toUpperCase();
export const normalizeShiftInput = (shift) => (mongoose.isValidObjectId(shift) ? shift : String(shift || "").trim());

export const getUserRoleFromStaffRole = (role) => roleToUserRole[normalizeStaffRole(role)] || null;

export const generateEmployeeId = async () => {
  const existing = await Sequence.findOne({ key: "staff-employee-id" });

  if (!existing) {
    await Sequence.create({ key: "staff-employee-id", value: 1000 });
  }

  const sequence = await Sequence.findOneAndUpdate(
    { key: "staff-employee-id" },
    { $inc: { value: 1 } },
    { new: true }
  );

  const nextValue = Math.max(1001, Number(sequence?.value || 1001));
  return `EMP-${nextValue}`;
};

export const ensureShiftRecord = async (input) => {
  if (!input) return null;
  if (mongoose.isValidObjectId(input)) {
    const existing = await Shift.findById(input);
    if (existing) return existing;
  }

  const rawName = String(input || "").trim();
  if (!rawName) return null;

  const normalizedName = rawName
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  const existing = await Shift.findOne({ name: new RegExp(`^${escapeRegex(normalizedName)}$`, "i") });
  if (existing) return existing;

  const defaults = shiftDefaults[normalizedName] || { startTime: "", endTime: "" };
  return Shift.create({ name: normalizedName, ...defaults });
};

export const buildStaffListFilter = async (query) => {
  const filters = {};
  const search = String(query.search || "").trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filters.$or = [
      { employeeId: pattern },
      { firstName: pattern },
      { lastName: pattern },
      { phone: pattern },
      { email: pattern },
    ];
  }

  if (query.role) filters.role = normalizeStaffRole(query.role);
  if (query.department) filters.department = normalizeStaffDepartment(query.department);
  if (query.status) filters.status = normalizeStaffStatus(query.status);

  if (query.shift) {
    if (mongoose.isValidObjectId(query.shift)) {
      filters.shift = query.shift;
    } else {
      const shiftPattern = new RegExp(`^${escapeRegex(String(query.shift).trim())}$`, "i");
      const shiftDocs = await Shift.find({ name: shiftPattern }).select("_id").lean();
      filters.shift = { $in: shiftDocs.map((doc) => doc._id) };
    }
  }

  return filters;
};

export const normalizeStaffDocument = (staff) => {
  const data = staff.toObject ? staff.toObject() : staff;
  return {
    ...data,
    fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
  };
};

export const buildStaffResponse = async (staff) => {
  const populated = await Staff.findById(staff._id)
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  return normalizeStaffDocument(populated);
};

export const getStaffActivity = async (userId, { restaurant = null, outlet = null } = {}) => {
  if (!userId) return [];

  const filters = {
    "context.userId": userId,
    ...(restaurant ? { "context.restaurantId": restaurant } : {}),
    ...(outlet ? { "context.metadata.outletId": outlet } : {}),
  };
  const logs = await Log.find(filters)
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return logs.map((log) => ({
    message: log.message,
    level: log.level,
    createdAt: log.createdAt,
    context: log.context || {},
  }));
};

export const getHistoricalStaffRecordCount = async (userId) => {
  if (!userId) return 0;

  const [orders, payments, reservations, logs] = await Promise.all([
    Order.countDocuments({ $or: [{ createdBy: userId }, { servedBy: userId }, { preparedBy: userId }] }),
    Payment.countDocuments({ user: userId }),
    Reservation.countDocuments({ $or: [{ handledBy: userId }, { confirmedBy: userId }, { createdBy: userId }] }),
    Log.countDocuments({ "context.userId": userId }),
  ]);

  return orders + payments + reservations + logs;
};

export const syncUserForStaff = async (staff, changes, actorRole) => {
  if (!staff.user) return null;

  const update = {};
  if (changes.email) {
    if (actorRole !== "admin") {
      throw new ApiError(403, "Only admin can change login email for linked staff");
    }
    update.email = String(changes.email).trim().toLowerCase();
  }

  if (changes.role) {
    if (actorRole !== "admin") {
      throw new ApiError(403, "Only admin can change login role for linked staff");
    }
    update.role = getUserRoleFromStaffRole(changes.role);
    update.allOutletsAccess = update.role === "admin";
  }

  if (Object.keys(update).length) {
    await User.updateOne({ _id: staff.user }, { $set: update });
  }
};
