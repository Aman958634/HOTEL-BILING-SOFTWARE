import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  orderNumber: { type: String, required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  loyaltyDiscount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  serviceCharge: { type: Number, default: 0, min: 0 },
  deliveryCharge: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: false });

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  allocations: { type: [allocationSchema], required: true, validate: [(rows) => Array.isArray(rows) && rows.length > 0, "A bill requires at least one order"] },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  loyaltyDiscount: { type: Number, default: 0, min: 0 },
  taxableAmount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  serviceCharge: { type: Number, default: 0, min: 0 },
  deliveryCharge: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  balanceDue: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED", "REFUNDED"], default: "OPEN", index: true },
  idempotencyKey: { type: String, default: "", trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  settledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, default: "", trim: true },
  parentBill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
}, { timestamps: true });

billSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
billSchema.index({ restaurant: 1, table: 1, status: 1, createdAt: -1 });
billSchema.index({ restaurant: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } }, name: "bill_restaurant_idempotency_unique" });

export default mongoose.model("Bill", billSchema);
