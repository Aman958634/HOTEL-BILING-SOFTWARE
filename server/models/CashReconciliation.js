import mongoose from "mongoose";

const cashReconciliationSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
  startedAt: { type: Date, required: true },
  closedAt: { type: Date, required: true, default: Date.now },
  expectedCash: { type: Number, required: true },
  countedCash: { type: Number, required: true },
  difference: { type: Number, required: true },
  note: { type: String, default: "", trim: true, maxlength: 1000 },
  status: { type: String, enum: ["MATCHED", "MISMATCHED"], required: true, index: true },
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
cashReconciliationSchema.index({ restaurant: 1, cashier: 1, closedAt: -1 });
export default mongoose.model("CashReconciliation", cashReconciliationSchema);
