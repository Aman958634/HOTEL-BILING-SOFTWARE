import mongoose from "mongoose";

const receiptLineSchema = new mongoose.Schema({
  poLine: { type: mongoose.Schema.Types.ObjectId, required: true },
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  receivedQuantity: { type: Number, required: true, min: 0.000001 },
  unit: { type: String, required: true, trim: true },
  baseQuantity: { type: Number, required: true, min: 0.000001 },
  baseUnit: { type: String, required: true, trim: true },
}, { _id: false });

const goodsReceiptSchema = new mongoose.Schema({
  grnNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  lines: { type: [receiptLineSchema], required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receivedAt: { type: Date, default: Date.now },
  notes: { type: String, default: "", maxlength: 2000 },
}, { timestamps: true });

goodsReceiptSchema.index({ restaurant: 1, idempotencyKey: 1 }, { unique: true });
goodsReceiptSchema.index({ restaurant: 1, outlet: 1, createdAt: -1 });

export default mongoose.model("GoodsReceipt", goodsReceiptSchema);