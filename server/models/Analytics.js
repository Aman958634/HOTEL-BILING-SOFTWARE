import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    day: { type: Date, required: true, index: true },
    orders: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    topFoods: [{ food: { type: mongoose.Schema.Types.ObjectId, ref: "Food" }, quantity: Number }],
  },
  { timestamps: true }
);

analyticsSchema.index({ restaurant: 1, day: 1 }, { unique: true });

const Analytics = mongoose.model("Analytics", analyticsSchema);
export default Analytics;
