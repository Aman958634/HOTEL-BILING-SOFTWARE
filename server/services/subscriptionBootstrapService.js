import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import { createActivity } from "./activityService.js";
import { resolvePlan } from "./planService.js";
import {
  calculateTrialEndDate,
  expireTrialIfNeeded,
  getFreeTrialDays,
  normalizeTrialDates,
} from "../utils/subscriptionUtils.js";
import logger from "../utils/logger.js";

/**
 * Safe backfill + correction for restaurants missing or misconfigured subscriptions.
 * - Fixes trialEndDate drift (e.g. old 30-day values) to exactly 15 days from trialStartDate
 * - Clears renewalDate during trial
 * - Does NOT grant a fresh trial to older restaurants without a subscription
 */
export const ensureRestaurantSubscriptions = async () => {
  const restaurants = await Restaurant.find({}).select("_id name createdAt").lean();
  let created = 0;
  let corrected = 0;

  for (const restaurant of restaurants) {
    const existing = await Subscription.findOne({ restaurant: restaurant._id }).sort({ createdAt: -1 });

    if (existing) {
      const beforeEnd = existing.trialEndDate ? new Date(existing.trialEndDate).toISOString() : null;
      let changed = normalizeTrialDates(existing);
      if (existing.status === "trial" && expireTrialIfNeeded(existing)) {
        changed = true;
      }
      if (changed) {
        await existing.save();
        corrected += 1;
        logger.info(
          `Corrected subscription for ${restaurant.name}${beforeEnd ? `: trialEnd ${beforeEnd} → ${existing.trialEndDate?.toISOString()}` : ""}`
        );
        if (existing.status === "expired") {
          await createActivity({
            action: "Trial Expired",
            description: `Trial expired for ${restaurant.name} during subscription bootstrap`,
            restaurantId: restaurant._id,
            targetId: existing._id,
            targetType: "subscription",
          });
        }
      }
      continue;
    }

    const plan = await resolvePlan("basic");
    const trialStart = restaurant.createdAt ? new Date(restaurant.createdAt) : new Date();
    const trialEnd = calculateTrialEndDate(trialStart, getFreeTrialDays());
    const now = new Date();
    const stillInTrialWindow = now.getTime() < trialEnd.getTime();

    const subscription = await Subscription.create({
      restaurant: restaurant._id,
      planId: plan._id,
      planName: plan.key,
      price: 0,
      billingCycle: plan.billingCycle || "monthly",
      status: stillInTrialWindow ? "trial" : "expired",
      startDate: trialStart,
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
      renewalDate: null,
      metadata: {
        backfilled: true,
        backfillReason: stillInTrialWindow
          ? "Restaurant created within trial window; remaining trial granted from createdAt"
          : "Restaurant older than trial window; marked expired without granting a new trial",
      },
    });

    created += 1;
    await createActivity({
      action: stillInTrialWindow ? "Trial Started" : "Subscription Expired",
      description: stillInTrialWindow
        ? `Backfilled trial subscription for ${restaurant.name}`
        : `Backfilled expired subscription for ${restaurant.name} (no fresh trial)`,
      restaurantId: restaurant._id,
      targetId: subscription._id,
      targetType: "subscription",
      metadata: { backfilled: true, trialDays: getFreeTrialDays() },
    });
  }

  if (created > 0) logger.info(`Backfilled ${created} restaurant subscription(s)`);
  if (corrected > 0) logger.info(`Corrected trial duration on ${corrected} subscription(s) to ${getFreeTrialDays()} days`);
};

export default { ensureRestaurantSubscriptions };
