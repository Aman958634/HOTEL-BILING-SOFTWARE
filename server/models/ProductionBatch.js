import mongoose from "mongoose";
const activitySchema = new mongoose.Schema({ action: { type: String, required: true }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, at: { type: Date, default: Date.now }, note: { type: String, default: "", trim: true, maxlength: 500 } }, { _id: false });

const schema = new mongoose.Schema({
  batchNumber: { type: String, required: true, unique: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  centralKitchen: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchen", required: true, index: true },
  recipe: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true },
  recipeVersion: { type: Number, required: true, min: 1 },
  outputInventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  plannedQty: { type: Number, required: true, min: 0.000001 },
  actualQty: { type: Number, default: null, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 24 },
  status: { type: String, enum: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], default: "PLANNED", index: true },
  productionLossQty: { type: Number, default: 0, min: 0 },
  lossReason: { type: String, default: "", trim: true, maxlength: 500 },
  expiryDate: { type: Date, default: null },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  history: { type: [activitySchema], default: [] },
}, { timestamps: true });

schema.index({ restaurant: 1, centralKitchen: 1, status: 1, createdAt: -1 });
schema.index({ restaurant: 1, outputInventoryItem: 1, createdAt: -1 });
export default mongoose.model("ProductionBatch", schema);
