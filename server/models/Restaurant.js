import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    branchCode: { type: String, required: true, unique: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null, index: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, required: true },
    city: { type: String, index: true },
    gstNumber: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    website: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    reservationsEnabled: { type: Boolean, default: true },
    onlineOrdersEnabled: { type: Boolean, default: true },
    openingHours: { type: String, default: "09:00-23:00" },
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
