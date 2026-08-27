import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, required: true, index: true },
    price: { type: Number, default: 0 },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    status: {
      type: String,
      enum: ["trial", "active", "expired", "cancelled", "suspended"],
      default: "trial",
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    trialStartDate: { type: Date, default: null },
    trialEndDate: { type: Date, default: null },
    subscriptionStartAt: { type: Date, default: null },
    renewalDate: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

subscriptionSchema.index({ restaurant: 1, createdAt: -1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
