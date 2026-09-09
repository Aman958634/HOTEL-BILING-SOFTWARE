import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import Payment from "../models/Payment.js";
import RestaurantSettlementProfile from "../models/RestaurantSettlementProfile.js";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import SettlementWebhookEvent from "../models/SettlementWebhookEvent.js";
import { createActivity } from "./activityService.js";
import { createEasySplitAfterPayment, getEasySplitOrderDetails } from "./cashfreeEasySplitService.js";

export const toPaise = (amount) => {
  const raw = String(amount ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new ApiError(422, "Amount must have no more than two decimal places");
  const [whole, fraction = ""] = raw.split(".");
  const paise = (Number(whole) * 100) + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(paise)) throw new ApiError(422, "Amount is out of range");
  return paise;
};

export const fromPaise = (paise) => Number((paise / 100).toFixed(2));

export const calculateCommissionSplit = ({ grossAmountPaise, commissionType = "NONE", commissionBps = 0, fixedAmountPaise = 0 }) => {
  if (!Number.isSafeInteger(grossAmountPaise) || grossAmountPaise <= 0) throw new ApiError(422, "Gross amount must be a positive paise integer");
  const type = String(commissionType || "NONE").toUpperCase();
  const bps = Number(commissionBps || 0);
  const fixed = Number(fixedAmountPaise || 0);
  if (!["NONE", "PERCENTAGE", "FIXED"].includes(type)) throw new ApiError(422, "Commission type is invalid");
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10000 || !Number.isSafeInteger(fixed) || fixed < 0) throw new ApiError(422, "Commission configuration is invalid");
  const platformSharePaise = type === "PERCENTAGE" ? Math.floor((grossAmountPaise * bps) / 10000) : type === "FIXED" ? fixed : 0;
  if (platformSharePaise > grossAmountPaise) throw new ApiError(422, "Commission exceeds this Cashfree payment", "COMMISSION_EXCEEDS_PAYMENT");
  const vendorSharePaise = grossAmountPaise - platformSharePaise;
  if (vendorSharePaise < 0 || vendorSharePaise + platformSharePaise !== grossAmountPaise) throw new ApiError(422, "Settlement split invariant failed");
  return { commissionType: type, commissionBps: type === "PERCENTAGE" ? bps : 0, fixedAmountPaise: type === "FIXED" ? fixed : 0, grossAmountPaise, vendorSharePaise, platformSharePaise };
};

const isPhaseTwoEnabled = () => {
  const config = getCashfreeConfig();
  return config.easySplitEnabled && config.easySplitPaymentsEnabled && config.configured && config.environment === "sandbox";
};

const providerStatusFrom = (payload = {}) => String(payload.status || payload.split_status || payload.settlement_status || "PENDING").toUpperCase();
const settlementStatusFrom = (status) => {
  if (/SUCCESS|SETTLED|PAID/.test(status)) return "SETTLED";
  if (/FAIL|REJECT|CANCEL/.test(status)) return "FAILED";
  if (/REVER/.test(status)) return "REVERSED";
  if (/HOLD/.test(status)) return "ON_HOLD";
  if (/PROCESS|INITIAT/.test(status)) return "PROCESSING";
  return "PENDING";
};

const safeProviderReference = (payload = {}) => String(payload.split_id || payload.split_reference || payload.order_split_id || "").trim();
const safeSettlementReference = (payload = {}) => String(payload.settlement_id || payload.vendor_settlement_id || "").trim();

const profileForRestaurant = async (restaurantId) => {
  const profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantId, provider: "CASHFREE" });
  if (!profile || profile.vendorStatus !== "ACTIVE" || profile.bankVerificationStatus !== "VERIFIED" || profile.settlementStatus !== "ACTIVE") {
    throw new ApiError(409, "Settlement account is not ready", "SETTLEMENT_ACCOUNT_NOT_READY");
  }
  return profile;
};

const ensurePaidCashfreePayment = async (paymentLike) => {
  const payment = paymentLike?._id && paymentLike.paymentStatus ? paymentLike : await Payment.findById(paymentLike?._id || paymentLike);
  if (!payment || String(payment.provider).toLowerCase() !== "cashfree" || payment.paymentStatus !== "PAID" || !payment.cashfreeOrderId) {
    throw new ApiError(409, "Only verified Cashfree payments can be allocated", "CASHFREE_PAYMENT_NOT_VERIFIED");
  }
  return payment;
};

export const safeSettlementTransaction = (transaction) => transaction ? {
  id: transaction._id,
  restaurant: transaction.restaurant,
  outlet: transaction.outlet,
  order: transaction.order,
  payment: transaction.payment,
  provider: transaction.provider,
  providerVendorId: transaction.providerVendorId,
  cashfreeOrderId: transaction.cashfreeOrderId,
  cashfreePaymentId: transaction.cashfreePaymentId,
  providerSplitReference: transaction.providerSplitReference,
  providerSettlementId: transaction.providerSettlementId,
  currency: transaction.currency,
  grossAmount: fromPaise(transaction.grossAmountPaise),
  vendorShare: fromPaise(transaction.vendorSharePaise),
  platformShare: fromPaise(transaction.platformSharePaise),
  commissionType: transaction.commissionType,
  commissionBps: transaction.commissionBps,
  fixedAmount: fromPaise(transaction.fixedAmountPaise),
  splitStatus: transaction.splitStatus,
  settlementStatus: transaction.settlementStatus,
  providerStatus: transaction.providerStatus,
  splitCreatedAt: transaction.splitCreatedAt,
  settlementUpdatedAt: transaction.settlementUpdatedAt,
  failureCode: transaction.failureCode,
  failureMessage: transaction.failureMessageSafe,
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt,
} : null;

export const ensureCashfreeSplitAllocation = async ({ payment: paymentLike, requestId = "" }) => {
  if (!isPhaseTwoEnabled()) return { skipped: true, reason: "EASY_SPLIT_PAYMENTS_DISABLED" };
  const payment = await ensurePaidCashfreePayment(paymentLike);
  const existing = await SettlementTransaction.findOne({ payment: payment._id, provider: "CASHFREE" });
  if (existing && ["ALLOCATED", "PROCESSING"].includes(existing.splitStatus)) return { transaction: existing, idempotent: true };

  const profile = await profileForRestaurant(payment.restaurant);
  const commission = await RestaurantCommissionConfig.findOne({ restaurant: payment.restaurant }).lean();
  const split = calculateCommissionSplit({
    grossAmountPaise: toPaise(payment.amount),
    commissionType: commission?.commissionType || "NONE",
    commissionBps: commission?.commissionBps || 0,
    fixedAmountPaise: commission?.fixedAmountPaise || 0,
  });

  let transaction = existing;
  if (!transaction) {
    try {
      transaction = await SettlementTransaction.create({
        restaurant: payment.restaurant, outlet: payment.outlet || null, order: payment.orderId, payment: payment._id,
        provider: "CASHFREE", providerVendorId: profile.providerVendorId, cashfreeOrderId: payment.cashfreeOrderId,
        cashfreePaymentId: payment.cashfreePaymentId || "", ...split, splitStatus: "PROCESSING",
        settlementStatus: "NOT_SCHEDULED", providerStatus: "PROCESSING", providerIdempotencyKey: crypto.randomUUID(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      transaction = await SettlementTransaction.findOne({ payment: payment._id, provider: "CASHFREE" });
      if (!transaction || ["ALLOCATED", "PROCESSING"].includes(transaction.splitStatus)) return { transaction, idempotent: true };
    }
  } else {
    transaction.splitStatus = "PROCESSING";
    transaction.failureCode = "";
    transaction.failureMessageSafe = "";
    await transaction.save();
  }

  // A 100% platform commission has no vendor allocation. It is still an
  // auditable settlement decision, but there is no Cashfree vendor call.
  if (transaction.vendorSharePaise === 0) {
    transaction.splitStatus = "ALLOCATED";
    transaction.providerStatus = "NO_VENDOR_SHARE";
    transaction.splitCreatedAt = new Date();
    await transaction.save();
    return { transaction, idempotent: false };
  }

  try {
    const providerResult = await createEasySplitAfterPayment({
      cashfreeOrderId: transaction.cashfreeOrderId,
      vendorId: transaction.providerVendorId,
      vendorSharePaise: transaction.vendorSharePaise,
      idempotencyKey: transaction.providerIdempotencyKey,
    });
    const status = providerStatusFrom(providerResult.payload);
    transaction.providerStatus = status;
    transaction.providerSplitReference = safeProviderReference(providerResult.payload) || transaction.providerSplitReference;
    transaction.providerRequestId = providerResult.providerRequestId || transaction.providerRequestId;
    transaction.splitStatus = /FAIL|REJECT/.test(status) ? "FAILED" : "ALLOCATED";
    transaction.settlementStatus = transaction.splitStatus === "ALLOCATED" ? settlementStatusFrom(status) : "NOT_SCHEDULED";
    transaction.splitCreatedAt = transaction.splitStatus === "ALLOCATED" ? new Date() : null;
    await transaction.save();
  } catch (error) {
    transaction.splitStatus = "FAILED";
    transaction.providerStatus = "FAILED";
    transaction.failureCode = String(error?.code || "EASY_SPLIT_REQUEST_FAILED").slice(0, 120);
    transaction.failureMessageSafe = "Cashfree allocation could not be confirmed. Retry is safe.";
    await transaction.save();
    logger.warn("Cashfree Easy Split allocation failed", { requestId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), internalOrderId: String(payment.orderId), cashfreeOrderId: payment.cashfreeOrderId, providerStatus: transaction.providerStatus });
    throw error;
  }

  await createActivity({ action: "CASHFREE_SPLIT_ALLOCATED", description: "Cashfree payment allocation recorded", restaurantId: payment.restaurant, targetId: transaction._id, targetType: "SettlementTransaction", metadata: { cashfreeOrderId: payment.cashfreeOrderId, providerVendorId: transaction.providerVendorId, providerStatus: transaction.providerStatus } });
  return { transaction, idempotent: false };
};

const updateTransactionFromProvider = async (transaction, payload) => {
  const status = providerStatusFrom(payload);
  transaction.providerStatus = status;
  transaction.providerSplitReference = safeProviderReference(payload) || transaction.providerSplitReference;
  transaction.providerSettlementId = safeSettlementReference(payload) || transaction.providerSettlementId;
  transaction.settlementStatus = settlementStatusFrom(status);
  transaction.settlementUpdatedAt = new Date();
  await transaction.save();
  return transaction;
};

export const refreshCashfreeSettlementTransaction = async (transaction) => {
  if (!isPhaseTwoEnabled()) throw new ApiError(503, "Easy Split payment allocation is disabled", "EASY_SPLIT_PAYMENTS_DISABLED");
  const result = await getEasySplitOrderDetails(transaction.cashfreeOrderId);
  const payload = result.payload?.data || result.payload || {};
  return updateTransactionFromProvider(transaction, payload);
};

export const processCashfreeSettlementWebhook = async ({ event, rawBody }) => {
  const eventType = String(event?.type || event?.event || "").toUpperCase();
  if (!eventType.startsWith("VENDOR_SETTLEMENT_")) return { handled: false };
  const payload = event?.data?.settlement || event?.data?.vendor_settlement || event?.data || event || {};
  const cashfreeOrderId = String(payload.order_id || event?.data?.order?.order_id || "").trim();
  const providerVendorId = String(payload.vendor_id || "").trim();
  const providerSettlementId = safeSettlementReference(payload);
  const eventKey = crypto.createHash("sha256").update(`${eventType}:${providerSettlementId || cashfreeOrderId}:${rawBody}`).digest("hex");
  let transaction = await SettlementTransaction.findOne({ ...(cashfreeOrderId ? { cashfreeOrderId } : {}), ...(providerVendorId ? { providerVendorId } : {}) }).sort({ createdAt: -1 });
  try {
    await SettlementWebhookEvent.create({ eventKey, settlementTransaction: transaction?._id || null, eventType });
  } catch (error) {
    if (error?.code === 11000) return { handled: true, idempotent: true, transaction };
    throw error;
  }
  if (!transaction) return { handled: true, unknown: true };
  transaction = await updateTransactionFromProvider(transaction, { ...payload, status: payload.status || eventType });
  await createActivity({ action: "CASHFREE_VENDOR_SETTLEMENT_STATUS_UPDATED", description: "Cashfree vendor settlement status updated", restaurantId: transaction.restaurant, targetId: transaction._id, targetType: "SettlementTransaction", metadata: { cashfreeOrderId: transaction.cashfreeOrderId, providerVendorId: transaction.providerVendorId, providerStatus: transaction.providerStatus } });
  return { handled: true, transaction };
};
