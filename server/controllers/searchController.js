import mongoose from "mongoose";
import Order from "../models/Order.js";
import Food from "../models/Food.js";
import Category from "../models/Category.js";
import Staff from "../models/Staff.js";
import Table from "../models/Table.js";
import Payment from "../models/Payment.js";
import Reservation from "../models/Reservation.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LIMIT_PER_CATEGORY = 5;

const searchOrders = async (regex, restaurantFilter) => {
  const customerMatches = await User.find({
    $or: [{ fullName: regex }, { phone: regex }],
  })
    .select("_id")
    .lean();

  const orderFilter = {
    ...restaurantFilter,
    $or: [
      { orderNumber: regex },
      ...(customerMatches.length ? [{ customer: { $in: customerMatches.map((c) => c._id) } }] : []),
    ],
  };

  const orders = await Order.find(orderFilter)
    .populate("customer", "fullName phone")
    .sort({ createdAt: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return orders.map((o) => ({
    id: o._id,
    orderNumber: o.orderNumber,
    customerName: o.customer?.fullName || "Guest",
    customerPhone: o.customer?.phone || "",
    total: o.total,
    status: o.status,
  }));
};

const searchMenuItems = async (regex, restaurantFilter) => {
  const items = await Food.find({
    ...restaurantFilter,
    name: regex,
  })
    .populate("category", "name")
    .sort({ createdAt: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return items.map((f) => ({
    id: f._id,
    name: f.name,
    price: f.price,
    categoryName: f.category?.name || "",
  }));
};

const searchCategories = async (regex) => {
  const categories = await Category.find({ name: regex })
    .sort({ createdAt: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return categories.map((c) => ({
    id: c._id,
    name: c.name,
  }));
};

const searchStaff = async (regex, restaurantFilter) => {
  const staffFilter = {
    ...restaurantFilter,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phone: regex },
      { employeeId: regex },
    ],
  };

  const staff = await Staff.find(staffFilter)
    .populate("user", "fullName email phone")
    .sort({ createdAt: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return staff.map((s) => ({
    id: s._id,
    fullName: `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.user?.fullName || "",
    role: s.role,
    email: s.email || s.user?.email || "",
    phone: s.phone || s.user?.phone || "",
    employeeId: s.employeeId,
  }));
};

const searchTables = async (regex, restaurantFilter) => {
  const tables = await Table.find({
    ...restaurantFilter,
    tableNumber: regex,
  })
    .sort({ tableNumber: 1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return tables.map((t) => ({
    id: t._id,
    tableNumber: t.tableNumber,
    status: t.status,
  }));
};

const searchPayments = async (regex, restaurantFilter) => {
  const orderMatches = await Order.find({ orderNumber: regex })
    .select("_id")
    .lean();

  const customerMatches = await User.find({ fullName: regex })
    .select("_id")
    .lean();

  const paymentFilter = {
    ...restaurantFilter,
    $or: [
      { paymentId: regex },
      { transactionId: regex },
      ...(orderMatches.length ? [{ orderId: { $in: orderMatches.map((o) => o._id) } }] : []),
      ...(customerMatches.length ? [{ customerId: { $in: customerMatches.map((c) => c._id) } }] : []),
    ],
  };

  const payments = await Payment.find(paymentFilter)
    .sort({ createdAt: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return payments.map((p) => ({
    id: p._id,
    paymentId: p.paymentId,
    amount: p.totalAmount ?? p.amount,
    paymentMethod: p.paymentMethod,
    paymentStatus: p.paymentStatus,
    orderId: p.orderId,
    customerId: p.customerId,
  }));
};

const searchReservations = async (regex, restaurantFilter) => {
  const [customerMatches, tableMatches] = await Promise.all([
    User.find({ fullName: regex }).select("_id").lean(),
    Table.find({ tableNumber: regex }).select("_id").lean(),
  ]);

  const reservationFilter = {
    ...restaurantFilter,
    $or: [
      ...(customerMatches.length ? [{ customer: { $in: customerMatches.map((c) => c._id) } }] : []),
      ...(tableMatches.length ? [{ table: { $in: tableMatches.map((t) => t._id) } }] : []),
    ],
  };

  const reservations = await Reservation.find(reservationFilter)
    .populate("customer", "fullName phone")
    .populate("table", "tableNumber")
    .sort({ date: -1 })
    .limit(LIMIT_PER_CATEGORY)
    .lean();

  return reservations.map((r) => ({
    id: r._id,
    customerName: r.customer?.fullName || "Guest",
    customerPhone: r.customer?.phone || "",
    tableNumber: r.table?.tableNumber || "",
    date: r.date,
    status: r.status,
  }));
};

const searchSubscriptions = async (regex, restaurantFilter) => {
  const subFilter = { ...restaurantFilter, planName: regex };

  const subs = await Subscription.find(subFilter)
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  return subs.map((s) => ({
    id: s._id,
    planName: s.planName,
    status: s.status,
    price: s.price,
    billingCycle: s.billingCycle,
  }));
};

export const search = asyncHandler(async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    return res.status(200).json(new ApiResponse(true, "Search results", {
      orders: [],
      menuItems: [],
      categories: [],
      staff: [],
      tables: [],
      payments: [],
      reservations: [],
      subscriptions: [],
    }));
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const restaurantFilter = await buildRestaurantQuery({}, req.user);

  const [
    orders,
    menuItems,
    categories,
    staff,
    tables,
    payments,
    reservations,
    subscriptions,
  ] = await Promise.all([
    searchOrders(regex, restaurantFilter),
    searchMenuItems(regex, restaurantFilter),
    searchCategories(regex),
    searchStaff(regex, restaurantFilter),
    searchTables(regex, restaurantFilter),
    searchPayments(regex, restaurantFilter),
    searchReservations(regex, restaurantFilter),
    searchSubscriptions(regex, restaurantFilter),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Search results", {
      orders,
      menuItems,
      categories,
      staff,
      tables,
      payments,
      reservations,
      subscriptions,
    })
  );
});
