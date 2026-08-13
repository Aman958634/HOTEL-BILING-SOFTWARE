/** SaaS trial is always exactly 15 days — never 30. */
const FREE_TRIAL_DAYS = Math.min(15, Math.max(1, Number(process.env.FREE_TRIAL_DAYS) || 15));
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getFreeTrialDays = () => FREE_TRIAL_DAYS;

/** Exact trial length: N × 24 hours from start (server time). */
export const calculateTrialEndDate = (startDate = new Date(), days = FREE_TRIAL_DAYS) => {
  const start = new Date(startDate);
  const effectiveDays = Math.min(15, Number(days) || FREE_TRIAL_DAYS);
  return new Date(start.getTime() + effectiveDays * MS_PER_DAY);
};

export const getEffectiveTrialEndDate = (subscription) => {
  if (!subscription) return null;
  if (subscription.trialEndDate) return new Date(subscription.trialEndDate);
  if (subscription.trialEndAt) return new Date(subscription.trialEndAt);
  if (subscription.status === "trial") {
    const start = subscription.trialStartDate || subscription.trialStartAt || subscription.startDate;
    if (start) return calculateTrialEndDate(start);
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

/** Whole days left until trialEnd (ceil). 0 when expired or past end. */
export const getDaysRemaining = (subscription, now = new Date()) => {
  if (!subscription) return 0;
  if (subscription.status === "expired") return 0;
  if (subscription.status !== "trial") return null;

  const trialEnd = getEffectiveTrialEndDate(subscription);
  if (!trialEnd) return 0;

  const diff = trialEnd.getTime() - new Date(now).getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
};

export const hasTrialExpired = (subscription, now = new Date()) => {
  if (!subscription || subscription.status !== "trial") return false;
  const trialEnd = getEffectiveTrialEndDate(subscription);
  return trialEnd ? new Date(now).getTime() >= trialEnd.getTime() : false;
};

export const expireTrialIfNeeded = (subscription, now = new Date()) => {
  if (!subscription) return false;
  if (hasTrialExpired(subscription, now)) {
    const trialEnd = getEffectiveTrialEndDate(subscription);
    subscription.status = "expired";
    if (!subscription.trialEndDate && trialEnd) {
      subscription.trialEndDate = trialEnd;
    }
    subscription.renewalDate = null;
    return true;
  }
  return false;
};

export const calculateRenewalDate = (startDate = new Date(), billingCycle = "monthly") => {
  const renewal = new Date(startDate);
  if (billingCycle === "yearly") {
    renewal.setUTCFullYear(renewal.getUTCFullYear() + 1);
  } else {
    renewal.setUTCMonth(renewal.getUTCMonth() + 1);
  }
  return renewal;
};

export const getTrialWarningMessage = (daysRemaining) => {
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining <= 0) {
    return "Your free trial has ended. Upgrade to continue.";
  }
  if (daysRemaining === 1) {
    return "Your free trial ends tomorrow.";
  }
  if (daysRemaining === 3) {
    return "Your free trial ends in 3 days.";
  }
  if (daysRemaining === 7) {
    return "Your free trial ends in 7 days.";
  }
  if (daysRemaining <= 7) {
    return `Your free trial ends in ${daysRemaining} days.`;
  }
  return null;
};

export const formatDaysRemainingLabel = (subscription, now = new Date()) => {
  if (!subscription) return null;
  if (subscription.status === "expired") return "EXPIRED";
  if (subscription.status !== "trial") return null;

  const days = getDaysRemaining(subscription, now);
  if (days <= 0) return "EXPIRED";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
};

export const toSubscriptionView = (subscription, now = new Date()) => {
  if (!subscription) return null;
  const plain = typeof subscription.toObject === "function" ? subscription.toObject() : { ...subscription };
  const daysRemaining = getDaysRemaining(plain, now);
  const trialEndDate = getEffectiveTrialEndDate(plain);
  const trialStartDate = getTrialStartDate(plain);
  const isTrial = plain.status === "trial";
  const isActivePaid = plain.status === "active";

  return {
    ...plain,
    trialStartDate,
    trialEndDate,
    trialStartAt: trialStartDate,
    trialEndAt: trialEndDate,
    subscriptionStartAt: isActivePaid
      ? plain.subscriptionStartAt || plain.startDate || null
      : null,
    daysRemaining,
    daysRemainingLabel: formatDaysRemainingLabel(plain, now),
    warningMessage: getTrialWarningMessage(daysRemaining),
    trialLabel: isTrial ? "15-Day Free Trial" : null,
    renewalDate: isTrial ? null : plain.renewalDate || null,
    serverTime: new Date(now).toISOString(),
  };
};

export const SUBSCRIPTION_ERROR_CODES = {
  REQUIRED: "SUBSCRIPTION_REQUIRED",
  EXPIRED: "SUBSCRIPTION_EXPIRED",
  CANCELLED: "SUBSCRIPTION_CANCELLED",
  SUSPENDED: "SUBSCRIPTION_SUSPENDED",
  INACTIVE: "SUBSCRIPTION_INACTIVE",
};

const DURATION_TOLERANCE_MS = 60 * 60 * 1000;

export const getTrialDurationMs = (subscription) => {
  const start = getTrialStartDate(subscription);
  const end = subscription?.trialEndDate ? new Date(subscription.trialEndDate) : null;
  if (!start || !end) return null;
  return end.getTime() - new Date(start).getTime();
};

/** True only when Super Admin explicitly extended via extendTrial (sets trialExtendedAt). */
export const hasLegitimateTrialExtension = (subscription) => {
  const meta = subscription?.metadata || {};
  return Boolean(meta.trialExtendedAt && Number(meta.lastTrialExtensionDays) > 0);
};

export const normalizeTrialDates = (subscription) => {
  if (!subscription) return false;
  let changed = false;

  const start = getTrialStartDate(subscription) || subscription.startDate;
  if (start && !subscription.trialStartDate) {
    subscription.trialStartDate = new Date(start);
    changed = true;
  }

  if (subscription.status === "trial" && start) {
    const expectedEnd = calculateTrialEndDate(start);
    const expectedDurationMs = FREE_TRIAL_DAYS * MS_PER_DAY;
    const currentEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
    const durationMs = currentEnd ? currentEnd.getTime() - new Date(start).getTime() : null;
    const legitimatelyExtended = hasLegitimateTrialExtension(subscription);

    if (!currentEnd) {
      subscription.trialEndDate = expectedEnd;
      changed = true;
    } else if (
      !legitimatelyExtended &&
      durationMs !== null &&
      Math.abs(durationMs - expectedDurationMs) > DURATION_TOLERANCE_MS
    ) {
      // Fix inflated trials (e.g. old 30-day values or bogus lastTrialExtensionDays metadata)
      subscription.trialEndDate = expectedEnd;
      if (subscription.metadata?.lastTrialExtensionDays) {
        const { lastTrialExtensionDays, ...restMeta } = subscription.metadata;
        subscription.metadata = {
          ...restMeta,
          repairedTrialDuration: true,
          repairedFromDays: Math.round(durationMs / MS_PER_DAY),
        };
      }
      changed = true;
    }

    if (subscription.renewalDate) {
      subscription.renewalDate = null;
      changed = true;
    }
  }

  return changed;
};

export default {
  getFreeTrialDays,
  calculateTrialEndDate,
  getEffectiveTrialEndDate,
  getTrialStartDate,
  getTrialDurationMs,
  hasLegitimateTrialExtension,
  getDaysRemaining,
  hasTrialExpired,
  expireTrialIfNeeded,
  calculateRenewalDate,
  getTrialWarningMessage,
  formatDaysRemainingLabel,
  toSubscriptionView,
  normalizeTrialDates,
  SUBSCRIPTION_ERROR_CODES,
};
