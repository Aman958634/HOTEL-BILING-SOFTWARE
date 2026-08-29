import mongoose from "mongoose";

const centralKitchenSchema = new mongoose.Schema({ restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true }, name: { type: String, required: true, trim: true }, code: { type: String, required: true, trim: true, uppercase: true }, address: { type: String, default: "", trim: true }, timezone: { type: String, default: "Asia/Kolkata", trim: true }, isActive: { type: Boolean, default: true, index: true } }, { timestamps: true });
centralKitchenSchema.index({ restaurant: 1, code: 1 }, { unique: true });
centralKitchenSchema.index({ restaurant: 1, isActive: 1, name: 1 });
export default mongoose.model("CentralKitchen", centralKitchenSchema);
