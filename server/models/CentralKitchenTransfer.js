import mongoose from "mongoose";

const lineSchema = new mongoose.Schema({
  centralInventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  destinationInventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", default: null },
  requisitionItem: { type: mongoose.Schema.Types.ObjectId, default: null },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionBatch", default: null },
  dispatchedQty: { type: Number, required: true, min: 0.000001 },
  receivedQty: { type: Number, default: 0, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 24 },
  discrepancyReason: { type: String, default: "", trim: true, maxlength: 500 },
}, { _id: true });
const activitySchema = new mongoose.Schema({ action: { type: String, required: true }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, at: { type: Date, default: Date.now }, note: { type: String, default: "", trim: true, maxlength: 500 } }, { _id: false });

const schema = new mongoose.Schema({
  transferNumber: { type: String, required: true, unique: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  centralKitchen: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchen", required: true, index: true },
  destinationOutlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
  requisition: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchenRequisition", default: null, index: true },
  status: { type: String, enum: ["READY", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"], default: "READY", index: true },
  items: { type: [lineSchema], validate: [(items) => items.length > 0, "A transfer needs at least one item"] },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  dispatchedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  dispatchIdempotencyKey: { type: String, default: "", trim: true, maxlength: 160 },
  receiveIdempotencyKeys: { type: [String], default: [] },
  history: { type: [activitySchema], default: [] },
}, { timestamps: true });

schema.index({ restaurant: 1, destinationOutlet: 1, status: 1, createdAt: -1 });
schema.index({ restaurant: 1, centralKitchen: 1, status: 1, createdAt: -1 });
export default mongoose.model("CentralKitchenTransfer", schema);
