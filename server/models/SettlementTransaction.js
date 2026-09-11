import mongoose from "mongoose";

const settlementTransactionSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    provider: { type: String, enum: ["CASHFREE"], default: "CASHFREE", required: true },
    allocationStrategy: { type: String, enum: ["POST_PAYMENT_SPLIT", "ORDER_CREATION_SPLIT"], default: "POST_PAYMENT_SPLIT" },
    providerVendorId: { type: String, required: true, trim: true, index: true },
    cashfreeOrderId: { type: String, required: true, trim: true, index: true },
    cashfreePaymentId: { type: String, default: "", trim: true, index: true },
    providerSplitReference: { type: String, default: "", trim: true, index: true },
    providerSettlementId: { type: String, default: "", trim: true, index: true },
    providerAllocationReference: { type: String, default: "", trim: true, index: true },
    providerSettlementReference: { type: String, default: "", trim: true, index: true },
    providerSettlementStatus: { type: String, default: "", trim: true, index: true },
    settlementAmountPaise: { type: Number, default: null, min: 0 },
    settledAt: { type: Date, default: null },
    settlementInitiatedAt: { type: Date, default: null },
    providerUtr: { type: String, default: "", trim: true, maxlength: 120 },
    lastReconciledAt: { type: Date, default: null, index: true },
    currency: { type: String, default: "INR", immutable: true },
    grossAmountPaise: { type: Number, required: true, min: 1 },
    vendorSharePaise: { type: Number, required: true, min: 0 },
    platformSharePaise: { type: Number, required: true, min: 0 },
    commissionType: { type: String, enum: ["NONE", "PERCENTAGE", "FIXED"], required: true },
    commissionBps: { type: Number, default: 0, min: 0, max: 10000 },
    fixedAmountPaise: { type: Number, default: 0, min: 0 },
    splitStatus: { type: String, enum: ["PENDING", "PROCESSING", "ALLOCATED", "FAILED"], default: "PROCESSING", index: true },
    settlementStatus: { type: String, enum: ["NOT_SCHEDULED", "PENDING", "PROCESSING", "SETTLED", "FAILED", "REVERSED", "ON_HOLD"], default: "NOT_SCHEDULED", index: true },
    providerStatus: { type: String, default: "", trim: true, index: true },
    providerIdempotencyKey: { type: String, required: true, trim: true, unique: true },
    providerRequestId: { type: String, default: "", trim: true },
    splitCreatedAt: { type: Date, default: null },
    settlementUpdatedAt: { type: Date, default: null },
    failureCode: { type: String, default: "", trim: true },
    failureMessageSafe: { type: String, default: "", trim: true, maxlength: 500 },
    // Only the allowlisted, bounded diagnostics extracted from a provider
    // error response are retained. Never persist headers or raw bodies.
    providerHttpStatus: { type: Number, default: null, min: 100, max: 599 },
    providerErrorCode: { type: String, default: "", trim: true, maxlength: 120 },
    providerErrorType: { type: String, default: "", trim: true, maxlength: 120 },
    providerErrorMessage: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

settlementTransactionSchema.index({ payment: 1, provider: 1 }, { unique: true, name: "settlement_payment_provider_unique" });
settlementTransactionSchema.index({ restaurant: 1, outlet: 1, createdAt: -1 });
settlementTransactionSchema.index({ restaurant: 1, settlementStatus: 1, createdAt: -1 });

export default mongoose.model("SettlementTransaction", settlementTransactionSchema);
