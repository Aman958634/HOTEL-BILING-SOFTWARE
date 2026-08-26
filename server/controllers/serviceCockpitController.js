import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import Payment from "../models/Payment.js";
import {
  buildLiveBoardOrderFilter,
  normalizeOrderForBoard,
  ORDER_STATUSES,
  safeNormalizeOrderStatus,
} from "../services/orderService.js";

// Kitchen / KOT stages are derived from real order statuses (no separate KOT
// collection exists in this project) so the cockpit never invents data.
const KITCHEN_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

// Configurable wait-time thresholds (minutes). Surfaced to the UI so both
// backend and frontend agree on what "delayed" means.
const DELAY_THRESHOLDS = { warning: 15, delayed: 30, critical: 45 };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const countByStatus = (orders) => {
  const counts = {};
  Object.values(ORDER_STATUSES).forEach((s) => {
    counts[s] = 0;
  });
  orders.forEach((o) => {
    const key = safeNormalizeOrderStatus(o.status);
    if (key in counts) counts[key] += 1;
  });
  return counts;
};

export const getOverview = asyncHandler(async (req, res) => {
  const base = await buildRestaurantQuery({}, req.user);

  // ---- Tables summary (counts only; full list comes from the tables API) ----
  const tableRows = await Table.aggregate([
    { $match: base },
    { $group: { _id: { $toUpper: "$status" }, count: { $sum: 1 } } },
  ]);
  const tableSummary = { total: 0, AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 };
  tableRows.forEach((row) => {
    const key = row._id || "AVAILABLE";
    tableSummary[key] = (tableSummary[key] || 0) + row.count;
    tableSummary.total += row.count;
  });

  // ---- Orders for the board ----
  const orderFilter = await buildRestaurantQuery(buildLiveBoardOrderFilter(), req.user);
  const orderDocs = await Order.find(orderFilter)
    .sort({ createdAt: -1 })
    .limit(160)
    .populate("table", "tableNumber floor section")
    .populate("customer", "fullName phone")
    .populate("items.menuItem", "name")
    .lean();

  const orders = orderDocs.map(normalizeOrderForBoard);

  const orderSummary = {
    total: orders.length,
    active: orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length,
    byStatus: countByStatus(orders),
  };

  // ---- Kitchen / KOT (derived from orders) ----
  const kitchenOrders = orders.filter((o) => KITCHEN_STATUSES.includes(o.status));
  const now = Date.now();
  const waitMinutes = (o) => Math.max(0, Math.round((now - new Date(o.createdAt).getTime()) / 60000));
  const delayedOrders = kitchenOrders.filter((o) => waitMinutes(o) >= DELAY_THRESHOLDS.delayed);

  const kitchen = {
    newKot: kitchenOrders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length,
    preparingKot: kitchenOrders.filter((o) => o.status === "PREPARING").length,
    readyKot: kitchenOrders.filter((o) => o.status === "READY").length,
    completedKot: orders.filter((o) => o.status === "SERVED" || o.status === "COMPLETED").length,
    delayedKot: delayedOrders.length,
    items: kitchenOrders
      .map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        table: o.table?.tableNumber || null,
        status: o.status,
        createdAt: o.createdAt,
        waitMinutes: waitMinutes(o),
        items: (o.items || []).map((it) => ({
          name: it.name || it.menuItem?.name || "Item",
          quantity: it.quantity || 1,
        })),
      }))
      .sort((a, b) => b.waitMinutes - a.waitMinutes),
  };

  // ---- Revenue / billing (real payment data only) ----
  const todayStart = startOfToday();
  const paidTodayAgg = await Payment.aggregate([
    { $match: { ...base, paymentStatus: "PAID", createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const paidToday = paidTodayAgg[0] || { total: 0, count: 0 };

  const unpaidAgg = await Order.aggregate([
    { $match: { ...base, isArchived: false, paymentStatus: { $ne: "PAID" }, status: { $ne: "CANCELLED" } } },
    { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  const unpaid = unpaidAgg[0] || { total: 0, count: 0 };

  const pendingPayments = await Order.countDocuments({
    ...base,
    isArchived: false,
    paymentStatus: "PENDING",
    status: { $ne: "CANCELLED" },
  });

  const revenue = {
    todaySales: paidToday.total || 0,
    paidBills: paidToday.count || 0,
    unpaidBills: unpaid.count || 0,
    unpaidAmount: unpaid.total || 0,
    pendingPayments: pendingPayments || 0,
  };

  // ---- Activity feed (real recent events) ----
  const recentOrders = orders.slice(0, 14).map((o) => ({
    id: `order-${o._id}`,
    type: "order",
    text: `Order #${o.orderNumber} · ${o.status}`,
    table: o.table?.tableNumber || null,
    time: o.updatedAt || o.createdAt,
  }));

  const recentPayments = await Payment.find({ ...base, paymentStatus: "PAID" })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("orderId", "orderNumber")
    .lean();
  const paymentActivity = recentPayments.map((p) => ({
    id: `pay-${p._id}`,
    type: "payment",
    text: `Payment received · Order #${p.orderId?.orderNumber || "?"}`,
    table: null,
    time: p.createdAt,
  }));

  const activity = [...recentOrders, ...paymentActivity]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 22);

  res.status(200).json(
    new ApiResponse(true, "Service cockpit overview", {
      generatedAt: new Date().toISOString(),
      config: { delayThresholds: DELAY_THRESHOLDS },
      tablesSummary: tableSummary,
      orders: { summary: orderSummary, items: orders },
      kitchen,
      revenue,
      activity,
    })
  );
});
