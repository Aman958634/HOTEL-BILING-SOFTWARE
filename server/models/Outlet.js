import mongoose from "mongoose";

const outletSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  address: { type: String, default: "", trim: true },
  city: { type: String, default: "", trim: true },
  state: { type: String, default: "", trim: true },
  country: { type: String, default: "India", trim: true },
  phone: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  timeZone: { type: String, default: "Asia/Kolkata", trim: true },
  gstNumber: { type: String, default: "", trim: true },
  isActive: { type: Boolean, default: true, index: true },
  isDefault: { type: Boolean, default: false, index: true },
}, { timestamps: true });

outletSchema.index({ restaurant: 1, code: 1 }, { unique: true });
outletSchema.index({ restaurant: 1, isActive: 1, name: 1 });
outletSchema.index({ restaurant: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export default mongoose.model("Outlet", outletSchema);
