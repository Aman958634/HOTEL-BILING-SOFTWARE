import mongoose from "mongoose";

const loyaltyAccountSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    currentPoints: { type: Number, default: 0, min: 0 },
    lifetimeEarnedPoints: { type: Number, default: 0, min: 0 },
    lifetimeRedeemedPoints: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    joinedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

loyaltyAccountSchema.index({ restaurant: 1, customer: 1 }, { unique: true, name: "loyalty_account_customer_restaurant_unique" });

export default mongoose.model("LoyaltyAccount", loyaltyAccountSchema);
