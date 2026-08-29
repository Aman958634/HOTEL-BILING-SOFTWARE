import mongoose from "mongoose";

const lineSchema = new mongoose.Schema({
  centralInventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  requestedQty: { type: Number, required: true, min: 0.000001 },
  approvedQty: { type: Number, default: 0, min: 0 },
  dispatchedQty: { type: Number, default: 0, min: 0 },
  fulfilledQty: { type: Number, default: 0, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 24 },
}, { _id: true });
const activitySchema = new mongoose.Schema({ action: { type: String, required: true }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, at: { type: Date, default: Date.now }, note: { type: String, default: "", trim: true, maxlength: 500 } }, { _id: false });

const schema = new mongoose.Schema({
  requisitionNumber: { type: String, required: true, unique: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  centralKitchen: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchen", required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
  status: { type: String, enum: ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PARTIALLY_DISPATCHED", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"], default: "SUBMITTED", index: true },
  items: { type: [lineSchema], validate: [(items) => items.length > 0, "A requisition needs at least one item"] },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  rejectionReason: { type: String, default: "", trim: true, maxlength: 500 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: { type: [activitySchema], default: [] },
}, { timestamps: true });

schema.index({ restaurant: 1, outlet: 1, status: 1, createdAt: -1 });
schema.index({ restaurant: 1, centralKitchen: 1, status: 1, createdAt: -1 });
export default mongoose.model("CentralKitchenRequisition", schema);
