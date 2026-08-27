import mongoose from "mongoose";

const kitchenStationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

kitchenStationSchema.index({ restaurant: 1, sortOrder: 1 });

const KitchenStation = mongoose.model("KitchenStation", kitchenStationSchema);
export default KitchenStation;
