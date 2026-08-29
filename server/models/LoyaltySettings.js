import mongoose from "mongoose";

const loyaltySettingsSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    spendPerPoint: { type: Number, default: 100, min: 0.01 },
    minimumOrderAmount: { type: Number, default: 0, min: 0 },
    // Monetary value of one point for bill redemption.
    pointValue: { type: Number, default: 0.5, min: 0.01 },
    minimumRedemptionPoints: { type: Number, default: 100, min: 1 },
    maxRedemptionPercent: { type: Number, default: 25, min: 0, max: 100 },
    eligibleOrderTypes: { type: [String], enum: ["DINE_IN", "TAKEAWAY", "DELIVERY", "PICKUP"], default: ["DINE_IN", "TAKEAWAY", "DELIVERY", "PICKUP"] },
    includeTaxes: { type: Boolean, default: false },
    includeDeliveryCharge: { type: Boolean, default: false },
    maxPointsPerOrder: { type: Number, default: null, min: 1 },
    expiryMonths: { type: Number, default: 0, min: 0, max: 120 },
  },
  { timestamps: true }
);

export default mongoose.model("LoyaltySettings", loyaltySettingsSchema);
