import mongoose from "mongoose";
import { paymentUniqueIndexDefinitions } from "../utils/paymentIndexDefinitions.js";

const PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "NET_BANKING",
  "WALLET",
  "RAZORPAY",
  "OTHER",
];

const PAYMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

const REFUND_STATUSES = ["PARTIALLY_REFUNDED", "REFUNDED"];
const RECONCILIATION_STATUSES = ["UNRECONCILED", "MATCHED", "MISMATCHED", "UNDERPAID", "OVERPAID", "REFUND_PENDING", "RECONCILED"];

const paymentTimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: "", trim: true },
  },
  { _id: false, timestamps: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, trim: true },
    // Retained for normal order payments. Consolidated bill payments use bill.
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    subtotal: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
    gateway: { type: String, default: "", trim: true, index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "PENDING", index: true },
    transactionId: { type: String, default: "", trim: true },
    razorpayOrderId: { type: String, default: "", trim: true, index: true, sparse: true },
    razorpayPaymentId: { type: String, default: "", trim: true },
    // Supplied by the caller (Idempotency-Key header) or derived from a
    // provider payment id. It makes a retry return the original payment
    // rather than recording money twice.
    idempotencyKey: { type: String, default: "", trim: true },
    paidAt: { type: Date, default: null, index: true },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, default: "", trim: true },
    refundStatus: { type: String, enum: [null, ...REFUND_STATUSES], default: null, index: true },
    refundedAt: { type: Date, default: null },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reconciliationStatus: { type: String, enum: RECONCILIATION_STATUSES, default: "UNRECONCILED", index: true },
    reconciledAt: { type: Date, default: null },
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reconciliationNote: { type: String, default: "", trim: true, maxlength: 1000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeline: { type: [paymentTimelineSchema], default: [] },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentUniqueIndexDefinitions.forEach(({ key, name, options }) => paymentSchema.index(key, { ...options, name }));
paymentSchema.index({ restaurant: 1, reconciliationStatus: 1, createdAt: -1 });
paymentSchema.index({ restaurant: 1, paymentStatus: 1, paidAt: -1 });
paymentSchema.index({ restaurant: 1, outlet: 1, paymentStatus: 1, paidAt: -1 });
paymentSchema.index({ restaurant: 1, paymentId: 1 });
paymentSchema.index({ restaurant: 1, outlet: 1, paymentStatus: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
