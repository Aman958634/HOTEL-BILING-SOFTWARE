import assert from "node:assert/strict";
import { DEFAULT_PLANS, getPlanOffer, getPlanOfferView } from "../services/planService.js";
import { buildSaasPaymentReceiptData } from "../utils/saasPaymentPdf.js";
import { calculateSubscriptionEndDate, toSubscriptionView } from "../utils/subscriptionUtils.js";

const basic = DEFAULT_PLANS.find((plan) => plan.key === "basic");
const original = {
  NODE_ENV: process.env.NODE_ENV,
  BILLING_TEST_MODE: process.env.BILLING_TEST_MODE,
};

try {
  process.env.NODE_ENV = "test";
  process.env.BILLING_TEST_MODE = "true";

  const offer = getPlanOffer(basic);
  assert.deepEqual(
    {
      amount: offer.amount,
      durationMonths: offer.durationMonths,
      durationLabel: offer.durationLabel,
      monthlyEquivalentPrice: offer.monthlyEquivalentPrice,
    },
    { amount: 2997, durationMonths: 3, durationLabel: "3 months", monthlyEquivalentPrice: 999 },
    "The server-owned Basic offer must be identical in test and production modes"
  );

  const offerView = getPlanOfferView(basic);
  assert.deepEqual(offerView.premiumDurationOptions, [], "Basic's server view contains no client-selected term");
  assert.deepEqual(
    {
      price: offerView.price,
      durationLabel: offerView.durationLabel,
      monthlyEquivalentPrice: offerView.monthlyEquivalentPrice,
    },
    { price: 2997, durationLabel: "3 months", monthlyEquivalentPrice: 999 },
    "Public and authenticated plan lists derive Basic from the canonical offer view"
  );

  const start = new Date("2026-01-31T00:00:00.000Z");
  const end = calculateSubscriptionEndDate(start, offer.durationMonths);
  assert.equal(end.toISOString(), "2026-04-30T00:00:00.000Z");
  const subscriptionView = toSubscriptionView({
    status: "active",
    planName: "basic",
    price: offer.amount,
    durationMonths: offer.durationMonths,
    durationLabel: offer.durationLabel,
    subscriptionStartAt: start,
    subscriptionEndAt: end,
    renewalDate: end,
  }, {}, start);
  assert.equal(subscriptionView.price, 2997);
  assert.equal(subscriptionView.durationLabel, "3 months");
  assert.equal(subscriptionView.subscriptionEndAt.toISOString(), end.toISOString());
  const receipt = buildSaasPaymentReceiptData({
    amount: offer.amount,
    durationLabel: offer.durationLabel,
    currency: "INR",
    status: "paid",
  }, subscriptionView);
  assert.equal(receipt.amount, 2997);
  assert.equal(receipt.durationLabel, "3 months");

  process.env.NODE_ENV = "production";
  assert.equal(getPlanOffer(basic).amount, 2997);
  assert.equal(getPlanOfferView(basic).monthlyEquivalentPrice, 999);

  console.log("testBasicPlanPrice.test.js passed: the server catalog always returns the 999/month Basic offer.");
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
