import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true, index: true },
    address: { type: String, trim: true, default: "" },
    logo: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "trial"],
      default: "trial",
      index: true,
    },
    plan: {
      type: String,
      enum: ["basic", "professional", "enterprise"],
      default: "basic",
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "expired", "cancelled", "trial"],
      default: "trial",
      index: true,
    },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
  },
  { timestamps: true }
);

hotelSchema.index({ slug: 1 });

const Hotel = mongoose.model("Hotel", hotelSchema);
export default Hotel;
