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
  assert.equal(getFreeTrialDays(), 5, "New trials must be exactly five days");

  // Test 1: trialStartAt = 2026-08-07 → trialEndAt = 2026-08-22
  const startAug7 = new Date("2026-08-07T00:00:00.000Z");
  assert.equal(calculateTrialEndDate(startAug7).toISOString(), "2026-08-12T00:00:00.000Z");

  // Test 2: trialStartAt = 2026-08-01 → trialEndAt = 2026-08-16
  const startAug1 = new Date("2026-08-01T00:00:00.000Z");
  assert.equal(calculateTrialEndDate(startAug1).toISOString(), "2026-08-06T00:00:00.000Z");

  // New restaurant trial is derived from the server-side start timestamp.
  const created = new Date("2026-08-10T12:00:00.000Z");
  const trialEnd = calculateTrialEndDate(created);
  assert.equal(trialEnd.toISOString(), "2026-08-15T12:00:00.000Z");
  assert.equal(trialEnd.getTime() - created.getTime(), 5 * MS_DAY);

  const trialSub = {
    status: "trial",
    trialStartDate: created,
    startDate: created,
    trialEndDate: trialEnd,
    renewalDate: null,
    metadata: { trialDurationDays: 5 },
  };
  assert.equal(getDaysRemaining(trialSub, created), 5);
  assert.equal(formatDaysRemainingLabel(trialSub, created), "5 days remaining");

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

  // Existing subscriptions retain their stored end date during policy changes.
  const legacy = {
    status: "trial",
    trialStartDate: created,
    trialEndDate: new Date(created.getTime() + 15 * MS_DAY),
    renewalDate: new Date("2026-09-01T00:00:00.000Z"),
    metadata: {},
  };
  assert.equal(normalizeTrialDates(legacy), true);
  assert.equal(legacy.trialEndDate.toISOString(), new Date(created.getTime() + 15 * MS_DAY).toISOString());
  assert.equal(legacy.renewalDate, null);

  const legacyWithoutEnd = {
    status: "trial",
    trialStartDate: created,
    metadata: {},
  };
  assert.equal(normalizeTrialDates(legacyWithoutEnd), true);
  assert.equal(
    legacyWithoutEnd.trialEndDate.toISOString(),
    new Date(created.getTime() + 15 * MS_DAY).toISOString()
  );

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
  assert.equal(trialView.trialLabel, "5-Day Free Trial");
  assert.equal(trialView.renewalDate, null);
  assert.equal(trialView.trialStartAt.toISOString(), created.toISOString());

  console.log("All subscription lifecycle tests passed.");
};

run();
