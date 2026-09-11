import crypto from "crypto";
import Payment from "../models/Payment.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import ApiError from "../utils/ApiError.js";
import { deriveOrderPaymentState, recordOrderPayment } from "./paymentService.js";
import { buildCashfreeOrderPayload, createCashfreeOrder, getCashfreeOrder } from "./cashfreeService.js";
import { ORDER_CREATION_SPLIT, prepareOrderSplit, ensureOrderSplitTransaction, assertProviderOrderSplit, persistOrderSplitError } from "./cashfreeOrderSplitService.js";
import { getCashfreeConfig } from "../config/cashfree.js";

const uuidFor = (value) => {
  const hex = crypto.createHash("sha256").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

// Caller supplies the order resolved through authenticated tenant/outlet
// scoping. No commercial fields from the request are accepted here.
export const prepareCashfreePaymentOrder = async ({ order, userId, attemptKey = "" }) => {
  const config = getCashfreeConfig();
  if (process.env.NODE_ENV === "production" && !config.enabled) {
    throw new ApiError(503, "Cashfree payments are disabled", "CASHFREE_PAYMENTS_DISABLED");
  }
  if (process.env.NODE_ENV === "production" && (!config.easySplitEnabled || !config.easySplitPaymentsEnabled)) {
    throw new ApiError(503, "Cashfree Easy Split production preflight is incomplete", "EASY_SPLIT_PRODUCTION_PREFLIGHT_REQUIRED");
  }
  const balance = await deriveOrderPaymentState(order);
  if (balance.fullyPaid || order.paymentStatus === "PAID") throw new ApiError(409, "Payment already completed");
  const scope = { orderId: order._id, restaurant: order.restaurant, outlet: order.outlet, provider: "cashfree" };
  const key = attemptKey || `cashfree-order:${order._id}:${balance.remainingAmount}`;
  let payment = await Payment.findOne({ ...scope, idempotencyKey: key }).select("+paymentSessionId +cashfreeOrderRequest");
  payment ||= await Payment.findOne({ ...scope, paymentStatus: { $in: ["PENDING", "PROCESSING"] }, providerStatus: { $nin: ["FAILED", "CANCELLED", "CREATE_FAILED"] } }).select("+paymentSessionId +cashfreeOrderRequest");
  if (!payment) {
    const split = await prepareOrderSplit(order, balance.remainingAmount);
    const idempotencyKey = uuidFor(`${order._id}:${key}`);
    const cashfreeOrderId = `RS_CF_${idempotencyKey.replace(/-/g, "")}`;
    const payload = buildCashfreeOrderPayload({ cashfreeOrderId, amount: balance.remainingAmount, customer: order.customer, order,
      orderSplits: split ? [{ vendor_id: split.providerVendorId, amount: split.vendorSharePaise / 100 }] : [],
    });
    const result = await recordOrderPayment(order, {
      amount: balance.remainingAmount, paymentMethod: "CASHFREE", paymentStatus: "PENDING", provider: "cashfree", gateway: "Cashfree",
      providerStatus: "CREATED", cashfreeOrderId, transactionId: `CF-ORDER-${cashfreeOrderId}`, idempotencyKey: key,
      allocationStrategy: split ? ORDER_CREATION_SPLIT : "POST_PAYMENT_SPLIT", providerOrderIdempotencyKey: idempotencyKey,
      cashfreeOrderRequest: payload, receivedBy: userId,
      metadata: { provider: "cashfree", internalOrderId: String(order._id), ...(split ? { easySplitCommission: split } : {}) },
    });
    payment = await Payment.findById(result.payment._id).select("+paymentSessionId +cashfreeOrderRequest");
  }
  if (payment.allocationStrategy === ORDER_CREATION_SPLIT) await ensureOrderSplitTransaction(payment);
  if (payment.paymentSessionId && payment.providerStatus !== "CREATE_UNCONFIRMED") return { payment, idempotent: true };
  if (payment.providerStatus === "CREATE_FAILED") throw new ApiError(409, "This attempt was rejected; inspect its persisted provider error", "CASHFREE_ORDER_PREVIOUSLY_REJECTED");

  // A DB lease serializes concurrent callers across backend processes. A lost
  // response is recovered by GET; any repeat POST reuses both ID and UUID.
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 60000);
  const claim = await Payment.findOneAndUpdate({ _id: payment._id, $or: [{ cashfreeCreateLockUntil: null }, { cashfreeCreateLockUntil: { $lte: now } }] },
    { $set: { cashfreeCreateLockUntil: lockUntil } }, { new: true });
  if (!claim) throw new ApiError(409, "Cashfree order preparation is in progress; retry the same request", "CASHFREE_ORDER_IN_PROGRESS");
  try {
    payment = await Payment.findById(payment._id).select("+paymentSessionId +cashfreeOrderRequest");
    if (payment.paymentSessionId && payment.providerStatus !== "CREATE_UNCONFIRMED") return { payment, idempotent: true };
    let providerOrder;
    // Legacy pending records retain their original provider ID. Never replace
    // an order after a network timeout or a provider-side duplicate response.
    if (payment.providerStatus !== "CREATED") {
      try { providerOrder = await getCashfreeOrder(payment.cashfreeOrderId); }
      catch (error) { if (error?.details?.providerHttpStatus !== 404) throw error; }
    }
    if (!providerOrder) {
      const payload = payment.cashfreeOrderRequest || buildCashfreeOrderPayload({ cashfreeOrderId: payment.cashfreeOrderId, amount: payment.amount, customer: order.customer, order });
      try {
        providerOrder = await createCashfreeOrder({ payload, idempotencyKey: payment.providerOrderIdempotencyKey || uuidFor(payment.cashfreeOrderId) });
      } catch (error) {
        if (error?.details?.providerErrorCode !== "order_already_exists") throw error;
        providerOrder = await getCashfreeOrder(payment.cashfreeOrderId);
      }
    }
    if (payment.allocationStrategy === ORDER_CREATION_SPLIT) {
      // A second GET verifies what Cashfree persisted, including recoveries.
      const confirmed = await getCashfreeOrder(payment.cashfreeOrderId);
      assertProviderOrderSplit(payment, confirmed);
      providerOrder = confirmed;
      await SettlementTransaction.updateOne({ payment: payment._id }, { $set: {
        providerStatus: "ORDER_SPLIT_CONFIRMED", splitStatus: "PENDING", providerHttpStatus: 200,
        providerErrorCode: "", providerErrorType: "", providerErrorMessage: "", failureCode: "", failureMessageSafe: "",
      } });
    }
    if (!providerOrder?.payment_session_id) throw new ApiError(503, "Cashfree order session is unavailable", "CASHFREE_ORDER_SESSION_MISSING");
    await Payment.updateOne({ _id: payment._id }, { $set: { paymentSessionId: providerOrder.payment_session_id, providerStatus: String(providerOrder.order_status || "ACTIVE") } });
    payment = await Payment.findById(payment._id).select("+paymentSessionId");
    return { payment, idempotent: false };
  } catch (error) {
    const status = error?.details?.providerHttpStatus;
    const rejected = status >= 400 && status < 500 && ![408, 409, 429].includes(status);
    await Payment.updateOne({ _id: payment._id }, { $set: { providerStatus: rejected ? "CREATE_FAILED" : "CREATE_UNCONFIRMED" } });
    await persistOrderSplitError(payment, error, rejected);
    throw error;
  } finally {
    await Payment.updateOne({ _id: payment._id, cashfreeCreateLockUntil: lockUntil }, { $set: { cashfreeCreateLockUntil: null } });
  }
};
