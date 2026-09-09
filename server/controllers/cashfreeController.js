import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import { deriveOrderPaymentState, recordOrderPayment, settleCashfreePayment, serializePayment } from "../services/paymentService.js";
import { cashfreePaymentState, createCashfreeOrder, getCashfreePayments, makeCashfreeOrderId, verifyCashfreeWebhook } from "../services/cashfreeService.js";

const activeCashfreePayment = async (orderId, user) => Payment.findOne(await buildOutletQuery({
  orderId,
  provider: "cashfree",
  paymentStatus: { $in: ["PENDING", "PROCESSING"] },
  providerStatus: { $nin: ["FAILED", "CANCELLED"] },
  cashfreeOrderId: { $ne: "" },
}, user)).select("_id cashfreeOrderId paymentSessionId providerStatus amount");

const safeCheckoutPayload = (payment) => ({
  success: true,
  provider: "cashfree",
  orderId: payment.cashfreeOrderId,
  paymentSessionId: payment.paymentSessionId,
  cashfreeEnvironment: getCashfreeConfig().environment,
});

export const createCashfreeCheckoutOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne(await buildOutletQuery({ _id: req.body.orderId }, req.user))
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber");
  if (!order) throw new ApiError(404, "Order not found");

  const settlement = await deriveOrderPaymentState(order);
  if (settlement.fullyPaid || String(order.paymentStatus).toUpperCase() === "PAID") {
    throw new ApiError(409, "Payment already completed");
  }

  const requestedAttemptKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim();
  const existing = requestedAttemptKey
    ? await Payment.findOne(await buildOutletQuery({ orderId: order._id, provider: "cashfree", idempotencyKey: requestedAttemptKey }, req.user)).select("_id cashfreeOrderId paymentSessionId providerStatus amount")
    : await activeCashfreePayment(order._id, req.user);
  if (existing?.paymentSessionId) {
    return res.status(200).json(new ApiResponse(true, "Existing Cashfree checkout returned", safeCheckoutPayload(existing)));
  }

  const cashfreeOrderId = existing?.cashfreeOrderId || makeCashfreeOrderId();
  const paymentRecord = existing || (await recordOrderPayment(order, {
    amount: settlement.remainingAmount,
    paymentMethod: "CASHFREE",
    paymentStatus: "PROCESSING",
    gateway: "Cashfree",
    provider: "cashfree",
    providerStatus: "CREATED",
    cashfreeOrderId,
    transactionId: `CF-ORDER-${cashfreeOrderId}`,
    idempotencyKey: requestedAttemptKey || `cashfree-order:${String(order._id)}:${cashfreeOrderId}`,
    metadata: { provider: "cashfree", gateway: "Cashfree", internalOrderId: String(order._id) },
    receivedBy: req.user._id,
    note: "Cashfree checkout created",
  })).payment;

  try {
    const cashfreeOrder = await createCashfreeOrder({
      cashfreeOrderId: paymentRecord.cashfreeOrderId,
      amount: paymentRecord.amount,
      customer: order.customer,
      order,
    });
    if (!cashfreeOrder?.payment_session_id) throw new ApiError(503, "Cashfree did not return a payment session");

    paymentRecord.paymentSessionId = cashfreeOrder.payment_session_id;
    paymentRecord.providerStatus = String(cashfreeOrder.order_status || "ACTIVE").toUpperCase();
    await paymentRecord.save();
    const cashfreeEnvironment = getCashfreeConfig().environment;
    logger.info("Cashfree checkout created", { requestId: req.requestId, cashfreeEnvironment, paymentSessionPresent: true, paymentSessionType: typeof cashfreeOrder.payment_session_id, restaurantId: String(order.restaurant), outletId: String(order.outlet || ""), internalOrderId: String(order._id), cashfreeOrderId: paymentRecord.cashfreeOrderId, providerStatus: paymentRecord.providerStatus });
    return res.status(201).json(new ApiResponse(true, "Cashfree checkout created", safeCheckoutPayload(paymentRecord)));
  } catch (error) {
    paymentRecord.paymentStatus = "FAILED";
    paymentRecord.providerStatus = "CREATE_FAILED";
    await paymentRecord.save().catch(() => {});
    throw error;
  }
});

const verifyPaymentForRecord = async ({ payment, fromWebhook = false }) => {
  const remotePayments = await getCashfreePayments(payment.cashfreeOrderId);
  const { status, payment: externalPayment } = cashfreePaymentState(remotePayments);
  return settleCashfreePayment({ order: payment.orderId, paymentId: payment._id, externalPayment, providerStatus: status, fromWebhook });
};

export const getCashfreePaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne(await buildOutletQuery({ cashfreeOrderId: req.params.orderId, provider: "cashfree" }, req.user));
  if (!payment) throw new ApiError(404, "Cashfree payment not found");
  const result = await verifyPaymentForRecord({ payment });
  logger.info("Cashfree payment verified", { requestId: req.requestId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), internalOrderId: String(payment.orderId), cashfreeOrderId: payment.cashfreeOrderId, providerStatus: payment.providerStatus });
  return res.status(200).json(new ApiResponse(true, "Cashfree payment status verified", {
    provider: "cashfree",
    orderId: payment.cashfreeOrderId,
    status: result.payment.paymentStatus,
    payment: serializePayment(result.payment),
  }));
});

export const cashfreeWebhook = asyncHandler(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const signature = req.get("x-webhook-signature");
  const timestamp = req.get("x-webhook-timestamp");
  if (!verifyCashfreeWebhook({ signature, timestamp, rawBody })) {
    throw new ApiError(401, "Invalid Cashfree webhook signature");
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { throw new ApiError(400, "Invalid Cashfree webhook payload"); }
  const cashfreeOrderId = String(event?.data?.order?.order_id || event?.order?.order_id || event?.order_id || "").trim();
  if (!cashfreeOrderId) throw new ApiError(400, "Cashfree webhook is missing order id");
  const payment = await Payment.findOne({ cashfreeOrderId, provider: "cashfree" });
  if (!payment) return res.status(200).json({ success: true }); // Unknown/old events must not be retried forever.

  const result = await verifyPaymentForRecord({ payment, fromWebhook: true });
  logger.info("Cashfree webhook processed", { requestId: req.requestId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), internalOrderId: String(payment.orderId), cashfreeOrderId, providerStatus: result.payment.providerStatus });
  return res.status(200).json({ success: true });
});
