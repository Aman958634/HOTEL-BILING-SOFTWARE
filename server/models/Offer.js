import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
