import crypto from "crypto";
import Razorpay from "razorpay";
import ApiError from "../utils/ApiError.js";

let platformRazorpayClient = null;

const safeEqual = (expected, supplied) => {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const suppliedBuffer = Buffer.from(String(supplied || ""), "utf8");
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
};

export const isSubscriptionTestMode = () =>
  process.env.NODE_ENV !== "production" && String(process.env.BILLING_TEST_MODE || "").toLowerCase() === "true";

export const getPlatformSubscriptionRazorpayClient = () => {
  if (platformRazorpayClient) return platformRazorpayClient;
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) return null;
  // These are only platform merchant credentials. No Route/linked-account
  // options are accepted or passed for SaaS subscription orders.
  platformRazorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return platformRazorpayClient;
};

export const toPaise = (amount) => {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new ApiError(400, "Invalid plan amount");
  return paise;
};

export const verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!secret) throw new ApiError(503, "Payment gateway is not configured");
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
};

export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new ApiError(503, "Webhook is not configured");
  if (!Buffer.isBuffer(rawBody) || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
};

export const assertCapturedSubscriptionPayment = ({ providerPayment, orderId, amount, currency }) => {
  if (!providerPayment || String(providerPayment.id || "").length === 0) {
    throw new ApiError(422, "Payment verification failed");
  }
  if (
    String(providerPayment.order_id || "") !== String(orderId || "") ||
    Number(providerPayment.amount) !== toPaise(amount) ||
    String(providerPayment.currency || "").toUpperCase() !== String(currency || "INR").toUpperCase() ||
    String(providerPayment.status || "").toLowerCase() !== "captured"
  ) {
    throw new ApiError(422, "Payment verification failed");
  }
  return providerPayment;
};

export default {
  getPlatformSubscriptionRazorpayClient,
  isSubscriptionTestMode,
  toPaise,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  assertCapturedSubscriptionPayment,
};
