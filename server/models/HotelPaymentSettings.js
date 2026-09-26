import mongoose from "mongoose";

const hotelPaymentSettingsSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    payeeName: { type: String, trim: true, default: "" },
    upiId: { type: String, trim: true, default: "" },
    isEnabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["ACTIVE", "DISABLED", "PENDING_REVIEW"],
      default: "DISABLED",
      index: true,
    },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

hotelPaymentSettingsSchema.index(
  { hotelId: 1, restaurant: 1, outlet: 1 },
  { unique: true, name: "hotel_upi_settings_scope_unique" }
);

const HotelPaymentSettings = mongoose.model("HotelPaymentSettings", hotelPaymentSettingsSchema);
export default HotelPaymentSettings;
