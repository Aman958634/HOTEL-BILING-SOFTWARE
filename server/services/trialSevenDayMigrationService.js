/** One-time 5-to-7 day trial upgrade; marker-based and safe to retry. */
export const TRIAL_SEVEN_DAY_MIGRATION_MARKER = "trialExpiryExtendedForSevenDayPolicyV1";
export const TRIAL_SEVEN_DAY_EXTENSION_MS = 48 * 60 * 60 * 1000;
export const PREVIOUS_FREE_TRIAL_DAYS = 5;
export const CURRENT_FREE_TRIAL_DAYS = 7;

const validDate = (value) => value instanceof Date && Number.isFinite(value.getTime());

export const getTrialSevenDayMigrationUpdate = (subscription, migratedAt = new Date()) => {
  const originalTrialEndDate = new Date(subscription?.trialEndDate);
  const now = new Date(migratedAt);
  const metadata = subscription?.metadata || {};
  if (subscription?.status !== "trial" || Number(metadata.trialDurationDays) !== PREVIOUS_FREE_TRIAL_DAYS || metadata[TRIAL_SEVEN_DAY_MIGRATION_MARKER] || !validDate(originalTrialEndDate) || !validDate(now) || originalTrialEndDate <= now) return null;
  const newTrialEndDate = new Date(originalTrialEndDate.getTime() + TRIAL_SEVEN_DAY_EXTENSION_MS);
  return {
    filter: { _id: subscription._id, status: "trial", trialEndDate: originalTrialEndDate, [`metadata.${TRIAL_SEVEN_DAY_MIGRATION_MARKER}`]: { $exists: false } },
    update: { $set: {
      trialEndDate: newTrialEndDate,
      "metadata.trialDurationDays": CURRENT_FREE_TRIAL_DAYS,
      [`metadata.${TRIAL_SEVEN_DAY_MIGRATION_MARKER}`]: { appliedAt: now.toISOString(), originalTrialEndDate: originalTrialEndDate.toISOString(), addedMilliseconds: TRIAL_SEVEN_DAY_EXTENSION_MS },
    } },
    originalTrialEndDate,
    newTrialEndDate,
  };
};

export const extendEligibleTrialExpiries = async ({ SubscriptionModel, now = new Date(), apply = false }) => {
  const migrationTime = new Date(now);
  if (!validDate(migrationTime)) throw new Error("A valid migration timestamp is required");
  const candidates = await SubscriptionModel.find({ status: "trial", trialEndDate: { $type: "date", $gt: migrationTime }, "metadata.trialDurationDays": PREVIOUS_FREE_TRIAL_DAYS, [`metadata.${TRIAL_SEVEN_DAY_MIGRATION_MARKER}`]: { $exists: false } }).select("_id restaurant status trialStartDate trialEndDate metadata").lean();
  const summary = { migration: "trial-5-day-to-7-day-v1", mode: apply ? "apply" : "dry-run", migrationTime: migrationTime.toISOString(), eligible: candidates.length, updated: 0, skippedDuringApply: 0, samples: [] };
  for (const subscription of candidates) {
    const operation = getTrialSevenDayMigrationUpdate(subscription, migrationTime);
    if (!operation) { if (apply) summary.skippedDuringApply += 1; continue; }
    if (summary.samples.length < 20) summary.samples.push({ subscriptionId: String(subscription._id), restaurantId: String(subscription.restaurant), trialStartDate: subscription.trialStartDate ? new Date(subscription.trialStartDate).toISOString() : null, originalTrialEndDate: operation.originalTrialEndDate.toISOString(), newTrialEndDate: operation.newTrialEndDate.toISOString() });
    if (!apply) continue;
    const result = await SubscriptionModel.updateOne(operation.filter, operation.update);
    if (result.modifiedCount === 1) summary.updated += 1;
    else summary.skippedDuringApply += 1;
  }
  return summary;
};
