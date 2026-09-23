import Subscription from "../models/Subscription.js";
import Restaurant from "../models/Restaurant.js";
import SaasPayment from "../models/SaasPayment.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";
import {
  getPlanDurationLabel,
  getPlanDurationMonths,
  getPlanOffer,
  getPremiumDurationOptions,
  isPremiumPlan,
  listActivePlans,
  resolvePlan,
} from "../services/planService.js";
import {
  assertNoDuplicateSubscription,
  assertStatusTransition,
} from "../services/subscriptionValidationService.js";
import {
  assertCapturedSubscriptionPayment,
  getPlatformSubscriptionRazorpayClient,
  isSubscriptionTestMode,
  toPaise,
  verifyCheckoutSignature,
} from "../services/razorpaySubscriptionService.js";
import {
  calculateSubscriptionEndDate,
  calculateTrialEndDate,
  expireTrialIfNeeded,
  getDaysRemaining,
  getFreeTrialDays,
  normalizeTrialDates,
  toSubscriptionView,
} from "../utils/subscriptionUtils.js";
import { notifySubscriptionExpiring } from "../services/notificationService.js";

const FORBIDDEN_TENANT_FIELDS = new Set([
  "trialEndDate",
  "trialStartDate",
  "trialEndAt",
  "trialStartAt",
  "status",
  "planId",
  "planName",
  "price",
  "renewalDate",
  "subscriptionStartAt",
  "billingCycle",
  "startDate",
  "cancelledAt",
  "suspendedAt",
  "metadata",
  "restaurant",
  "restaurantId",
  "amount",
]);

const rejectClientPricing = (body = {}) => {
  if (body.price !== undefined || body.amount !== undefined) {
    throw new ApiError(400, "Price must not be sent from client. Server uses plan catalog pricing.");
  }
};

const getSelectedPlanForSubscription = async (subscription) => {
  const selectedKey = subscription.metadata?.selectedPaidPlan || subscription.planName;
  if (!selectedKey) {
    throw new ApiError(400, "No paid plan selected. Select a plan before payment.");
  }
  try {
    return await resolvePlan(selectedKey);
  } catch {
    throw new ApiError(400, "Selected plan is invalid or inactive");
  }
};

const buildPaymentSummary = (plan, offer, restaurantName) => {
  const now = new Date();
  const durationMonths = offer.durationMonths;
  const durationLabel = offer.durationLabel;
  return {
    restaurantName,
    planName: plan.name,
    planKey: plan.key,
    billingPeriod: durationLabel,
    amount: offer.amount,
    currency: offer.currency || plan.currency || "INR",
    durationMonths,
    durationLabel,
    monthlyEquivalentPrice: offer.monthlyEquivalentPrice,
    premiumDurationYears: offer.premiumDurationYears || null,
    subscriptionStartPreview: now.toISOString(),
    renewalDatePreview: calculateSubscriptionEndDate(now, durationMonths).toISOString(),
  };
};

const getSelectedOfferForSubscription = async (subscription) => {
  const plan = await getSelectedPlanForSubscription(subscription);
  try {
    return { plan, offer: getPlanOffer(plan, subscription.metadata?.selectedPremiumDurationYears) };
  } catch {
    throw new ApiError(400, "Premium duration must be one of 1, 2, 3, 4, or 5 years");
  }
};

const toCheckoutResponse = (payment, plan, restaurantName, summary) => {
  const testMode = payment.provider === "TEST";
  return {
    paymentId: payment._id,
    internalReference: payment.internalReference,
    testMode,
    ...(testMode ? { testModeLabel: "TEST/DEVELOPMENT" } : { razorpayOrderId: payment.providerOrderId || payment.gatewayOrderId }),
    // Razorpay Checkout requires paise. Rupees is provided separately only for
    // display, never as a browser-controlled input.
    amount: toPaise(payment.amount),
    amountRupees: payment.amount,
    currency: payment.currency || "INR",
    ...(testMode ? {} : { keyId: process.env.RAZORPAY_KEY_ID }),
    restaurantName,
    plan,
    recurringBilling: false,
    paymentSummary: summary,
  };
};

const createCheckoutPayment = async (subscription, plan, offer, restaurantName, performedBy = null, idempotencyKey = null) => {
  const restaurantId = subscription.restaurant?._id || subscription.restaurant;
  const amount = offer.amount;
  const summary = buildPaymentSummary(plan, offer, restaurantName);

  if (idempotencyKey) {
    const prior = await SaasPayment.findOne({ restaurant: restaurantId, idempotencyKey });
    if (prior) {
      if (String(prior.subscription) !== String(subscription._id) || prior.planName !== plan.key || prior.amount !== amount || prior.durationMonths !== offer.durationMonths) {
        throw new ApiError(409, "Idempotency key belongs to another payment attempt");
      }
      if (prior.status === "paid") throw new ApiError(409, "Subscription payment is already completed");
      if (prior.status === "pending" && (prior.providerOrderId || prior.gatewayOrderId || prior.provider === "TEST")) {
        return toCheckoutResponse(prior, plan, restaurantName, summary);
      }
    }
  }

  const existingPending = await SaasPayment.findOne({
    subscription: subscription._id,
    status: "pending",
  }).sort({ createdAt: -1 });
  // A retry without a header should still reuse the outstanding checkout for
  // the same plan, rather than creating competing subscription attempts.
  if (existingPending && existingPending.planName === plan.key && existingPending.amount === amount && existingPending.durationMonths === offer.durationMonths && (existingPending.providerOrderId || existingPending.gatewayOrderId || existingPending.provider === "TEST")) {
    return toCheckoutResponse(existingPending, plan, restaurantName, summary);
  }
  if (existingPending) {
    existingPending.status = "cancelled";
    existingPending.metadata = { ...(existingPending.metadata || {}), cancelledReason: "replaced_by_new_plan_checkout" };
    await existingPending.save();
  }

  const payment = await SaasPayment.create({
    restaurant: restaurantId,
    subscription: subscription._id,
    planId: plan._id,
    planName: plan.key,
    amount,
    currency: offer.currency || plan.currency || "INR",
    billingCycle: offer.billingCycle,
    durationMonths: offer.durationMonths,
    durationLabel: offer.durationLabel,
    status: "pending",
    gateway: "razorpay",
    provider: "RAZORPAY",
    idempotencyKey,
    metadata: { planSnapshot: offer, purpose: "SUBSCRIPTION" },
  });

  await createActivity({
    action: "Payment Initiated",
    description: `Payment initiated for ${plan.name} (₹${amount}) — ${restaurantName || "restaurant"}`,
    performedBy,
    restaurantId,
    targetId: payment._id,
    targetType: "saas_payment",
    metadata: { planKey: plan.key, amount, currency: offer.currency || plan.currency || "INR", durationMonths: offer.durationMonths, paymentId: String(payment._id) },
  });

  const testMode = isSubscriptionTestMode();
  const razorpay = getPlatformSubscriptionRazorpayClient();

  if (!razorpay && !testMode) {
    payment.status = "failed";
    await payment.save();
    await createActivity({
      action: "Payment Failed",
      description: "Payment gateway is not configured",
      performedBy,
      restaurantId,
      targetId: payment._id,
      targetType: "saas_payment",
    });
    throw new ApiError(503, "Payment gateway is not configured. Enable BILLING_TEST_MODE for development.");
  }

  if (!razorpay && testMode) {
    payment.gateway = "test";
    payment.provider = "TEST";
    payment.gatewayOrderId = `test_order_${payment._id}`;
    payment.providerOrderId = payment.gatewayOrderId;
    payment.metadata = { ...(payment.metadata || {}), testMode: true, mode: "TEST/DEVELOPMENT" };
    await payment.save();
    return toCheckoutResponse(payment, plan, restaurantName, summary);
  }

  const order = await razorpay.orders.create({
    amount: toPaise(amount),
    currency: offer.currency || plan.currency || "INR",
    receipt: `saas_${String(payment._id).slice(-10)}`,
    notes: {
      restaurantId: String(restaurantId),
      subscriptionId: String(subscription._id),
      planName: plan.key,
      durationMonths: String(offer.durationMonths),
      purpose: "SUBSCRIPTION",
    },
  });

  payment.gatewayOrderId = order.id;
  payment.providerOrderId = order.id;
  await payment.save();
  return toCheckoutResponse(payment, plan, restaurantName, summary);
};

export const verifyAndActivatePayment = async ({
  payment,
  restaurantId,
  performedBy,
  source,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  testSuccess,
  verifiedProviderPayment = null,
}) => {
  if (payment.status === "paid") {
    return Subscription.findById(payment.subscription);
  }

  // Only one request (browser callback or a retried webhook) can cross the
  // pending boundary. This makes subscription activation exactly-once even
  // when Razorpay and the browser deliver success concurrently.
  const lockedPayment = await SaasPayment.findOneAndUpdate(
    { _id: payment._id, status: "pending" },
    { $set: { status: "processing" } },
    { new: true }
  );
  if (!lockedPayment) {
    const current = await SaasPayment.findById(payment._id);
    if (current?.status === "paid") return Subscription.findById(current.subscription);
    if (current?.status === "processing") {
      const sub = await Subscription.findById(current.subscription);
      if (sub?.metadata?.lastSaasPaymentId === String(current._id)) {
        current.status = "paid";
        await current.save();
        return sub;
      }
      throw new ApiError(409, "Payment verification is already in progress");
    }
    throw new ApiError(409, "This payment attempt can no longer be verified");
  }
  payment = lockedPayment;

  const testMode = isSubscriptionTestMode();
  let paid = false;
  let providerPayment = null;

  if (testMode && testSuccess === true && payment.gateway === "test") {
    paid = true;
    payment.gatewayPaymentId = `test_pay_${Date.now()}`;
    payment.providerPaymentId = payment.gatewayPaymentId;
  } else if (testMode && testSuccess === false && payment.gateway === "test") {
    paid = false;
  } else {
    if (!razorpay_order_id || !razorpay_payment_id || (!verifiedProviderPayment && !razorpay_signature)) {
      payment.status = "failed";
      await payment.save();
      throw new ApiError(422, "Payment verification failed");
    }

    if (
      payment.gatewayOrderId !== razorpay_order_id ||
      (!verifiedProviderPayment && !verifyCheckoutSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature }))
    ) {
      payment.status = "failed";
      await payment.save();
      throw new ApiError(422, "Payment verification failed");
    }

    try {
      providerPayment = verifiedProviderPayment || await getPlatformSubscriptionRazorpayClient()?.payments.fetch(razorpay_payment_id);
      assertCapturedSubscriptionPayment({
        providerPayment,
        orderId: payment.providerOrderId || payment.gatewayOrderId,
        amount: payment.amount,
        currency: payment.currency,
      });
    } catch (error) {
      payment.status = "failed";
      await payment.save();
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "Payment verification failed");
    }

    const duplicatePayment = await SaasPayment.findOne({
      _id: { $ne: payment._id },
      $or: [{ providerPaymentId: razorpay_payment_id }, { gatewayPaymentId: razorpay_payment_id }],
    }).select("_id restaurant");
    if (duplicatePayment) {
      payment.status = "failed";
      await payment.save();
      throw new ApiError(422, "Payment verification failed");
    }

    paid = true;
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.providerPaymentId = razorpay_payment_id;
  }

  if (!paid) {
    payment.status = "failed";
    await payment.save();
    await createActivity({
      action: "Payment Failed",
      description: `Payment failed for subscription ${payment.subscription}`,
      performedBy,
      restaurantId,
      targetId: payment._id,
      targetType: "saas_payment",
      metadata: { planName: payment.planName, amount: payment.amount, paymentReference: payment.gatewayPaymentId || payment.gatewayOrderId },
    });
    const sub = await Subscription.findById(payment.subscription);
    if (sub && sub.status !== "active" && sub.status !== "trial") {
      sub.status = "expired";
      await sub.save();
    }
    throw new ApiError(422, "Payment failed. Subscription remains expired.");
  }

  payment.gatewayPaymentId = payment.gatewayPaymentId || `paid_${Date.now()}`;
  payment.providerPaymentId = payment.providerPaymentId || payment.gatewayPaymentId;
  payment.paidAt = payment.paidAt || new Date();

  // Best-effort: enrich safe payment method from Razorpay (never stores card/CVV).
  if (!payment.paymentMethod && payment.gatewayPaymentId && !String(payment.gatewayPaymentId).startsWith("test_")) {
    try {
      const razorpay = getPlatformSubscriptionRazorpayClient();
      if (razorpay) {
        const rpPayment = await razorpay.payments.fetch(payment.gatewayPaymentId);
        if (rpPayment?.method) {
          payment.paymentMethod = String(rpPayment.method).toLowerCase();
        }
      }
    } catch (_err) {
      // Non-fatal — listing still works without method.
    }
  } else if (!payment.paymentMethod && payment.gateway === "test") {
    payment.paymentMethod = "test";
  }

  const plan = await resolvePlan(payment.planName);
  const sub = await Subscription.findById(payment.subscription);
  if (!sub) throw new ApiError(404, "Subscription not found");

  const restaurant = await Restaurant.findById(restaurantId).select("name").lean();
  await activatePaidSubscription({
    subscription: sub,
    plan,
    performedBy,
    restaurantName: restaurant?.name,
    source,
    adminOverride: false,
    payment,
  });

  sub.metadata = {
    ...(sub.metadata || {}),
    lastGatewayPaymentId: payment.gatewayPaymentId,
    lastSaasPaymentId: String(payment._id),
    lastPaidAmount: payment.amount,
    lastPaidAt: payment.paidAt || new Date().toISOString(),
  };
  await sub.save();

  payment.status = "paid";
  await payment.save();

  await createActivity({
    action: "Payment Successful",
    description: `Payment successful for ${plan.name} — subscription activated`,
    performedBy,
    restaurantId,
    targetId: payment._id,
    targetType: "saas_payment",
    metadata: {
      planName: plan.key,
      amount: payment.amount,
      paymentReference: payment.gatewayPaymentId,
      subscriptionId: String(sub._id),
    },
  });

  return sub;
};

const syncAndExpire = async (sub) => {
  if (normalizeTrialDates(sub)) {
    await sub.save();
  }
  if (sub.status === "trial" && expireTrialIfNeeded(sub)) {
    await sub.save();
    return true;
  }
  return false;
};

const activatePaidSubscription = async ({
  subscription,
  plan,
  performedBy = null,
  restaurantName = "",
  source = "payment",
  adminOverride = false,
  payment = null,
}) => {
  const now = new Date();
  // A payment's values are a purchase-time snapshot. This protects old pending
  // checkout records if plan catalog pricing changes before verification.
  const snapshot = payment?.metadata?.planSnapshot || null;
  // Mongoose materializes a schema default for old rows. Ignore that default so
  // a pre-change yearly payment keeps its original 12-month term.
  const persistedPaymentDuration = payment?.$isDefault?.("durationMonths") ? null : payment?.durationMonths;
  const durationMonths = Number(snapshot?.durationMonths || persistedPaymentDuration) || getPlanDurationMonths(plan);
  const durationLabel = snapshot?.durationLabel || payment?.durationLabel || getPlanDurationLabel(plan);
  const amount = payment ? Number(payment.amount) : Number(plan.price);
  const endDate = calculateSubscriptionEndDate(now, durationMonths);
  subscription.status = "active";
  subscription.planId = plan._id;
  subscription.planName = plan.key;
  subscription.price = amount;
  subscription.billingCycle = snapshot?.billingCycle || payment?.billingCycle || plan.billingCycle || "monthly";
  subscription.durationMonths = durationMonths;
  subscription.durationLabel = durationLabel;
  subscription.subscriptionStartAt = now;
  subscription.startDate = now;
  subscription.subscriptionEndAt = endDate;
  // Kept in sync for existing guards and API clients that still use renewalDate.
  subscription.renewalDate = endDate;
  subscription.cancelledAt = null;
  subscription.suspendedAt = null;
  subscription.metadata = {
    ...(subscription.metadata || {}),
    lastActivationSource: source,
    adminOverride,
    recurringBillingEnabled: false,
    paymentRecorded: !adminOverride,
    durationMonths,
    durationLabel,
    selectedPremiumDurationYears: snapshot?.premiumDurationYears || null,
  };
  await subscription.save();

  await createActivity({
    action: adminOverride ? "Manual Admin Activation" : "Subscription Activated",
    description: adminOverride
      ? `Admin manually activated ${plan.name} for ${restaurantName || subscription.restaurant} without payment`
      : `Paid plan ${plan.name} activated for ${restaurantName || subscription.restaurant}`,
    performedBy,
    restaurantId: subscription.restaurant,
    targetId: subscription._id,
    targetType: "subscription",
    metadata: { planName: plan.key, price: amount, durationMonths, durationLabel, source, adminOverride, userId: performedBy },
  });

  return subscription;
};

export const listSubscriptions = asyncHandler(async (_req, res) => {
  const subs = await Subscription.find().populate("restaurant", "name").sort({ createdAt: -1 });
  const views = [];

  for (const sub of subs) {
    const expiredNow = await syncAndExpire(sub);
    if (expiredNow) {
      await createActivity({
        action: "Trial Expired",
        description: `Trial expired for ${sub.restaurant?.name || sub.restaurant}`,
        restaurantId: sub.restaurant?._id || sub.restaurant,
        targetId: sub._id,
        targetType: "subscription",
      });
    }
    views.push(toSubscriptionView(sub));
  }

  res.status(200).json(new ApiResponse(true, "Subscriptions fetched", views));
});

export const createSubscription = asyncHandler(async (req, res) => {
  const { restaurantId, planName, status } = req.body;
  if (!restaurantId || !planName) throw new ApiError(400, "restaurantId and planName required");

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw new ApiError(404, "Restaurant not found");

  await assertNoDuplicateSubscription(restaurant._id);

  const plan = await resolvePlan(planName);
  const trialStart = new Date();
  const effectiveStatus = status === "active" ? "active" : "trial";
  const trialEndDate = effectiveStatus === "trial" ? calculateTrialEndDate(trialStart) : null;

  const sub = await Subscription.create({
    restaurant: restaurant._id,
    planId: plan._id,
    planName: plan.key,
    price: effectiveStatus === "trial" ? 0 : plan.price,
    billingCycle: plan.billingCycle || "monthly",
    durationMonths: getPlanDurationMonths(plan),
    durationLabel: getPlanDurationLabel(plan),
    status: effectiveStatus,
    startDate: trialStart,
    trialStartDate: effectiveStatus === "trial" ? trialStart : null,
    trialEndDate,
    subscriptionStartAt: effectiveStatus === "active" ? trialStart : null,
    subscriptionEndAt: effectiveStatus === "active" ? calculateSubscriptionEndDate(trialStart, getPlanDurationMonths(plan)) : null,
    renewalDate: effectiveStatus === "active" ? calculateSubscriptionEndDate(trialStart, getPlanDurationMonths(plan)) : null,
    metadata: {
      recurringBillingEnabled: false,
      ...(effectiveStatus === "trial" ? { trialDurationDays: getFreeTrialDays() } : {}),
    },
  });

  await createActivity({
    action: effectiveStatus === "trial" ? "Trial Started" : "Subscription Created",
    description: `Subscription for ${restaurant.name} created (${effectiveStatus})`,
    performedBy: req.user._id,
    restaurantId: restaurant._id,
    targetId: sub._id,
    targetType: "subscription",
    metadata: {
      trialStartAt: trialStart.toISOString(),
      trialEndAt: trialEndDate?.toISOString(),
      trialDays: getFreeTrialDays(),
    },
  });

  res.status(201).json(new ApiResponse(true, "Subscription created", toSubscriptionView(sub)));
});

export const getSubscription = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  await syncAndExpire(sub);
  res.status(200).json(new ApiResponse(true, "Subscription fetched", toSubscriptionView(sub)));
});

export const updateSubscription = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw new ApiError(404, "Subscription not found");

  const allowed = ["planName", "price", "billingCycle", "metadata"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.planName) {
    const plan = await resolvePlan(updates.planName);
    updates.planId = plan._id;
    updates.planName = plan.key;
    if (updates.price === undefined && sub.status === "active") updates.price = plan.price;
  }

  Object.assign(sub, updates);
  if (sub.status === "trial") sub.renewalDate = null;
  await sub.save();

  await createActivity({
    action: "Subscription Updated",
    description: `Subscription ${sub._id} updated`,
    performedBy: req.user._id,
    restaurantId: sub.restaurant,
    targetId: sub._id,
    targetType: "subscription",
  });

  res.status(200).json(new ApiResponse(true, "Subscription updated", toSubscriptionView(sub)));
});

export const extendTrial = asyncHandler(async (req, res) => {
  const { days, confirm } = req.body;
  if (confirm !== true) {
    throw new ApiError(400, "Confirmation required to extend trial");
  }

  const extraDays = Number(days);
  if (!Number.isFinite(extraDays) || extraDays <= 0 || extraDays > 90) {
    throw new ApiError(400, "days must be between 1 and 90");
  }

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  assertStatusTransition(sub, "extend_trial");

  const oldTrialEnd = sub.trialEndDate
    ? new Date(sub.trialEndDate)
    : calculateTrialEndDate(sub.trialStartDate || sub.startDate);
  const base = oldTrialEnd.getTime() > Date.now() ? oldTrialEnd : new Date();
  const newTrialEnd = calculateTrialEndDate(base, extraDays);

  sub.trialEndDate = newTrialEnd;
  sub.status = "trial";
  sub.trialStartDate = sub.trialStartDate || sub.startDate || new Date();
  sub.renewalDate = null;
  sub.subscriptionStartAt = null;
  sub.metadata = {
    ...(sub.metadata || {}),
    lastTrialExtensionDays: extraDays,
    trialExtendedAt: new Date().toISOString(),
  };
  await sub.save();

  await createActivity({
    action: "Trial Extended",
    description: "Trial period extended",
    performedBy: req.user._id,
    restaurantId: sub.restaurant?._id || sub.restaurant,
    targetId: sub._id,
    targetType: "subscription",
    metadata: {
      restaurant: sub.restaurant?.name,
      oldTrialEnd: oldTrialEnd.toISOString(),
      newTrialEnd: newTrialEnd.toISOString(),
      performedBy: req.user._id,
      days: extraDays,
    },
  });

  res.status(200).json(new ApiResponse(true, "Trial extended", toSubscriptionView(sub)));
});

/** Select paid plan only — does NOT activate or record payment. */
export const convertToPaid = asyncHandler(async (req, res) => {
  rejectClientPricing(req.body);

  const { planName, planId, premiumDurationYears } = req.body;
  if (!planName && !planId) throw new ApiError(400, "planName or planId is required");

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  assertStatusTransition(sub, "convert_plan");

  let plan;
  try {
    plan = planId ? await resolvePlan(planId) : await resolvePlan(planName);
  } catch {
    throw new ApiError(400, "Invalid plan selected");
  }
  let offer;
  try {
    offer = getPlanOffer(plan, premiumDurationYears);
  } catch {
    throw new ApiError(400, "Premium duration must be one of 1, 2, 3, 4, or 5 years");
  }

  sub.planId = plan._id;
  sub.planName = plan.key;
  sub.price = 0;
  sub.metadata = {
    ...(sub.metadata || {}),
    selectedPaidPlan: plan.key,
    selectedPaidPlanId: String(plan._id),
    selectedPaidPlanAt: new Date().toISOString(),
    selectedPremiumDurationYears: isPremiumPlan(plan) ? offer.premiumDurationYears : null,
    paymentRecorded: false,
  };
  await sub.save();

  await createActivity({
    action: "Plan Selected",
    description: `Paid plan ${plan.name} selected for ${sub.restaurant?.name}. Payment still required.`,
    performedBy: req.user._id,
    restaurantId: sub.restaurant?._id || sub.restaurant,
    targetId: sub._id,
    targetType: "subscription",
    metadata: { planName: plan.key, planId: plan._id, paymentRecorded: false, userId: req.user._id },
  });

  const paymentSummary = buildPaymentSummary(plan, offer, sub.restaurant?.name);

  res.status(200).json(
    new ApiResponse(true, "Paid plan selected. Continue to payment to activate.", {
      subscription: toSubscriptionView(sub),
      selectedPlan: plan,
      paymentSummary,
    })
  );
});

export const suspendSubscription = asyncHandler(async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== true) throw new ApiError(400, "Confirmation required to suspend subscription");

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  assertStatusTransition(sub, "suspend");

  sub.status = "suspended";
  sub.suspendedAt = new Date();
  await sub.save();

  await createActivity({
    action: "Subscription Suspended",
    description: `Subscription suspended for ${sub.restaurant?.name || sub.restaurant}`,
    performedBy: req.user._id,
    restaurantId: sub.restaurant?._id || sub.restaurant,
    targetId: sub._id,
    targetType: "subscription",
  });

  res.status(200).json(new ApiResponse(true, "Subscription suspended", toSubscriptionView(sub)));
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== true) throw new ApiError(400, "Confirmation required to cancel subscription");

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  assertStatusTransition(sub, "cancel");

  sub.status = "cancelled";
  sub.cancelledAt = new Date();
  sub.renewalDate = null;
  await sub.save();

  await createActivity({
    action: "Subscription Cancelled",
    description: `Subscription cancelled for ${sub.restaurant?.name || sub.restaurant}`,
    performedBy: req.user._id,
    restaurantId: sub.restaurant?._id || sub.restaurant,
    targetId: sub._id,
    targetType: "subscription",
  });

  res.status(200).json(new ApiResponse(true, "Subscription cancelled", toSubscriptionView(sub)));
});

/** Super Admin manual activation without payment — explicit override. */
export const activateSubscription = asyncHandler(async (req, res) => {
  const { planName, confirm } = req.body;
  if (confirm !== true) {
    throw new ApiError(400, "Confirmation required to activate subscription without payment");
  }

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");
  assertStatusTransition(sub, "activate_admin");

  const plan = await resolvePlan(planName || sub.planName || "basic");
  await activatePaidSubscription({
    subscription: sub,
    plan,
    performedBy: req.user._id,
    restaurantName: sub.restaurant?.name,
    source: "super_admin_activate",
    adminOverride: true,
  });

  res.status(200).json(new ApiResponse(true, "Subscription activated (admin override)", toSubscriptionView(sub)));
});

export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await listActivePlans();
  res.status(200).json(new ApiResponse(true, "Plans fetched", plans.map((plan) => ({
    ...plan,
    premiumDurationOptions: getPremiumDurationOptions(plan).map((offer) => ({
      years: offer.premiumDurationYears,
      amount: offer.amount,
      durationMonths: offer.durationMonths,
      durationLabel: offer.durationLabel,
      monthlyEquivalentPrice: offer.monthlyEquivalentPrice,
    })),
  }))));
});

export const getMySubscription = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  const sub = await Subscription.findOne({ restaurant: restaurantId }).sort({ createdAt: -1 });
  if (!sub) throw new ApiError(404, "Subscription not found");

  const expiredNow = await syncAndExpire(sub);
  if (expiredNow) {
    await createActivity({
      action: "Trial Expired",
      description: "Your free trial has ended.",
      performedBy: req.user._id,
      restaurantId,
      targetId: sub._id,
      targetType: "subscription",
    });

    await notifySubscriptionExpiring({
      restaurantId,
      subscriptionId: sub._id,
      daysRemaining: 0,
      isExpired: true,
    }).catch(() => {});
  }

  const daysRemaining = getDaysRemaining(sub, new Date());
  if ([7, 3, 1].includes(daysRemaining) && sub.status !== "expired") {
    await notifySubscriptionExpiring({
      restaurantId,
      subscriptionId: sub._id,
      daysRemaining,
    }).catch(() => {});
  }

  const [pendingPayment, latestPayment] = await Promise.all([
    SaasPayment.findOne({ subscription: sub._id, status: "pending" }).sort({ createdAt: -1 }),
    SaasPayment.findOne({ subscription: sub._id }).sort({ createdAt: -1 }),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Subscription fetched", toSubscriptionView(sub, { pendingPayment, latestPayment }))
  );
});

export const createBillingCheckout = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  // planName is allowed for selection; server still loads price from catalog.
  // Block any attempt to set subscription state / pricing from the client.
  const blockedForCheckout = [
    "trialEndDate",
    "trialStartDate",
    "trialEndAt",
    "trialStartAt",
    "status",
    "price",
    "amount",
    "renewalDate",
    "subscriptionStartAt",
    "billingCycle",
    "startDate",
    "cancelledAt",
    "suspendedAt",
    "metadata",
    "restaurant",
    "restaurantId",
  ];
  for (const field of blockedForCheckout) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      throw new ApiError(403, `You are not allowed to modify ${field}`);
    }
  }
  rejectClientPricing(req.body);

  const { planName, premiumDurationYears } = req.body;
  if (!planName) throw new ApiError(400, "planName is required");

  const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();
  if (idempotencyKey.length > 120) throw new ApiError(400, "Idempotency key is invalid");

  const plan = await resolvePlan(planName);
  let offer;
  try {
    offer = getPlanOffer(plan, premiumDurationYears);
  } catch {
    throw new ApiError(400, "Premium duration must be one of 1, 2, 3, 4, or 5 years");
  }
  const sub = await Subscription.findOne({ restaurant: restaurantId }).sort({ createdAt: -1 });
  if (!sub) throw new ApiError(404, "Subscription not found");

  if (sub.status === "trial") await syncAndExpire(sub);
  if (sub.status === "active") throw new ApiError(400, "Subscription is already active");

  // Remember selected plan in metadata only during trial — do not overwrite trial plan name.
  const alreadySelected = sub.metadata?.selectedPaidPlan === plan.key && sub.metadata?.selectedPremiumDurationYears === (offer.premiumDurationYears || null);
  sub.metadata = {
    ...(sub.metadata || {}),
    selectedPaidPlan: plan.key,
    selectedPaidPlanId: String(plan._id),
    selectedPaidPlanAt: new Date().toISOString(),
    selectedPremiumDurationYears: isPremiumPlan(plan) ? offer.premiumDurationYears : null,
    paymentRecorded: false,
  };
  if (sub.status !== "trial") {
    sub.planId = plan._id;
    sub.planName = plan.key;
  }
  await sub.save();

  if (!alreadySelected) {
    const restaurantForLog = await Restaurant.findById(restaurantId).select("name").lean();
    await createActivity({
      action: "Plan Selected",
      description: `Paid plan ${plan.name} selected for ${restaurantForLog?.name || "restaurant"}. Payment still required.`,
      performedBy: req.user._id,
      restaurantId,
      targetId: sub._id,
      targetType: "subscription",
      metadata: { planName: plan.key, planId: plan._id, paymentRecorded: false, source: "tenant_checkout" },
    });
  }

  const restaurant = await Restaurant.findById(restaurantId).select("name").lean();
  const checkout = await createCheckoutPayment(sub, plan, offer, restaurant?.name, req.user._id, idempotencyKey || null);
  res.status(200).json(new ApiResponse(true, "Checkout created", checkout));
});

/**
 * Production-facing tenant endpoint. Its only accepted plan field is a
 * catalog identifier; all money, dates, restaurant context and state remain
 * server authoritative in createBillingCheckout.
 */
export const createRazorpaySubscriptionOrder = (req, res, next) => {
  req.body = { ...(req.body || {}), planName: req.body?.planId };
  return createBillingCheckout(req, res, next);
};

/** Super Admin: checkout for a subscription using server-side selected plan pricing. */
export const createSubscriptionPaymentCheckout = asyncHandler(async (req, res) => {
  rejectClientPricing(req.body);

  const sub = await Subscription.findById(req.params.id).populate("restaurant", "name");
  if (!sub) throw new ApiError(404, "Subscription not found");

  if (sub.status === "trial") await syncAndExpire(sub);
  if (sub.status === "active") throw new ApiError(400, "Subscription is already active");

  const { plan, offer } = await getSelectedOfferForSubscription(sub);
  const checkout = await createCheckoutPayment(sub, plan, offer, sub.restaurant?.name, req.user._id);
  res.status(200).json(new ApiResponse(true, "Checkout created", checkout));
});

export const verifyBillingPayment = asyncHandler(async (req, res) => {
  const restaurantId = req.user?.restaurant;
  if (!restaurantId) throw new ApiError(403, "Restaurant context required");

  for (const field of FORBIDDEN_TENANT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      throw new ApiError(403, `You are not allowed to modify ${field}`);
    }
  }
  rejectClientPricing(req.body);

  const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature, testSuccess } = req.body;
  if (!paymentId) throw new ApiError(400, "paymentId is required");

  const payment = await SaasPayment.findOne({ _id: paymentId, restaurant: restaurantId });
  if (!payment) throw new ApiError(404, "Billing payment not found");

  const sub = await verifyAndActivatePayment({
    payment,
    restaurantId,
    performedBy: req.user._id,
    source: "restaurant_billing_payment",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    testSuccess,
  });

  res.status(200).json(new ApiResponse(true, "Subscription activated", toSubscriptionView(sub)));
});

export const verifyRazorpaySubscriptionPayment = verifyBillingPayment;

/** Super Admin: verify payment for a subscription (tenant from subscription record). */
export const verifySubscriptionPayment = asyncHandler(async (req, res) => {
  rejectClientPricing(req.body);

  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw new ApiError(404, "Subscription not found");

  const restaurantId = sub.restaurant?._id || sub.restaurant;
  const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature, testSuccess } = req.body;
  if (!paymentId) throw new ApiError(400, "paymentId is required");

  const payment = await SaasPayment.findOne({ _id: paymentId, subscription: sub._id, restaurant: restaurantId });
  if (!payment) throw new ApiError(404, "Billing payment not found for this subscription");

  const updated = await verifyAndActivatePayment({
    payment,
    restaurantId,
    performedBy: req.user._id,
    source: "super_admin_billing_payment",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    testSuccess,
  });

  res.status(200).json(new ApiResponse(true, "Subscription activated", toSubscriptionView(updated)));
});

export { activatePaidSubscription, getFreeTrialDays };

export default {
  listSubscriptions,
  createSubscription,
  getSubscription,
  updateSubscription,
  extendTrial,
  convertToPaid,
  suspendSubscription,
  cancelSubscription,
  activateSubscription,
  listPlans,
  getMySubscription,
  createBillingCheckout,
  verifyBillingPayment,
  createRazorpaySubscriptionOrder,
  verifyRazorpaySubscriptionPayment,
  createSubscriptionPaymentCheckout,
  verifySubscriptionPayment,
};
