import mongoose from "mongoose";

const saasPaymentSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    gateway: { type: String, default: "razorpay" },
    gatewayOrderId: { type: String, default: null, index: true },
    gatewayPaymentId: { type: String, default: null, index: true },
    /** Safe Razorpay method label: card | upi | netbanking | wallet | etc. Never stores card numbers/CVV. */
    paymentMethod: { type: String, default: null, index: true },
    paidAt: { type: Date, default: null, index: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

saasPaymentSchema.index({ createdAt: -1 });

const SaasPayment = mongoose.model("SaasPayment", saasPaymentSchema);
export default SaasPayment;
