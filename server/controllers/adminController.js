import Order from "../models/Order.js";
import Food from "../models/Food.js";
import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import Inventory from "../models/Inventory.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const growthPercent = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
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

export const dashboardStats = asyncHandler(async (_req, res) => {
  const todayStart = startOfDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [
    totalRevenueAgg,
    todayRevenueAgg,
    yesterdayRevenueAgg,
    totalOrders,
    todayOrders,
    yesterdayOrders,
    activeReservations,
    availableTables,
    lowStockItems,
    totalMenuItems,
  ] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: { $in: ["PAID", "paid"] }, isArchived: { $ne: true } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ["PAID", "paid"] }, createdAt: { $gte: todayStart }, isArchived: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ["PAID", "paid"] }, createdAt: { $gte: yesterdayStart, $lt: todayStart }, isArchived: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments({ isArchived: { $ne: true } }),
    Order.countDocuments({ createdAt: { $gte: todayStart }, isArchived: { $ne: true } }),
    Order.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart }, isArchived: { $ne: true } }),
    Reservation.countDocuments({ status: { $in: ["pending", "confirmed"] } }),
    Table.countDocuments({ status: { $in: ["AVAILABLE", "available"] } }),
    Inventory.countDocuments({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }),
    Food.countDocuments(),
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;
  const todayRevenue = todayRevenueAgg[0]?.total || 0;
  const yesterdayRevenue = yesterdayRevenueAgg[0]?.total || 0;

  const cards = {
    totalRevenue: {
      label: "Total Revenue",
      value: totalRevenue,
      trend: growthPercent(todayRevenue, yesterdayRevenue),
    },
    todayRevenue: {
      label: "Today's Revenue",
      value: todayRevenue,
      trend: growthPercent(todayRevenue, yesterdayRevenue),
    },
    totalOrders: {
      label: "Total Orders",
      value: totalOrders,
      trend: growthPercent(todayOrders, yesterdayOrders),
    },
    todayOrders: {
      label: "Today's Orders",
      value: todayOrders,
      trend: growthPercent(todayOrders, yesterdayOrders),
    },
    activeReservations: {
      label: "Active Reservations",
      value: activeReservations,
      trend: 0,
    },
    availableTables: {
      label: "Available Tables",
      value: availableTables,
      trend: 0,
    },
    lowStockItems: {
      label: "Low Stock Items",
      value: lowStockItems,
      trend: 0,
    },
    totalMenuItems: {
      label: "Total Menu Items",
      value: totalMenuItems,
      trend: 0,
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

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate }, paymentStatus: { $in: ["PAID", "PENDING", "paid", "pending"] }, isArchived: { $ne: true } } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json(new ApiResponse(true, "Sales overview fetched", data));
});

export const recentOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find()
    .populate("customer", "fullName email")
    .populate("items.menuItem", "name")
    .where({ isArchived: { $ne: true } })
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
