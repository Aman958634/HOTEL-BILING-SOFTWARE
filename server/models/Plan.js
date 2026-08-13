import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, unique: true, index: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
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
