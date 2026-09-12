import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildReceiptBuffer } from "../utils/paymentUtils.js";
import { redactLogText, safeErrorContext } from "../utils/safeLog.js";

const GRAPH_ROOT = "https://graph.facebook.com";
const statusValues = ["NOT_SENT", "PENDING", "SENT", "FAILED"];

export const normalizeWhatsAppPhone = (value, defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91") => {
  const digits = String(value || "").replace(/\D/g, "");
  const country = String(defaultCountryCode || "91").replace(/\D/g, "");
  if (!country || !digits) return "";
  const local = digits.startsWith("00") ? digits.slice(2) : digits;
  const normalized = local.length === 10 ? `${country}${local}` : local;
  return /^\d{10,15}$/.test(normalized) ? normalized : "";
};

const maskedPhone = (value) => value ? `***${String(value).slice(-4)}` : "missing";
const enabled = () => String(process.env.WHATSAPP_ENABLED || "false").trim().toLowerCase() === "true";

export const getWhatsAppConfig = () => {
  const config = {
    enabled: enabled(),
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
    apiVersion: String(process.env.WHATSAPP_API_VERSION || "v22.0").trim(),
    receiptTemplateName: String(process.env.WHATSAPP_RECEIPT_TEMPLATE_NAME || "").trim(),
  };
  config.configured = Boolean(config.phoneNumberId && config.accessToken && config.apiVersion && config.receiptTemplateName);
  return config;
};

export const assertWhatsAppConfiguration = () => {
  const config = getWhatsAppConfig();
  if (config.enabled && !config.configured) throw new Error("WhatsApp is enabled but its production configuration is incomplete");
  return config;
};

const providerError = async (response) => {
  const payload = await response.json().catch(() => ({}));
  const error = payload?.error || payload || {};
  return {
    code: String(error.code || error.error_subcode || "WHATSAPP_PROVIDER_REJECTED").slice(0, 120),
    message: redactLogText(String(error.message || "WhatsApp provider request failed")).slice(0, 500),
  };
};

const graphRequest = async (path, { body, form } = {}) => {
  const config = assertWhatsAppConfiguration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${GRAPH_ROOT}/${config.apiVersion}/${config.phoneNumberId}${path}`, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${config.accessToken}`, ...(form ? {} : { "content-type": "application/json" }) },
      body: form || JSON.stringify(body),
    });
    if (!response.ok) {
      const details = await providerError(response);
      throw new ApiError(response.status >= 500 ? 503 : 422, "WhatsApp receipt delivery was rejected", "WHATSAPP_PROVIDER_REJECTED", details);
    }
    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") throw new ApiError(504, "WhatsApp receipt delivery timed out", "WHATSAPP_TIMEOUT");
    throw new ApiError(503, "WhatsApp receipt delivery is unavailable", "WHATSAPP_UNAVAILABLE");
  } finally { clearTimeout(timer); }
};

const uploadReceiptMedia = async ({ buffer, filename }) => {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  const data = await graphRequest("/media", { form });
  if (!data?.id) throw new ApiError(502, "WhatsApp media upload did not return an ID", "WHATSAPP_MEDIA_INVALID");
  return String(data.id);
};

const sendReceiptTemplate = async ({ to, mediaId, filename, customerName, restaurantName, orderNumber, amount }) => {
  const config = getWhatsAppConfig();
  const data = await graphRequest("/messages", { body: {
    messaging_product: "whatsapp", to, type: "template",
    template: {
      name: config.receiptTemplateName,
      language: { code: "en_US" },
      components: [
        { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename } }] },
        { type: "body", parameters: [customerName || "Customer", restaurantName || "RestoSphere", orderNumber || "-", Number(amount || 0).toFixed(2)].map((text) => ({ type: "text", text: String(text) })) },
      ],
    },
  } });
  const id = data?.messages?.[0]?.id;
  if (!id) throw new ApiError(502, "WhatsApp delivery did not return a message ID", "WHATSAPP_MESSAGE_INVALID");
  return String(id);
};

const loadReceiptContext = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, "Payment not found");
  const order = await Order.findById(payment.orderId).populate("customer", "fullName phone email").populate("table", "tableNumber");
  if (!order || String(order.paymentStatus).toUpperCase() !== "PAID" || String(payment.paymentStatus).toUpperCase() !== "PAID") {
    throw new ApiError(409, "A final paid order is required before sending its receipt", "WHATSAPP_RECEIPT_NOT_FINAL");
  }
  const restaurant = await Restaurant.findById(payment.restaurant || order.restaurant).lean();
  const phone = normalizeWhatsAppPhone(order.customer?.phone || payment.metadata?.customerPhone);
  if (!phone) throw new ApiError(422, "Customer WhatsApp number is missing or invalid", "WHATSAPP_PHONE_INVALID");
  return { payment, order, restaurant, phone };
};

const claimDelivery = async (paymentId, { automatic }) => {
  const base = automatic
    ? { _id: paymentId, paymentStatus: "PAID", $and: [{ "whatsappReceipt.status": { $ne: "PENDING" } }, { "whatsappReceipt.status": { $ne: "SENT" } }, { "whatsappReceipt.automaticSent": { $ne: true } }] }
    : { _id: paymentId, paymentStatus: "PAID", "whatsappReceipt.status": { $ne: "PENDING" } };
  const claimed = await Payment.findOneAndUpdate(base, {
    $set: { "whatsappReceipt.status": "PENDING", "whatsappReceipt.lastAttemptAt": new Date(), ...(automatic ? { "whatsappReceipt.automaticSent": true } : {}) },
    $inc: { "whatsappReceipt.attemptCount": 1 },
  }, { new: true });
  return claimed;
};
const markFailure = async (paymentId, error) => Payment.updateOne({ _id: paymentId }, { $set: {
  "whatsappReceipt.status": "FAILED",
  "whatsappReceipt.errorCode": String(error?.code || "WHATSAPP_SEND_FAILED").slice(0, 120),
  "whatsappReceipt.errorMessage": redactLogText(String(error?.details?.message || error?.message || "WhatsApp receipt delivery failed")).slice(0, 500),
} });

export const sendPaymentReceiptWhatsApp = async ({ paymentId, automatic = false }) => {
  if (!enabled()) return { skipped: true, reason: "WHATSAPP_DISABLED" };
  // Validate before the atomic claim so bad deployment configuration never changes delivery state.
  assertWhatsAppConfiguration();
  const claimed = await claimDelivery(paymentId, { automatic });
  if (!claimed) return { skipped: true, reason: automatic ? "ALREADY_SENT_OR_IN_PROGRESS" : "SEND_IN_PROGRESS" };
  try {
    const { payment, order, restaurant, phone } = await loadReceiptContext(paymentId);
    logger.info("WhatsApp receipt send requested", { event: "WHATSAPP_RECEIPT_REQUESTED", orderNumber: order.orderNumber, paymentId: payment.paymentId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), phone: maskedPhone(phone), automatic });
    const buffer = await buildReceiptBuffer({ payment, order, restaurant });
    const filename = `receipt-${String(payment.paymentId || order.orderNumber).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    const mediaId = await uploadReceiptMedia({ buffer, filename });
    logger.info("WhatsApp receipt media uploaded", { event: "WHATSAPP_RECEIPT_MEDIA_UPLOADED", orderNumber: order.orderNumber, paymentId: payment.paymentId, restaurantId: String(payment.restaurant) });
    const messageId = await sendReceiptTemplate({ to: phone, mediaId, filename, customerName: order.customer?.fullName, restaurantName: restaurant?.name, orderNumber: order.orderNumber, amount: payment.amount });
    await Payment.updateOne({ _id: paymentId }, { $set: { "whatsappReceipt.status": "SENT", "whatsappReceipt.messageId": messageId, "whatsappReceipt.sentAt": new Date(), "whatsappReceipt.errorCode": "", "whatsappReceipt.errorMessage": "" } });
    logger.info("WhatsApp receipt sent", { event: "WHATSAPP_RECEIPT_SENT", orderNumber: order.orderNumber, paymentId: payment.paymentId, restaurantId: String(payment.restaurant), outletId: String(payment.outlet || ""), messageId });
    return { sent: true, messageId };
  } catch (error) {
    await markFailure(paymentId, error).catch((markError) => logger.error("WhatsApp receipt failure status update failed", { event: "WHATSAPP_RECEIPT_STATUS_FAILED", error: safeErrorContext(markError) }));
    logger.warn("WhatsApp receipt failed", { event: "WHATSAPP_RECEIPT_FAILED", paymentId: String(paymentId), error: safeErrorContext(error) });
    throw error;
  }
};

export const triggerSuccessfulPaymentSideEffects = async ({ order, payment, fullyPaid }) => {
  if (!fullyPaid || String(order?.paymentStatus).toUpperCase() !== "PAID" || String(payment?.paymentStatus).toUpperCase() !== "PAID") return { skipped: true, reason: "NOT_FINAL_PAID" };
  try { return await sendPaymentReceiptWhatsApp({ paymentId: payment._id, automatic: true }); }
  catch (error) { logger.warn("WhatsApp receipt side effect deferred", { event: "WHATSAPP_RECEIPT_DEFERRED", orderNumber: order.orderNumber, paymentId: payment.paymentId, restaurantId: String(payment.restaurant), error: safeErrorContext(error) }); return { failed: true, reason: error?.code || "WHATSAPP_SEND_FAILED" }; }
};

export const whatsappReceiptStatuses = statusValues;
