import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Food from "../models/Food.js";
import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import Inventory from "../models/Inventory.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { calculateGrowth } from "../utils/growthUtils.js";

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const PAID_PAYMENT_STATUSES = ["PAID", "PARTIALLY_REFUNDED"];

const netRevenueExpr = {
  $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] },
};

const sumNetRevenue = async (match) => {
  const [result] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, total: netRevenueExpr } },
  ]);
  return Number(result?.total || 0);
};

const normalizeStatus = (status) => {
  const map = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PREPARING: "Preparing",
    READY: "Ready",
    SERVED: "Served",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    placed: "Pending",
    accepted: "Confirmed",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    delivered: "Completed",
    cancelled: "Cancelled",
    out_for_delivery: "Confirmed",
  };
  return map[status] || status;
};

export const dashboardStats = asyncHandler(async (req, res) => {
  const todayStart = startOfDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const baseOrderMatch = await buildRestaurantQuery({ isArchived: { $ne: true } }, req.user);
  const paidPaymentMatch = await buildRestaurantQuery(
    { paymentStatus: { $in: PAID_PAYMENT_STATUSES } },
    req.user
  );

  const [
    totalRevenue,
    todayRevenue,
    yesterdayRevenue,
    totalOrders,
    todayOrders,
    yesterdayOrders,
    activeReservations,
    availableTables,
    lowStockItems,
    totalMenuItems,
  ] = await Promise.all([
    sumNetRevenue(paidPaymentMatch),
    sumNetRevenue({ ...paidPaymentMatch, createdAt: { $gte: todayStart } }),
    sumNetRevenue({ ...paidPaymentMatch, createdAt: { $gte: yesterdayStart, $lt: todayStart } }),
    Order.countDocuments(baseOrderMatch),
    Order.countDocuments({ ...baseOrderMatch, createdAt: { $gte: todayStart } }),
    Order.countDocuments({ ...baseOrderMatch, createdAt: { $gte: yesterdayStart, $lt: todayStart } }),
    Reservation.countDocuments({ status: { $in: ["pending", "confirmed"] } }),
    Table.countDocuments({ status: { $in: ["AVAILABLE", "available"] } }),
    Inventory.countDocuments({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }),
    Food.countDocuments(),
  ]);

  const cards = {
    totalRevenue: {
      label: "Total Revenue",
      value: totalRevenue,
      trend: calculateGrowth(todayRevenue, yesterdayRevenue),
    },
    todayRevenue: {
      label: "Today's Revenue",
      value: todayRevenue,
      trend: calculateGrowth(todayRevenue, yesterdayRevenue),
    },
    totalOrders: {
      label: "Total Orders",
      value: totalOrders,
      trend: calculateGrowth(todayOrders, yesterdayOrders),
    },
    todayOrders: {
      label: "Today's Orders",
      value: todayOrders,
      trend: calculateGrowth(todayOrders, yesterdayOrders),
    },
    activeReservations: {
      label: "Active Reservations",
      value: activeReservations,
      trend: { value: null, label: "—", type: "neutral" },
    },
    availableTables: {
      label: "Available Tables",
      value: availableTables,
      trend: { value: null, label: "—", type: "neutral" },
    },
    lowStockItems: {
      label: "Low Stock Items",
      value: lowStockItems,
      trend: { value: null, label: "—", type: "neutral" },
    },
    totalMenuItems: {
      label: "Total Menu Items",
      value: totalMenuItems,
      trend: { value: null, label: "—", type: "neutral" },
    },
  };

  res.status(200).json(new ApiResponse(true, "Admin stats fetched", cards));
});

export const salesOverview = asyncHandler(async (req, res) => {
  const range = req.query.range || "7d";
  const now = new Date();
  let startDate = new Date(now);
  let groupFormat = "%Y-%m-%d";

  if (range === "today") {
    startDate = startOfDay(now);
    groupFormat = "%Y-%m-%d %H:00";
  } else if (range === "7d") {
    startDate.setDate(now.getDate() - 6);
  } else if (range === "30d") {
    startDate.setDate(now.getDate() - 29);
  } else if (range === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    groupFormat = "%Y-%m";
  }

  const paymentMatch = await buildRestaurantQuery(
    {
      createdAt: { $gte: startDate },
      paymentStatus: { $in: PAID_PAYMENT_STATUSES },
    },
    req.user
  );

  const data = await Payment.aggregate([
    { $match: paymentMatch },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
        revenue: netRevenueExpr,
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json(new ApiResponse(true, "Sales overview fetched", data));
});

export const recentOrders = asyncHandler(async (req, res) => {
  const orderMatch = await buildRestaurantQuery({ isArchived: { $ne: true } }, req.user);

  const orders = await Order.find(orderMatch)
    .populate("customer", "fullName email")
    .populate("items.menuItem", "name")
    .sort({ createdAt: -1 })
    .limit(12);

  const data = orders.map((order) => ({
    _id: order._id,
    orderNumber: order.orderNumber,
    customer: order.customer?.fullName || "Guest",
    items: order.items.map((item) => item.menuItem?.name || item.name || "Item").join(", "),
    amount: order.total,
    payment: order.paymentStatus,
    rawStatus: order.status,
    status: normalizeStatus(order.status),
    date: order.createdAt,
  }));

  res.status(200).json(new ApiResponse(true, "Recent orders fetched", data));
});
