import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import ApiError from "../utils/ApiError.js";
import { createActivity } from "../services/activityService.js";
import {
  expireTrialIfNeeded,
  getDaysRemaining,
  getTrialWarningMessage,
  normalizeTrialDates,
  toSubscriptionView,
  SUBSCRIPTION_ERROR_CODES,
} from "../utils/subscriptionUtils.js";
import { resolveRestaurantForUser } from "../utils/tenantUtils.js";

/** Tenant is always derived from JWT — never from request body/query. */
const resolveRestaurantFromAuth = async (req) => {
  if (req.user?.role === "super_admin") return null;

  if (req.user?.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    return req.user.restaurant;
  }

  if (req.user) {
    try {
      const restaurant = await resolveRestaurantForUser({ user: req.user });
      return restaurant?._id || null;
    } catch (_error) {
      return null;
    }
  }

  return null;
};

const maybeLogTrialEndingSoon = async (subscription, restaurantId) => {
  if (!subscription || subscription.status !== "trial") return;
  const daysRemaining = getDaysRemaining(subscription);
  const warning = getTrialWarningMessage(daysRemaining);
  if (!warning || daysRemaining <= 0) return;

  const meta = subscription.metadata || {};
  const alreadyLogged = meta.trialEndingLoggedFor === daysRemaining;
  if (alreadyLogged) return;
  if (![1, 3, 7].includes(daysRemaining)) return;

  subscription.metadata = { ...meta, trialEndingLoggedFor: daysRemaining };
  await subscription.save();
  await createActivity({
    action: "Trial Ending Soon",
    description: warning,
    restaurantId,
    targetId: subscription._id,
    targetType: "subscription",
    metadata: { daysRemaining },
  });
};

export const requireActiveSubscription = async (req, _res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    if (req.user.role === "super_admin") {
      return next();
    }

    const restaurantId = await resolveRestaurantFromAuth(req);
    if (!restaurantId) {
      return next(
        new ApiError(
          403,
          "Restaurant subscription is required to access this feature.",
          SUBSCRIPTION_ERROR_CODES.REQUIRED
        )
      );
    }

    const subscription = await Subscription.findOne({ restaurant: restaurantId }).sort({ createdAt: -1 });
    if (!subscription) {
      return next(
        new ApiError(
          403,
          "Restaurant subscription is required to access this feature.",
          SUBSCRIPTION_ERROR_CODES.REQUIRED
        )
      );
    }

    if (normalizeTrialDates(subscription)) {
      await subscription.save();
    }

    if (subscription.status === "trial" && expireTrialIfNeeded(subscription)) {
      await subscription.save();
      await createActivity({
        action: "Trial Expired",
        description: "Your 15-day free trial has ended.",
        restaurantId,
        targetId: subscription._id,
        targetType: "subscription",
      });
      await createActivity({
        action: "Subscription Expired",
        description: `Subscription for restaurant ${restaurantId} expired after trial`,
        restaurantId,
        targetId: subscription._id,
        targetType: "subscription",
      });
    } else if (subscription.status === "trial") {
      await maybeLogTrialEndingSoon(subscription, restaurantId);
    }

    if (subscription.status === "active" && subscription.renewalDate) {
      if (new Date() >= new Date(subscription.renewalDate) && !subscription.metadata?.recurringBillingEnabled) {
        subscription.status = "expired";
        await subscription.save();
        await createActivity({
          action: "Subscription Expired",
          description: "Paid subscription reached renewal date without recurring billing authorization.",
          restaurantId,
          targetId: subscription._id,
          targetType: "subscription",
        });
      }
    }

    if (subscription.status === "active" || subscription.status === "trial") {
      req.subscription = subscription;
      req.subscriptionView = toSubscriptionView(subscription);
      return next();
    }

    const view = toSubscriptionView(subscription);

    if (subscription.status === "expired") {
      return next(
        new ApiError(
          403,
          "Your 15-day free trial has ended. Please choose a paid plan to continue using RestoSphere.",
          SUBSCRIPTION_ERROR_CODES.EXPIRED,
          {
            subscription: view,
            trialEnded: true,
            upgradeRequired: true,
          }
        )
      );
    }

    if (subscription.status === "cancelled") {
      return next(
        new ApiError(
          403,
          "Your subscription is cancelled. Please choose a paid plan to continue using RestoSphere.",
          SUBSCRIPTION_ERROR_CODES.CANCELLED,
          { subscription: view, upgradeRequired: true }
        )
      );
    }

    if (subscription.status === "suspended") {
      return next(
        new ApiError(
          403,
          "Your subscription is suspended. Please contact support or upgrade your plan.",
          SUBSCRIPTION_ERROR_CODES.SUSPENDED,
          { subscription: view, upgradeRequired: true }
        )
      );
    }

    return next(
      new ApiError(403, "Subscription is not active.", SUBSCRIPTION_ERROR_CODES.INACTIVE, {
        subscription: view,
        upgradeRequired: true,
      })
    );
  } catch (error) {
    return next(error);
  }
};

export default { requireActiveSubscription };
