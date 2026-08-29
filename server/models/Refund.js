import mongoose from "mongoose";

const refundSchema = new mongoose.Schema({
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
  bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING", index: true },
  method: { type: String, required: true },
  providerRefundId: { type: String, default: "", trim: true, index: true, sparse: true },
  idempotencyKey: { type: String, default: "", trim: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  processedAt: { type: Date, default: null },
  failureReason: { type: String, default: "", trim: true },
}, { timestamps: true });

refundSchema.index({ payment: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } }, name: "refund_payment_idempotency_unique" });
refundSchema.index({ restaurant: 1, createdAt: -1 });
export default mongoose.model("Refund", refundSchema);
