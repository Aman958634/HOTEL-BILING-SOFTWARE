import mongoose from "mongoose";
import SaasPayment from "../models/SaasPayment.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildSaasPaymentReceiptBuffer } from "../utils/saasPaymentPdf.js";

const PLAN_DISPLAY = {
  basic: "Basic",
  professional: "Pro",
  pro: "Pro",
  enterprise: "Premium",
  premium: "Premium",
};

const PLAN_FILTER_KEYS = {
  basic: ["basic"],
  pro: ["professional", "pro"],
  premium: ["enterprise", "premium"],
  professional: ["professional", "pro"],
  enterprise: ["enterprise", "premium"],
};

const STATUS_UI_TO_DB = {
  success: "paid",
  paid: "paid",
  pending: "pending",
  failed: "failed",
  refunded: "refunded",
  cancelled: "cancelled",
};

const STATUS_DB_TO_UI = {
  paid: "SUCCESS",
  pending: "PENDING",
  failed: "FAILED",
  refunded: "REFUNDED",
  cancelled: "CANCELLED",
};

const METHOD_NORMALIZE = {
  card: "Card",
  credit_card: "Card",
  debit_card: "Card",
  upi: "UPI",
  netbanking: "Netbanking",
  net_banking: "Netbanking",
  wallet: "Wallet",
  razorpay: "Razorpay",
  test: "Test",
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const formatPlanLabel = (planName) => {
  const key = String(planName || "").toLowerCase();
  return PLAN_DISPLAY[key] || (planName ? String(planName) : "—");
};

export const formatMethodLabel = (method, gateway) => {
  if (method) {
    const key = String(method).toLowerCase().replace(/\s+/g, "_");
    return METHOD_NORMALIZE[key] || String(method).charAt(0).toUpperCase() + String(method).slice(1);
  }
  if (gateway === "test") return "Test";
  if (gateway === "razorpay") return "Razorpay";
  return "—";
};

const startOfUtcDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const buildDateFilter = ({ dateRange, from, to }) => {
  const range = String(dateRange || "").toLowerCase();
  const now = new Date();

  if (range === "today") {
    return { $gte: startOfUtcDay(now) };
  }
  if (range === "7d" || range === "last7" || range === "last_7_days") {
    return { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (range === "30d" || range === "last30" || range === "last_30_days") {
    return { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (range === "custom" || from || to) {
    const filter = {};
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) throw new ApiError(400, "Invalid from date");
      filter.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) throw new ApiError(400, "Invalid to date");
      toDate.setUTCHours(23, 59, 59, 999);
      filter.$lte = toDate;
    }
    return Object.keys(filter).length ? filter : null;
  }
  return null;
};

const buildPaymentFilter = async (query) => {
  const {
    q,
    status,
    plan,
    method,
    dateRange,
    from,
    to,
  } = query;

  const filter = {};

  if (status && String(status).toLowerCase() !== "all") {
    const mapped = STATUS_UI_TO_DB[String(status).toLowerCase()];
    if (!mapped) throw new ApiError(400, "Invalid status filter");
    filter.status = mapped;
  }

  if (plan && String(plan).toLowerCase() !== "all") {
    const keys = PLAN_FILTER_KEYS[String(plan).toLowerCase()];
    if (!keys) throw new ApiError(400, "Invalid plan filter");
    filter.planName = { $in: keys };
  }

  if (method && String(method).toLowerCase() !== "all") {
    const m = String(method).toLowerCase();
    const allowed = ["card", "upi", "netbanking", "wallet"];
    if (!allowed.includes(m)) throw new ApiError(400, "Invalid payment method filter");
    if (m === "card") {
      filter.paymentMethod = /card/i;
    } else if (m === "netbanking") {
      filter.paymentMethod = /net.?banking/i;
    } else {
      filter.paymentMethod = new RegExp(`^${escapeRegex(m)}$`, "i");
    }
  }

  const createdAt = buildDateFilter({ dateRange, from, to });
  if (createdAt) filter.createdAt = createdAt;

  if (q && String(q).trim()) {
    const term = String(q).trim();
    const pattern = new RegExp(escapeRegex(term), "i");
    const or = [
      { gatewayPaymentId: pattern },
      { gatewayOrderId: pattern },
      { planName: pattern },
      { paymentMethod: pattern },
    ];

    if (mongoose.isValidObjectId(term)) {
      or.push({ _id: term });
      or.push({ subscription: term });
      or.push({ restaurant: term });
    }

    // Restaurant name search via populate-friendly pre-query
    const restaurants = await Restaurant.find({ name: pattern }).select("_id").lean();
    if (restaurants.length) {
      or.push({ restaurant: { $in: restaurants.map((r) => r._id) } });
    }

    const users = await User.find({
      $or: [{ fullName: pattern }, { email: pattern }],
      role: { $in: ["admin", "hotel_admin", "restaurant_admin"] },
    })
      .select("restaurant")
      .lean();
    const userRestaurantIds = users.map((u) => u.restaurant).filter(Boolean);
    if (userRestaurantIds.length) {
      or.push({ restaurant: { $in: userRestaurantIds } });
    }

    filter.$or = or;
  }

  return filter;
};

const loadCustomerMap = async (payments) => {
  const restaurantIds = [
    ...new Set(
      payments
        .map((p) => {
          const r = p.restaurant;
          return String(r?._id || r || "");
        })
        .filter(Boolean)
    ),
  ];
  if (!restaurantIds.length) return new Map();

  const admins = await User.find({
    restaurant: { $in: restaurantIds },
    role: { $in: ["admin", "hotel_admin", "restaurant_admin", "manager"] },
  })
    .select("fullName email phone restaurant role")
    .lean();

  const map = new Map();
  for (const admin of admins) {
    const key = String(admin.restaurant);
    if (!map.has(key)) {
      map.set(key, {
        id: admin._id,
        name: admin.fullName || "—",
        email: admin.email || "",
        phone: admin.phone || "",
      });
    }
  }

  // Fallback: match restaurant email to a user, or use restaurant contact fields
  for (const payment of payments) {
    const restaurant = payment.restaurant && typeof payment.restaurant === "object" ? payment.restaurant : null;
    const key = String(restaurant?._id || payment.restaurant || "");
    if (!key || map.has(key)) continue;

    if (restaurant?.email) {
      const byEmail = await User.findOne({ email: restaurant.email })
        .select("fullName email phone")
        .lean();
      if (byEmail) {
        map.set(key, {
          id: byEmail._id,
          name: byEmail.fullName || restaurant.email,
          email: byEmail.email || restaurant.email,
          phone: byEmail.phone || restaurant.phone || "",
        });
        continue;
      }
      map.set(key, {
        id: null,
        name: restaurant.email,
        email: restaurant.email,
        phone: restaurant.phone || "",
      });
      continue;
    }

    if (restaurant?.name) {
      map.set(key, {
        id: null,
        name: restaurant.name,
        email: "",
        phone: restaurant.phone || "",
      });
    }
  }

  return map;
};

/** Safe payment view — never exposes secrets, card numbers, or CVV. */
export const toSaasPaymentView = (payment, customer = null) => {
  if (!payment) return null;
  const plain = typeof payment.toObject === "function" ? payment.toObject() : { ...payment };
  const restaurant = plain.restaurant && typeof plain.restaurant === "object" ? plain.restaurant : null;
  const restaurantId = restaurant?._id || plain.restaurant || null;
  const statusKey = String(plain.status || "").toLowerCase();

  // Strip any accidental sensitive metadata keys
  const safeMeta = { ...(plain.metadata || {}) };
  delete safeMeta.razorpaySecret;
  delete safeMeta.keySecret;
  delete safeMeta.cardNumber;
  delete safeMeta.cvv;
  delete safeMeta.signature;

  return {
    id: plain._id,
    _id: plain._id,
    paymentId: plain.gatewayPaymentId || (statusKey === "paid" ? String(plain._id) : "—"),
    razorpayPaymentId: plain.gatewayPaymentId || null,
    razorpayOrderId: plain.gatewayOrderId || null,
    restaurantId,
    restaurantName: restaurant?.name || "—",
    restaurant: restaurant ? { _id: restaurant._id, name: restaurant.name } : null,
    customer: customer
      ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone }
      : null,
    customerName: customer?.name || "—",
    plan: formatPlanLabel(plain.planName),
    planKey: plain.planName,
    planId: plain.planId || null,
    amount: plain.amount,
    currency: plain.currency || "INR",
    paymentMethod: formatMethodLabel(plain.paymentMethod, plain.gateway),
    paymentMethodRaw: plain.paymentMethod || null,
    status: STATUS_DB_TO_UI[statusKey] || String(plain.status || "").toUpperCase(),
    statusRaw: plain.status,
    gateway: plain.gateway || "razorpay",
    billingCycle: plain.billingCycle || "monthly",
    subscriptionId: plain.subscription || null,
    paidAt: plain.paidAt || (statusKey === "paid" ? plain.updatedAt : null),
    paymentDate: plain.paidAt || plain.createdAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    metadata: {
      testMode: Boolean(safeMeta.testMode),
      mode: safeMeta.mode || null,
      cancelledReason: safeMeta.cancelledReason || null,
    },
  };
};

export const listSaasPayments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = await buildPaymentFilter(req.query);

  const [items, total, summaryRows] = await Promise.all([
    SaasPayment.find(filter)
      .populate("restaurant", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SaasPayment.countDocuments(filter),
    SaasPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const customerMap = await loadCustomerMap(items);

  const views = items.map((p) => {
    const rid = String(p.restaurant?._id || p.restaurant || "");
    return toSaasPaymentView(p, customerMap.get(rid) || null);
  });

  const summary = {
    totalPayments: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    refundedPayments: 0,
    cancelledPayments: 0,
    totalRevenue: 0,
  };

  for (const row of summaryRows) {
    summary.totalPayments += row.count;
    summary.totalRevenue += row.revenue || 0;
    if (row._id === "paid") summary.successfulPayments = row.count;
    else if (row._id === "pending") summary.pendingPayments = row.count;
    else if (row._id === "failed") summary.failedPayments = row.count;
    else if (row._id === "refunded") summary.refundedPayments = row.count;
    else if (row._id === "cancelled") summary.cancelledPayments = row.count;
  }

  // Global summary (unfiltered) for top cards when no filters — still respect current filter set
  // so cards stay consistent with the table. User asked for actual DB records; filtered summary is correct UX.

  res.status(200).json(
    new ApiResponse(true, "Payments fetched", {
      items: views,
      summary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  );
});

export const getSaasPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid payment id");

  const payment = await SaasPayment.findById(id).populate("restaurant", "name email phone");
  if (!payment) throw new ApiError(404, "Payment not found");

  const customerMap = await loadCustomerMap([payment]);
  const rid = String(payment.restaurant?._id || payment.restaurant || "");
  const view = toSaasPaymentView(payment, customerMap.get(rid) || null);

  res.status(200).json(new ApiResponse(true, "Payment fetched", view));
});

export const downloadSaasPaymentPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid payment id");

  const payment = await SaasPayment.findById(id).populate("restaurant", "name email phone");
  if (!payment) throw new ApiError(404, "Payment not found");

  const customerMap = await loadCustomerMap([payment]);
  const rid = String(payment.restaurant?._id || payment.restaurant || "");
  const view = toSaasPaymentView(payment, customerMap.get(rid) || null);

  const buffer = await buildSaasPaymentReceiptBuffer(view);
  const paymentId = view.razorpayPaymentId || view.paymentId || String(view.id);
  const safeName = String(paymentId).replace(/[^a-zA-Z0-9_-]/g, "_");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="RestoSphere-Payment-${safeName}.pdf"`);
  res.setHeader("Content-Length", buffer.length);
  res.status(200).send(buffer);
});

export const deleteSaasPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid payment id");

  const payment = await SaasPayment.findById(id).populate("restaurant", "name email phone");
  if (!payment) throw new ApiError(404, "Payment not found");

  const customerMap = await loadCustomerMap([payment]);
  const rid = String(payment.restaurant?._id || payment.restaurant || "");
  const view = toSaasPaymentView(payment, customerMap.get(rid) || null);

  await SaasPayment.deleteOne({ _id: payment._id });

  res.status(200).json(new ApiResponse(true, "Payment deleted successfully", { deleted: view }));
});

export const getSaasPaymentSummary = asyncHandler(async (_req, res) => {
  const rows = await SaasPayment.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  const summary = {
    totalPayments: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    refundedPayments: 0,
    cancelledPayments: 0,
    totalRevenue: 0,
  };

  for (const row of rows) {
    summary.totalPayments += row.count;
    summary.totalRevenue += row.revenue || 0;
    if (row._id === "paid") summary.successfulPayments = row.count;
    else if (row._id === "pending") summary.pendingPayments = row.count;
    else if (row._id === "failed") summary.failedPayments = row.count;
    else if (row._id === "refunded") summary.refundedPayments = row.count;
    else if (row._id === "cancelled") summary.cancelledPayments = row.count;
  }

  res.status(200).json(new ApiResponse(true, "Payment summary fetched", summary));
});

export default {
  listSaasPayments,
  getSaasPaymentById,
  getSaasPaymentSummary,
  downloadSaasPaymentPdf,
  deleteSaasPayment,
};
