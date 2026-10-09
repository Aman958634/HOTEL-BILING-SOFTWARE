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
    state: { type: String, default: "", trim: true, index: true },
    gstNumber: { type: String, default: "" },
    // Tenant-wide rate used for newly created orders. Missing legacy settings resolve to 0.
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    // Applied to new POS orders only. Saved orders retain their calculated discount.
    defaultDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    logoUrl: { type: String, default: "" },
    website: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    // Archived tenants are retained for financial and audit history; they can never authenticate.
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reservationsEnabled: { type: Boolean, default: true },
    onlineOrdersEnabled: { type: Boolean, default: true },
    kitchenDisplayEnabled: { type: Boolean, default: true },
    // Opt-in operational mode for restaurants using printed KOT slips rather
    // than the live KDS lifecycle. It is active only while KDS is disabled.
    simpleOrderWorkflowEnabled: { type: Boolean, default: false },
    openingHours: { type: String, default: "09:00-23:00" },
    // IANA timezone used for business-day boundaries in reports and BI.
    timeZone: { type: String, default: "Asia/Kolkata", trim: true },
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
