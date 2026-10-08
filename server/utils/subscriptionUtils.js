/** New SaaS trials are seven days; the explicit 5-to-7 migration preserves starts and extends only eligible expiry timestamps. */
const FREE_TRIAL_DAYS = 7;
const LEGACY_FREE_TRIAL_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_STATES = {
  TRIAL_ACTIVE: "TRIAL_ACTIVE",
  TRIAL_EXPIRED: "TRIAL_EXPIRED",
  SUBSCRIPTION_ACTIVE: "SUBSCRIPTION_ACTIVE",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUSPENDED: "SUSPENDED",
};

export const getFreeTrialDays = () => FREE_TRIAL_DAYS;

/** Exact trial length: N × 24 hours from the server timestamp. */
export const calculateTrialEndDate = (startDate = new Date(), days = FREE_TRIAL_DAYS) => {
  const start = new Date(startDate);
  const effectiveDays = Math.max(1, Math.floor(Number(days) || FREE_TRIAL_DAYS));
  return new Date(start.getTime() + effectiveDays * MS_PER_DAY);
};

/** New rows carry this marker; unmarked legacy rows retain the former term. */
export const getTrialDurationDays = (subscription) => {
  const persisted = Number(subscription?.metadata?.trialDurationDays);
  return Number.isInteger(persisted) && persisted > 0 ? persisted : LEGACY_FREE_TRIAL_DAYS;
};

export const getEffectiveTrialEndDate = (subscription) => {
  if (!subscription) return null;
  if (subscription.trialEndDate) return new Date(subscription.trialEndDate);
  if (subscription.trialEndAt) return new Date(subscription.trialEndAt);
  if (subscription.status === "trial") {
    const start = subscription.trialStartDate || subscription.trialStartAt || subscription.startDate;
    if (start) return calculateTrialEndDate(start, getTrialDurationDays(subscription));
  }
  return null;
};

export const getTrialStartDate = (subscription) => {
  if (!subscription) return null;
  if (subscription.trialStartDate) return new Date(subscription.trialStartDate);
  if (subscription.trialStartAt) return new Date(subscription.trialStartAt);
  if (subscription.status === "trial" && subscription.startDate) return new Date(subscription.startDate);
  return null;
};

/** The paid end timestamp is canonical; renewalDate is the legacy fallback. */
export const getSubscriptionEndDate = (subscription) => {
  if (!subscription) return null;
  const value = subscription.subscriptionEndAt || subscription.renewalDate;
  return value ? new Date(value) : null;
};

export const getDaysRemaining = (subscription, now = new Date()) => {
  if (!subscription) return 0;
  if (subscription.status === "expired") return 0;
  if (subscription.status !== "trial") return null;
  const trialEnd = getEffectiveTrialEndDate(subscription);
  if (!trialEnd) return 0;
  const diff = trialEnd.getTime() - new Date(now).getTime();
  // Human-facing labels show completed 24-hour periods left instead of rounding up.
  return diff <= 0 ? 0 : Math.floor(diff / MS_PER_DAY);
};

export const hasTrialExpired = (subscription, now = new Date()) => {
  if (!subscription || subscription.status !== "trial") return false;
  const end = getEffectiveTrialEndDate(subscription);
  return Boolean(end && new Date(now).getTime() >= end.getTime());
};

export const hasPaidSubscriptionExpired = (subscription, now = new Date()) => {
  if (!subscription || subscription.status !== "active") return false;
  const end = getSubscriptionEndDate(subscription);
  // An active legacy subscription without an end date is not silently revoked.
  return Boolean(end && new Date(now).getTime() >= end.getTime());
};

/**
 * Resolves entitlement from server-persisted timestamps on every request.
 * It deliberately does not trust browser state or a scheduled expiry job.
 */
export const getEffectiveSubscriptionState = (subscription, now = new Date()) => {
  if (!subscription) return SUBSCRIPTION_STATES.TRIAL_EXPIRED;
  if (subscription.status === "suspended") return SUBSCRIPTION_STATES.SUSPENDED;
  if (subscription.status === "trial") {
    return hasTrialExpired(subscription, now)
      ? SUBSCRIPTION_STATES.TRIAL_EXPIRED
      : SUBSCRIPTION_STATES.TRIAL_ACTIVE;
  }
  if (subscription.status === "active") {
    return hasPaidSubscriptionExpired(subscription, now)
      ? SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED
      : SUBSCRIPTION_STATES.SUBSCRIPTION_ACTIVE;
  }
  if (subscription.status === "expired") {
    return subscription.metadata?.expiredEntitlementState ||
      (getSubscriptionEndDate(subscription)
        ? SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED
        : SUBSCRIPTION_STATES.TRIAL_EXPIRED);
  }
  return SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED;
};

/** Mutates only the canonical subscription row when request-time expiry occurs. */
export const syncSubscriptionEntitlement = (subscription, now = new Date()) => {
  if (!subscription) return { changed: false, state: SUBSCRIPTION_STATES.TRIAL_EXPIRED };
  let changed = normalizeTrialDates(subscription);
  const state = getEffectiveSubscriptionState(subscription, now);
  if ([SUBSCRIPTION_STATES.TRIAL_EXPIRED, SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED].includes(state) && subscription.status !== "expired") {
    subscription.status = "expired";
    subscription.metadata = { ...(subscription.metadata || {}), expiredEntitlementState: state };
    changed = true;
  }
  return { changed, state };
};

export const expireTrialIfNeeded = (subscription, now = new Date()) => {
  if (!hasTrialExpired(subscription, now)) return false;
  subscription.status = "expired";
  subscription.metadata = { ...(subscription.metadata || {}), expiredEntitlementState: SUBSCRIPTION_STATES.TRIAL_EXPIRED };
  return true;
};

export const calculateRenewalDate = (startDate = new Date(), billingCycle = "monthly") =>
  calculateSubscriptionEndDate(startDate, billingCycle === "yearly" ? 12 : 1);

/** Adds whole calendar months in UTC without month-end rollover. */
export const calculateSubscriptionEndDate = (startDate = new Date(), durationMonths = 1) => {
  const start = new Date(startDate);
  const months = Math.max(1, Math.floor(Number(durationMonths) || 1));
  const end = new Date(start);
  const originalDay = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(originalDay, lastDay));
  return end;
};

export const getSubscriptionDurationMonths = (subscription) => {
  const months = Number(subscription?.durationMonths ?? subscription?.metadata?.durationMonths);
  if (Number.isInteger(months) && months > 0) return months;
  return subscription?.billingCycle === "yearly" ? 12 : 1;
};

export const getSubscriptionDurationLabel = (subscription) => {
  if (subscription?.durationLabel || subscription?.metadata?.durationLabel) return subscription.durationLabel || subscription.metadata.durationLabel;
  const months = getSubscriptionDurationMonths(subscription);
  return months === 12 ? "1 year" : `${months} month${months === 1 ? "" : "s"}`;
};

export const getTrialWarningMessage = (daysRemaining) => {
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining <= 0) return "Your free trial has ended. Upgrade to continue.";
  if (daysRemaining === 1) return "Your free trial ends tomorrow.";
  if (daysRemaining === 3) return "Your free trial ends in 3 days.";
  if (daysRemaining === 7) return "Your free trial ends in 7 days.";
  if (daysRemaining <= 7) return `Your free trial ends in ${daysRemaining} days.`;
  return null;
};

export const formatDaysRemainingLabel = (subscription, now = new Date()) => {
  if (!subscription) return null;
  if (getEffectiveSubscriptionState(subscription, now) === SUBSCRIPTION_STATES.TRIAL_EXPIRED) return "EXPIRED";
  if (subscription.status !== "trial") return null;
  const days = getDaysRemaining(subscription, now);
  return days === 1 ? "1 day remaining" : `${days} days remaining`;
};

export const toSubscriptionView = (subscription, paymentContext = {}, now = new Date()) => {
  // Keep the legacy (subscription, now) helper signature used by older callers/tests.
  if (paymentContext instanceof Date) { now = paymentContext; paymentContext = {}; }
  if (!subscription) return null;
  const plain = typeof subscription.toObject === "function" ? subscription.toObject() : { ...subscription };
  const entitlementState = getEffectiveSubscriptionState(plain, now);
  const daysRemaining = getDaysRemaining(plain, now);
  const trialEndDate = getEffectiveTrialEndDate(plain);
  const trialStartDate = getTrialStartDate(plain);
  const paidEnd = getSubscriptionEndDate(plain);
  const pendingPayment = paymentContext.pendingPayment || null;
  const latestPayment = paymentContext.latestPayment || null;
  const isTrial = entitlementState === SUBSCRIPTION_STATES.TRIAL_ACTIVE;
  const isActivePaid = entitlementState === SUBSCRIPTION_STATES.SUBSCRIPTION_ACTIVE;
  const isExpired = [SUBSCRIPTION_STATES.TRIAL_EXPIRED, SUBSCRIPTION_STATES.SUBSCRIPTION_EXPIRED].includes(entitlementState);
  let paymentStatus = "—";
  if (isActivePaid) paymentStatus = "PAID";
  else if (isTrial) paymentStatus = pendingPayment ? "PENDING" : "TRIAL";
  else if (isExpired && latestPayment?.status === "failed") paymentStatus = "FAILED";
  else if (entitlementState === SUBSCRIPTION_STATES.SUSPENDED) paymentStatus = "SUSPENDED";

  return {
    ...plain,
    trialStartDate,
    trialEndDate,
    trialStartAt: trialStartDate,
    trialEndAt: trialEndDate,
    subscriptionStartAt: plain.subscriptionStartAt || (isActivePaid ? plain.startDate || null : null),
    subscriptionEndAt: paidEnd,
    renewalDate: isTrial ? null : plain.renewalDate || null,
    durationMonths: getSubscriptionDurationMonths(plain),
    durationLabel: getSubscriptionDurationLabel(plain),
    daysRemaining,
    daysRemainingLabel: formatDaysRemainingLabel(plain, now),
    warningMessage: getTrialWarningMessage(daysRemaining),
    trialLabel: isTrial ? `${getTrialDurationDays(plain)}-Day Free Trial` : null,
    serverTime: new Date(now).toISOString(),
    entitlementState,
    displayStatus: entitlementState,
    paymentStatus,
    currentPlanLabel: isTrial ? "Free Trial" : plain.planName,
    selectedPaidPlan: plain.metadata?.selectedPaidPlan || null,
    selectedPlanLabel: plain.metadata?.selectedPaidPlan && isTrial ? plain.metadata.selectedPaidPlan : null,
    pendingPaymentId: pendingPayment?._id || null,
  };
};

export const SUBSCRIPTION_ERROR_CODES = {
  REQUIRED: "SUBSCRIPTION_REQUIRED",
  EXPIRED: "SUBSCRIPTION_EXPIRED",
  CANCELLED: "SUBSCRIPTION_CANCELLED",
  SUSPENDED: "SUBSCRIPTION_SUSPENDED",
  INACTIVE: "SUBSCRIPTION_INACTIVE",
};

export const getTrialDurationMs = (subscription) => {
  const start = getTrialStartDate(subscription);
  const end = subscription?.trialEndDate ? new Date(subscription.trialEndDate) : null;
  return start && end ? end.getTime() - start.getTime() : null;
};

export const hasLegitimateTrialExtension = (subscription) => {
  const meta = subscription?.metadata || {};
  return Boolean(meta.trialExtendedAt && Number(meta.lastTrialExtensionDays) > 0);
};

export const normalizeTrialDates = (subscription) => {
  if (!subscription) return false;
  let changed = false;
  const start = getTrialStartDate(subscription) || subscription.startDate;
  if (subscription.status === "trial" && start && !subscription.trialStartDate) { subscription.trialStartDate = new Date(start); changed = true; }
  if (subscription.status === "trial" && start) {
    if (!subscription.trialEndDate) { subscription.trialEndDate = calculateTrialEndDate(start, getTrialDurationDays(subscription)); changed = true; }
    if (subscription.renewalDate) { subscription.renewalDate = null; changed = true; }
  }
  return changed;
};

export default {
  SUBSCRIPTION_STATES, getFreeTrialDays, calculateTrialEndDate, getEffectiveTrialEndDate, getTrialStartDate,
  getSubscriptionEndDate, getTrialDurationDays, getTrialDurationMs, hasLegitimateTrialExtension, getDaysRemaining,
  hasTrialExpired, hasPaidSubscriptionExpired, getEffectiveSubscriptionState, syncSubscriptionEntitlement,
  expireTrialIfNeeded, calculateRenewalDate, calculateSubscriptionEndDate, getSubscriptionDurationMonths,
  getSubscriptionDurationLabel, getTrialWarningMessage, formatDaysRemainingLabel, toSubscriptionView,
  normalizeTrialDates, SUBSCRIPTION_ERROR_CODES,
};
