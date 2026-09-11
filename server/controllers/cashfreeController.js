import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import { settleCashfreePayment, serializePayment } from "../services/paymentService.js";
import { cashfreePaymentState, getCashfreePayments, verifyCashfreeWebhook } from "../services/cashfreeService.js";
import { prepareCashfreePaymentOrder } from "../services/cashfreeOrderCreationService.js";
import { processCashfreeEasySplitAllocation, processCashfreeSettlementWebhook, safeSettlementTransaction } from "../services/easySplitSettlementService.js";


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

  const result = await prepareCashfreePaymentOrder({ order, userId: req.user._id,
    attemptKey: String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim(),
  });
  return res.status(result.idempotent ? 200 : 201).json(new ApiResponse(true, "Cashfree order prepared", safeCheckoutPayload(result.payment)));
});

export const verifyPaymentForRecord = async ({ payment, fromWebhook = false, requestId = "" }) => {
  const remotePayments = await getCashfreePayments(payment.cashfreeOrderId);
  const { status, payment: externalPayment } = cashfreePaymentState(remotePayments);
  const result = await settleCashfreePayment({ order: payment.orderId, paymentId: payment._id, externalPayment, providerStatus: status, fromWebhook });
  let settlement = null;
  if (result.payment.paymentStatus === "PAID") {
    try {
      settlement = await processCashfreeEasySplitAllocation({
        paymentId: result.payment._id,
        providerPayment: externalPayment,
        requestId,
      });
    } catch (error) {
      // Customer payment status is never rolled back by a settlement failure.
      logger.warn("Cashfree Easy Split allocation deferred", { restaurantId: String(result.payment.restaurant), outletId: String(result.payment.outlet || ""), internalOrderId: String(result.payment.orderId), cashfreeOrderId: result.payment.cashfreeOrderId, providerStatus: result.payment.providerStatus, code: error?.code || "EASY_SPLIT_ALLOCATION_FAILED" });
    }
  }
  return { ...result, settlement };
};

export const getCashfreePaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne(await buildOutletQuery({ cashfreeOrderId: req.params.orderId, provider: "cashfree" }, req.user));
  if (!payment) throw new ApiError(404, "Cashfree payment not found");
  const result = await verifyPaymentForRecord({ payment, requestId: req.requestId });
  logger.info("Cashfree payment verified", { requestId: req.requestId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), internalOrderId: String(payment.orderId), cashfreeOrderId: payment.cashfreeOrderId, providerStatus: payment.providerStatus });
  return res.status(200).json(new ApiResponse(true, "Cashfree payment status verified", {
    provider: "cashfree",
    orderId: payment.cashfreeOrderId,
    status: result.payment.paymentStatus,
    payment: serializePayment(result.payment),
    settlement: safeSettlementTransaction(result.settlement?.transaction),
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
  const settlementWebhook = await processCashfreeSettlementWebhook({ event, rawBody });
  if (settlementWebhook.handled) return res.status(200).json({ success: true });
  const paymentEvents = new Set(["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"]);
  if (!paymentEvents.has(event?.type)) return res.status(200).json({ success: true });
  const cashfreeOrderId = String(event?.data?.order?.order_id || event?.order?.order_id || event?.order_id || "").trim();
  if (!cashfreeOrderId) throw new ApiError(400, "Cashfree webhook is missing order id");
  const payment = await Payment.findOne({ cashfreeOrderId, provider: "cashfree" });
  if (!payment) return res.status(200).json({ success: true }); // Unknown/old events must not be retried forever.

  const result = await verifyPaymentForRecord({ payment, fromWebhook: true, requestId: req.requestId });
  logger.info("Cashfree webhook processed", { requestId: req.requestId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), internalOrderId: String(payment.orderId), cashfreeOrderId, providerStatus: result.payment.providerStatus });
  return res.status(200).json({ success: true });
});
