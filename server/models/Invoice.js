import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const paymentBreakdownSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    refundedAmount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    issuedAt: { type: Date, required: true, default: Date.now, index: true },
    items: { type: [invoiceItemSchema], required: true },
    gstType: { type: String, enum: ["CGST_SGST", "IGST"], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    cgst: { type: Number, required: true, min: 0, default: 0 },
    sgst: { type: Number, required: true, min: 0, default: 0 },
    igst: { type: Number, required: true, min: 0, default: 0 },
    totalTax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    totalPaid: { type: Number, required: true, min: 0 },
    refundTotal: { type: Number, default: 0, min: 0 },
    netTotal: { type: Number, required: true, min: 0 },
    netTax: { type: Number, required: true, min: 0 },
    paymentBreakdown: { type: [paymentBreakdownSchema], default: [] },
    status: { type: String, enum: ["FINAL", "PARTIALLY_REFUNDED", "REFUNDED", "VOID"], default: "FINAL", index: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ restaurant: 1, issuedAt: -1 });

export default mongoose.model("Invoice", invoiceSchema);
