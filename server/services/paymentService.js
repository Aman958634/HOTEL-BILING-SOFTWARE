import Stripe from "stripe";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import Sequence from "../models/Sequence.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import {
  buildReceiptBuffer,
  normalizePaymentMethod,
  normalizePaymentStatus,
  paymentMethodLabel,
  paymentStatusLabel,
} from "../utils/paymentUtils.js";
import { emitPaymentCreated, emitPaymentUpdated } from "../socket/paymentSocket.js";
import { notifyPaymentReceived } from "./notificationService.js";
import { formatPaymentId } from "../utils/paymentId.js";
import { generateInvoice } from "./invoiceService.js";
import { awardPointsForPaidOrder } from "./loyaltyService.js";

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

let razorpayClient = null;

export const getRazorpayClient = () => {
  if (razorpayClient) return razorpayClient;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;

  razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpayClient;
};

const PAYMENT_EVENT_STATUS = {
  ORDER_CREATED: "ORDER_CREATED",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  PAYMENT_SUCCESSFUL: "PAYMENT_SUCCESSFUL",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  PARTIAL_REFUND_COMPLETED: "PARTIAL_REFUND_COMPLETED",
};

const normalizeGateway = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "razorpay") return "Razorpay";
  if (lower === "stripe") return "Stripe";
  if (lower === "cash") return "Cash";
  return raw;
};

const nextPaymentSequence = async (session = null) => {
  const updated = await Sequence.findOneAndUpdate(
    { key: "paymentId" },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session: session || undefined }
  );
  return formatPaymentId(updated.value);
};

const addTimelineEntry = (timeline = [], status, timestamp = new Date(), note = "") => {
  const next = Array.isArray(timeline) ? [...timeline] : [];
  const last = next[next.length - 1];
  if (last && String(last.status).toUpperCase() === String(status).toUpperCase()) {
    return next;
  }
  next.push({ status, timestamp: timestamp ? new Date(timestamp) : new Date(), note });
  return next;
};

const buildPaymentTimeline = (order, payment, status, refundReason = "") => {
  let nextTimeline = Array.isArray(payment?.timeline) ? [...payment.timeline] : [];

  nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.ORDER_CREATED, order?.createdAt || payment?.createdAt, "Order created");
  nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.PAYMENT_INITIATED, payment?.createdAt || new Date(), "Payment initiated");

  const normalized = normalizePaymentStatus(status);
  if (normalized === "PROCESSING") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.PAYMENT_PROCESSING, new Date(), "Payment processing");
  }
  if (normalized === "PAID") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.PAYMENT_SUCCESSFUL, payment?.paidAt || new Date(), "Payment successful");
  }
  if (normalized === "FAILED") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.PAYMENT_FAILED, new Date(), "Payment failed");
  }
  if (order?.status === "COMPLETED" || normalized === "PAID") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.ORDER_COMPLETED, order?.updatedAt || new Date(), "Order completed");
  }
  if (normalized === "REFUNDED") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.REFUND_COMPLETED, payment?.refundedAt || new Date(), refundReason || "Full refund completed");
  }
  if (normalized === "PARTIALLY_REFUNDED") {
    nextTimeline = addTimelineEntry(nextTimeline, PAYMENT_EVENT_STATUS.PARTIAL_REFUND_COMPLETED, payment?.refundedAt || new Date(), refundReason || "Partial refund completed");
  }

  return nextTimeline;
};

const buildOrderLookup = async (orderId, session = null) => {
  if (!orderId) return null;
  if (orderId?.populate) return orderId;
  const query = Order.findById(orderId)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name price");
  if (session) query.session(session);
  return query;
};

const getSuccessfulPaymentTotal = async (orderId, session = null) => {
  let query = Payment.find({
    orderId,
    paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED"] },
  }).select("amount totalAmount refundAmount").lean();
  if (session) query = query.session(session);
  const payments = await query;
  return payments.reduce(
    (sum, payment) => sum + Math.max(Number(payment.amount || payment.totalAmount || 0) - Number(payment.refundAmount || 0), 0),
    0
  );
};

export const serializePayment = (payment) => {
  if (!payment) return null;
  const data = payment.toObject ? payment.toObject() : payment;
  return {
    ...data,
    paymentIdDisplay: formatPaymentId(data.paymentId),
    paymentStatusLabel: paymentStatusLabel(data.paymentStatus),
    paymentMethodLabel: paymentMethodLabel(data.paymentMethod),
  };
};

const notifyPaymentAudience = async ({ title, message, payment, order }) => {
  try {
    const restaurantId = payment?.restaurant || order?.restaurant || null;
    const paymentId = payment?._id || null;
    const orderId = order?._id || payment?.orderId || null;
    const orderNumber = order?.orderNumber || payment?.orderId?.orderNumber || "";

    if (title === "Payment received" || title === "Refund processed") {
      await notifyPaymentReceived({
        restaurantId,
        paymentId,
        orderId,
        orderNumber,
        amount: Number(payment?.totalAmount || payment?.amount || 0),
        paymentMethod: paymentMethodLabel(payment?.paymentMethod || order?.paymentMethod || "OTHER"),
      });
      return;
    }

    const recipients = await User.find({
      role: { $in: ["admin", "manager", "cashier", "waiter"] },
      isActive: true,
      ...(restaurantId && mongoose.isValidObjectId(restaurantId) ? { restaurant: restaurantId } : {}),
    }).select("_id");

    if (!recipients.length) return;

    await Notification.insertMany(
      recipients.map((recipient) => ({
        user: recipient._id,
        restaurantId: restaurantId || null,
        title,
        message,
        type: "payment",
        entityType: "Payment",
        entityId: paymentId,
      }))
    );
  } catch (_error) {
    // Ignore notification failures.
  }
};

export const syncPaymentFromOrder = async (
  order,
  {
    transactionId = "",
    metadata = {},
    status = null,
    note = "",
    session = null,
  } = {}
) => {
  const orderDoc = order?.populate ? order : await buildOrderLookup(order?._id || order, session);
  if (!orderDoc) throw new ApiError(404, "Order not found");

  const nextPaymentStatus = normalizePaymentStatus(status || orderDoc.paymentStatus || "PENDING");
  const nextPaymentMethod = normalizePaymentMethod(metadata.paymentMethod || orderDoc.paymentMethod || "OTHER");
  const gateway =
    nextPaymentMethod === "CASH"
      ? ""
      : normalizeGateway(metadata.gateway || metadata.provider || nextPaymentMethod);

  let paymentQuery = Payment.findOne({ orderId: orderDoc._id });
  if (session) paymentQuery = paymentQuery.session(session);
  let payment = await paymentQuery;
  const isNew = !payment;

  if (!payment) {
    payment = new Payment({
      paymentId: await nextPaymentSequence(session),
      orderId: orderDoc._id,
      customerId: orderDoc.customer?._id || orderDoc.customer || null,
      tableId: orderDoc.table?._id || orderDoc.table || null,
      restaurant: orderDoc.restaurant || null,
      outlet: orderDoc.outlet || null,
      amount: Number(orderDoc.total || 0),
      currency: metadata.currency || "INR",
      subtotal: Number(orderDoc.subtotal || 0),
      tax: Number(orderDoc.tax || 0),
      discount: Number(orderDoc.discount || 0),
      serviceCharge: Number(orderDoc.serviceCharge || 0),
      totalAmount: Number(orderDoc.total || 0),
      paymentMethod: nextPaymentMethod,
      gateway,
      paymentStatus: nextPaymentStatus,
      transactionId: transactionId || "",
      razorpayOrderId: metadata.razorpayOrderId || "",
      razorpayPaymentId: metadata.razorpayPaymentId || "",
      paidAt: nextPaymentStatus === "PAID" ? metadata.paidAt || new Date() : null,
      metadata: { ...metadata },
      timeline: [],
    });
  } else {
    payment.amount = Number(orderDoc.total || payment.amount || 0);
    payment.subtotal = Number(orderDoc.subtotal || 0);
    payment.tax = Number(orderDoc.tax || 0);
    payment.discount = Number(orderDoc.discount || 0);
    payment.serviceCharge = Number(orderDoc.serviceCharge || 0);
    payment.totalAmount = Number(orderDoc.total || payment.totalAmount || 0);
    payment.paymentMethod = nextPaymentMethod;
    payment.gateway = gateway || payment.gateway;
    payment.paymentStatus = nextPaymentStatus;
    payment.customerId = orderDoc.customer?._id || orderDoc.customer || payment.customerId;
    payment.tableId = orderDoc.table?._id || orderDoc.table || payment.tableId;
    payment.restaurant = orderDoc.restaurant || payment.restaurant;
    if (transactionId) payment.transactionId = transactionId;
    if (metadata.razorpayOrderId) payment.razorpayOrderId = metadata.razorpayOrderId;
    if (metadata.razorpayPaymentId) payment.razorpayPaymentId = metadata.razorpayPaymentId;
    payment.metadata = { ...(payment.metadata || {}), ...metadata };
    if (nextPaymentStatus === "PAID") {
      payment.paidAt = metadata.paidAt ? new Date(metadata.paidAt) : payment.paidAt || new Date();
    }
  }

  payment.timeline = buildPaymentTimeline(orderDoc, payment, payment.paymentStatus, note);
  await payment.save(session ? { session } : undefined);

  await payment.populate("orderId", "orderNumber status total paymentStatus createdAt updatedAt");
  await payment.populate("customerId", "fullName email phone avatar");
  await payment.populate("tableId", "tableNumber floor section");

  if (isNew) {
    emitPaymentCreated(serializePayment(payment));
  } else {
    emitPaymentUpdated(serializePayment(payment));
  }

  await notifyPaymentAudience({
    title: payment.paymentStatus === "FAILED" ? "Payment failed" : payment.paymentStatus === "PAID" ? "Payment received" : "Payment updated",
    message: `${paymentMethodLabel(payment.paymentMethod)} ${payment.paymentStatus === "PAID" ? "payment received" : `payment is ${paymentStatusLabel(payment.paymentStatus).toLowerCase()}`} for Order #${orderDoc.orderNumber}`,
    payment,
    order: orderDoc,
  });

  return payment;
};

export const updateOrderPaymentState = async (
  order,
  {
    amount = undefined,
    paymentMethod,
    paymentStatus,
    gateway = "",
    transactionId = "",
    razorpayOrderId = "",
    razorpayPaymentId = "",
    paidAt = null,
    note = "",
    session = null,
    idempotencyKey = "",
  } = {}
) => {
  const orderDoc = order?.populate ? order : await buildOrderLookup(order?._id || order, session);
  if (!orderDoc) throw new ApiError(404, "Order not found");

  const nextPaymentMethod = normalizePaymentMethod(paymentMethod || orderDoc.paymentMethod || "OTHER");
  const nextPaymentStatus = normalizePaymentStatus(paymentStatus || orderDoc.paymentStatus || "PENDING");

  // Settlement is intentionally delegated to the transactional write path.
  // This prevents internal callers from bypassing idempotency/invoice safety.
  if (nextPaymentStatus === "PAID") {
    if (session) throw new ApiError(500, "Nested payment transactions are not supported");
    return recordVerifiedPayment(orderDoc, {
      amount,
      paymentMethod: nextPaymentMethod,
      gateway,
      transactionId,
      razorpayOrderId,
      razorpayPaymentId,
      paidAt: paidAt || new Date(),
      note,
      idempotencyKey,
    });
  }

  orderDoc.paymentMethod = nextPaymentMethod;
  orderDoc.paymentStatus = nextPaymentStatus;
  orderDoc.paidAt = null;
  if (orderDoc.status === "COMPLETED") {
    orderDoc.status = "PENDING";
  }
  orderDoc.transactionId = transactionId || orderDoc.transactionId || "";

  await orderDoc.save(session ? { session } : undefined);

  const payment = await syncPaymentFromOrder(orderDoc, {
    transactionId: orderDoc.transactionId,
    metadata: {
      paymentMethod: nextPaymentMethod,
      gateway,
      razorpayOrderId,
      razorpayPaymentId,
      paidAt: orderDoc.paidAt,
    },
    status: nextPaymentStatus,
    note,
    session,
  });

  orderDoc.paymentId = payment.paymentId;
  orderDoc.transactionId = payment.transactionId || orderDoc.transactionId || "";
  orderDoc.paidAt = payment.paidAt || orderDoc.paidAt || null;

  // A payment is settled only when the sum of all successful payments covers
  // the order total. This also protects aggregate/split-payment flows.
  const totalPaid = await getSuccessfulPaymentTotal(orderDoc._id, session);
  const fullyPaid = totalPaid + 0.01 >= Number(orderDoc.total || 0);
  orderDoc.paymentStatus = fullyPaid ? "PAID" : "PENDING";
  if (fullyPaid) {
    orderDoc.status = "COMPLETED";
    orderDoc.paidAt = payment.paidAt || new Date();
  }
  await orderDoc.save(session ? { session } : undefined);

  const { maybeReleaseTableAfterSettlement } = await import("./tableOrderService.js");
  await maybeReleaseTableAfterSettlement(orderDoc);

  if (fullyPaid) await generateInvoice(orderDoc);

  return { order: orderDoc, payment };
};

export const recordVerifiedPayment = async (
  order,
  {
    amount,
    paymentMethod,
    gateway = "",
    transactionId = "",
    razorpayOrderId = "",
    razorpayPaymentId = "",
    idempotencyKey = "",
    paidAt = new Date(),
    note = "Payment verified successfully",
    receivedBy = null,
  } = {}
) => {
  const orderId = order?._id || order;
  if (!orderId) throw new ApiError(404, "Order not found");
  const requestedAmount = amount === undefined || amount === null || amount === ""
    ? null
    : Number(amount);
  if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
    throw new ApiError(422, "Payment amount must be greater than zero");
  }
  const stableIdempotencyKey = String(idempotencyKey || razorpayPaymentId || transactionId || "").trim();
  if (!stableIdempotencyKey) {
    throw new ApiError(422, "Idempotency-Key is required for a payment without a gateway transaction id");
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const orderDoc = await buildOrderLookup(orderId, session);
      if (!orderDoc) throw new ApiError(404, "Order not found");

      // Idempotent retries succeed with the original result before the
      // already-paid guard is evaluated.
      const priorPayment = await Payment.findOne({ orderId: orderDoc._id, idempotencyKey: stableIdempotencyKey }).session(session);
      if (priorPayment) {
        const paidTotal = await getSuccessfulPaymentTotal(orderDoc._id, session);
        result = {
          order: orderDoc,
          payment: priorPayment,
          paidTotal,
          remaining: Math.max(Number(orderDoc.total || 0) - paidTotal, 0),
          fullyPaid: String(orderDoc.paymentStatus || "").toUpperCase() === "PAID",
          idempotent: true,
        };
        return;
      }

      if (normalizePaymentStatus(orderDoc.paymentStatus) === "PAID") {
        throw new ApiError(409, "Payment already completed.");
      }

      const billTotal = Number(orderDoc.total || 0);
      const paidBefore = await getSuccessfulPaymentTotal(orderDoc._id, session);
      const remaining = Math.max(billTotal - paidBefore, 0);
      const paymentAmount = requestedAmount === null ? remaining : requestedAmount;
      if (paymentAmount > remaining + 0.01) {
        throw new ApiError(422, "Payment amount exceeds the remaining balance");
      }
      if (paymentAmount <= 0) throw new ApiError(409, "Order balance is already settled");

      const method = normalizePaymentMethod(paymentMethod || orderDoc.paymentMethod || "OTHER");
      const payment = new Payment({
        paymentId: await nextPaymentSequence(session),
        orderId: orderDoc._id,
        customerId: orderDoc.customer?._id || orderDoc.customer || null,
        tableId: orderDoc.table?._id || orderDoc.table || null,
        restaurant: orderDoc.restaurant || null,
        amount: paymentAmount,
        currency: "INR",
        subtotal: Number(orderDoc.subtotal || 0),
        tax: Number(orderDoc.tax || 0),
        discount: Number(orderDoc.discount || 0),
        serviceCharge: Number(orderDoc.serviceCharge || 0),
        totalAmount: paymentAmount,
        paymentMethod: method,
        receivedBy,
        gateway: normalizeGateway(gateway),
        paymentStatus: "PAID",
        transactionId: transactionId || `PAY-${stableIdempotencyKey}`,
        razorpayOrderId: razorpayOrderId || "",
        razorpayPaymentId: razorpayPaymentId || "",
        idempotencyKey: stableIdempotencyKey,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        metadata: { verified: true },
        timeline: buildPaymentTimeline(orderDoc, null, "PAID", note),
      });
      await payment.save({ session });

      const totalPaid = await getSuccessfulPaymentTotal(orderDoc._id, session);
      const fullyPaid = totalPaid + 0.01 >= billTotal;
      orderDoc.paymentMethod = method;
      orderDoc.paymentStatus = fullyPaid ? "PAID" : "PENDING";
      orderDoc.paidAt = fullyPaid ? payment.paidAt : null;
      if (fullyPaid) orderDoc.status = "COMPLETED";
      await orderDoc.save({ session });
      if (fullyPaid) await generateInvoice(orderDoc, { session });

      result = { order: orderDoc, payment, paidTotal: totalPaid, remaining: Math.max(billTotal - totalPaid, 0), fullyPaid, idempotent: false };
    });
  } catch (error) {
    // A concurrent retry can lose the unique-index race after its transaction
    // snapshot was taken. Return the committed payment for that same key.
    if (error?.code === 11000) {
      const priorPayment = await Payment.findOne({ orderId, idempotencyKey: stableIdempotencyKey });
      if (priorPayment) {
        const currentOrder = await buildOrderLookup(orderId);
        const paidTotal = await getSuccessfulPaymentTotal(orderId);
        result = {
          order: currentOrder,
          payment: priorPayment,
          paidTotal,
          remaining: Math.max(Number(currentOrder?.total || 0) - paidTotal, 0),
          fullyPaid: String(currentOrder?.paymentStatus || "").toUpperCase() === "PAID",
          idempotent: true,
        };
      } else {
        throw error;
      }
    } else if (String(error?.message || "").includes("Transaction numbers are only allowed")) {
      throw new ApiError(503, "Payments require MongoDB replica-set transactions. Configure a replica set before accepting payments.");
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  const { order: committedOrder, payment, paidTotal, remaining, fullyPaid, idempotent } = result;

  // Payment verification also re-derives the table. A partial payment leaves
  // it OCCUPIED; a settled/terminal order can become AVAILABLE only if no
  // other active order exists for that table.
  const { maybeReleaseTableAfterSettlement } = await import("./tableOrderService.js");
  await maybeReleaseTableAfterSettlement(committedOrder);

  await payment.populate("orderId", "orderNumber status total paymentStatus createdAt updatedAt");
  await payment.populate("customerId", "fullName email phone avatar");
  await payment.populate("tableId", "tableNumber floor section");
  // earn:<orderId> makes this safe for gateway retries and recovery runs.
  if (fullyPaid) await awardPointsForPaidOrder({ order: committedOrder, payment });
  if (!idempotent) emitPaymentCreated(serializePayment(payment));
  return { order: committedOrder, payment, paidTotal, remaining, fullyPaid, idempotent };
};

/**
 * Repairs a crash window such as a committed gateway payment followed by a
 * process exit before settlement/invoice work completed. It is safe to run on
 * every boot because all decisions are derived from successful payments.
 */
export const reconcilePaymentSettlements = async () => {
  const orders = await Order.find({
    isArchived: false,
    status: { $ne: "CANCELLED" },
    paymentStatus: { $in: ["PENDING", "PAID", "FAILED"] },
  }).select("_id").lean();

  let reconciled = 0;
  for (const candidate of orders) {
    const session = await mongoose.startSession();
    let needsTableRefresh = false;
    try {
      await session.withTransaction(async () => {
        const orderDoc = await buildOrderLookup(candidate._id, session);
        if (!orderDoc || orderDoc.isArchived || orderDoc.status === "CANCELLED") return;

        const totalPaid = await getSuccessfulPaymentTotal(orderDoc._id, session);
        const shouldBePaid = totalPaid + 0.01 >= Number(orderDoc.total || 0);
        const nextStatus = shouldBePaid ? "PAID" : "PENDING";
        const changed = orderDoc.paymentStatus !== nextStatus || (shouldBePaid && orderDoc.status !== "COMPLETED");

        if (changed) {
          orderDoc.paymentStatus = nextStatus;
          orderDoc.paidAt = shouldBePaid ? orderDoc.paidAt || new Date() : null;
          if (shouldBePaid) orderDoc.status = "COMPLETED";
          await orderDoc.save({ session });
          needsTableRefresh = true;
          reconciled += 1;
        }
        if (shouldBePaid) await generateInvoice(orderDoc, { session });
      });
    } finally {
      await session.endSession();
    }
    if (needsTableRefresh) {
      const repairedOrder = await Order.findById(candidate._id).select("table");
      if (repairedOrder) {
        const { maybeReleaseTableAfterSettlement } = await import("./tableOrderService.js");
        await maybeReleaseTableAfterSettlement(repairedOrder);
      }
    }
  }
  return reconciled;
};

export const completeOrderPayment = async (order, options = {}) =>
  updateOrderPaymentState(order, {
    ...options,
    paymentStatus: "PAID",
  });

export const buildPaymentReceipt = async (payment) => {
  const paymentDoc = payment?.populate ? payment : await Payment.findById(payment?._id || payment);
  if (!paymentDoc) throw new ApiError(404, "Payment not found");

  const order = await buildOrderLookup(paymentDoc.orderId?._id || paymentDoc.orderId);
  const restaurantId = paymentDoc.restaurant || order?.restaurant;
  const restaurant = restaurantId ? await Restaurant.findById(restaurantId).lean() : null;

  return buildReceiptBuffer({ payment: paymentDoc, order, restaurant });
};
