import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import { assertCashfreeConfiguration, getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";

const request = async (path, { method = "GET", body, idempotencyKey } = {}) => {
  const config = assertCashfreeConfiguration();
  if (!config.configured) {
    throw new ApiError(503, "Cashfree payment service is not configured. Configure CASHFREE_ENV, CASHFREE_APP_ID, and CASHFREE_SECRET_KEY on the backend.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-version": config.apiVersion,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-request-id": crypto.randomUUID(),
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.message || payload?.type || "Cashfree request failed");
      throw new ApiError(response.status >= 500 ? 503 : 422, message);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") throw new ApiError(504, "Cashfree request timed out");
    throw new ApiError(503, "Cashfree payment service is unavailable");
  } finally {
    clearTimeout(timeout);
  }
};

const safePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
};

export const makeCashfreeOrderId = () => `RS_CF_${crypto.randomUUID().replace(/-/g, "")}`;

export const createCashfreeOrder = async ({ cashfreeOrderId, amount, customer, order }) => {
  const phone = safePhone(customer?.phone);
  if (!phone) throw new ApiError(422, "Cashfree requires a customer phone number");

  const customerDetails = {
    customer_id: customer?._id ? `rs_customer_${String(customer._id)}` : `rs_guest_${String(order._id)}`,
    customer_phone: phone,
  };
  const name = String(customer?.fullName || "").trim();
  const email = String(customer?.email || "").trim();
  if (name) customerDetails.customer_name = name;
  if (email) customerDetails.customer_email = email;

  return request("/orders", {
    method: "POST",
    idempotencyKey: crypto.randomUUID(),
    body: {
      order_id: cashfreeOrderId,
      order_amount: Number(amount).toFixed(2),
      order_currency: "INR",
      customer_details: customerDetails,
      order_meta: { return_url: getCashfreeReturnUrl() },
      order_note: `RestoSphere ${String(order.orderNumber || "order").slice(0, 80)}`,
    },
  });
};

export const getCashfreeOrder = (cashfreeOrderId) => request(`/orders/${encodeURIComponent(cashfreeOrderId)}`);
export const getCashfreePayments = (cashfreeOrderId) => request(`/orders/${encodeURIComponent(cashfreeOrderId)}/payments`);

export const verifyCashfreeWebhook = ({ signature, timestamp, rawBody }) => {
  const { secretKey } = getCashfreeConfig();
  if (!signature || !timestamp || !rawBody || !secretKey) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(`${timestamp}${rawBody}`).digest("base64");
  const received = Buffer.from(String(signature));
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && crypto.timingSafeEqual(received, calculated);
};

export const cashfreePaymentState = (payments = []) => {
  const list = Array.isArray(payments) ? payments : [];
  const successful = list.find((payment) => String(payment?.payment_status || "").toUpperCase() === "SUCCESS");
  if (successful) return { status: "SUCCESS", payment: successful };
  const pending = list.find((payment) => ["PENDING", "NOT_ATTEMPTED", "ACTIVE", "USER_DROPPED"].includes(String(payment?.payment_status || "").toUpperCase()));
  if (pending) return { status: "PENDING", payment: pending };
  const failed = list.find((payment) => ["FAILED", "CANCELLED"].includes(String(payment?.payment_status || "").toUpperCase()));
  return { status: failed ? "FAILED" : "PENDING", payment: failed || list[0] || null };
};
