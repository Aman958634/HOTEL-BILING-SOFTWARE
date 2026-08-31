import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import CashReconciliation from "../models/CashReconciliation.js";
import KotTicket from "../models/KotTicket.js";
import Inventory from "../models/Inventory.js";
import StockMovement from "../models/StockMovement.js";
import Staff from "../models/Staff.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import { calculateGrowth } from "../utils/growthUtils.js";
import { resolveBusinessRange } from "../utils/businessDateRange.js";
import { buildValidCollectedPaymentStages, COLLECTED_PAYMENT_STATUSES, getSettledOrderCount } from "./financialMetricsService.js";

export { resolveBusinessRange } from "../utils/businessDateRange.js";

export const BI_METRIC_DEFINITIONS = Object.freeze({
  grossSales: { formula: "Sum of completed, non-cancelled order subtotals", source: ["Order.subtotal"], dateField: "Order.createdAt", excludes: ["CANCELLED", "REJECTED"] },
  netSales: { formula: "Sum of completed, non-cancelled order totals after stored discounts and charges, before refunds", source: ["Order.total"], dateField: "Order.createdAt", excludes: ["CANCELLED", "REJECTED"] },
  netCollected: { formula: "Successful payment amount minus stored refunded amount", source: ["Payment.amount", "Payment.refundAmount"], dateField: "Payment.paidAt or createdAt", excludes: ["PENDING", "PROCESSING", "FAILED"] },
  averageOrderValue: { formula: "Net sales / qualifying completed orders", source: ["Order.total"], dateField: "Order.createdAt", excludes: ["CANCELLED", "REJECTED"] },
});

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value) => Number((finite(value)).toFixed(2));
const sum = (rows, key) => rows.reduce((total, row) => total + finite(typeof key === "function" ? key(row) : row[key]), 0);

const format = (granularity) => granularity === "hour" ? "%Y-%m-%d %H:00" : granularity === "week" ? "%G-W%V" : granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
const metricComparison = (current, previous) => ({ current: round(current), previous: round(previous), difference: round(current - previous), growth: calculateGrowth(current, previous) });

const netPaymentAmount = {
  $max: [
    {
      $subtract: [
        { $ifNull: ["$amount", "$totalAmount"] },
        { $ifNull: ["$refundAmount", 0] },
      ],
    },
    0,
  ],
};

const settledOrderMatch = (scope) => ({
  ...scope,
  isArchived: { $ne: true },
  status: { $nin: ["CANCELLED", "REJECTED"] },
});

const salesForRange = async (scope, range) => {
  const match = { ...settledOrderMatch(scope), createdAt: { $gte: range.start, $lt: range.end } };
  const [summaryRows, sourceRows, trendRows, hourRows, weekdayRows] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: null, orders: { $sum: 1 }, grossSales: { $sum: "$subtotal" }, netSales: { $sum: "$total" }, discounts: { $sum: "$discount" }, loyaltyRedemptions: { $sum: "$loyaltyDiscount" } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: { $ifNull: ["$orderSource", "$orderType"] }, orders: { $sum: 1 }, sales: { $sum: "$total" } } }, { $sort: { sales: -1 } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: format(range.granularity), date: "$createdAt", timezone: range.timeZone } }, sales: { $sum: "$total" }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: { $hour: { date: "$createdAt", timezone: range.timeZone } }, orders: { $sum: 1 }, sales: { $sum: "$total" } } }, { $sort: { orders: -1, sales: -1 } }, { $limit: 8 }]),
    Order.aggregate([{ $match: match }, { $group: { _id: { $dayOfWeek: { date: "$createdAt", timezone: range.timeZone } }, orders: { $sum: 1 }, sales: { $sum: "$total" } } }, { $sort: { _id: 1 } }]),
  ]);
  const summary = summaryRows[0] || {}; return { orders: finite(summary.orders), grossSales: finite(summary.grossSales), netSales: finite(summary.netSales), discounts: finite(summary.discounts), loyaltyRedemptions: finite(summary.loyaltyRedemptions), sources: sourceRows.map((row) => ({ source: row._id || "UNKNOWN", orders: finite(row.orders), sales: round(row.sales) })), trend: trendRows.map((row) => ({ label: row._id, sales: round(row.sales), orders: finite(row.orders), aov: row.orders ? round(row.sales / row.orders) : 0 })), peakHours: hourRows.map((row) => ({ hour: row._id, orders: finite(row.orders), sales: round(row.sales) })), weekdays: weekdayRows.map((row) => ({ day: row._id, orders: finite(row.orders), sales: round(row.sales) })) };
};

const paymentsForRange = async (scope, range) => {
  const paymentIds = await Payment.distinct("_id", scope);
  const staffIds = scope.outlet ? await Staff.distinct("_id", scope) : [];
  const refundScope = paymentIds.length ? { payment: { $in: paymentIds } } : { _id: null };
  const cashScope = scope.outlet ? { restaurant: scope.restaurant, staff: { $in: staffIds } } : scope;
  const [totals, methods, refundRows, reconciliationRows] = await Promise.all([
    Promise.all([Payment.aggregate([...buildValidCollectedPaymentStages(scope, range), { $group: { _id: null, received: { $sum: netPaymentAmount }, transactions: { $sum: 1 } } }]), Payment.aggregate([{ $match: { ...scope, refundAmount: { $gt: 0 }, refundedAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: null, refunded: { $sum: "$refundAmount" } } }])]),
    Payment.aggregate([...buildValidCollectedPaymentStages(scope, range), { $group: { _id: "$paymentMethod", amount: { $sum: netPaymentAmount }, transactions: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Payment.aggregate([{ $match: { ...scope, refundAmount: { $gt: 0 }, refundedAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: "$refundStatus", amount: { $sum: "$refundAmount" }, count: { $sum: 1 } } }]),
    Promise.all([Payment.countDocuments({ ...scope, reconciliationStatus: { $in: ["UNRECONCILED", "MISMATCHED", "UNDERPAID", "OVERPAID"] } }), CashReconciliation.aggregate([{ $match: { ...cashScope, closedAt: { $gte: range.start, $lt: range.end }, status: "MISMATCHED" } }, { $group: { _id: null, variance: { $sum: "$difference" }, count: { $sum: 1 } } }]), Refund.countDocuments({ ...refundScope, status: "PENDING" })]),
  ]);
  const paymentRows = totals[0]?.[0] || {}; const refundTotal = totals[1]?.[0] || {}; const received = finite(paymentRows.received); const refunded = finite(refundTotal.refunded); return { netCollected: round(received - refunded), received: round(received), refunds: round(refunded), transactions: finite(paymentRows.transactions), paymentMix: methods.map((item) => ({ method: item._id || "OTHER", amount: round(item.amount), transactions: finite(item.transactions), percentage: received ? round(finite(item.amount) * 100 / received) : 0 })), refundBreakdown: refundRows.map((item) => ({ status: item._id || "UNKNOWN", amount: round(item.amount), count: finite(item.count) })), reconciliation: { unreconciledPayments: reconciliationRows[0], cashVariance: round(reconciliationRows[1][0]?.variance), cashMismatchCount: finite(reconciliationRows[1][0]?.count), pendingRefunds: reconciliationRows[2] } };
};

const menuForRange = async (scope, range) => {
  const match = { ...settledOrderMatch(scope), createdAt: { $gte: range.start, $lt: range.end } };
  const base = [{ $match: match }, { $unwind: "$items" }, { $lookup: { from: "foods", localField: "items.menuItem", foreignField: "_id", as: "food" } }, { $unwind: { path: "$food", preserveNullAndEmptyArrays: true } }, { $lookup: { from: "categories", localField: "food.category", foreignField: "_id", as: "category" } }, { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }];
  const [rows, categoryRows] = await Promise.all([Order.aggregate([...base, { $group: { _id: { name: "$items.name", category: { $ifNull: ["$category.name", "Uncategorized"] } }, quantity: { $sum: "$items.quantity" }, sales: { $sum: "$items.subtotal" }, orderIds: { $addToSet: "$_id" } } }, { $project: { _id: 0, item: "$_id.name", category: "$_id.category", quantity: 1, sales: 1, orderCount: { $size: "$orderIds" } } }, { $sort: { quantity: -1, sales: -1 } }, { $limit: 15 }]), Order.aggregate([...base, { $group: { _id: { $ifNull: ["$category.name", "Uncategorized"] }, quantity: { $sum: "$items.quantity" }, sales: { $sum: "$items.subtotal" } } }, { $sort: { sales: -1 } }])]);
  const totalSales = sum(categoryRows, "sales"); return { topItems: rows.map((row, index) => ({ rank: index + 1, item: row.item || "Menu item", category: row.category, quantity: finite(row.quantity), sales: round(row.sales), orderCount: finite(row.orderCount) })), categories: categoryRows.map((row) => ({ category: row._id, quantity: finite(row.quantity), sales: round(row.sales), percentage: totalSales ? round(finite(row.sales) * 100 / totalSales) : 0 })) };
};

const customersForRange = async (scope, range) => {
  const match = { ...settledOrderMatch(scope), createdAt: { $gte: range.start, $lt: range.end }, customer: { $ne: null } };
  const [customers, firstOrders] = await Promise.all([Order.aggregate([{ $match: match }, { $group: { _id: "$customer", orders: { $sum: 1 }, spend: { $sum: "$total" } } }]), Order.aggregate([{ $match: { ...settledOrderMatch(scope), customer: { $ne: null } } }, { $group: { _id: "$customer", firstOrderAt: { $min: "$createdAt" } } }])]);
  const first = new Map(firstOrders.map((row) => [String(row._id), row.firstOrderAt])); const newCustomers = customers.filter((row) => { const date = first.get(String(row._id)); return date >= range.start && date < range.end; }).length; const returning = customers.length - newCustomers; const repeat = customers.filter((row) => finite(row.orders) > 1).length; return { identifiedCustomers: customers.length, newCustomers, returningCustomers: returning, repeatRate: customers.length ? round(repeat * 100 / customers.length) : 0, averageCustomerSpend: customers.length ? round(sum(customers, "spend") / customers.length) : 0 };
};

const operationsForRange = async (scope, range) => {
  const match = { ...settledOrderMatch(scope), createdAt: { $gte: range.start, $lt: range.end } }; const [tables, kots, staff, inventory, movements] = await Promise.all([
    Order.aggregate([{ $match: { ...match, table: { $ne: null } } }, { $group: { _id: "$table", orders: { $sum: 1 }, sales: { $sum: "$total" } } }, { $sort: { sales: -1 } }, { $limit: 8 }]),
    KotTicket.aggregate([{ $match: { ...scope, createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...match, assignedWaiter: { $ne: null } } }, { $group: { _id: "$assignedWaiter", orders: { $sum: 1 }, sales: { $sum: "$total" } } }, { $sort: { orders: -1 } }, { $limit: 10 }]),
    Inventory.aggregate([{ $match: { ...scope, isActive: true } }, { $group: { _id: null, stockValue: { $sum: { $multiply: ["$quantity", "$costPerUnit"] } }, lowStock: { $sum: { $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0] } } } }]),
    StockMovement.aggregate([{ $match: { ...scope, movementType: "WASTAGE", createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: null, quantity: { $sum: "$quantity" }, count: { $sum: 1 } } }]),
  ]); const stock = inventory[0] || {}; const waste = movements[0] || {}; return { tables: tables.map((row) => ({ tableId: row._id, orders: finite(row.orders), sales: round(row.sales), averageOrderValue: row.orders ? round(row.sales / row.orders) : 0 })), kitchen: { ticketsByStatus: kots.map((row) => ({ status: row._id || "NEW", count: finite(row.count) })), preparationTimeAvailable: false, note: "KOT tickets do not retain preparation-start and ready timestamps." }, staff: { waiterWorkloads: staff.map((row) => ({ staffId: row._id, orders: finite(row.orders), sales: round(row.sales) })) }, inventory: { currentStockValue: round(stock.stockValue), lowStockCount: finite(stock.lowStock), wasteMovements: finite(waste.count), wasteQuantity: finite(waste.quantity), foodCostAvailable: false, note: "Historical recipe-cost snapshots are not stored, so food cost is not presented as actual COGS." } };
};

export const getBusinessIntelligenceOverview = async ({ restaurantId, scope = null, query }) => {
  const authorizedScope = scope || { restaurant: restaurantId };
  if (!authorizedScope.restaurant) throw new ApiError(403, "A restaurant scope is required for business intelligence");
  const resolvedRestaurantId = authorizedScope.restaurant;
  const restaurant = await Restaurant.findById(resolvedRestaurantId).select("timeZone").lean(); const timeZone = restaurant?.timeZone || "Asia/Kolkata"; const currentRange = resolveBusinessRange({ ...query, timeZone }); const previousRange = { ...currentRange, start: currentRange.previousStart, end: currentRange.previousEnd };
  const [sales, payments, menu, customers, operations, previousSales, previousPayments] = await Promise.all([salesForRange(authorizedScope, currentRange), paymentsForRange(authorizedScope, currentRange), menuForRange(authorizedScope, currentRange), customersForRange(authorizedScope, currentRange), operationsForRange(authorizedScope, currentRange), salesForRange(authorizedScope, previousRange), paymentsForRange(authorizedScope, previousRange)]);
  return { period: { range: currentRange.range, start: currentRange.start, end: currentRange.end, days: currentRange.days, timeZone }, definitions: BI_METRIC_DEFINITIONS, overview: { grossSales: metricComparison(sales.grossSales, previousSales.grossSales), netSales: metricComparison(sales.netSales, previousSales.netSales), netCollected: metricComparison(payments.netCollected, previousPayments.netCollected), orders: metricComparison(sales.orders, previousSales.orders), averageOrderValue: metricComparison(sales.orders ? sales.netSales / sales.orders : 0, previousSales.orders ? previousSales.netSales / previousSales.orders : 0), refunds: metricComparison(payments.refunds, previousPayments.refunds) }, sales, payments, menu, customers, operations };
};
