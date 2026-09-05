import mongoose from "mongoose";

const lineSchema = new mongoose.Schema({
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  itemName: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  unit: { type: String, required: true, trim: true },
  baseQuantity: { type: Number, required: true, min: 0.000001 },
  baseUnit: { type: String, required: true, trim: true },
  costPerUnit: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
}, { _id: true });

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  at: { type: Date, default: Date.now },
  note: { type: String, default: "" },
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, default: null },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
  status: { type: String, enum: ["DRAFT", "PLACED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"], default: "DRAFT", index: true },
  lines: { type: [lineSchema], required: true, validate: (lines) => lines.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  notes: { type: String, default: "", maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

purchaseOrderSchema.index({ restaurant: 1, outlet: 1, createdAt: -1 });
purchaseOrderSchema.index({ restaurant: 1, supplier: 1, status: 1 });
purchaseOrderSchema.index({ restaurant: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);