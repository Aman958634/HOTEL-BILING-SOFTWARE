import assert from "node:assert/strict";
import {
  calculateRenewalDate,
  calculateTrialEndDate,
  expireTrialIfNeeded,
  formatDaysRemainingLabel,
  getDaysRemaining,
  getFreeTrialDays,
  getTrialWarningMessage,
  hasTrialExpired,
  normalizeTrialDates,
  toSubscriptionView,
} from "../utils/subscriptionUtils.js";

const MS_DAY = 24 * 60 * 60 * 1000;

const run = () => {
  assert.equal(getFreeTrialDays(), 15, "Trial must be exactly 15 days, never 30");

  // Test 1: trialStartAt = 2026-08-07 → trialEndAt = 2026-08-22
  const startAug7 = new Date("2026-08-07T00:00:00.000Z");
  assert.equal(calculateTrialEndDate(startAug7).toISOString(), "2026-08-22T00:00:00.000Z");

  // Test 2: trialStartAt = 2026-08-01 → trialEndAt = 2026-08-16
  const startAug1 = new Date("2026-08-01T00:00:00.000Z");
  assert.equal(calculateTrialEndDate(startAug1).toISOString(), "2026-08-16T00:00:00.000Z");

  // Test 4: new restaurant always receives exactly 15 days
  const created = new Date("2026-08-10T12:00:00.000Z");
  const trialEnd = calculateTrialEndDate(created, 15);
  assert.equal(trialEnd.toISOString(), "2026-08-25T12:00:00.000Z");
  assert.equal(trialEnd.getTime() - created.getTime(), 15 * MS_DAY);

  const trialSub = {
    status: "trial",
    trialStartDate: created,
    startDate: created,
    trialEndDate: trialEnd,
    renewalDate: null,
  };
  assert.equal(getDaysRemaining(trialSub, created), 15);
  assert.equal(formatDaysRemainingLabel(trialSub, created), "15 days remaining");

  const at10 = new Date(trialEnd.getTime() - 10 * MS_DAY);
  assert.equal(getDaysRemaining(trialSub, at10), 10);

  const at1 = new Date(trialEnd.getTime() - 1 * MS_DAY);
  assert.equal(getDaysRemaining(trialSub, at1), 1);
  assert.equal(getTrialWarningMessage(1), "Your free trial ends tomorrow.");

  // Test 3: after trialEndAt → status EXPIRED, daysRemaining = 0
  assert.equal(hasTrialExpired(trialSub, trialEnd), true);
  const expiredCopy = { ...trialSub };
  assert.equal(expireTrialIfNeeded(expiredCopy, trialEnd), true);
  assert.equal(expiredCopy.status, "expired");
  assert.equal(formatDaysRemainingLabel(expiredCopy, trialEnd), "EXPIRED");

  const expiredView = toSubscriptionView(expiredCopy, trialEnd);
  assert.equal(expiredView.daysRemaining, 0);
  assert.equal(expiredView.renewalDate, null);

  const paidStart = new Date("2026-08-25T12:00:00.000Z");
  const paid = {
    status: "active",
    planName: "basic",
    price: 999,
    subscriptionStartAt: paidStart,
    startDate: paidStart,
    renewalDate: calculateRenewalDate(paidStart, "monthly"),
    trialEndDate: trialEnd,
  };
  const paidView = toSubscriptionView(paid, new Date("2026-08-26T12:00:00.000Z"));
  assert.equal(paidView.status, "active");
  assert.ok(paidView.renewalDate);
  assert.equal(paidView.daysRemaining, null);

  const renewal = calculateRenewalDate(paidStart, "monthly");
  assert.equal(renewal.toISOString(), "2026-09-25T12:00:00.000Z");

  const suspendedView = toSubscriptionView({ status: "suspended", planName: "basic" });
  assert.equal(suspendedView.status, "suspended");

  const cancelledView = toSubscriptionView({ status: "cancelled", planName: "basic" });
  assert.equal(cancelledView.status, "cancelled");

  // Fix 30-day drift → 15 days (without extension metadata)
  const drifted = {
    status: "trial",
    trialStartDate: created,
    trialEndDate: new Date(created.getTime() + 30 * MS_DAY),
    renewalDate: new Date("2026-09-01T00:00:00.000Z"),
    metadata: {},
  };
  assert.equal(normalizeTrialDates(drifted), true);
  assert.equal(drifted.trialEndDate.toISOString(), trialEnd.toISOString());
  assert.equal(drifted.renewalDate, null);

  // Fix real-world bug: 30-day trial with bogus lastTrialExtensionDays (no trialExtendedAt)
  const buggy30WithFakeExtension = {
    status: "trial",
    trialStartDate: new Date("2026-08-07T17:33:45.644Z"),
    trialEndDate: new Date("2026-09-06T17:33:45.644Z"),
    metadata: { lastTrialExtensionDays: 15 },
  };
  assert.equal(normalizeTrialDates(buggy30WithFakeExtension), true);
  assert.equal(
    buggy30WithFakeExtension.trialEndDate.toISOString(),
    calculateTrialEndDate(buggy30WithFakeExtension.trialStartDate).toISOString()
  );
  assert.equal(buggy30WithFakeExtension.metadata.lastTrialExtensionDays, undefined);
  assert.equal(buggy30WithFakeExtension.metadata.repairedTrialDuration, true);

  // Preserve Super Admin trial extensions (requires trialExtendedAt)
  const extended = {
    status: "trial",
    trialStartDate: created,
    trialEndDate: new Date(created.getTime() + 22 * MS_DAY),
    metadata: { lastTrialExtensionDays: 7, trialExtendedAt: "2026-08-20T12:00:00.000Z" },
  };
  assert.equal(normalizeTrialDates(extended), false);
  assert.equal(extended.trialEndDate.toISOString(), new Date(created.getTime() + 22 * MS_DAY).toISOString());

  const trialView = toSubscriptionView(trialSub, created);
  assert.equal(trialView.trialLabel, "15-Day Free Trial");
  assert.equal(trialView.renewalDate, null);
  assert.equal(trialView.trialStartAt.toISOString(), created.toISOString());

  console.log("All subscription lifecycle tests passed.");
};

run();
