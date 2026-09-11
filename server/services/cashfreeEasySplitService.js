import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import { safeCashfreeError } from "../utils/cashfreeDiagnostics.js";

export const assertEasySplitAvailable = () => {
  const config = getCashfreeConfig();
  if (!config.easySplitEnabled) throw new ApiError(503, "Easy Split activation is required", "EASY_SPLIT_ACTIVATION_REQUIRED");
  if (!config.configured) throw new ApiError(503, "Cashfree Easy Split is not configured on the backend", "EASY_SPLIT_NOT_CONFIGURED");
  if (!["sandbox", "production"].includes(config.environment)) throw new ApiError(503, "Cashfree Easy Split environment is invalid", "EASY_SPLIT_ENVIRONMENT_INVALID");
  return config;
};

export const assertEasySplitPaymentsAvailable = () => {
  const config = assertEasySplitAvailable();
  if (!config.easySplitPaymentsEnabled) {
    throw new ApiError(503, "Easy Split payment allocation is disabled", "EASY_SPLIT_PAYMENTS_DISABLED");
  }
  return config;
};

export const generateProviderVendorId = (restaurantId) => `RESTO_${crypto.createHash("sha256").update(String(restaurantId)).digest("hex").slice(0, 20).toUpperCase()}`;

const digitsOnlyPhone = (value) => String(value || "").replace(/\D/g, "");
export const scheduleOptionFor = (cycle) => ({ "T+1": 1, "T+2": 2, WEEKLY: 11, MONTHLY: 12 })[String(cycle || "").toUpperCase()] || 1;


export const createEasySplitVendorPayload = ({ vendorId, restaurantName, email, phone, method, bank, upiVpa, settlementCycle, accountType, pan }) => {
  const normalizedMethod = String(method || "").toUpperCase();
  const payload = {
    vendor_id: vendorId,
    status: "ACTIVE",
    name: String(restaurantName || "").trim().slice(0, 100),
    email: String(email || "").trim(),
    phone: digitsOnlyPhone(phone),
    verify_account: true,
    dashboard_access: false,
    schedule_option: scheduleOptionFor(settlementCycle),
    // Cashfree requires KYC metadata; document collection remains provider-led.
    kyc_details: { account_type: String(accountType || "").trim(), business_type: "Food and Beverages", pan: String(pan || "").trim().toUpperCase() },
  };
  if (normalizedMethod === "BANK") {
    payload.bank = {
      account_number: String(bank?.accountNumber || "").replace(/\s/g, ""),
      account_holder: String(bank?.accountHolderName || "").trim(),
      ifsc: String(bank?.ifsc || "").trim().toUpperCase(),
    };
  } else if (normalizedMethod === "UPI") {
    payload.upi = { vpa: String(upiVpa || "").trim(), account_holder: String(restaurantName || "").trim().slice(0, 100) };
  } else {
    throw new ApiError(422, "Settlement account method is invalid");
  }
  return payload;
};

export const mapCashfreeVendorStatus = (status) => {
  const providerStatus = String(status || "PENDING").trim().toUpperCase();
  const failed = new Set(["BANK_VALIDATION_FAILED", "BENE_CREATION_FAILED", "ACTION_REQUIRED", "BLOCKED", "DELETED"]);
  const verified = new Set(["IN_BENE_CREATION", "IN_KYC_REVIEW", "ACTIVE"]);
  const known = new Set(["IN_BANK_VALIDATION", "BANK_VALIDATION_FAILED", "IN_BENE_CREATION", "BENE_CREATION_FAILED", "IN_KYC_REVIEW", "ACTION_REQUIRED", "ACTIVE", "ON_HOLD", "BLOCKED", "DELETED"]);
  return {
    providerStatus,
    vendorStatus: known.has(providerStatus) ? providerStatus : "CREATING",
    verificationStatus: failed.has(providerStatus) ? "FAILED" : verified.has(providerStatus) ? "VERIFIED" : "PENDING",
    settlementStatus: providerStatus === "ACTIVE" ? "ACTIVE" : providerStatus === "ON_HOLD" ? "ON_HOLD" : "PENDING",
  };
};

const easySplitRequest = async (path, { method = "GET", body, idempotencyKey, splitPayment = false } = {}) => {
  const config = splitPayment ? assertEasySplitPaymentsAvailable() : assertEasySplitAvailable();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-version": splitPayment ? config.easySplitSplitApiVersion : config.easySplitApiVersion,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-request-id": crypto.randomUUID(),
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        response.status >= 500 ? 503 : 422,
        "Cashfree Easy Split request was rejected",
        "EASY_SPLIT_PROVIDER_REJECTED",
        safeCashfreeError(response.status, payload),
      );
    }
    return { payload, providerRequestId: response.headers.get("x-request-id") || "", providerHttpStatus: response.status };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") throw new ApiError(504, "Cashfree Easy Split request timed out", "EASY_SPLIT_TIMEOUT");
    throw new ApiError(503, "Cashfree Easy Split is unavailable", "EASY_SPLIT_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
};

export const createEasySplitVendor = ({ payload, idempotencyKey }) => easySplitRequest("/easy-split/vendors", { method: "POST", body: payload, idempotencyKey });
export const getEasySplitVendor = (vendorId) => easySplitRequest(`/easy-split/vendors/${encodeURIComponent(vendorId)}`);

// Cashfree's documented Split After Payment endpoint accepts the order amount
// in INR (with up to two decimal places). Only the restaurant/vendor share is
// sent: the remainder stays with the platform account as its commission.
export const createEasySplitAfterPayment = ({ cashfreeOrderId, vendorId, vendorSharePaise, idempotencyKey }) => {
  if (!cashfreeOrderId || !vendorId || !Number.isSafeInteger(vendorSharePaise) || vendorSharePaise <= 0) {
    throw new ApiError(422, "A valid Cashfree order, vendor, and vendor share are required");
  }
  return easySplitRequest(`/easy-split/orders/${encodeURIComponent(cashfreeOrderId)}/split`, {
    method: "POST",
    idempotencyKey,
    splitPayment: true,
    body: {
      split: [{ vendor_id: vendorId, amount: Number((vendorSharePaise / 100).toFixed(2)) }],
      disable_split: true,
    },
  });
};

// Cashfree's published Payment Gateway OpenAPI contract documents this as
// "Get Settlements by Order ID". It is intentionally read-only and never
// creates a settlement, payout, or transfer.
export const getEasySplitOrderDetails = (cashfreeOrderId) => easySplitRequest(
  `/orders/${encodeURIComponent(cashfreeOrderId)}/settlements`,
  { method: "GET", splitPayment: true }
);

// Vendor-aware split details, unlike /orders/:id/settlements (merchant only).
// Contract: Cashfree v2023-08-01 split/settlements/split-details.
export const getEasySplitAllocationDetails = (cashfreeOrderId) => {
  assertEasySplitPaymentsAvailable();
  return easySplitRequest(`/easy-split/orders/${encodeURIComponent(cashfreeOrderId)}`);
};

// This POST is a read-only report query, not a split or settlement action.
// Its string entity_id preserves int64 payment IDs and identifies vendor
// allocation credits even before Cashfree assigns a bank settlement ID.
export const getEasySplitOrderReconciliation = async (cashfreeOrderId) => {
  assertEasySplitPaymentsAvailable();
  const data = [];
  const seen = new Set();
  let cursor;
  let result;
  do {
    result = await easySplitRequest("/split/order/vendor/recon", {
      method: "POST",
      body: { filters: { order_ids: [cashfreeOrderId] }, pagination: { limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    if (!Array.isArray(result.payload?.data)) throw new ApiError(502, "Cashfree reconciliation response is invalid", "CASHFREE_RECONCILIATION_INVALID");
    data.push(...result.payload.data);
    cursor = result.payload.cursor;
    if (cursor && (seen.has(cursor) || seen.size >= 20)) throw new ApiError(502, "Cashfree reconciliation pagination is incomplete", "CASHFREE_RECONCILIATION_INCOMPLETE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return { ...result, payload: { data } };
};
