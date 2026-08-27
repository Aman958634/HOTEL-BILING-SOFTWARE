import mongoose from "mongoose";

const paymentPartSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, required: true, trim: true },
    status: { type: String, enum: ["PENDING", "VERIFIED", "VOIDED"], default: "VERIFIED", index: true },
    transactionId: { type: String, default: "", trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    verifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentPartSchema.index({ restaurant: 1, idempotencyKey: 1 }, { unique: true });
paymentPartSchema.index({ restaurant: 1, orderId: 1, status: 1, createdAt: 1 });

export default mongoose.model("PaymentPart", paymentPartSchema);
