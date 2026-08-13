import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, unique: true, index: true },
    type: { type: String, enum: ["percent", "flat"], default: "percent" },
    value: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
