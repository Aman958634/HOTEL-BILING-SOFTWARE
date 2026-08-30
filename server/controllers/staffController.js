import mongoose from "mongoose";
import User from "../models/User.js";
import Staff from "../models/Staff.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import KotTicket from "../models/KotTicket.js";
import Delivery from "../models/Delivery.js";
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
import { notifyNewStaff } from "../services/notificationService.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { getAllowedOutlets } from "../services/outletService.js";
import { createActivity } from "../services/activityService.js";

const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "SERVED"];
const ACTIVE_KOT_STATUSES = ["NEW", "PREPARING", "READY"];
const ACTIVE_DELIVERY_STATUSES = ["assigned", "picked", "on_the_way"];
const canManageCommandCenter = (user) => ["admin", "manager"].includes(String(user?.role || "").toLowerCase());
const commandStaffQuery = async (filters, user) => buildOutletQuery(filters, user);
const getCommandStaff = async (id, user) => {
  const staff = await Staff.findOne(await commandStaffQuery({ _id: id }, user)).populate("user", "fullName email phone role isActive");
  if (!staff) throw new ApiError(404, "Staff member not found");
  return staff;
};
const addDutyActivity = async ({ staff, action, actor }) => createActivity({ action: `Staff ${action}`, description: `${staff.firstName} ${staff.lastName}: ${action}`, performedBy: actor._id, restaurantId: staff.restaurant || actor.restaurant || null, targetId: staff._id, targetType: "Staff", metadata: { dutyStatus: staff.dutyStatus, outletId: staff.outlet || null } });

const canAccessRecord = (user, staff) => {
  if (!user || !staff) return false;
  if (["admin", "manager"].includes(String(user.role || "").toLowerCase())) return true;
  if (!staff.user) return false;
  return String(staff.user?._id || staff.user) === String(user._id);
};

const getStaffByIdentifier = async (identifier, user) => {
  const scope = await commandStaffQuery({}, user);
  if (mongoose.isValidObjectId(identifier)) {
    return Staff.findOne({ ...scope, _id: identifier }).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
  }

  return Staff.findOne({ ...scope, employeeId: identifier }).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
};

const serialize = async (staff) => {
  const data = await buildStaffResponse(staff);
  const userId = data.user?._id || data.user || null;
  const activityScope = {
    restaurant: data.restaurant || null,
    ...(data.outlet ? { outlet: data.outlet } : {}),
  };
  const [totalOrdersHandled, recentActivity] = await Promise.all([
    userId ? Order.countDocuments({ createdBy: userId, ...activityScope }) : Promise.resolve(0),
    getStaffActivity(userId, activityScope),
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

export const getStaffStats = asyncHandler(async (req, res) => {
  const scope = await commandStaffQuery({}, req.user);
  const [totalStaff, activeStaff, inactiveStaff, chefs, waiters, deliveryStaff] = await Promise.all([
    Staff.countDocuments(scope),
    Staff.countDocuments({ ...scope, status: "ACTIVE" }),
    Staff.countDocuments({ ...scope, status: "INACTIVE" }),
    Staff.countDocuments({ ...scope, role: "CHEF" }),
    Staff.countDocuments({ ...scope, role: "WAITER" }),
    Staff.countDocuments({ ...scope, role: "DELIVERY" }),
  ]);

  res.status(200).json(new ApiResponse(true, "Staff stats fetched", { totalStaff, activeStaff, inactiveStaff, chefs, waiters, deliveryStaff }));
});

export const listStaff = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filters = await commandStaffQuery(await buildStaffListFilter(req.query), req.user);

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
  const items = await Staff.find(await commandStaffQuery({ status: "ACTIVE" }, req.user))
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive")
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json(new ApiResponse(true, "Active staff fetched", await Promise.all(items.map((item) => serialize(item)))));
});

export const getStaffByRole = asyncHandler(async (req, res) => {
  const role = normalizeStaffRole(req.params.role);
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, "Invalid staff role");

  const items = await Staff.find(await commandStaffQuery({ role }, req.user))
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive")
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json(new ApiResponse(true, "Staff by role fetched", await Promise.all(items.map((item) => serialize(item)))));
});

export const getMyStaffProfile = asyncHandler(async (req, res) => {
  const staff = await Staff.findOne(await commandStaffQuery({ user: req.user._id }, req.user))
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  if (!staff) throw new ApiError(404, "Staff profile not found");

  res.status(200).json(new ApiResponse(true, "Staff profile fetched", await serialize(staff)));
});

export const getStaffById = asyncHandler(async (req, res) => {
  const staff = await getStaffByIdentifier(req.params.id, req.user);
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
  // Outlet ownership is derived exclusively from the authenticated user. A
  // request body cannot create staff in another restaurant or outlet.
  const allowedOutlets = await getAllowedOutlets(req.user);
  const assignedOutletId = req.user.activeOutlet
    || allowedOutlets.find((outlet) => String(outlet._id) === String(req.user.defaultOutlet))?._id
    || (allowedOutlets.length === 1 ? allowedOutlets[0]._id : null);
  if (!assignedOutletId) {
    throw new ApiError(403, "Select an authorized outlet before creating staff");
  }
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
      avatar: req.body.profilePhoto || "",
      restaurant: req.user.restaurant || null,
      hotelId: req.user.hotelId || null,
      defaultOutlet: assignedOutletId,
      outletAccess: assignedOutletId ? [{ outlet: assignedOutletId, role: userRole, isActive: true }] : [],
      allOutletsAccess: userRole === "admin",
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
    restaurant: req.user.restaurant || null,
    outlet: assignedOutletId,
    hotelId: req.user.hotelId || null,
  });

  const saved = await Staff.findOne(await commandStaffQuery({ _id: staff._id }, req.user))
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

  const staff = await Staff.findOne(await commandStaffQuery({ _id: req.params.id }, req.user)).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
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

  if (updates.role !== undefined && req.user.role === "manager" && ["ADMIN", "MANAGER"].includes(updates.role)) {
    throw new ApiError(403, "Managers cannot assign admin or manager roles");
  }

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

  const populated = await Staff.findOne(await commandStaffQuery({ _id: staff._id }, req.user))
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  emitStaffUpdated(await serialize(populated));
  res.status(200).json(new ApiResponse(true, "Staff member updated successfully.", await serialize(populated)));
});

export const updateStaffStatus = asyncHandler(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) throw new ApiError(403, "Forbidden");

  const staff = await Staff.findOne(await commandStaffQuery({ _id: req.params.id }, req.user)).populate("user", "fullName email phone role isActive lastLogin").populate("shift", "name startTime endTime isActive");
  if (!staff) throw new ApiError(404, "Staff not found");

  const status = normalizeStaffStatus(req.body.status);
  staff.status = status;
  await staff.save();

  if (staff.user) {
    const isActive = ["ACTIVE", "ON_LEAVE"].includes(status);
    await User.updateOne({ _id: staff.user._id || staff.user }, { $set: { isActive } });
  }

  const populated = await Staff.findOne(await commandStaffQuery({ _id: staff._id }, req.user))
    .populate("user", "fullName email phone role isActive lastLogin")
    .populate("shift", "name startTime endTime isActive");

  emitStaffStatusChanged(await serialize(populated));
  res.status(200).json(new ApiResponse(true, "Staff status updated", await serialize(populated)));
});

export const getStaffCommandCenter = asyncHandler(async (req, res) => {
  const staffFilter = await commandStaffQuery({ status: "ACTIVE" }, req.user);
  const staff = await Staff.find(staffFilter).populate("user", "fullName email phone role isActive").sort({ firstName: 1, lastName: 1 }).lean();
  const ids = staff.map((item) => item._id);
  const restaurantFilter = await commandStaffQuery({}, req.user);
  const [tables, orders, kots, deliveries, activity, availableTables, availableOrders, availableKots, availableDeliveries] = await Promise.all([
    ids.length ? Table.find({ ...restaurantFilter, assignedStaff: { $in: ids } }).select("tableNumber floor section status assignedStaff").lean() : [],
    ids.length ? Order.find({ ...restaurantFilter, assignedWaiter: { $in: ids }, isArchived: { $ne: true }, status: { $in: ACTIVE_ORDER_STATUSES } }).select("orderNumber status table assignedWaiter createdAt").populate("table", "tableNumber").lean() : [],
    ids.length ? KotTicket.find({ ...restaurantFilter, assignedChef: { $in: ids }, status: { $in: ACTIVE_KOT_STATUSES } }).select("orderNumber status assignedChef items createdAt").lean() : [],
    Delivery.find({ status: { $in: ACTIVE_DELIVERY_STATUSES } }).select("order rider status assignedAt").populate({ path: "order", match: restaurantFilter, select: "orderNumber restaurant" }).lean(),
    Log.find({ "context.targetType": "Staff", "context.restaurantId": restaurantFilter.restaurant || undefined, "context.metadata.outletId": restaurantFilter.outlet || undefined }).sort({ createdAt: -1 }).limit(50).lean(),
    Table.find({ ...restaurantFilter, assignedStaff: null, status: { $ne: "MAINTENANCE" } }).select("tableNumber floor section status").sort({ tableNumber: 1 }).limit(100).lean(),
    Order.find({ ...restaurantFilter, assignedWaiter: null, isArchived: { $ne: true }, status: { $in: ACTIVE_ORDER_STATUSES } }).select("orderNumber status orderType").sort({ createdAt: -1 }).limit(100).lean(),
    KotTicket.find({ ...restaurantFilter, assignedChef: null, status: { $in: ACTIVE_KOT_STATUSES } }).select("orderNumber status").sort({ createdAt: -1 }).limit(100).lean(),
    Order.find({ ...restaurantFilter, orderType: "DELIVERY", status: { $in: ["READY", "OUT_FOR_DELIVERY"] } }).select("orderNumber status").sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const tableMap = new Map(); const orderMap = new Map(); const kotMap = new Map(); const deliveryMap = new Map();
  tables.forEach((table) => { const key = String(table.assignedStaff); tableMap.set(key, [...(tableMap.get(key) || []), table]); });
  orders.forEach((order) => { const key = String(order.assignedWaiter); orderMap.set(key, [...(orderMap.get(key) || []), order]); });
  kots.forEach((kot) => { const key = String(kot.assignedChef); kotMap.set(key, [...(kotMap.get(key) || []), kot]); });
  deliveries.filter((delivery) => delivery.order).forEach((delivery) => { const key = String(delivery.rider?._id || delivery.rider); deliveryMap.set(key, [...(deliveryMap.get(key) || []), delivery]); });
  const members = staff.map((member) => {
    const key = String(member._id); const deliveriesForStaff = deliveryMap.get(String(member.user?._id || member.user)) || [];
    const waiterOrders = orderMap.get(key) || []; const chefKots = kotMap.get(key) || [];
    const workload = waiterOrders.length + chefKots.length + deliveriesForStaff.length;
    return { ...member, assignedTables: tableMap.get(key) || [], activeOrders: waiterOrders, activeKots: chefKots, activeDeliveries: deliveriesForStaff, workload, liveStatus: member.dutyStatus === "ON_DUTY" && workload ? "BUSY" : member.dutyStatus };
  });
  res.json(new ApiResponse(true, "Staff command center fetched", { members, activity, available: { tables: availableTables, orders: availableOrders, kots: availableKots, deliveries: availableDeliveries } }));
});

export const updateDutyStatus = asyncHandler(async (req, res) => {
  const staff = await getCommandStaff(req.params.id, req.user);
  const isSelf = String(staff.user?._id || staff.user || "") === String(req.user._id);
  if (!canManageCommandCenter(req.user) && !isSelf) throw new ApiError(403, "You can only update your own duty status");
  if (staff.status !== "ACTIVE") throw new ApiError(409, "Inactive staff cannot be put on duty");
  const action = String(req.body.action || "").toUpperCase(); const now = new Date();
  if (action === "START_SHIFT") { if (staff.dutyStatus !== "OFF_DUTY") throw new ApiError(409, "Shift is already active"); staff.dutyStatus = "ON_DUTY"; staff.shiftStartedAt = now; staff.breakStartedAt = null; }
  else if (action === "END_SHIFT") { if (staff.dutyStatus === "OFF_DUTY") throw new ApiError(409, "Staff member is already off duty"); if (staff.breakStartedAt) staff.totalBreakMinutes += Math.max(0, Math.round((now - staff.breakStartedAt) / 60000)); staff.dutyStatus = "OFF_DUTY"; staff.breakStartedAt = null; }
  else if (action === "START_BREAK") { if (!["ON_DUTY", "BUSY"].includes(staff.dutyStatus)) throw new ApiError(409, "Staff member must be on duty before starting a break"); staff.dutyStatus = "ON_BREAK"; staff.breakStartedAt = now; }
  else if (action === "END_BREAK") { if (staff.dutyStatus !== "ON_BREAK" || !staff.breakStartedAt) throw new ApiError(409, "No active break to end"); staff.totalBreakMinutes += Math.max(0, Math.round((now - staff.breakStartedAt) / 60000)); staff.breakStartedAt = null; staff.dutyStatus = "ON_DUTY"; }
  else throw new ApiError(422, "Invalid duty action");
  staff.lastDutyActivityAt = now; await staff.save(); await addDutyActivity({ staff, action: action.replaceAll("_", " "), actor: req.user });
  const result = await Staff.findOne(await commandStaffQuery({ _id: staff._id }, req.user)).populate("user", "fullName email phone role isActive"); emitStaffUpdated(await serialize(result));
  res.json(new ApiResponse(true, "Staff duty status updated", await serialize(result)));
});

export const assignStaffWork = asyncHandler(async (req, res) => {
  if (!canManageCommandCenter(req.user)) throw new ApiError(403, "Only admins and managers can assign work");
  const type = String(req.body.type || "").toUpperCase(); const staff = await getCommandStaff(req.body.staffId, req.user);
  if (staff.status !== "ACTIVE" || !["ON_DUTY", "BUSY"].includes(staff.dutyStatus)) throw new ApiError(409, "Staff member must be on duty before receiving an assignment");
  const scoped = await commandStaffQuery({ _id: req.body.entityId }, req.user);
  let target; let message;
  if (type === "TABLE") { if (staff.role !== "WAITER") throw new ApiError(422, "Tables can only be assigned to waiters"); target = await Table.findOne(scoped); if (!target) throw new ApiError(404, "Table not found"); target.assignedStaff = staff._id; await target.save(); message = "Table assigned"; }
  else if (type === "ORDER") { if (staff.role !== "WAITER") throw new ApiError(422, "Orders can only be assigned to waiters"); target = await Order.findOne({ ...scoped, isArchived: { $ne: true }, status: { $in: ACTIVE_ORDER_STATUSES } }); if (!target) throw new ApiError(404, "Active order not found"); target.assignedWaiter = staff._id; await target.save(); message = "Order assigned"; }
  else if (type === "KOT") { if (staff.role !== "CHEF") throw new ApiError(422, "KOT tickets can only be assigned to chefs"); target = await KotTicket.findOne({ ...scoped, status: { $in: ACTIVE_KOT_STATUSES } }); if (!target) throw new ApiError(404, "Active KOT ticket not found"); target.assignedChef = staff._id; await target.save(); message = "KOT assigned"; }
  else if (type === "DELIVERY") { if (staff.role !== "DELIVERY" || !staff.user) throw new ApiError(422, "Delivery staff need a linked login account"); const order = await Order.findOne({ ...scoped, orderType: "DELIVERY", status: { $in: ["READY", "OUT_FOR_DELIVERY"] } }); if (!order) throw new ApiError(404, "Ready delivery order not found"); target = await Delivery.findOneAndUpdate({ order: order._id }, { $set: { rider: staff.user, status: "assigned", assignedAt: new Date() } }, { new: true, upsert: true, runValidators: true }); message = "Delivery assigned"; }
  else throw new ApiError(422, "Invalid assignment type");
  await addDutyActivity({ staff, action: message, actor: req.user });
  res.json(new ApiResponse(true, message, target));
});

export const deleteStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Forbidden");

  const staff = await Staff.findOne(await commandStaffQuery({ _id: req.params.id }, req.user));
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
