import mongoose from "mongoose";

const commissionConfigSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, unique: true, index: true },
    commissionType: { type: String, enum: ["NONE", "PERCENTAGE", "FIXED"], default: "NONE" },
    // Percent is represented in basis points (100 = 1%) so calculations never
    // depend on JavaScript floating point arithmetic.
    commissionBps: { type: Number, default: 0, min: 0, max: 10000 },
    fixedAmountPaise: { type: Number, default: 0, min: 0 },
    // A payment can only use a commission configuration that existed when
    // Cashfree success was verified. This prevents a later configuration
    // change from retroactively allocating an old customer payment.
    effectiveFrom: { type: Date, default: Date.now, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("RestaurantCommissionConfig", commissionConfigSchema);
