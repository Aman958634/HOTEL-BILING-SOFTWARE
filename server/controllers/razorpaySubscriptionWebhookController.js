import crypto from "crypto";
import SaasPayment from "../models/SaasPayment.js";
import RazorpaySubscriptionWebhookEvent from "../models/RazorpaySubscriptionWebhookEvent.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyWebhookSignature } from "../services/razorpaySubscriptionService.js";
import { verifyAndActivatePayment } from "./superAdminSubscriptionsController.js";

const digest = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const safeEventId = (req, raw) => String(req.get("x-razorpay-event-id") || `body_${digest(raw)}`).slice(0, 240);

const getPaymentEntity = (body) => body?.payload?.payment?.entity || null;

/**
 * POST /api/webhooks/razorpay
 * Raw body verification happens before JSON parsing. Only captured SaaS
 * payments associated with a local subscription attempt are actionable.
 */
export const razorpaySubscriptionWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body;
  const signature = req.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(401, "Invalid webhook signature");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ApiError(400, "Invalid webhook payload");
  }

  const providerPayment = getPaymentEntity(event);
  const eventId = safeEventId(req, rawBody);
  let webhookEvent;
  try {
    webhookEvent = await RazorpaySubscriptionWebhookEvent.create({
      eventId,
      eventType: String(event?.event || "").slice(0, 120),
      providerOrderId: providerPayment?.order_id || null,
      providerPaymentId: providerPayment?.id || null,
      payloadDigest: digest(rawBody),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(200).json({ success: true, duplicate: true });
    throw error;
  }

  const eventType = String(event?.event || "");
  if (eventType === "payment.failed" && providerPayment?.order_id) {
    const failedAttempt = await SaasPayment.findOne({
      purpose: "SUBSCRIPTION",
      provider: "RAZORPAY",
      status: "pending",
      $or: [
        { providerOrderId: String(providerPayment.order_id) },
        { gatewayOrderId: String(providerPayment.order_id) },
      ],
    }).sort({ createdAt: -1 });
    if (failedAttempt) {
      failedAttempt.status = "failed";
      failedAttempt.metadata = { ...(failedAttempt.metadata || {}), providerFailure: true, providerFailureAt: new Date().toISOString() };
      await failedAttempt.save();
      webhookEvent.payment = failedAttempt._id;
    }
    webhookEvent.status = "processed";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return res.status(200).json({ success: true });
  }

  const relevant = ["payment.captured", "order.paid"].includes(eventType);
  if (!relevant || String(providerPayment?.status || "").toLowerCase() !== "captured") {
    webhookEvent.status = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return res.status(200).json({ success: true, ignored: true });
  }

  const payment = await SaasPayment.findOne({
    purpose: "SUBSCRIPTION",
    provider: "RAZORPAY",
    $or: [
      { providerOrderId: String(providerPayment.order_id || "") },
      { gatewayOrderId: String(providerPayment.order_id || "") },
    ],
  }).sort({ createdAt: -1 });

  if (!payment) {
    webhookEvent.status = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    await verifyAndActivatePayment({
      payment,
      restaurantId: payment.restaurant,
      performedBy: null,
      source: "razorpay_webhook",
      razorpay_order_id: providerPayment.order_id,
      razorpay_payment_id: providerPayment.id,
      verifiedProviderPayment: providerPayment,
    });
    webhookEvent.status = "processed";
    webhookEvent.payment = payment._id;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    webhookEvent.status = "failed";
    webhookEvent.payment = payment._id;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    throw error;
  }
});
