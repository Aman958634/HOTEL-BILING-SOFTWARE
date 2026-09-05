import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
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
import Restaurant from "../models/Restaurant.js";
import { resolveBusinessRange } from "../services/businessIntelligenceService.js";
import { getExternalOrderIntegrationStatus } from "../services/externalOrderAdapter.js";

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

const sumInvoiceSales = async (match) => {
  const [result] = await Invoice.aggregate([
    { $match: { ...match, status: { $ne: "VOID" } } },
    { $group: { _id: null, total: { $sum: "$netTotal" } } },
  ]);
  return Number(result?.total || 0);
};

// Legacy Invoice records predate outletId. Scope them through their immutable
// source order instead of treating restaurant-wide invoice totals as outlet data.
const invoiceOrderScope = async (user, filters = {}) => {
  const orderScope = await buildOutletQuery({}, user, { allowAll: true });
  const orderIds = await Order.distinct("_id", orderScope);
  return { ...filters, order: { $in: orderIds } };
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
  const restaurant = req.user?.restaurant ? await Restaurant.findById(req.user.restaurant).select("timeZone").lean() : null;
  const timeZone = restaurant?.timeZone || "Asia/Kolkata";
  const todayRange = resolveBusinessRange({ range: "today", timeZone });
  const yesterdayRange = resolveBusinessRange({ range: "yesterday", timeZone });

  const baseOrderMatch = await buildOutletQuery({ isArchived: { $ne: true } }, req.user, { allowAll: true });
  const invoiceMatch = await invoiceOrderScope(req.user);
  const operationalScope = await buildOutletQuery({}, req.user, { allowAll: true });

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
    sumInvoiceSales(invoiceMatch),
    sumInvoiceSales({ ...invoiceMatch, issuedAt: { $gte: todayRange.start, $lt: todayRange.end } }),
    sumInvoiceSales({ ...invoiceMatch, issuedAt: { $gte: yesterdayRange.start, $lt: yesterdayRange.end } }),
    // Revenue is invoice-based; paid-order count is intentionally order-based.
    Order.countDocuments({ ...baseOrderMatch, status: { $ne: "CANCELLED" }, paymentStatus: "PAID" }),
    Order.countDocuments({ ...baseOrderMatch, status: { $ne: "CANCELLED" }, paymentStatus: "PAID", paidAt: { $gte: todayRange.start, $lt: todayRange.end } }),
    Order.countDocuments({ ...baseOrderMatch, status: { $ne: "CANCELLED" }, paymentStatus: "PAID", paidAt: { $gte: yesterdayRange.start, $lt: yesterdayRange.end } }),
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
  const restaurant = req.user?.restaurant ? await Restaurant.findById(req.user.restaurant).select("timeZone").lean() : null;
  const timeZone = restaurant?.timeZone || "Asia/Kolkata";
  const rangeMap = { today: "today", "7d": "last_7_days", "30d": "last_30_days", year: "this_year" };
  const resolved = resolveBusinessRange({ range: rangeMap[range] || "last_7_days", timeZone });
  const groupFormat = resolved.granularity === "hour" ? "%Y-%m-%d %H:00" : resolved.granularity === "month" ? "%Y-%m" : "%Y-%m-%d";

  const invoiceMatch = await invoiceOrderScope(req.user,
    {
      issuedAt: { $gte: resolved.start, $lt: resolved.end },
      status: { $ne: "VOID" },
    }
  );

  const data = await Invoice.aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$issuedAt", timezone: timeZone } },
        revenue: { $sum: "$netTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

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

export const integrationStatus = asyncHandler(async (_req, res) => {
  const configured = (...names) => names.every((name) => {
    const value = String(process.env[name] || "").trim();
    return value && !/^(false|your_|replace_with)/i.test(value);
  });
  res.status(200).json(new ApiResponse(true, "Integration status fetched", {
    integrations: [
      {
        id: "external-order-adapter",
        name: "External order adapter",
        category: "Ordering",
        status: getExternalOrderIntegrationStatus().status,
        scope: "Server-side provider boundary",
        detail: "Provider credentials and webhook specification are required before external orders can be accepted.",
      },
      {
        id: "razorpay",
        name: "Razorpay",
        category: "Payments",
        status: configured("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET") ? "Configured" : "Unavailable",
        scope: "Platform payment account",
        detail: "Order and subscription checkout with server-side signature verification.",
      },
      {
        id: "stripe",
        name: "Stripe",
        category: "Payments",
        status: configured("STRIPE_SECRET_KEY") ? "Configured" : "Unavailable",
        scope: "Platform payment account",
        detail: process.env.STRIPE_SECRET_KEY ? "Payment intents are available; client settlement requires a provider webhook." : "Stripe credentials are not configured.",
      },
      {
        id: "email",
        name: "SMTP email",
        category: "Communication",
        status: configured("EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS") ? "Configured" : "Unavailable",
        scope: "Server configuration",
        detail: "Server-side email transport is configured where credentials are present.",
      },
      {
        id: "cloudinary",
        name: "Cloudinary",
        category: "Media",
        status: configured("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET") ? "Configured" : "Unavailable",
        scope: "Server configuration",
        detail: "Cloudinary configuration is available to server media workflows.",
      },
      {
        id: "qr-ordering",
        name: "QR ordering",
        category: "Ordering",
        status: configured("PUBLIC_MENU_CONTEXT_SECRET") || process.env.NODE_ENV !== "production" ? "Configured" : "Unavailable",
        scope: "Restaurant and outlet table context",
        detail: "Signed table context routes to the authorized public menu and ordering flow.",
      },
      {
        id: "socket-io",
        name: "Socket.IO",
        category: "Infrastructure",
        status: "Configured",
        scope: "Authenticated restaurant and outlet rooms",
        detail: "Real-time order, payment, kitchen, and notification events.",
      },
      {
        id: "online-orders",
        name: "Online orders",
        category: "Ordering",
        status: "Configured",
        scope: "Internal order sources",
        detail: "Internal online, delivery, pickup, and QR order sources are supported.",
      },
    ],
    unsupported: ["External aggregator ingestion", "WhatsApp API ordering", "Google Maps", "External menu sync"],
  }));
});
