import assert from "node:assert/strict";
import { CURRENT_FREE_TRIAL_DAYS, TRIAL_SEVEN_DAY_EXTENSION_MS, TRIAL_SEVEN_DAY_MIGRATION_MARKER, getTrialSevenDayMigrationUpdate } from "../services/trialSevenDayMigrationService.js";
import { getEffectiveSubscriptionState, SUBSCRIPTION_STATES, toSubscriptionView } from "../utils/subscriptionUtils.js";

const migratedAt = new Date("2026-10-08T10:00:00.000Z");
const trialStart = new Date("2026-10-03T10:00:00.000Z");
const originalTrialEnd = new Date("2026-10-08T18:00:00.000Z"); // 8 hours remain
const trial = { _id: "trial-1", restaurant: "restaurant-1", status: "trial", trialStartDate: trialStart, trialEndDate: originalTrialEnd, metadata: { trialDurationDays: 5 } };
const operation = getTrialSevenDayMigrationUpdate(trial, migratedAt);
assert.ok(operation, "an active five-day trial is eligible");
assert.equal(operation.newTrialEndDate.toISOString(), "2026-10-10T18:00:00.000Z");
assert.equal(operation.newTrialEndDate.getTime() - originalTrialEnd.getTime(), TRIAL_SEVEN_DAY_EXTENSION_MS);
assert.equal(trial.trialStartDate.toISOString(), trialStart.toISOString(), "the start date is untouched");
const migrated = { ...trial, trialEndDate: operation.newTrialEndDate, metadata: { trialDurationDays: CURRENT_FREE_TRIAL_DAYS, [TRIAL_SEVEN_DAY_MIGRATION_MARKER]: operation.update.$set[`metadata.${TRIAL_SEVEN_DAY_MIGRATION_MARKER}`] } };
assert.equal(getTrialSevenDayMigrationUpdate(migrated, migratedAt), null, "the marker prevents a second extension");
assert.equal(getEffectiveSubscriptionState(migrated, migratedAt), SUBSCRIPTION_STATES.TRIAL_ACTIVE);
const view = toSubscriptionView(migrated, migratedAt);
assert.equal(view.trialStartAt.toISOString(), trialStart.toISOString());
assert.equal(view.trialEndAt.toISOString(), "2026-10-10T18:00:00.000Z");
assert.equal(view.trialLabel, "7-Day Free Trial");
assert.equal(getTrialSevenDayMigrationUpdate({ ...trial, status: "active" }, migratedAt), null, "paid subscriptions are excluded");
assert.equal(getTrialSevenDayMigrationUpdate({ ...trial, trialEndDate: migratedAt }, migratedAt), null, "expired trials are excluded");
assert.equal(getTrialSevenDayMigrationUpdate({ ...trial, metadata: { trialDurationDays: 7 } }, migratedAt), null, "new seven-day trials are excluded");
console.log("trialSevenDayMigration.test.js passed: 48-hour extension, preserved start, idempotency, and paid-subscription safety.");
