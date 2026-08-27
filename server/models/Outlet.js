import mongoose from "mongoose";

const outletSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

outletSchema.index({ restaurant: 1, code: 1 }, { unique: true });
export default mongoose.model("Outlet", outletSchema);
