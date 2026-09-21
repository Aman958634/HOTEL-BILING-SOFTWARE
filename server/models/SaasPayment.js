import crypto from "crypto";
import mongoose from "mongoose";

const saasPaymentSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, enum: ["monthly", "yearly", "fixed"], default: "monthly" },
    durationMonths: { type: Number, default: 1, min: 1 },
    durationLabel: { type: String, default: null },
    /** This collection is exclusively the RestoSphere platform SaaS ledger. */
    purpose: { type: String, enum: ["SUBSCRIPTION"], default: "SUBSCRIPTION", required: true, index: true },
    internalReference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => `sub_${crypto.randomUUID()}`,
    },
    idempotencyKey: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    gateway: { type: String, default: "razorpay" },
    gatewayOrderId: { type: String, default: null, index: true },
    gatewayPaymentId: { type: String, default: null, index: true },
    // Explicit provider aliases keep subscription payments distinct from the
    // restaurant operational Payment collection while retaining compatibility
    // with existing receipt/admin views that read gateway* fields.
    provider: { type: String, enum: ["RAZORPAY", "TEST"], default: "RAZORPAY", required: true },
    providerOrderId: { type: String, default: null, index: true },
    providerPaymentId: { type: String, default: null, index: true },
    /** Safe Razorpay method label: card | upi | netbanking | wallet | etc. Never stores card numbers/CVV. */
    paymentMethod: { type: String, default: null, index: true },
    paidAt: { type: Date, default: null, index: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

saasPaymentSchema.index({ createdAt: -1 });
saasPaymentSchema.index(
  { restaurant: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
saasPaymentSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });

const SaasPayment = mongoose.model("SaasPayment", saasPaymentSchema);
export default SaasPayment;
