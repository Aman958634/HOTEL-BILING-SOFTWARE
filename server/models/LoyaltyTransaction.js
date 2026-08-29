import mongoose from "mongoose";

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "LoyaltyAccount", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    type: { type: String, enum: ["EARN", "REDEEM", "ADJUSTMENT", "EXPIRY", "REVERSAL"], required: true, index: true },
    // Signed value. Positive values credit points; negative values debit them.
    points: { type: Number, required: true },
    previousBalance: { type: Number, required: true, min: 0 },
    newBalance: { type: Number, required: true, min: 0 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    reward: { type: mongoose.Schema.Types.ObjectId, ref: "LoyaltyReward", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Stable event key makes payment callbacks, retries and reversals idempotent.
    eventKey: { type: String, default: "", trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ restaurant: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: "string", $gt: "" } }, name: "loyalty_transaction_event_unique" });
loyaltyTransactionSchema.index({ account: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ restaurant: 1, type: 1, createdAt: -1 });

export default mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);
