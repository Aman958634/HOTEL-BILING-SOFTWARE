import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import { resolveBusinessRange } from "../utils/businessDateRange.js";

// Revenue is financial, rather than order/invoice, data. A split settlement
// therefore contributes each verified payment once, while refunds reduce only
// the payment that was actually refunded.
export const COLLECTED_PAYMENT_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
const INVALID_ORDER_STATUSES = ["CANCELLED", "REJECTED"];

const paymentDateMatch = (range) =>
  !range
    ? {}
    : {
        $or: [
          { paidAt: { $gte: range.start, $lt: range.end } },
          { paidAt: null, createdAt: { $gte: range.start, $lt: range.end } },
        ],
      };

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

const validOrderMatch = (scope) => ({
  ...scope,
  isArchived: { $ne: true },
  status: { $nin: INVALID_ORDER_STATUSES },
});

export const buildCollectedPaymentMatch = (scope, range = null) => ({
  ...scope,
  paymentStatus: { $in: COLLECTED_PAYMENT_STATUSES },
  ...paymentDateMatch(range),
});

export const buildValidCollectedPaymentStages = (scope, range = null) => [
  { $match: buildCollectedPaymentMatch(scope, range) },
  {
    $lookup: {
      from: Order.collection.name,
      let: { orderId: "$orderId" },
      pipeline: [
        {
          $match: {
            ...validOrderMatch(scope),
            $expr: { $eq: ["$_id", "$$orderId"] },
          },
        },
        { $limit: 1 },
      ],
      as: "sourceOrder",
    },
  },
  {
    $lookup: {
      from: Bill.collection.name,
      let: { billId: "$bill" },
      pipeline: [
        {
          $match: {
            ...scope,
            status: { $nin: ["CANCELLED", "REFUNDED"] },
            $expr: { $eq: ["$_id", "$$billId"] },
          },
        },
        { $limit: 1 },
      ],
      as: "sourceBill",
    },
  },
  {
    $match: {
      $or: [
        { $and: [{ orderId: { $ne: null } }, { "sourceOrder.0": { $exists: true } }] },
        { $and: [{ bill: { $ne: null } }, { "sourceBill.0": { $exists: true } }] },
      ],
    },
  },
];

const getScopeRestaurantId = (scope) => {
  const restaurantId = scope?.restaurant;
  if (!restaurantId || Array.isArray(restaurantId?.$in) || restaurantId?.$in) {
    throw new ApiError(403, "A single authorized restaurant context is required for financial metrics");
  }
  return restaurantId;
};

export const resolveFinancialRange = async ({ scope, range, startDate, endDate } = {}) => {
  const restaurantId = getScopeRestaurantId(scope);
  const restaurant = await Restaurant.findById(restaurantId).select("timeZone").lean();
  const aliases = {
    "7d": "last_7_days",
    "30d": "last_30_days",
    year: "this_year",
  };
  const resolvedRange = aliases[String(range || "this_month").toLowerCase()] || String(range || "this_month").toLowerCase();
  return resolveBusinessRange({ range: resolvedRange, startDate, endDate, timeZone: restaurant?.timeZone || "Asia/Kolkata" });
};

export const getCollectedRevenue = async ({ scope, range = null }) => {
  const [row] = await Payment.aggregate([
    ...buildValidCollectedPaymentStages(scope, range),
    { $group: { _id: null, revenue: { $sum: netPaymentAmount }, payments: { $sum: 1 } } },
  ]);
  return { revenue: Number(row?.revenue || 0), payments: Number(row?.payments || 0) };
};

/**
 * Counts an order once after it has been fully settled. Direct orders require
 * their verified payment and order PAID state. Consolidated-bill orders are
 * matched through the settled bill's immutable allocations, without unwinding
 * either payments or allocations, so split payments/items cannot duplicate an
 * order count.
 */
export const getSettledOrderCount = async ({ scope, range = null }) => {
  const directPaymentLookup = {
    $lookup: {
      from: Payment.collection.name,
      let: { orderId: "$_id" },
      pipeline: [
        {
          $match: {
            ...scope,
            paymentStatus: { $in: COLLECTED_PAYMENT_STATUSES },
            $expr: {
              $and: [
                { $eq: ["$orderId", "$$orderId"] },
                { $gt: [netPaymentAmount, 0] },
              ],
            },
          },
        },
        { $limit: 1 },
      ],
      as: "verifiedOrderPayments",
    },
  };

  const directOrderSettlement = {
    $and: [
      { paymentStatus: "PAID" },
      ...(range ? [{ paidAt: { $gte: range.start, $lt: range.end } }] : []),
      { "verifiedOrderPayments.0": { $exists: true } },
    ],
  };

  const billMatch = {
    ...scope,
    status: "PAID",
    ...(range ? { settledAt: { $gte: range.start, $lt: range.end } } : {}),
    $expr: { $in: ["$$orderId", "$allocations.order"] },
  };
  const settledBillLookup = {
    $lookup: {
      from: Bill.collection.name,
      let: { orderId: "$_id" },
      pipeline: [{ $match: billMatch }, { $limit: 1 }],
      as: "settledBills",
    },
  };

  const [row] = await Order.aggregate([
    { $match: validOrderMatch(scope) },
    directPaymentLookup,
    settledBillLookup,
    { $match: { $or: [directOrderSettlement, { "settledBills.0": { $exists: true } }] } },
    { $count: "orders" },
  ]);
  return Number(row?.orders || 0);
};

export const getCollectedRevenueSeries = async ({ scope, range }) => {
  const format = range.granularity === "hour" ? "%Y-%m-%d %H:00" : range.granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
  const rows = await Payment.aggregate([
    ...buildValidCollectedPaymentStages(scope, range),
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: { $ifNull: ["$paidAt", "$createdAt"] },
            timezone: range.timeZone,
          },
        },
        revenue: { $sum: netPaymentAmount },
        payments: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({
    label: row._id,
    revenue: Number(row.revenue || 0),
    payments: Number(row.payments || 0),
  }));
};

export const getFinancialMetrics = async ({ scope, range = null }) => {
  const [{ revenue, payments }, orders] = await Promise.all([
    getCollectedRevenue({ scope, range }),
    getSettledOrderCount({ scope, range }),
  ]);
  return { revenue, orders, payments };
};
