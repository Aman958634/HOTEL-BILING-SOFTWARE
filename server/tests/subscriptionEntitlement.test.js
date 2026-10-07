import assert from "node:assert/strict";
import { SUBSCRIPTION_STATES, calculateSubscriptionEndDate, getEffectiveSubscriptionState, syncSubscriptionEntitlement, toSubscriptionView } from "../utils/subscriptionUtils.js";

const now = new Date("2026-10-04T12:00:00.000Z");
const trialStart = new Date("2026-09-29T12:00:00.000Z");
const activeTrial = { status: "trial", trialStartDate: trialStart, trialEndDate: new Date("2026-10-05T12:00:00.000Z"), metadata: { trialDurationDays: 7 } };
assert.equal(getEffectiveSubscriptionState(activeTrial, now), SUBSCRIPTION_STATES.TRIAL_ACTIVE);

const expiredTrial = { status: "trial", trialStartDate: trialStart, trialEndDate: now, metadata: { trialDurationDays: 7 } };
const expiredTrialSync = syncSubscriptionEntitlement(expiredTrial, now);
assert.equal(expiredTrialSync.state, SUBSCRIPTION_STATES.TRIAL_EXPIRED);
assert.equal(expiredTrial.status, "expired");
assert.equal(expiredTrial.metadata.expiredEntitlementState, SUBSCRIPTION_STATES.TRIAL_EXPIRED);
assert.equal(toSubscriptionView(expiredTrial, {}, now).entitlementState, SUBSCRIPTION_STATES.TRIAL_EXPIRED);

const paidStart = new Date("2026-09-04T12:00:00.000Z");
const expiredPaid = { status: "active", subscriptionStartAt: paidStart, subscriptionEndAt: now, renewalDate: now, metadata: {} };
const expiredPaidSync = syncSubscriptionEntitlement(expiredPaid, now);
assert.equal(expiredPaidSync.state, SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED);
assert.equal(expiredPaid.status, "expired");
assert.equal(expiredPaid.metadata.expiredEntitlementState, SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED);

const paidActive = { status: "active", subscriptionStartAt: paidStart, subscriptionEndAt: calculateSubscriptionEndDate(now, 1), metadata: {} };
assert.equal(getEffectiveSubscriptionState(paidActive, now), SUBSCRIPTION_STATES.SUBSCRIPTION_ACTIVE);
assert.equal(getEffectiveSubscriptionState({ status: "suspended", metadata: {} }, now), SUBSCRIPTION_STATES.SUSPENDED);
console.log("subscriptionEntitlement.test.js passed: request-time trial/paid expiry and effective entitlement states.");
