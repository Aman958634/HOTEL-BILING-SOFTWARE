import mongoose from "mongoose";

// Raw webhook payloads are deliberately not stored: they can be large and are
// not needed after signature verification. The immutable event reference and
// payload digest provide replay protection without retaining payment details.
const razorpaySubscriptionWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY", required: true },
    eventId: { type: String, required: true, trim: true },
    eventType: { type: String, default: "", trim: true },
    providerOrderId: { type: String, default: null, index: true },
    providerPaymentId: { type: String, default: null, index: true },
    payloadDigest: { type: String, required: true },
    status: { type: String, enum: ["received", "processed", "ignored", "failed"], default: "received" },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "SaasPayment", default: null, index: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

razorpaySubscriptionWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export default mongoose.model("RazorpaySubscriptionWebhookEvent", razorpaySubscriptionWebhookEventSchema);
