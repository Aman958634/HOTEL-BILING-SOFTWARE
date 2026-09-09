import mongoose from "mongoose";

const PROVIDERS = ["CASHFREE"];
const VENDOR_STATUSES = ["NOT_STARTED", "CREATING", "IN_BANK_VALIDATION", "BANK_VALIDATION_FAILED", "IN_BENE_CREATION", "BENE_CREATION_FAILED", "IN_KYC_REVIEW", "ACTION_REQUIRED", "ACTIVE", "ON_HOLD", "BLOCKED", "DELETED", "FAILED"];
const BANK_STATUSES = ["NOT_SUBMITTED", "PENDING", "VERIFIED", "FAILED"];
const SETTLEMENT_STATUSES = ["DISABLED", "PENDING", "ACTIVE", "ON_HOLD"];

const settlementProfileSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    provider: { type: String, enum: PROVIDERS, default: "CASHFREE", required: true },
    providerVendorId: { type: String, default: null, trim: true, index: true, unique: true, sparse: true },
    vendorStatus: { type: String, enum: VENDOR_STATUSES, default: "NOT_STARTED", index: true },
    payoutMethod: { type: String, enum: ["BANK", "UPI"], default: null },
    providerStatus: { type: String, default: "NOT_STARTED", trim: true, index: true },
    bankVerificationStatus: { type: String, enum: BANK_STATUSES, default: "NOT_SUBMITTED", index: true },
    settlementStatus: { type: String, enum: SETTLEMENT_STATUSES, default: "DISABLED", index: true },
    vendorLineOfBusiness: { type: String, default: "Food and Beverages", trim: true },
    settlementCycle: { type: String, default: "", trim: true },
    accountHolderName: { type: String, default: "", trim: true },
    bankName: { type: String, default: "", trim: true },
    maskedAccountNumber: { type: String, default: "", trim: true },
    ifscSafeValue: { type: String, default: "", trim: true },
    maskedUpiVpa: { type: String, default: "", trim: true },
    verificationReference: { type: String, default: "", trim: true },
    verificationMessageSafe: { type: String, default: "", trim: true, maxlength: 500 },
    providerRequestId: { type: String, default: "", trim: true },
    providerCreatedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    lastIdempotencyKey: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

settlementProfileSchema.index({ restaurant: 1, provider: 1 }, { unique: true, name: "settlement_profile_restaurant_provider_unique" });

export default mongoose.model("RestaurantSettlementProfile", settlementProfileSchema);
