import Plan from "../models/Plan.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * The one commercial entitlement for every paid restaurant plan. This is a
 * product entitlement only: authentication, tenant/outlet isolation and RBAC
 * remain enforced independently by their existing middleware.
 */
export const ALL_PAID_PLAN_FEATURES = Object.freeze([
  "All RestoSphere features",
  "POS, Orders & Billing",
  "KOT/KDS & QR Ordering",
  "Inventory & Reports",
  "CRM & Loyalty",
  "Staff Management",
  "Multi-outlet",
  "Advanced Analytics",
  "Payment & Reconciliation",
]);

export const FULL_ACCESS_PAID_PLAN_KEYS = Object.freeze([
  "basic",
  "professional",
  "pro",
  "enterprise", // Legacy enterprise subscriptions remain full access.
  "premium",
]);

const FULL_ACCESS_CAPACITY = Object.freeze({
  maxUsers: 200,
  maxTables: 300,
  maxMenuItems: 2000,
  maxOrders: 100000,
});

export const DEFAULT_PLANS = [
  {
    key: "basic",
    name: "Basic",
    price: 7500,
    currency: "INR",
    billingCycle: "fixed",
    durationMonths: 3,
    durationLabel: "3 months",
    monthlyEquivalentPrice: 2500,
    ...FULL_ACCESS_CAPACITY,
    entitlement: "all_paid_features",
    features: [...ALL_PAID_PLAN_FEATURES],
    sortOrder: 1,
  },
  {
    key: "professional",
    name: "Pro",
    price: 15000,
    currency: "INR",
    billingCycle: "fixed",
    durationMonths: 6,
    durationLabel: "6 months",
    monthlyEquivalentPrice: 2500,
    ...FULL_ACCESS_CAPACITY,
    entitlement: "all_paid_features",
    features: [...ALL_PAID_PLAN_FEATURES],
    sortOrder: 2,
  },
  {
    key: "enterprise",
    name: "Premium",
    price: 30000,
    currency: "INR",
    billingCycle: "fixed",
    durationMonths: 12,
    durationLabel: "1 year",
    monthlyEquivalentPrice: 2500,
    ...FULL_ACCESS_CAPACITY,
    entitlement: "all_paid_features",
    features: [...ALL_PAID_PLAN_FEATURES],
    sortOrder: 3,
  },
];

const PLAN_ALIASES = {
  pro: "professional",
  premium: "enterprise",
};

/** Premium is sold in whole calendar-year terms; amounts always come from this catalog. */
export const PREMIUM_DURATION_YEARS = Object.freeze([1, 2, 3, 4, 5]);

export const isPremiumPlan = (plan) => String(plan?.key || "").toLowerCase() === "enterprise";

const premiumDurationLabel = (years) => `${years} year${years === 1 ? "" : "s"}`;

export const getPremiumDurationYears = (value) => {
  const years = Number(value);
  if (!Number.isInteger(years) || !PREMIUM_DURATION_YEARS.includes(years)) {
    throw new Error("Premium duration must be one of 1, 2, 3, 4, or 5 years");
  }
  return years;
};

export const hasAllPaidFeatures = (planKeyOrName) =>
  FULL_ACCESS_PAID_PLAN_KEYS.includes(String(planKeyOrName || "").trim().toLowerCase());

// Plans created before fixed-duration pricing did not store durationMonths.
// This fallback is only for historical payment/subscription records.
export const getPlanDurationMonths = (plan) => {
  const months = Number(plan?.durationMonths);
  if (Number.isInteger(months) && months > 0) return months;
  return plan?.billingCycle === "yearly" ? 12 : 1;
};

export const getPlanDurationLabel = (plan) => {
  if (plan?.durationLabel) return plan.durationLabel;
  const months = getPlanDurationMonths(plan);
  return months === 12 ? "1 year" : `${months} month${months === 1 ? "" : "s"}`;
};

export const getPlanSnapshot = (plan) => ({
  planId: String(plan?._id || ""),
  planKey: plan?.key,
  planName: plan?.name,
  amount: Number(plan?.price) || 0,
  currency: plan?.currency || "INR",
  billingCycle: plan?.billingCycle || "monthly",
  durationMonths: getPlanDurationMonths(plan),
  durationLabel: getPlanDurationLabel(plan),
  monthlyEquivalentPrice: Number(plan?.monthlyEquivalentPrice) || null,
});

/**
 * Creates the immutable offer snapshot used for payment orders. Basic and Pro
 * retain their fixed catalog terms; only Premium accepts a selected year term.
 */
export const getPlanOffer = (plan, premiumDurationYears = undefined) => {
  if (!isPremiumPlan(plan)) return getPlanSnapshot(plan);

  const years = premiumDurationYears === undefined || premiumDurationYears === null || premiumDurationYears === ""
    ? 1
    : getPremiumDurationYears(premiumDurationYears);
  const monthlyEquivalentPrice = Number(plan?.monthlyEquivalentPrice);
  if (!Number.isFinite(monthlyEquivalentPrice) || monthlyEquivalentPrice <= 0) {
    throw new Error("Premium monthly price is not configured");
  }

  return {
    ...getPlanSnapshot(plan),
    amount: monthlyEquivalentPrice * 12 * years,
    billingCycle: "fixed",
    durationMonths: years * 12,
    durationLabel: premiumDurationLabel(years),
    monthlyEquivalentPrice,
    premiumDurationYears: years,
  };
};

export const getPremiumDurationOptions = (plan) =>
  isPremiumPlan(plan) ? PREMIUM_DURATION_YEARS.map((years) => getPlanOffer(plan, years)) : [];

export const ensureDefaultPlans = async () => {
  for (const plan of DEFAULT_PLANS) {
    await Plan.findOneAndUpdate(
      { key: plan.key },
      { $set: { ...plan, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info("Default SaaS plans ensured");
};

export const listActivePlans = async () => {
  await ensureDefaultPlans();
  return Plan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean();
};

export const resolvePlan = async (planKeyOrName = "basic") => {
  await ensureDefaultPlans();
  let raw = String(planKeyOrName || "basic").trim().toLowerCase();
  raw = PLAN_ALIASES[raw] || raw;

  const plan =
    (await Plan.findOne({ key: raw, isActive: true }).lean()) ||
    (await Plan.findOne({ name: new RegExp(`^${raw}$`, "i"), isActive: true }).lean()) ||
    (await Plan.findById(mongoose.isValidObjectId(raw) ? raw : null).lean()) ||
    (await Plan.findOne({ key: "basic", isActive: true }).lean());

  if (!plan) {
    throw new Error("No active plans configured");
  }
  return plan;
};

export default {
  DEFAULT_PLANS,
  ensureDefaultPlans,
  listActivePlans,
  resolvePlan,
  getPlanDurationMonths,
  getPlanDurationLabel,
  getPlanSnapshot,
  getPlanOffer,
  getPremiumDurationOptions,
  getPremiumDurationYears,
  PREMIUM_DURATION_YEARS,
  isPremiumPlan,
  ALL_PAID_PLAN_FEATURES,
  FULL_ACCESS_PAID_PLAN_KEYS,
  hasAllPaidFeatures,
};
