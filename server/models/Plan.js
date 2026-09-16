import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, unique: true, index: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    // `fixed` plans are paid once for the configured duration; they are not recurring monthly plans.
    billingCycle: { type: String, enum: ["monthly", "yearly", "fixed"], default: "monthly" },
    durationMonths: { type: Number, default: 1, min: 1 },
    durationLabel: { type: String, default: "1 month" },
    monthlyEquivalentPrice: { type: Number, default: null, min: 0 },
    maxUsers: { type: Number, default: 50 },
    maxTables: { type: Number, default: 50 },
    maxMenuItems: { type: Number, default: 500 },
    maxOrders: { type: Number, default: 10000 },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", planSchema);
export default Plan;
