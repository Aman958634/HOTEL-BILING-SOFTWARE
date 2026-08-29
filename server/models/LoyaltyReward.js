import mongoose from "mongoose";

const loyaltyRewardSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["DISCOUNT_AMOUNT", "DISCOUNT_PERCENT"], required: true },
    pointsRequired: { type: Number, required: true, min: 1 },
    value: { type: Number, required: true, min: 0.01 },
    active: { type: Boolean, default: true, index: true },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    eligibleOrderTypes: { type: [String], enum: ["DINE_IN", "TAKEAWAY", "DELIVERY", "PICKUP"], default: [] },
  },
  { timestamps: true }
);

loyaltyRewardSchema.index({ restaurant: 1, active: 1, createdAt: -1 });
export default mongoose.model("LoyaltyReward", loyaltyRewardSchema);
