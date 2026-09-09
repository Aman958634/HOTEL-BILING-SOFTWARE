import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantSettlementProfile from "../models/RestaurantSettlementProfile.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import { createActivity } from "../services/activityService.js";
import { getCashfreeEasySplitStatus } from "../config/cashfree.js";
import {
  assertEasySplitAvailable,
  createEasySplitVendor,
  createEasySplitVendorPayload,
  generateProviderVendorId,
  getEasySplitVendor,
  mapCashfreeVendorStatus,
} from "../services/cashfreeEasySplitService.js";
import { refreshCashfreeSettlementTransaction, safeSettlementTransaction } from "../services/easySplitSettlementService.js";

const restaurantIdFor = (user) => user?.restaurant && mongoose.isValidObjectId(user.restaurant) ? user.restaurant : null;
const maskAccount = (value) => {
  const raw = String(value || "").replace(/\s/g, "");
  return raw ? `••••${raw.slice(-4)}` : "";
};
const maskUpi = (value) => {
  const [name, domain] = String(value || "").split("@");
  return name && domain ? `${name.slice(0, 2)}••••@${domain}` : "";
};

const safeProfile = (profile) => profile ? ({
  provider: profile.provider,
  easySplit: getCashfreeEasySplitStatus(),
  configured: Boolean(profile.providerVendorId && profile.vendorStatus !== "FAILED"),
  vendorId: profile.providerVendorId,
  vendorStatus: profile.vendorStatus,
  providerStatus: profile.providerStatus,
  payoutMethod: profile.payoutMethod,
  verificationStatus: profile.bankVerificationStatus,
  settlementStatus: profile.settlementStatus,
  vendorLineOfBusiness: profile.vendorLineOfBusiness,
  settlementCycle: profile.settlementCycle,
  accountHolderName: profile.accountHolderName,
  bankName: profile.bankName,
  maskedAccountNumber: profile.maskedAccountNumber,
  ifscSafeValue: profile.ifscSafeValue,
  maskedUpiVpa: profile.maskedUpiVpa,
  verificationReference: profile.verificationReference,
  verificationMessageSafe: profile.verificationMessageSafe,
  providerCreatedAt: profile.providerCreatedAt,
  verifiedAt: profile.verifiedAt,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
}) : ({ provider: "CASHFREE", easySplit: getCashfreeEasySplitStatus(), configured: false, vendorStatus: "NOT_STARTED", providerStatus: "NOT_STARTED", verificationStatus: "NOT_SUBMITTED", settlementStatus: "DISABLED" });

const validateBody = (body = {}) => {
  const method = String(body.method || "BANK").toUpperCase();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const email = String(body.email || "").trim();
  const accountType = String(body.accountType || "").trim();
  const pan = String(body.pan || "").trim().toUpperCase();
  if (!['BANK', 'UPI'].includes(method)) throw new ApiError(422, "Settlement account method is invalid");
  if (!/^\d{8,12}$/.test(phone) || !/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(422, "A valid Indian vendor phone and email are required");
  if (!["Individual", "Proprietorship", "Limited Liability Partnership (LLP)", "Private Ltd or Public Ltd", "Society/Trust/Clubs/NGO/Association", "Govt Authority/ULBs/Municipalities"].includes(accountType) || !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw new ApiError(422, "A Cashfree-supported account type and valid PAN are required");
  if (method === "BANK") {
    const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
    const ifsc = String(body.ifsc || "").trim().toUpperCase();
    if (!String(body.accountHolderName || "").trim() || !/^\d{4,34}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new ApiError(422, "A valid bank account holder, account number, and IFSC are required");
    if (accountNumber !== String(body.confirmAccountNumber || "").replace(/\s/g, "")) throw new ApiError(422, "Account numbers do not match");
  } else if (!/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9._-]{2,}$/i.test(String(body.upiVpa || "").trim())) {
    throw new ApiError(422, "UPI VPA is invalid");
  }
  return { method, phone, email, accountType, pan };
};

const applyProviderStatus = (profile, providerPayload, providerRequestId = "") => {
  const mapped = mapCashfreeVendorStatus(providerPayload?.status);
  profile.providerStatus = mapped.providerStatus;
  profile.vendorStatus = mapped.vendorStatus;
  profile.bankVerificationStatus = mapped.verificationStatus;
  profile.settlementStatus = mapped.settlementStatus;
  profile.verificationReference = String(providerPayload?.vendor_id || profile.providerVendorId || "");
  profile.providerRequestId = providerRequestId || profile.providerRequestId;
  profile.providerCreatedAt = profile.providerCreatedAt || new Date();
  if (mapped.verificationStatus === "VERIFIED") profile.verifiedAt = new Date();
};

export const getSettlementProfile = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req.user);
  if (!restaurantId) throw new ApiError(403, "Settlement account requires a restaurant context");
  const profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantId, provider: "CASHFREE" }).lean();
  res.json(new ApiResponse(true, "Settlement profile fetched", safeProfile(profile)));
});

export const createSettlementVendor = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req.user);
  if (!restaurantId) throw new ApiError(403, "Settlement account requires a restaurant context");
  const { method, phone, email, accountType, pan } = validateBody(req.body);
  const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();
  if (!/^[0-9a-f-]{16,128}$/i.test(idempotencyKey)) throw new ApiError(422, "A valid Idempotency-Key is required");
  assertEasySplitAvailable();

  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true }).select("name").lean();
  if (!restaurant) throw new ApiError(404, "Restaurant not found");
  let profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantId, provider: "CASHFREE" });
  if (profile?.lastIdempotencyKey === idempotencyKey) return res.json(new ApiResponse(true, "Settlement request already recorded", safeProfile(profile)));
  if (profile?.providerVendorId && !["FAILED", "BANK_VALIDATION_FAILED", "BENE_CREATION_FAILED", "ACTION_REQUIRED"].includes(profile.vendorStatus)) {
    throw new ApiError(409, "A Cashfree vendor already exists for this restaurant", "EASY_SPLIT_VENDOR_EXISTS");
  }

  const providerVendorId = profile?.providerVendorId || generateProviderVendorId(restaurantId);
  if (!profile) {
    try {
      profile = await RestaurantSettlementProfile.create({ restaurant: restaurantId, provider: "CASHFREE", providerVendorId, vendorStatus: "CREATING", providerStatus: "CREATING", bankVerificationStatus: "PENDING", settlementStatus: "PENDING", lastIdempotencyKey: idempotencyKey });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantId, provider: "CASHFREE" });
      if (profile?.lastIdempotencyKey === idempotencyKey) return res.json(new ApiResponse(true, "Settlement request already recorded", safeProfile(profile)));
      throw new ApiError(409, "A Cashfree vendor onboarding request is already in progress", "EASY_SPLIT_VENDOR_EXISTS");
    }
  }

  const payload = createEasySplitVendorPayload({
    vendorId: providerVendorId,
    restaurantName: restaurant.name,
    email,
    phone,
    method,
    bank: req.body,
    upiVpa: req.body.upiVpa,
    settlementCycle: req.body.settlementCycle,
    accountType,
    pan,
  });

  try {
    const providerResult = await createEasySplitVendor({ payload, idempotencyKey });
    applyProviderStatus(profile, providerResult.payload, providerResult.providerRequestId);
  } catch (error) {
    // A 4xx rejection is definite; a timeout/unavailability remains CREATING
    // so a second request cannot accidentally create a second remote vendor.
    if (error?.code === "EASY_SPLIT_PROVIDER_REJECTED") {
      profile.vendorStatus = "FAILED";
      profile.providerStatus = "REJECTED";
      profile.bankVerificationStatus = "FAILED";
      profile.verificationMessageSafe = "Cashfree rejected the onboarding details.";
    }
    profile.lastIdempotencyKey = idempotencyKey;
    await profile.save();
    throw error;
  }

  profile.payoutMethod = method;
  profile.vendorLineOfBusiness = "Food and Beverages";
  profile.settlementCycle = String(req.body.settlementCycle || "T+1").trim().toUpperCase();
  profile.accountHolderName = method === "BANK" ? String(req.body.accountHolderName).trim() : "";
  profile.ifscSafeValue = method === "BANK" ? String(req.body.ifsc).trim().toUpperCase() : "";
  profile.maskedAccountNumber = method === "BANK" ? maskAccount(req.body.accountNumber) : "";
  profile.maskedUpiVpa = method === "UPI" ? maskUpi(req.body.upiVpa) : "";
  profile.lastIdempotencyKey = idempotencyKey;
  await profile.save();
  await createActivity({ action: "CASHFREE_VENDOR_ONBOARDING_SUBMITTED", description: "Cashfree settlement vendor onboarding submitted", performedBy: req.user._id, restaurantId, targetId: profile._id, targetType: "RestaurantSettlementProfile", metadata: { provider: "CASHFREE", providerVendorId, vendorStatus: profile.vendorStatus, payoutMethod: method } });
  res.status(201).json(new ApiResponse(true, "Settlement vendor onboarding submitted", safeProfile(profile)));
});

export const refreshSettlementVendor = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req.user);
  if (!restaurantId) throw new ApiError(403, "Settlement account requires a restaurant context");
  const profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurantId, provider: "CASHFREE", providerVendorId: { $ne: null } });
  if (!profile) throw new ApiError(404, "Cashfree settlement vendor has not been created");
  const providerResult = await getEasySplitVendor(profile.providerVendorId);
  applyProviderStatus(profile, providerResult.payload, providerResult.providerRequestId);
  await profile.save();
  await createActivity({ action: "CASHFREE_VENDOR_STATUS_REFRESHED", description: "Cashfree settlement vendor status refreshed", performedBy: req.user._id, restaurantId, targetId: profile._id, targetType: "RestaurantSettlementProfile", metadata: { provider: "CASHFREE", providerVendorId: profile.providerVendorId, vendorStatus: profile.vendorStatus } });
  res.json(new ApiResponse(true, "Settlement vendor status refreshed", safeProfile(profile)));
});

export const getSettlementSplitSummary = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req.user);
  if (!restaurantId) throw new ApiError(403, "Settlement account requires a restaurant context");
  const activeOutlet = req.user.activeOutlet || req.user.defaultOutlet;
  const transactions = await SettlementTransaction.find({ restaurant: restaurantId, ...(activeOutlet ? { outlet: activeOutlet } : {}) })
    .sort({ createdAt: -1 }).limit(100).lean();
  const summary = transactions.reduce((acc, item) => {
    acc.grossAmount += item.grossAmountPaise || 0;
    acc.vendorShare += item.vendorSharePaise || 0;
    acc.platformShare += item.platformSharePaise || 0;
    acc.statuses[item.settlementStatus] = (acc.statuses[item.settlementStatus] || 0) + 1;
    return acc;
  }, { grossAmount: 0, vendorShare: 0, platformShare: 0, statuses: {} });
  res.json(new ApiResponse(true, "Settlement allocation history fetched", {
    summary: { grossAmount: summary.grossAmount / 100, vendorShare: summary.vendorShare / 100, platformShare: summary.platformShare / 100, statuses: summary.statuses },
    transactions: transactions.map(safeSettlementTransaction),
  }));
});

export const refreshSettlementSplit = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req.user);
  if (!restaurantId) throw new ApiError(403, "Settlement account requires a restaurant context");
  const activeOutlet = req.user.activeOutlet || req.user.defaultOutlet;
  const transaction = await SettlementTransaction.findOne({ _id: req.params.id, restaurant: restaurantId, ...(activeOutlet ? { outlet: activeOutlet } : {}) });
  if (!transaction) throw new ApiError(404, "Settlement allocation not found");
  const refreshed = await refreshCashfreeSettlementTransaction(transaction);
  await createActivity({ action: "CASHFREE_SETTLEMENT_STATUS_REFRESHED", description: "Cashfree settlement allocation status refreshed", performedBy: req.user._id, restaurantId, targetId: refreshed._id, targetType: "SettlementTransaction", metadata: { cashfreeOrderId: refreshed.cashfreeOrderId, providerVendorId: refreshed.providerVendorId, providerStatus: refreshed.providerStatus } });
  res.json(new ApiResponse(true, "Settlement allocation status refreshed", safeSettlementTransaction(refreshed)));
});
