import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import ApiError from "../utils/ApiError.js";
import { createActivity } from "../services/activityService.js";
import {
  getDaysRemaining,
  getTrialWarningMessage,
  SUBSCRIPTION_ERROR_CODES,
  SUBSCRIPTION_STATES,
  syncSubscriptionEntitlement,
  toSubscriptionView,
} from "../utils/subscriptionUtils.js";
import { resolveRestaurantForUser } from "../utils/tenantUtils.js";

/** Tenant is always derived from JWT — never from request body/query. */
const resolveRestaurantFromAuth = async (req) => {
  if (req.user?.role === "super_admin") return null;
  if (req.user?.restaurant && mongoose.isValidObjectId(req.user.restaurant)) return req.user.restaurant;
  if (!req.user) return null;
  try {
    const restaurant = await resolveRestaurantForUser({ user: req.user });
    return restaurant?._id || null;
  } catch {
    return null;
  }
};

const maybeLogTrialEndingSoon = async (subscription, restaurantId) => {
  if (!subscription || subscription.status !== "trial") return;
  const daysRemaining = getDaysRemaining(subscription);
  const warning = getTrialWarningMessage(daysRemaining);
  if (!warning || daysRemaining <= 0 || ![1, 3, 7].includes(daysRemaining)) return;
  const meta = subscription.metadata || {};
  if (meta.trialEndingLoggedFor === daysRemaining) return;
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

const expiryMessage = (state) => state === SUBSCRIPTION_STATES.TRIAL_EXPIRED
  ? "Your free trial has ended. Please choose a paid plan to continue using RestoSphere."
  : "Your subscription has expired. Renew your plan to continue using restaurant operations.";

/** Central request-time entitlement enforcement for every restaurant operation. */
export const requireActiveSubscription = async (req, _res, next) => {
  try {
    if (!req.user) return next(new ApiError(401, "Unauthorized"));
    // Platform operators are not restaurant tenants and must remain able to manage subscriptions.
    if (req.user.role === "super_admin") return next();

    const restaurantId = await resolveRestaurantFromAuth(req);
    if (!restaurantId) {
      return next(new ApiError(403, "Restaurant subscription is required to access this feature.", SUBSCRIPTION_ERROR_CODES.REQUIRED, {
        subscriptionState: SUBSCRIPTION_STATES.TRIAL_EXPIRED,
        upgradeRequired: true,
      }));
    }

    const subscription = await Subscription.findOne({ restaurant: restaurantId }).sort({ createdAt: -1 });
    if (!subscription) {
      return next(new ApiError(403, "Restaurant subscription is required to access this feature.", SUBSCRIPTION_ERROR_CODES.REQUIRED, {
        subscriptionState: SUBSCRIPTION_STATES.TRIAL_EXPIRED,
        upgradeRequired: true,
      }));
    }

    const wasStatus = subscription.status;
    const { changed, state } = syncSubscriptionEntitlement(subscription);
    if (changed) {
      await subscription.save();
      if (subscription.status === "expired" && wasStatus !== "expired") {
        await createActivity({
          action: state === SUBSCRIPTION_STATES.TRIAL_EXPIRED ? "Trial Expired" : "Subscription Expired",
          description: expiryMessage(state),
          restaurantId,
          targetId: subscription._id,
          targetType: "subscription",
        });
      }
    }
    if (state === SUBSCRIPTION_STATES.TRIAL_ACTIVE) await maybeLogTrialEndingSoon(subscription, restaurantId);

    req.subscription = subscription;
    req.subscriptionView = toSubscriptionView(subscription);
    if ([SUBSCRIPTION_STATES.TRIAL_ACTIVE, SUBSCRIPTION_STATES.SUBSCRIPTION_ACTIVE].includes(state)) return next();

    const code = state === SUBSCRIPTION_STATES.SUSPENDED
      ? SUBSCRIPTION_ERROR_CODES.SUSPENDED
      : SUBSCRIPTION_ERROR_CODES.EXPIRED;
    return next(new ApiError(403, expiryMessage(state), code, {
      subscription: req.subscriptionView,
      subscriptionState: state,
      trialEnded: state === SUBSCRIPTION_STATES.TRIAL_EXPIRED,
      upgradeRequired: true,
    }));
  } catch (error) {
    return next(error);
  }
};

export default { requireActiveSubscription };
