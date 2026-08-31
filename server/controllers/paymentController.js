import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Refund from "../models/Refund.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { buildOutletQuery as buildRestaurantQuery } from "../utils/tenantUtils.js";
import {
  buildPaymentCsv,
  formatCurrency,
  normalizePaymentMethod,
  normalizePaymentStatus,
  paymentMethodLabel,
  paymentStatusLabel,
  gatewayLabel,
} from "../utils/paymentUtils.js";
import { formatPaymentId, paymentIdLookupPattern } from "../utils/paymentId.js";
import {
  buildPaymentReceipt,
  recordVerifiedPayment,
  getRazorpayClient,
  getSuccessfulPaymentTotal,
  serializePayment,
  stripe,
  syncPaymentFromOrder,
  updateOrderPaymentState,
} from "../services/paymentService.js";
import { refundRecordedPayment } from "../services/reconciliationService.js";
import { buildBillReceiptBuffer } from "../services/billService.js";
import { notifyPaymentReceived } from "../services/notificationService.js";

const providerToMethod = {
  stripe: "OTHER",
  razorpay: "RAZORPAY",
  cash: "CASH",
  upi: "UPI",
  card: "CREDIT_CARD",
  credit_card: "CREDIT_CARD",
  debit_card: "DEBIT_CARD",
  wallet: "WALLET",
};

const normalizeGateway = (value) => String(value || "").trim().toLowerCase();

const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDateRange = (query) => {
  const now = new Date();
  const range = String(query.range || "").toLowerCase();

  if (!range && !query.startDate && !query.endDate) {
    return { start: new Date(0), end: now };
  }

  if (query.startDate || query.endDate) {
    return {
      start: query.startDate ? new Date(query.startDate) : new Date(0),
      end: query.endDate ? new Date(query.endDate) : now,
    };
  }

  if (range === "today") {
    const start = startOfDay(now);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  if (range === "yesterday") {
    const end = startOfDay(now);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  }

  if (range === "week" || range === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: startOfDay(start), end: now };
  }

  if (range === "month" || range === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: startOfDay(start), end: now };
  }

  if (range === "thismonth") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }

  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
};

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchMatch = (search) => {
  const query = String(search || "").trim();
  if (!query) return null;

  const regex = new RegExp(escapeRegex(query), "i");
  return {
    $or: [
      { paymentId: regex },
      { transactionId: regex },
      { "order.orderNumber": regex },
      { "customer.fullName": regex },
      { "customer.phone": regex },
      { "table.tableNumber": regex },
    ],
  };
};

const buildListPipeline = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const { start, end } = getDateRange(query);
  let baseMatch = {
    createdAt: { $gte: start, $lt: end },
  };

  baseMatch = await buildRestaurantQuery(baseMatch, user);

  const status = query.status || query.paymentStatus;
  if (status) baseMatch.paymentStatus = normalizePaymentStatus(status);
  if (query.method) baseMatch.paymentMethod = normalizePaymentMethod(query.method);
  if (query.paymentMethod) baseMatch.paymentMethod = normalizePaymentMethod(query.paymentMethod);

  const allowedSortFields = new Set(["createdAt", "paidAt", "amount", "totalAmount", "paymentStatus", "paymentMethod"]);
  const requestedSort = String(query.sortBy || "createdAt");
  const sortBy = allowedSortFields.has(requestedSort) ? requestedSort : "createdAt";
  const sortOrder = String(query.sortOrder || query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const pipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "tables",
        localField: "tableId",
        foreignField: "_id",
        as: "table",
      },
    },
    { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        orderNumber: { $ifNull: ["$order.orderNumber", ""] },
        customerName: { $ifNull: ["$customer.fullName", "Guest"] },
        customerPhone: { $ifNull: ["$customer.phone", ""] },
        tableNumber: { $ifNull: ["$table.tableNumber", ""] },
        netRevenue: { $subtract: ["$totalAmount", { $ifNull: ["$refundAmount", 0] }] },
      },
    },
  ];

  const searchMatch = buildSearchMatch(query.search);
  if (searchMatch) pipeline.push({ $match: searchMatch });

  pipeline.push(
    { $sort: sort },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    }
  );

  return { pipeline, page, limit };
};

const mapPaymentRow = (payment) => {
  const paymentObject = payment?.toObject ? payment.toObject() : payment;
  const safeTotalAmount = Number(paymentObject?.totalAmount ?? paymentObject?.amount ?? 0);
  const safeAmount = Number(paymentObject?.amount ?? paymentObject?.totalAmount ?? 0);
  return {
    ...paymentObject,
    paymentIdDisplay: formatPaymentId(paymentObject?.paymentId),
    amount: safeAmount,
    totalAmount: safeTotalAmount,
    amountLabel: formatCurrency(safeAmount),
    totalAmountLabel: formatCurrency(safeTotalAmount),
    refundAmountLabel: formatCurrency(paymentObject?.refundAmount || 0),
    paymentMethodLabel: paymentMethodLabel(paymentObject?.paymentMethod),
    paymentStatusLabel: paymentStatusLabel(paymentObject?.paymentStatus),
    gatewayLabel: gatewayLabel(paymentObject || {}),
    dateTimeLabel: paymentObject?.createdAt,
    orderIdValue: paymentObject?.orderNumber || paymentObject?.orderId?.orderNumber || paymentObject?.orderId,
    customerName: paymentObject?.customerName || paymentObject?.customerId?.fullName || "Guest",
    customerPhone: paymentObject?.customerPhone || paymentObject?.customerId?.phone || "",
    tableNumber: paymentObject?.tableNumber || paymentObject?.tableId?.tableNumber || "",
  };
};

const mapPaymentDetail = (payment) => {
  const paymentObject = payment.toObject ? payment.toObject() : payment;
  const order = paymentObject.orderId
    ? {
        _id: paymentObject.orderId._id || paymentObject.orderId,
        orderNumber: paymentObject.orderId.orderNumber || paymentObject.orderNumber || "",
        status: paymentObject.orderId.status || "",
        paymentStatus: paymentObject.orderId.paymentStatus || paymentObject.paymentStatus,
        paymentMethod: paymentObject.orderId.paymentMethod || paymentObject.paymentMethod,
        subtotal: paymentObject.orderId.subtotal ?? paymentObject.subtotal ?? 0,
        tax: paymentObject.orderId.tax ?? paymentObject.tax ?? 0,
        discount: paymentObject.orderId.discount ?? paymentObject.discount ?? 0,
        serviceCharge: paymentObject.orderId.serviceCharge ?? paymentObject.serviceCharge ?? 0,
        total: paymentObject.orderId.total ?? paymentObject.totalAmount ?? 0,
        items: paymentObject.orderId.items || [],
        createdAt: paymentObject.orderId.createdAt,
        updatedAt: paymentObject.orderId.updatedAt,
        customer: paymentObject.orderId.customer || paymentObject.customerId || null,
        table: paymentObject.orderId.table || paymentObject.tableId || null,
      }
    : null;

  return {
    ...mapPaymentRow(paymentObject),
    order,
    // Receipt previews need the persisted bill snapshot and the restaurant
    // identity, not a generic product label. Both are populated only after
    // the normal tenant/outlet-scoped payment lookup above.
    bill: paymentObject.bill || null,
    restaurant: paymentObject.restaurant || null,
    customer: paymentObject.customerId || null,
    table: paymentObject.tableId || null,
    refundAmount: paymentObject.refundAmount || 0,
    refundReason: paymentObject.refundReason || "",
    refundStatus: paymentObject.refundStatus || "",
    refundedAt: paymentObject.refundedAt || null,
    refundedBy: paymentObject.refundedBy || null,
    metadata: paymentObject.metadata || {},
    timeline: paymentObject.timeline || [],
  };
};

const getPaymentDoc = async (identifier, user) => {
  const paymentIdPattern = paymentIdLookupPattern(identifier);
  const query = mongoose.isValidObjectId(identifier)
    ? await buildRestaurantQuery({ _id: identifier }, user)
    : await buildRestaurantQuery({ paymentId: paymentIdPattern || String(identifier).trim().toUpperCase() }, user);

  return Payment.findOne(query)
    .populate("orderId")
    .populate("customerId", "fullName email phone avatar")
    .populate("tableId", "tableNumber floor section")
    .populate("refundedBy", "fullName email role")
    .populate("restaurant", "name address city state phone email gstNumber")
    .populate("bill", "billNumber subtotal discount loyaltyDiscount tax serviceCharge deliveryCharge total paidAmount balanceDue status allocations restaurant table");
};

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { orderId, provider, paymentMethod } = req.body;
  const order = await Order.findOne(await buildRestaurantQuery({ _id: orderId }, req.user))
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section");
  if (!order) throw new ApiError(404, "Order not found");

  const resolvedMethod = normalizePaymentMethod(paymentMethod || providerToMethod[provider] || provider || order.paymentMethod);
  if (normalizePaymentStatus(order.paymentStatus) === "PAID") {
    throw new ApiError(409, "Payment already completed.");
  }
  const successfulPaidAmount = await getSuccessfulPaymentTotal(order);
  const amountDue = Math.max(Number(order.total || 0) - successfulPaidAmount, 0);
  if (amountDue <= 0.01) throw new ApiError(409, "Payment already completed.");

  if (provider === "stripe") {
    if (!stripe) throw new ApiError(500, "Stripe not configured");
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountDue * 100),
      currency: "inr",
      metadata: { orderId: String(order._id) },
    });
    await syncPaymentFromOrder(order, {
      transactionId: intent.id,
      metadata: { provider: "stripe", gateway: "Stripe", paymentMethod: resolvedMethod, clientSecret: intent.client_secret, currency: "INR" },
      status: "PROCESSING",
      note: "Stripe intent created",
    });
    return res.status(200).json(new ApiResponse(true, "Stripe intent created", { clientSecret: intent.client_secret, keyId: process.env.STRIPE_PUBLISHABLE_KEY || "" }));
  }

  if (provider === "razorpay") {
    const razorpayClient = getRazorpayClient();
    if (!razorpayClient) {
      throw new ApiError(503, "Razorpay payment service is unavailable. Please try another method or contact support.");
    }

    logger.info(`Razorpay create-order requested for order=${order.orderNumber} amount=${order.total} method=${resolvedMethod}`);

    const razorOrder = await razorpayClient.orders.create({
      amount: Math.round(amountDue * 100),
      currency: "INR",
      receipt: String(order.orderNumber),
    });
    const payment = await syncPaymentFromOrder(order, {
      transactionId: razorOrder.id,
      metadata: { provider: "razorpay", gateway: "Razorpay", paymentMethod: resolvedMethod, razorpayOrderId: razorOrder.id, currency: "INR" },
      status: "PROCESSING",
      note: "Razorpay order created",
    });
    return res.status(200).json(
      new ApiResponse(true, "Razorpay order created", {
        keyId: process.env.RAZORPAY_KEY_ID || "",
        razorpayOrderId: razorOrder.id,
        amount: razorOrder.amount,
        currency: razorOrder.currency,
        paymentId: payment.paymentId,
        orderId: order.orderNumber,
      })
    );
  }

  if (resolvedMethod === "CASH") {
    throw new ApiError(422, "Cash payments do not require a gateway order");
  }

  const payment = await syncPaymentFromOrder(order, {
    transactionId: `PENDING-${Date.now()}`,
    metadata: { provider: provider || resolvedMethod.toLowerCase(), gateway: provider || resolvedMethod.toLowerCase(), paymentMethod: resolvedMethod, currency: "INR" },
    status: "PENDING",
    note: "Payment pending",
  });

  res.status(200).json(new ApiResponse(true, "Payment pending", serializePayment(payment)));
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, provider, paymentMethod, transactionId, status = "success", meta = {}, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const order = await Order.findOne(await buildRestaurantQuery({ _id: orderId }, req.user))
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section");
  if (!order) throw new ApiError(404, "Order not found");

  const nextStatus = normalizePaymentStatus(status === "success" ? "PAID" : status);
  const gateway = normalizeGateway(provider || meta.provider);
  let verifiedAmount = null;

  if (nextStatus === "PAID" && gateway !== "razorpay") {
    // Browser-supplied success values are never proof of payment. Other
    // gateways require their own authenticated webhook integration.
    throw new ApiError(422, "This payment provider cannot be settled from the client.");
  }

  if (gateway === "razorpay") {
    logger.info(`Razorpay verify requested for orderId=${orderId} razorpayOrderId=${razorpay_order_id || ""} razorpayPaymentId=${razorpay_payment_id || ""}`);

    const pendingPayment = await Payment.findOne({
      orderId: order._id,
      restaurant: order.restaurant || null,
      outlet: order.outlet || null,
    })
      .select("razorpayOrderId transactionId metadata paymentStatus amount totalAmount")
      .lean();
    const expectedOrderId = pendingPayment?.razorpayOrderId || pendingPayment?.metadata?.razorpayOrderId || "";
    if (!expectedOrderId || String(expectedOrderId) !== String(razorpay_order_id || "")) {
      throw new ApiError(422, "Payment verification failed");
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!razorpay_payment_id || !razorpay_signature || generatedSignature !== razorpay_signature) {
      throw new ApiError(422, "Payment verification failed");
    }

    // A valid HMAC proves the callback was signed, but the server still
    // verifies the provider-side order, amount, currency and captured state
    // before any local financial record is marked paid.
    const razorpayClient = getRazorpayClient();
    if (!razorpayClient) throw new ApiError(503, "Razorpay payment service is unavailable");
    const gatewayPayment = await razorpayClient.payments.fetch(razorpay_payment_id);
    if (
      String(gatewayPayment?.order_id || "") !== String(expectedOrderId) ||
      String(gatewayPayment?.status || "").toLowerCase() !== "captured" ||
      String(gatewayPayment?.currency || "").toUpperCase() !== "INR" ||
      Number(gatewayPayment?.amount || 0) !== Math.round(Number(pendingPayment.amount || pendingPayment.totalAmount || 0) * 100)
    ) {
      throw new ApiError(422, "Payment verification failed");
    }
    verifiedAmount = Number(gatewayPayment.amount) / 100;
  }

  const settlement =
    nextStatus === "PAID"
      ? await recordVerifiedPayment(order, {
          amount: verifiedAmount ?? req.body.amount,
          paymentMethod: paymentMethod || meta.paymentMethod || order.paymentMethod,
          gateway: provider || meta.provider || "Razorpay",
          transactionId: transactionId || razorpay_payment_id || meta.transactionId || "",
          razorpayOrderId: razorpay_order_id || meta.razorpayOrderId || "",
          razorpayPaymentId: razorpay_payment_id || meta.razorpayPaymentId || "",
          idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey || "",
          paidAt: new Date(),
          note: "Payment verified successfully",
          receivedBy: req.user._id,
        })
      : await syncPaymentFromOrder(order, {
          transactionId: transactionId || razorpay_payment_id || meta.transactionId || "",
          metadata: {
            ...meta,
            paymentMethod: paymentMethod || meta.paymentMethod || order.paymentMethod,
            provider: provider || meta.provider || "other",
            gateway: provider || meta.provider || "other",
            razorpayOrderId: razorpay_order_id || meta.razorpayOrderId || "",
            razorpayPaymentId: razorpay_payment_id || meta.razorpayPaymentId || "",
            currency: meta.currency || "INR",
          },
          status: nextStatus,
          note: nextStatus === "PAID" ? "Payment verified successfully" : "Payment verification failed",
        });
  const payment = nextStatus === "PAID" ? settlement.payment : settlement;

  if (nextStatus !== "PAID") {
    await updateOrderPaymentState(order, {
      paymentMethod: paymentMethod || meta.paymentMethod || order.paymentMethod,
      paymentStatus: nextStatus,
      gateway: provider || meta.provider || "Razorpay",
      transactionId: transactionId || razorpay_payment_id || meta.transactionId || "",
      razorpayOrderId: razorpay_order_id || meta.razorpayOrderId || "",
      razorpayPaymentId: razorpay_payment_id || meta.razorpayPaymentId || "",
      note: "Payment verification failed",
    });
  }

  if (nextStatus === "PAID") {
    await notifyPaymentReceived({
      restaurantId: order.restaurant,
      outletId: order.outlet || null,
      paymentId: payment._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: payment.totalAmount || payment.amount || order.total,
      paymentMethod: paymentMethod || meta.paymentMethod || order.paymentMethod || "Unknown",
      actorUserId: req.user?._id,
    }).catch(() => {});
  }

  res.status(200).json(
    new ApiResponse(true, "Payment verified", {
      ...serializePayment(payment),
      // Additive data lets a client replace stale order state immediately
      // after a verified settlement, including a split payment.
      settlement: nextStatus === "PAID"
        ? {
            orderId: String(settlement.order._id),
            paymentStatus: settlement.order.paymentStatus,
            orderStatus: settlement.order.status,
            paidAmount: settlement.paidTotal,
            remainingAmount: settlement.remaining,
            fullyPaid: settlement.fullyPaid,
          }
        : null,
    })
  );
});

export const getPaymentByOrderId = asyncHandler(async (req, res) => {
  const paymentScope = await buildRestaurantQuery({ orderId: req.params.orderId }, req.user);
  // An order can retain prior PENDING gateway intents and can have multiple
  // successful rows for split payments. Prefer the most recent settled row
  // for a receipt/status view; never mutate or hide the individual attempts.
  const payment = await Payment.findOne({
    ...paymentScope,
    paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .populate("orderId")
    .populate("customerId", "fullName email phone avatar")
    .populate("tableId", "tableNumber floor section")
    .populate("refundedBy", "fullName email role")
    || await Payment.findOne(paymentScope)
      .sort({ createdAt: -1 })
      .populate("orderId")
      .populate("customerId", "fullName email phone avatar")
      .populate("tableId", "tableNumber floor section")
      .populate("refundedBy", "fullName email role");

  if (!payment) throw new ApiError(404, "Payment not found");

  const detail = mapPaymentDetail(payment);
  const successfulPayments = await Payment.find({
    ...paymentScope,
    paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED"] },
  }).select("amount totalAmount refundAmount").lean();
  const paidAmount = successfulPayments.reduce(
    (total, item) => total + Math.max(Number(item.amount || item.totalAmount || 0) - Number(item.refundAmount || 0), 0),
    0
  );
  const orderTotal = Number(detail.order?.total || 0);
  detail.settlement = {
    paidAmount,
    remainingAmount: Math.max(orderTotal - paidAmount, 0),
    paymentStatus: detail.order?.paymentStatus || "PENDING",
  };
  detail.refunds = await Refund.find({ payment: payment._id }).select("amount reason status method processedAt createdAt initiatedBy").populate("initiatedBy", "fullName role").sort({ createdAt: -1 }).lean();
  res.status(200).json(new ApiResponse(true, "Payment fetched", detail));
});

export const listPayments = asyncHandler(async (req, res) => {
  const { pipeline, page, limit } = await buildListPipeline(req.query, req.user);
  const [result] = await Payment.aggregate(pipeline);
  const rows = (result?.data || []).map(mapPaymentRow);
  const total = result?.meta?.[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(true, "Payments fetched", rows, {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    })
  );
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await getPaymentDoc(req.params.id, req.user);
  if (!payment) throw new ApiError(404, "Payment not found");

  const order = await Order.findById(payment.orderId?._id || payment.orderId)
    .populate("customer", "fullName email phone avatar")
    .populate("table", "tableNumber floor section")
    .populate("items.menuItem", "name price");

  const detail = mapPaymentDetail(payment);
  detail.refunds = await Refund.find({ payment: payment._id }).select("amount reason status method processedAt createdAt initiatedBy").populate("initiatedBy", "fullName role").sort({ createdAt: -1 }).lean();
  detail.order = order
    ? {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        serviceCharge: order.serviceCharge,
        total: order.total,
        items: order.items || [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        customer: order.customer,
        table: order.table,
      }
    : detail.order;

  res.status(200).json(new ApiResponse(true, "Payment fetched", detail));
});

export const getPaymentStats = asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const successfulStatuses = ["PAID", "PARTIALLY_REFUNDED"];
  const revenueStatuses = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

  const [
    totalRevenueAgg,
    todayRevenueAgg,
    successfulCount,
    pendingCount,
    failedRefundedCount,
    refundAgg,
    averageAgg,
    revenueByDay,
    revenueByMethod,
    statusBreakdown,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: await buildRestaurantQuery({ paymentStatus: { $in: revenueStatuses } }, req.user) },
      { $group: { _id: null, total: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] } } } },
    ]),
    Payment.aggregate([
      { $match: await buildRestaurantQuery({ paymentStatus: { $in: revenueStatuses }, createdAt: { $gte: todayStart, $lt: tomorrowStart } }, req.user) },
      { $group: { _id: null, total: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] } } } },
    ]),
    Payment.countDocuments(await buildRestaurantQuery({ paymentStatus: { $in: successfulStatuses } }, req.user)),
    Payment.countDocuments(await buildRestaurantQuery({ paymentStatus: { $in: ["PENDING", "PROCESSING"] } }, req.user)),
    Payment.countDocuments(await buildRestaurantQuery({ paymentStatus: { $in: ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED"] } }, req.user)),
    Payment.aggregate([{ $match: await buildRestaurantQuery({}, req.user) }, { $group: { _id: null, total: { $sum: { $ifNull: ["$refundAmount", 0] } } } }]),
    Payment.aggregate([
      { $match: await buildRestaurantQuery({ paymentStatus: { $in: successfulStatuses } }, req.user) },
      { $group: { _id: null, avg: { $avg: { $ifNull: ["$totalAmount", 0] } } } },
    ]),
    Payment.aggregate([
      { $match: await buildRestaurantQuery({ createdAt: { $gte: thisMonthStart } }, req.user) },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] } },
          payments: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: await buildRestaurantQuery({}, req.user) },
      { $group: { _id: "$paymentMethod", revenue: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] } }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
    ]),
    Payment.aggregate([
      { $match: await buildRestaurantQuery({}, req.user) },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 }, revenue: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$refundAmount", 0] }] } } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const stats = {
    totalRevenue: totalRevenueAgg[0]?.total || 0,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
    successfulPayments: successfulCount,
    pendingPayments: pendingCount,
    failedRefunded: failedRefundedCount,
    refundAmount: refundAgg[0]?.total || 0,
    averageOrderValue: averageAgg[0]?.avg || 0,
    revenueByDay: revenueByDay.map((row) => ({ label: row._id, revenue: row.revenue, payments: row.payments })),
    revenueByMethod: revenueByMethod.map((row) => ({ method: row._id || "OTHER", revenue: row.revenue, count: row.count })),
    paymentStatusBreakdown: statusBreakdown.map((row) => ({ status: row._id || "PENDING", count: row.count, revenue: row.revenue })),
    summary: {
      totalRevenue: totalRevenueAgg[0]?.total || 0,
      todayRevenue: todayRevenueAgg[0]?.total || 0,
      successfulPayments: successfulCount,
      pendingPayments: pendingCount,
      failedRefunded: failedRefundedCount,
    },
  };

  res.status(200).json(new ApiResponse(true, "Payment stats fetched", stats));
});

export const getPaymentReceipt = asyncHandler(async (req, res) => {
  const payment = await getPaymentDoc(req.params.id, req.user);
  if (!payment) throw new ApiError(404, "Payment not found");

  // A bill payment belongs to the finalized bill snapshot. Reuse that receipt
  // so a consolidated settlement always includes the restaurant identity,
  // item lines, and all applied payments.
  const bill = payment.bill?._id || payment.bill;
  const buffer = bill ? await buildBillReceiptBuffer(payment.bill) : await buildPaymentReceipt(payment);
  const paymentId = bill?.billNumber || payment.bill?.billNumber || payment.paymentId || req.params.id;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=receipt-${paymentId}.pdf`);
  res.send(buffer);
});

export const exportPayments = asyncHandler(async (req, res) => {
  const { pipeline } = await buildListPipeline(req.query, req.user);
  const exportPipeline = pipeline.slice(0, -1);
  const payments = await Payment.aggregate(exportPipeline);
  const csv = buildPaymentCsv(payments.map(mapPaymentRow));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename=payments-export.csv');
  res.status(200).send(csv);
});

export const refundPayment = asyncHandler(async (req, res) => {
  const payment = await getPaymentDoc(req.params.id, req.user);
  if (!payment) throw new ApiError(404, "Payment not found");

  const { refundType = "full", refundAmount, refundReason = "" } = req.body;
  const remaining = Math.max(Number(payment.totalAmount || payment.amount || 0) - Number(payment.refundAmount || 0), 0);
  const amountToRefund = refundType === "partial" ? Number(refundAmount || 0) : remaining;

  if (payment.paymentStatus === "FAILED") {
    throw new ApiError(422, "Failed payments cannot be refunded");
  }

  const result = await refundRecordedPayment({
    paymentId: payment._id,
    restaurantId: payment.restaurant,
    amount: amountToRefund,
    reason: refundReason,
    initiatedBy: req.user._id,
    idempotencyKey: String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim(),
  });

  res.status(result.idempotent ? 200 : 201).json(new ApiResponse(true, result.idempotent ? "Refund already processed" : "Cash refund processed", serializePayment(result.payment)));
});

export const deletePayment = asyncHandler(async (req, res) => {
  const payment = await getPaymentDoc(req.params.id, req.user);
  if (!payment) throw new ApiError(404, "Payment not found");

  const blockedStatuses = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
  if (blockedStatuses.includes(normalizePaymentStatus(payment.paymentStatus))) {
    throw new ApiError(409, "Paid or refunded payments cannot be deleted");
  }

  await Payment.deleteOne({ _id: payment._id });

  if (payment.orderId?._id || payment.orderId) {
    const order = await Order.findById(payment.orderId?._id || payment.orderId);
    if (order && normalizePaymentStatus(order.paymentStatus) !== "PAID") {
      order.paymentStatus = "PENDING";
      if (String(order.status || "").toUpperCase() === "COMPLETED") {
        order.status = "PENDING";
      }
      await order.save();
    }
  }

  logger.info(`Payment deleted paymentId=${payment.paymentId} by user=${req.user?._id || "unknown"}`);
  res.status(200).json(new ApiResponse(true, "Payment deleted"));
});
