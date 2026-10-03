import assert from "node:assert/strict";
import { DEFAULT_PLANS, getPlanOffer, getPlanOfferView, isTestBasicOneMonthPricingEnabled } from "../services/planService.js";
import { buildSaasPaymentReceiptData } from "../utils/saasPaymentPdf.js";
import { calculateSubscriptionEndDate, toSubscriptionView } from "../utils/subscriptionUtils.js";

const basic = DEFAULT_PLANS.find((plan) => plan.key === "basic");
const original = {
  NODE_ENV: process.env.NODE_ENV,
  BILLING_TEST_MODE: process.env.BILLING_TEST_MODE,
  TEST_BASIC_1M_PRICE: process.env.TEST_BASIC_1M_PRICE,
};

try {
  process.env.NODE_ENV = "test";
  process.env.BILLING_TEST_MODE = "true";
  process.env.TEST_BASIC_1M_PRICE = "true";
  assert.equal(isTestBasicOneMonthPricingEnabled(), true);
  const testOffer = getPlanOffer(basic);
  assert.deepEqual(
    {
      amount: testOffer.amount,
      durationMonths: testOffer.durationMonths,
      durationLabel: testOffer.durationLabel,
      monthlyEquivalentPrice: testOffer.monthlyEquivalentPrice,
      testPrice: testOffer.testPrice,
    },
    { amount: 1, durationMonths: 1, durationLabel: "1 month", monthlyEquivalentPrice: 1, testPrice: true }
  );

  const offerView = getPlanOfferView(basic);
  assert.deepEqual(offerView.premiumDurationOptions, [], "Basic's server view contains no client-selected term");
  assert.deepEqual(
    {
      price: offerView.price,
      durationLabel: offerView.durationLabel,
      monthlyEquivalentPrice: offerView.monthlyEquivalentPrice,
      testPrice: offerView.testPrice,
    },
    { price: 1, durationLabel: "1 month", monthlyEquivalentPrice: 1, testPrice: true },
    "public and authenticated plan lists derive their Basic display values from the canonical offer view"
  );

  const start = new Date("2026-01-31T00:00:00.000Z");
  const end = calculateSubscriptionEndDate(start, testOffer.durationMonths);
  assert.equal(end.toISOString(), "2026-02-28T00:00:00.000Z");
  const subscriptionView = toSubscriptionView({
    status: "active",
    planName: "basic",
    price: testOffer.amount,
    durationMonths: testOffer.durationMonths,
    durationLabel: testOffer.durationLabel,
    subscriptionStartAt: start,
    subscriptionEndAt: end,
    renewalDate: end,
  }, {}, start);
  assert.equal(subscriptionView.price, 1);
  assert.equal(subscriptionView.durationLabel, "1 month");
  assert.equal(subscriptionView.subscriptionEndAt.toISOString(), end.toISOString());
  const receipt = buildSaasPaymentReceiptData({
    amount: testOffer.amount,
    durationLabel: testOffer.durationLabel,
    currency: "INR",
    status: "paid",
  }, subscriptionView);
  assert.equal(receipt.amount, 1);
  assert.equal(receipt.durationLabel, "1 month");

  process.env.BILLING_TEST_MODE = "false";
  assert.equal(isTestBasicOneMonthPricingEnabled(), false);
  assert.equal(getPlanOffer(basic).amount, basic.price);

  process.env.BILLING_TEST_MODE = "true";
  process.env.NODE_ENV = "production";
  assert.equal(isTestBasicOneMonthPricingEnabled(), false);
  assert.equal(getPlanOffer(basic).amount, basic.price);
  assert.deepEqual(
    {
      price: getPlanOfferView(basic).price,
      durationLabel: getPlanOfferView(basic).durationLabel,
      monthlyEquivalentPrice: getPlanOfferView(basic).monthlyEquivalentPrice,
      testPrice: getPlanOfferView(basic).testPrice,
    },
    { price: 7500, durationLabel: "3 months", monthlyEquivalentPrice: 2500, testPrice: false },
    "production public and authenticated plan views retain the configured Basic catalog price"
  );

  console.log("testBasicPlanPrice.test.js passed: the ₹1 Basic offer is development/test-only and production retains catalog pricing.");
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}