import Order from "../models/Order.js";
import Food from "../models/Food.js";
import Reservation from "../models/Reservation.js";
import Table from "../models/Table.js";
import Inventory from "../models/Inventory.js";
import Subscription from "../models/Subscription.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { calculateGrowth } from "../utils/growthUtils.js";
import { notifySubscriptionExpiring } from "../services/notificationService.js";
import { getDaysRemaining } from "../utils/subscriptionUtils.js";
import { getCollectedRevenueSeries, getFinancialMetrics, resolveFinancialRange } from "../services/financialMetricsService.js";

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
  const operationalScope = await buildOutletQuery({}, req.user, { allowAll: true });
  const todayRange = await resolveFinancialRange({ scope: operationalScope, range: "today" });
  const yesterdayRange = { ...todayRange, start: todayRange.previousStart, end: todayRange.previousEnd };

  const [
    totalMetrics,
    todayMetrics,
    yesterdayMetrics,
    activeReservations,
    availableTables,
    lowStockItems,
    totalMenuItems,
  ] = await Promise.all([
    getFinancialMetrics({ scope: operationalScope }),
    getFinancialMetrics({ scope: operationalScope, range: todayRange }),
    getFinancialMetrics({ scope: operationalScope, range: yesterdayRange }),
    Reservation.countDocuments({ ...operationalScope, status: { $in: ["pending", "confirmed"] } }),
    Table.countDocuments({ ...operationalScope, status: { $in: ["AVAILABLE", "available"] } }),
    Inventory.countDocuments({ ...operationalScope, $expr: { $lte: ["$quantity", "$reorderLevel"] } }),
    Food.countDocuments({ ...(req.user?.restaurant ? { restaurant: req.user.restaurant } : {}) }),
  ]);

  if (req.user?.restaurant) {
    const sub = await Subscription.findOne({ restaurant: req.user.restaurant }).sort({ createdAt: -1 });
    if (sub) {
      const daysRemaining = getDaysRemaining(sub, new Date());
      if (daysRemaining <= 0) {
        await notifySubscriptionExpiring({
          restaurantId: req.user.restaurant,
          subscriptionId: sub._id,
          daysRemaining: 0,
          isExpired: true,
        }).catch(() => {});
      } else if ([7, 3, 1].includes(daysRemaining)) {
        await notifySubscriptionExpiring({
          restaurantId: req.user.restaurant,
          subscriptionId: sub._id,
          daysRemaining,
        }).catch(() => {});
      }
    }
  }

  const cards = {
    totalRevenue: {
      label: "Total Revenue",
      value: totalMetrics.revenue,
      trend: calculateGrowth(todayMetrics.revenue, yesterdayMetrics.revenue),
    },
    todayRevenue: {
      label: "Today's Revenue",
      value: todayMetrics.revenue,
      trend: calculateGrowth(todayMetrics.revenue, yesterdayMetrics.revenue),
    },
    totalOrders: {
      label: "Total Orders",
      value: totalMetrics.orders,
      trend: calculateGrowth(todayMetrics.orders, yesterdayMetrics.orders),
    },
    todayOrders: {
      label: "Today's Orders",
      value: todayMetrics.orders,
      trend: calculateGrowth(todayMetrics.orders, yesterdayMetrics.orders),
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
  const scope = await buildOutletQuery({}, req.user, { allowAll: true });
  const range = await resolveFinancialRange({ scope, range: req.query.range || "7d" });
  const rows = await getCollectedRevenueSeries({ scope, range });
  const data = rows.map((row) => ({ _id: row.label, revenue: row.revenue, orders: row.payments }));

  res.status(200).json(new ApiResponse(true, "Sales overview fetched", data));
});

export const recentOrders = asyncHandler(async (req, res) => {
  const orderMatch = await buildOutletQuery({ isArchived: { $ne: true } }, req.user, { allowAll: true });

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
