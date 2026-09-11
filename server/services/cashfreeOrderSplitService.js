import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import RestaurantSettlementProfile from "../models/RestaurantSettlementProfile.js";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import { getEasySplitVendor, getEasySplitOrderReconciliation } from "./cashfreeEasySplitService.js";
import { getCashfreeOrder } from "./cashfreeService.js";
import { calculateCommissionSplit, toPaise } from "./easySplitSettlementService.js";
import { diagnosticsFromError } from "../utils/cashfreeDiagnostics.js";

export const ORDER_CREATION_SPLIT = "ORDER_CREATION_SPLIT";

export const prepareOrderSplit = async (order, amount) => {
  const config = getCashfreeConfig();
  if (!config.easySplitEnabled || !config.easySplitPaymentsEnabled) return null;
  if (!["sandbox", "production"].includes(config.environment)) throw new ApiError(503, "Cashfree Easy Split environment is invalid", "EASY_SPLIT_ENVIRONMENT_INVALID");
  const restaurant = await Restaurant.findOne({ _id: order.restaurant, isActive: true }).select("_id");
  const outlet = await Outlet.findOne({ _id: order.outlet, restaurant: order.restaurant, isActive: true }).select("_id");
  if (!restaurant || !outlet) throw new ApiError(409, "Active restaurant and outlet are required for allocation");
  const profile = await RestaurantSettlementProfile.findOne({ restaurant: order.restaurant, provider: "CASHFREE" });
  if (!profile?.providerVendorId || profile.vendorStatus !== "ACTIVE" || profile.bankVerificationStatus !== "VERIFIED" || profile.settlementStatus !== "ACTIVE") {
    throw new ApiError(409, "Settlement account is not ready", "SETTLEMENT_ACCOUNT_NOT_READY");
  }
  const { payload: vendor } = await getEasySplitVendor(profile.providerVendorId);
  if (vendor?.vendor_id !== profile.providerVendorId || vendor?.status !== "ACTIVE") {
    throw new ApiError(409, "Cashfree vendor is not provider-verified ACTIVE", "SETTLEMENT_ACCOUNT_NOT_READY");
  }
  const commission = await RestaurantCommissionConfig.findOne({ restaurant: order.restaurant }).lean();
  const effectiveFrom = commission?.effectiveFrom || commission?.updatedAt || commission?.createdAt;
  if (!commission || !effectiveFrom || new Date(effectiveFrom) > new Date()) throw new ApiError(409, "Effective commission configuration required");
  const split = calculateCommissionSplit({ grossAmountPaise: toPaise(amount), ...commission });
  if (!split.vendorSharePaise) throw new ApiError(409, "Order-level Easy Split requires a positive vendor share");
  return { ...split, providerVendorId: profile.providerVendorId, effectiveFrom, capturedAt: new Date() };
};

export const ensureOrderSplitTransaction = async (payment) => {
  const split = payment.metadata?.easySplitCommission;
  if (payment.allocationStrategy !== ORDER_CREATION_SPLIT || !split?.providerVendorId) throw new ApiError(409, "Order split snapshot missing");
  const values = calculateCommissionSplit(split);
  try {
    return await SettlementTransaction.findOneAndUpdate({ payment: payment._id, provider: "CASHFREE" }, { $setOnInsert: {
      restaurant: payment.restaurant, outlet: payment.outlet, order: payment.orderId, payment: payment._id,
      provider: "CASHFREE", allocationStrategy: ORDER_CREATION_SPLIT,
      providerVendorId: split.providerVendorId, cashfreeOrderId: payment.cashfreeOrderId,
      cashfreePaymentId: payment.cashfreePaymentId || "", ...values,
      providerIdempotencyKey: payment.providerOrderIdempotencyKey || crypto.randomUUID(),
      splitStatus: "PENDING", settlementStatus: "NOT_SCHEDULED", providerStatus: "ORDER_CREATION_PENDING",
    } }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return SettlementTransaction.findOne({ payment: payment._id, provider: "CASHFREE" });
  }
};

export const assertProviderOrderSplit = (payment, order) => {
  const snapshot = payment.metadata?.easySplitCommission;
  const splits = order?.order_splits;
  if (order?.order_id !== payment.cashfreeOrderId || order?.order_currency !== "INR" || toPaise(order?.order_amount) !== toPaise(payment.amount)) {
    throw new ApiError(409, "Cashfree order does not match payment", "CASHFREE_ORDER_MISMATCH");
  }
  if (!Array.isArray(splits) || splits.length !== 1 || splits[0].vendor_id !== snapshot?.providerVendorId ||
      toPaise(splits[0].amount) !== snapshot?.vendorSharePaise) {
    throw new ApiError(409, "Cashfree has not confirmed the intended order split", "CASHFREE_ORDER_SPLIT_UNCONFIRMED");
  }
  return true;
};

export const persistOrderSplitError = async (payment, error, creation = false) => {
  if (payment.allocationStrategy !== ORDER_CREATION_SPLIT) return;
  const diagnostic = diagnosticsFromError(error);
  await SettlementTransaction.updateOne({ payment: payment._id, provider: "CASHFREE" }, { $set: {
    ...diagnostic, failureCode: String(error?.code || "CASHFREE_RECONCILIATION_FAILED").slice(0, 120),
    failureMessageSafe: diagnostic.providerErrorMessage || "Cashfree confirmation is pending; inspect provider diagnostics.",
    ...(creation ? { splitStatus: "FAILED", providerStatus: "ORDER_CREATION_FAILED" } : {}),
  } });
};

// Read-only provider reconciliation. A customer SUCCESS alone never allocates
// a split, and a merchant settlement cannot mark the vendor as settled.
export const reconcileOrderCreationSplit = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.allocationStrategy !== ORDER_CREATION_SPLIT) throw new ApiError(409, "Order split payment required");
  const transaction = await ensureOrderSplitTransaction(payment);
  if (payment.paymentStatus !== "PAID") return { transaction, pending: true };
  try {
    const order = await getCashfreeOrder(payment.cashfreeOrderId);
    assertProviderOrderSplit(payment, order);
    const { payload, providerHttpStatus } = await getEasySplitOrderReconciliation(payment.cashfreeOrderId);
    const rows = payload.data.filter((row) => row.merchant_order_id === payment.cashfreeOrderId);
    const payments = rows.filter((row) => row.entity_type === "transaction" && row.entity_id === payment.cashfreePaymentId);
    const settlement = payments[0];
    if (payments.length !== 1 || settlement.currency !== "INR" || settlement.sale_type !== "CREDIT" ||
        toPaise(settlement.amount) !== transaction.grossAmountPaise) {
      throw new ApiError(409, "Cashfree split detail mapping is unconfirmed", "CASHFREE_SPLIT_MAPPING_UNCONFIRMED");
    }
    const vendors = rows.filter((row) => row.entity_type === "vendor_commission" && row.merchant_vendor_id === transaction.providerVendorId && row.sale_type === "CREDIT");
    const vendor = vendors[0];
    // The vendor_commission entity is the allocation reference. A settlement
    // ID may still be absent until the vendor's scheduled bank settlement.
    const reference = typeof vendor?.entity_id === "string" ? vendor.entity_id : "";
    if (vendors.length !== 1 || !reference || vendor.currency !== "INR" || toPaise(vendor.amount) !== transaction.vendorSharePaise ||
        toPaise(settlement.merchant_vendor_commission) !== transaction.vendorSharePaise || toPaise(settlement.eligible_split_balance) !== 0) {
      throw new ApiError(409, "Cashfree vendor allocation is unconfirmed", "CASHFREE_VENDOR_ALLOCATION_UNCONFIRMED");
    }
    if (!["YES", "NO"].includes(vendor.settled)) throw new ApiError(409, "Cashfree vendor settlement state is unconfirmed", "CASHFREE_VENDOR_SETTLEMENT_UNCONFIRMED");
    const settlementStatus = vendor.settled === "YES" ? "SETTLED" : "PENDING";
    const settlementReference = vendor.vendor_settlement_id && vendor.vendor_settlement_id !== "N/A" ? String(vendor.vendor_settlement_id) : "";
    // Atomic condition prevents a slower pending read from overwriting a
    // concurrent, provider-confirmed bank settlement.
    const updated = await SettlementTransaction.findOneAndUpdate({ _id: transaction._id, ...(settlementStatus === "PENDING" ? { settlementStatus: { $ne: "SETTLED" } } : {}) }, { $set: {
      cashfreePaymentId: payment.cashfreePaymentId, splitStatus: "ALLOCATED",
      providerStatus: "ALLOCATED", providerSplitReference: reference, providerAllocationReference: reference,
      providerSettlementId: settlementReference, providerSettlementReference: settlementReference,
      providerSettlementStatus: vendor.settled === "YES" ? "SETTLED" : "PENDING", settlementAmountPaise: vendor.settled === "YES" ? toPaise(vendor.amount) : null,
      settlementStatus,
      providerHttpStatus, providerErrorCode: "", providerErrorType: "", providerErrorMessage: "",
      failureCode: "", failureMessageSafe: "", settlementUpdatedAt: new Date(),
      splitCreatedAt: transaction.splitCreatedAt || new Date(), lastReconciledAt: new Date(),
      ...(settlementStatus === "SETTLED" && !transaction.settledAt ? { settledAt: new Date() } : {}),
    } }, { new: true });
    return { transaction: updated || await SettlementTransaction.findById(transaction._id), idempotent: transaction.splitStatus === "ALLOCATED" };
  } catch (error) {
    await persistOrderSplitError(payment, error);
    throw error;
  }
};
