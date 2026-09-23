import assert from "node:assert/strict";
import {
  ALL_PAID_PLAN_FEATURES,
  DEFAULT_PLANS,
  getPlanDurationLabel,
  getPlanDurationMonths,
  getPlanOffer,
  getPremiumDurationYears,
  getPlanSnapshot,
  hasAllPaidFeatures,
} from "../services/planService.js";
import { calculateSubscriptionEndDate, toSubscriptionView } from "../utils/subscriptionUtils.js";

const plans = Object.fromEntries(DEFAULT_PLANS.map((plan) => [plan.key, plan]));

assert.deepEqual(
  [plans.basic.price, plans.professional.price, plans.enterprise.price],
  [7500, 15000, 30000],
  "Fixed-duration pricing must come from the server plan catalog"
);
for (const key of ["basic", "professional", "enterprise", "pro", "premium"]) {
  assert.equal(hasAllPaidFeatures(key), true, `${key} must receive all paid product features`);
}
for (const plan of Object.values(plans)) {
  assert.equal(plan.entitlement, "all_paid_features");
  assert.deepEqual(plan.features, ALL_PAID_PLAN_FEATURES);
}
assert.deepEqual(
  [getPlanDurationMonths(plans.basic), getPlanDurationMonths(plans.professional), getPlanDurationMonths(plans.enterprise)],
  [3, 6, 12]
);
assert.deepEqual(
  [getPlanDurationLabel(plans.basic), getPlanDurationLabel(plans.professional), getPlanDurationLabel(plans.enterprise)],
  ["3 months", "6 months", "1 year"]
);

// Calendar-safe handling: January 31 plus one month ends on February 28 in a non-leap year.
assert.equal(
  calculateSubscriptionEndDate(new Date("2026-01-31T10:00:00.000Z"), 1).toISOString(),
  "2026-02-28T10:00:00.000Z"
);
assert.equal(
  calculateSubscriptionEndDate(new Date("2026-01-31T10:00:00.000Z"), 3).toISOString(),
  "2026-04-30T10:00:00.000Z"
);
const activation = new Date("2026-08-25T12:00:00.000Z");
assert.equal(calculateSubscriptionEndDate(activation, 3).toISOString(), "2026-11-25T12:00:00.000Z");
assert.equal(calculateSubscriptionEndDate(activation, 6).toISOString(), "2027-02-25T12:00:00.000Z");
assert.equal(calculateSubscriptionEndDate(activation, 12).toISOString(), "2027-08-25T12:00:00.000Z");

const purchase = getPlanSnapshot(plans.professional);
assert.equal(purchase.amount, 15000);
assert.equal(purchase.durationMonths, 6);

const premiumOffers = [1, 2, 3, 4, 5].map((years) => getPlanOffer(plans.enterprise, years));
assert.deepEqual(premiumOffers.map((offer) => offer.amount), [30000, 60000, 90000, 120000, 150000]);
assert.deepEqual(premiumOffers.map((offer) => offer.durationMonths), [12, 24, 36, 48, 60]);
assert.deepEqual(premiumOffers.map((offer) => offer.monthlyEquivalentPrice), [2500, 2500, 2500, 2500, 2500]);
assert.throws(() => getPremiumDurationYears(6), /Premium duration/i);
assert.throws(() => getPremiumDurationYears("invalid"), /Premium duration/i);
assert.equal(
  calculateSubscriptionEndDate(new Date("2024-02-29T09:00:00.000Z"), 12).toISOString(),
  "2025-02-28T09:00:00.000Z"
);

// Existing records without duration fields retain their historical monthly meaning.
const legacy = toSubscriptionView({ status: "active", billingCycle: "monthly", renewalDate: new Date("2026-10-01T00:00:00.000Z") });
assert.equal(legacy.durationMonths, 1);
assert.equal(legacy.durationLabel, "1 month");

console.log("Fixed-duration pricing tests passed.");
