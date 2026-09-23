import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import SaasPayment from "../models/SaasPayment.js";
import { getPlanOffer, resolvePlan } from "../services/planService.js";
import { calculateSubscriptionEndDate } from "../utils/subscriptionUtils.js";
import { verifyAndActivatePayment } from "../controllers/superAdminSubscriptionsController.js";

const { uri } = requireSafeTestDatabase();
const original = { NODE_ENV: process.env.NODE_ENV, BILLING_TEST_MODE: process.env.BILLING_TEST_MODE };
const suffix = crypto.randomBytes(8).toString("hex");
const restaurantIds = [];

try {
  process.env.NODE_ENV = "test";
  process.env.BILLING_TEST_MODE = "true";
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const premium = await resolvePlan("enterprise");

  for (const years of [1, 2, 3, 4, 5]) {
    const offer = getPlanOffer(premium, years);
    assert.equal(offer.amount, 2500 * 12 * years, "server catalog controls Premium amount");
    const restaurant = await Restaurant.create({ name: `Premium test ${years} ${suffix}`, slug: `premium-${years}-${suffix}`, branchCode: `P${years}${suffix.slice(0, 5)}`, address: "Isolated test" });
    restaurantIds.push(restaurant._id);
    const subscription = await Subscription.create({ restaurant: restaurant._id, planId: premium._id, planName: premium.key, status: "expired", metadata: { recurringBillingEnabled: false, selectedPaidPlan: premium.key, selectedPremiumDurationYears: years } });
    const payment = await SaasPayment.create({ restaurant: restaurant._id, subscription: subscription._id, planId: premium._id, planName: premium.key, amount: offer.amount, currency: "INR", billingCycle: offer.billingCycle, durationMonths: offer.durationMonths, durationLabel: offer.durationLabel, gateway: "test", provider: "TEST", metadata: { planSnapshot: offer, purpose: "SUBSCRIPTION" } });
    const activated = await verifyAndActivatePayment({ payment, restaurantId: restaurant._id, performedBy: null, source: "isolated_premium_lifecycle", testSuccess: true });
    assert.equal(activated.status, "active");
    assert.equal(activated.price, offer.amount);
    assert.equal(activated.durationMonths, years * 12);
    assert.equal(activated.durationLabel, offer.durationLabel);
    assert.equal(activated.subscriptionEndAt.getTime(), calculateSubscriptionEndDate(activated.subscriptionStartAt, years * 12).getTime());

    // A browser retry or provider replay cannot add a second term.
    const firstEnd = activated.subscriptionEndAt.getTime();
    const replay = await verifyAndActivatePayment({ payment: await SaasPayment.findById(payment._id), restaurantId: restaurant._id, performedBy: null, source: "isolated_replay", testSuccess: true });
    assert.equal(replay.subscriptionEndAt.getTime(), firstEnd);
  }

  const failedRestaurant = await Restaurant.create({ name: `Premium failed ${suffix}`, slug: `premium-failed-${suffix}`, branchCode: `F${suffix.slice(0, 6)}`, address: "Isolated test" });
  restaurantIds.push(failedRestaurant._id);
  const failedSubscription = await Subscription.create({ restaurant: failedRestaurant._id, planId: premium._id, planName: premium.key, status: "expired", metadata: { recurringBillingEnabled: false } });
  const failedOffer = getPlanOffer(premium, 1);
  const failedPayment = await SaasPayment.create({ restaurant: failedRestaurant._id, subscription: failedSubscription._id, planId: premium._id, planName: premium.key, amount: failedOffer.amount, currency: "INR", billingCycle: failedOffer.billingCycle, durationMonths: failedOffer.durationMonths, durationLabel: failedOffer.durationLabel, gateway: "test", provider: "TEST", metadata: { planSnapshot: failedOffer, purpose: "SUBSCRIPTION" } });
  await assert.rejects(
    () => verifyAndActivatePayment({ payment: failedPayment, restaurantId: failedRestaurant._id, source: "isolated_failed_payment", testSuccess: false }),
    /Payment failed/i
  );
  assert.equal((await SaasPayment.findById(failedPayment._id)).status, "failed");
  assert.equal((await Subscription.findById(failedSubscription._id)).status, "expired");

  assert.throws(() => getPlanOffer(premium, 0), /Premium duration/i);
  assert.throws(() => getPlanOffer(premium, 6), /Premium duration/i);
  assert.equal(calculateSubscriptionEndDate(new Date("2024-02-29T00:00:00.000Z"), 12).toISOString(), "2025-02-28T00:00:00.000Z");
  console.log("premiumSubscriptionLifecycle.integration.test.js passed: all terms, catalog amount, activation, calendar expiry, and replay idempotency.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await SaasPayment.deleteMany({ restaurant: { $in: restaurantIds } });
    await Subscription.deleteMany({ restaurant: { $in: restaurantIds } });
    await Restaurant.deleteMany({ _id: { $in: restaurantIds } });
    await mongoose.disconnect();
  }
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
