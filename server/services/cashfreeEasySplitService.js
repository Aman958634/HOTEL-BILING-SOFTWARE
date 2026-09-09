import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import { getCashfreeConfig } from "../config/cashfree.js";

export const assertEasySplitAvailable = () => {
  const config = getCashfreeConfig();
  if (!config.easySplitEnabled) throw new ApiError(503, "Easy Split activation is required", "EASY_SPLIT_ACTIVATION_REQUIRED");
  if (!config.configured) throw new ApiError(503, "Cashfree Easy Split is not configured on the backend", "EASY_SPLIT_NOT_CONFIGURED");
  // Phase 1 is deliberately test-only. A production launch requires review.
  if (config.environment !== "sandbox") throw new ApiError(503, "Cashfree Easy Split onboarding is sandbox-only", "EASY_SPLIT_SANDBOX_ONLY");
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

const easySplitRequest = async (path, { method = "GET", body, idempotencyKey } = {}) => {
  const config = assertEasySplitAvailable();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-version": config.easySplitApiVersion,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-request-id": crypto.randomUUID(),
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status >= 500 ? 503 : 422, "Cashfree vendor onboarding request was rejected", "EASY_SPLIT_PROVIDER_REJECTED");
    return { payload, providerRequestId: response.headers.get("x-request-id") || "" };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") throw new ApiError(504, "Cashfree vendor onboarding timed out", "EASY_SPLIT_TIMEOUT");
    throw new ApiError(503, "Cashfree vendor onboarding is unavailable", "EASY_SPLIT_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
};

export const createEasySplitVendor = ({ payload, idempotencyKey }) => easySplitRequest("/easy-split/vendors", { method: "POST", body: payload, idempotencyKey });
export const getEasySplitVendor = (vendorId) => easySplitRequest(`/easy-split/vendors/${encodeURIComponent(vendorId)}`);
