import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import SaasPayment from "../models/SaasPayment.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";
import { listActivePlans, resolvePlan } from "../services/planService.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import {
  calculateTrialEndDate,
  getFreeTrialDays,
  toSubscriptionView,
} from "../utils/subscriptionUtils.js";
import { buildSaasPaymentReceiptBuffer } from "../utils/saasPaymentPdf.js";
import mongoose from "mongoose";

const PUBLIC_PLAN_KEYS = ["basic", "professional", "enterprise"];

const toPublicPlan = (plan) => ({
  id: plan._id || plan.key,
  key: plan.key,
  name: plan.name,
  price: plan.price,
  currency: plan.currency || "INR",
  billingCycle: plan.billingCycle === "yearly" ? "year" : "month",
  billingCycleLabel: plan.billingCycle || "monthly",
  description: plan.description || (plan.features || []).slice(0, 1).join("") || `${plan.name} plan`,
  features: plan.features || [],
  sortOrder: plan.sortOrder || 0,
});

/** GET /public/plans — safe catalog for Pricing page (no secrets, no auth). */
export const listPublicPlans = asyncHandler(async (_req, res) => {
  const plans = await listActivePlans();
  const publicPlans = plans
    .filter((p) => PUBLIC_PLAN_KEYS.includes(p.key))
    .map(toPublicPlan)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  res.status(200).json(
    new ApiResponse(true, "Plans fetched", {
      plans: publicPlans,
      trialDays: getFreeTrialDays(),
    })
  );
});

/**
 * POST /public/subscribe/signup
 * Self-serve restaurant owner registration:
 * Restaurant + admin user + trial subscription with selected plan remembered.
 * Returns access token so checkout can continue immediately.
 */
export const publicSubscribeSignup = asyncHandler(async (req, res) => {
  const {
    planName,
    fullName,
    ownerName,
    email,
    password,
    phone,
    restaurantName,
    address,
    city,
  } = req.body || {};

  if (!planName) throw new ApiError(400, "planName is required");
  if (!fullName) throw new ApiError(400, "Owner / admin name is required");
  if (!email) throw new ApiError(400, "Email is required");
  if (!password || String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  if (!restaurantName) throw new ApiError(400, "Restaurant name is required");
  if (!address) throw new ApiError(400, "Address is required");
  if (!phone) throw new ApiError(400, "Phone is required");

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) throw new ApiError(409, "Email already registered. Please login instead.");

  const normalizedPlanName = String(planName).toLowerCase();
  const isTrialOnlySignup = ["trial", "free_trial", "free-trial"].includes(normalizedPlanName);

  let plan;
  try {
    plan = await resolvePlan(isTrialOnlySignup ? "basic" : planName);
  } catch {
    throw new ApiError(400, "Invalid plan selected");
  }

  const slugBase = String(restaurantName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;
  const branchCode = `B${Date.now().toString().slice(-6)}`;

  const restaurant = await Restaurant.create({
    name: String(restaurantName).trim(),
    slug,
    branchCode,
    email: String(email).toLowerCase().trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    city: city ? String(city).trim() : "",
    isActive: true,
  });

  const outlet = await Outlet.create({
    restaurant: restaurant._id,
    name: "Main Outlet",
    code: "MAIN",
    isActive: true,
  });

  const user = await User.create({
    fullName: String(fullName).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    phone: String(phone).trim(),
    role: "admin",
    restaurant: restaurant._id,
    outlet: outlet._id,
  });

  const trialStart = restaurant.createdAt ? new Date(restaurant.createdAt) : new Date();
  const trialEndDate = calculateTrialEndDate(trialStart);

  const subscription = await Subscription.create({
    restaurant: restaurant._id,
    planId: plan._id,
    planName: plan.key,
    price: 0,
    billingCycle: plan.billingCycle || "monthly",
    status: "trial",
    startDate: trialStart,
    trialStartDate: trialStart,
    trialEndDate,
    renewalDate: null,
    metadata: {
      recurringBillingEnabled: false,
      createdViaPublicSubscribe: true,
      trialOnlySignup: isTrialOnlySignup,
      selectedPaidPlan: isTrialOnlySignup ? null : plan.key,
      selectedPaidPlanId: isTrialOnlySignup ? null : String(plan._id),
      selectedPaidPlanAt: isTrialOnlySignup ? null : new Date().toISOString(),
      paymentRecorded: false,
      ownerName: ownerName || fullName,
    },
  });

  await createActivity({
    action: "Restaurant Created",
    description: `Restaurant ${restaurant.name} registered via public subscription signup`,
    performedBy: user._id,
    restaurantId: restaurant._id,
    targetId: user._id,
    targetType: "user",
    metadata: { source: "public_subscribe" },
  });

  await createActivity({
    action: "Trial Started",
    description: `${getFreeTrialDays()}-day free trial started for ${restaurant.name}`,
    performedBy: user._id,
    restaurantId: restaurant._id,
    targetId: subscription._id,
    targetType: "subscription",
    metadata: {
      trialStartDate: trialStart.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      plan: plan.key,
      source: "public_subscribe",
    },
  });

  await createActivity({
    action: "Plan Selected",
    description: `Paid plan ${plan.name} selected for ${restaurant.name}. Payment still required.`,
    performedBy: user._id,
    restaurantId: restaurant._id,
    targetId: subscription._id,
    targetType: "subscription",
    metadata: { planName: plan.key, planId: plan._id, paymentRecorded: false, source: "public_subscribe" },
  });

  const payload = {
    id: user._id,
    userId: user._id,
    role: user.role,
    email: user.email,
    hotelId: user.hotelId || null,
    restaurant: restaurant._id,
    restaurantId: restaurant._id,
    outletId: outlet._id,
    outlet: outlet._id,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshToken = refreshToken;
  await user.save();

  const safeUser = await User.findById(user._id).select("-password -refreshToken");

  res.status(201).json(
    new ApiResponse(true, "Restaurant registered. Continue to payment.", {
      user: safeUser,
      accessToken,
      refreshToken,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
      },
      subscription: toSubscriptionView(subscription),
      selectedPlan: toPublicPlan(plan),
    })
  );
});

/** Authenticated: remember selected plan before checkout. */
export const selectBillingPlan = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  const { planName } = req.body || {};
  if (!planName) throw new ApiError(400, "planName is required");

  let plan;
  try {
    plan = await resolvePlan(planName);
  } catch {
    throw new ApiError(400, "Invalid plan selected");
  }

  const sub = await Subscription.findOne({ restaurant: restaurantId }).sort({ createdAt: -1 }).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");

  if (sub.status === "active" && sub.planName === plan.key) {
    return res.status(200).json(
      new ApiResponse(true, "Plan already active", {
        subscription: toSubscriptionView(sub),
        selectedPlan: toPublicPlan(plan),
        alreadyActive: true,
      })
    );
  }

  sub.metadata = {
    ...(sub.metadata || {}),
    selectedPaidPlan: plan.key,
    selectedPaidPlanId: String(plan._id),
    selectedPaidPlanAt: new Date().toISOString(),
    paymentRecorded: false,
  };
  // Keep trial/expired status; do not activate without payment.
  if (sub.status !== "active") {
    sub.planId = plan._id;
    sub.planName = plan.key;
    sub.price = 0;
  }
  await sub.save();

  await createActivity({
    action: "Plan Selected",
    description: `Paid plan ${plan.name} selected for ${sub.restaurant?.name || "restaurant"}. Payment still required.`,
    performedBy: req.user._id,
    restaurantId,
    targetId: sub._id,
    targetType: "subscription",
    metadata: { planName: plan.key, planId: plan._id, paymentRecorded: false, source: "tenant_billing" },
  });

  res.status(200).json(
    new ApiResponse(true, "Plan selected. Continue to payment.", {
      subscription: toSubscriptionView(sub),
      selectedPlan: toPublicPlan(plan),
      alreadyActive: false,
    })
  );
});

/** Authenticated restaurant admin: own SaaS payment history. */
export const listMyBillingPayments = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  const payments = await SaasPayment.find({ restaurant: restaurantId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const items = payments.map((p) => ({
    id: p._id,
    paymentId: p.gatewayPaymentId || null,
    razorpayPaymentId: p.gatewayPaymentId || null,
    razorpayOrderId: p.gatewayOrderId || null,
    plan: p.planName,
    amount: p.amount,
    currency: p.currency || "INR",
    status: p.status === "paid" ? "SUCCESS" : String(p.status || "").toUpperCase(),
    paymentMethod: p.paymentMethod || (p.gateway === "razorpay" ? "Razorpay" : p.gateway || "—"),
    paidAt: p.paidAt || (p.status === "paid" ? p.updatedAt : null),
    paymentDate: p.paidAt || p.updatedAt || p.createdAt || null,
    createdAt: p.createdAt,
  }));

  res.status(200).json(new ApiResponse(true, "Billing payments fetched", items));
});

/**
 * GET /admin/billing/payments/:id/pdf
 * Authenticated restaurant admin: own SaaS payment receipt (PDF).
 */
export const downloadMyBillingPaymentPdf = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid payment id");

  const payment = await SaasPayment.findOne({ _id: id, restaurant: restaurantId })
    .populate("restaurant", "name email phone address")
    .populate("subscription")
    .lean();

  if (!payment) throw new ApiError(404, "Payment not found");

  const subscription = payment.subscription || null;
  const restaurant = payment.restaurant || null;

  const paymentReceipt = {
    _id: payment._id,
    id: payment._id,
    paymentId: payment.gatewayPaymentId || null,
    razorpayPaymentId: payment.gatewayPaymentId || null,
    razorpayOrderId: payment.gatewayOrderId || null,
    customerName: req.user?.fullName || "—",
    customer: {
      name: req.user?.fullName || "—",
      email: req.user?.email || "",
    },
    restaurantName: restaurant?.name || "—",
    restaurant: restaurant
      ? {
          _id: restaurant._id,
          name: restaurant.name,
        }
      : null,
    plan: payment.planName || "—",
    amount: payment.amount,
    currency: payment.currency || "INR",
    paymentMethod: payment.paymentMethod || (payment.gateway === "razorpay" ? "Razorpay" : payment.gateway || "—"),
    status: payment.status === "paid" ? "SUCCESS" : String(payment.status || "").toUpperCase() || "—",
    paymentDate: payment.paidAt || payment.updatedAt || payment.createdAt || null,
    subscriptionId: payment.subscription || null,
    gateway: payment.gateway || "razorpay",
    billingCycle: payment.billingCycle || "monthly",
    metadata: payment.metadata || {},
  };

  const buffer = await buildSaasPaymentReceiptBuffer(paymentReceipt, subscription);

  const receiptPaymentId = paymentReceipt.razorpayPaymentId || paymentReceipt.paymentId || String(paymentReceipt.id);
  const safeName = String(receiptPaymentId).replace(/[^a-zA-Z0-9_-]/g, "_");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="RestoSphere-Payment-${safeName}.pdf"`);
  res.setHeader("Content-Length", buffer.length);
  res.status(200).send(buffer);
});

export default {
  listPublicPlans,
  publicSubscribeSignup,
  selectBillingPlan,
  listMyBillingPayments,
  downloadMyBillingPaymentPdf,
};
