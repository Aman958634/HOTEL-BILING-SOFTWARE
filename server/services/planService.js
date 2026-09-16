import Plan from "../models/Plan.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

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
    maxUsers: 10,
    maxTables: 20,
    maxMenuItems: 100,
    maxOrders: 2000,
    features: ["POS billing", "Menu management", "Basic reports"],
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
    maxUsers: 50,
    maxTables: 80,
    maxMenuItems: 500,
    maxOrders: 10000,
    features: ["Everything in Basic", "Staff roles", "Advanced analytics"],
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
    maxUsers: 200,
    maxTables: 300,
    maxMenuItems: 2000,
    maxOrders: 100000,
    features: ["Everything in Pro", "Multi-branch ready", "Priority support"],
    sortOrder: 3,
  },
];

const PLAN_ALIASES = {
  pro: "professional",
  premium: "enterprise",
};

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
};
