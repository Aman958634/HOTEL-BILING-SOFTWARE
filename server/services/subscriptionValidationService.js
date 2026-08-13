import Subscription from "../models/Subscription.js";
import ApiError from "../utils/ApiError.js";

export const BLOCKING_STATUSES = ["trial", "active", "suspended"];

export const findBlockingSubscription = async (restaurantId, excludeId = null) => {
  const filter = {
    restaurant: restaurantId,
    status: { $in: BLOCKING_STATUSES },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Subscription.findOne(filter).sort({ createdAt: -1 });
};

export const assertNoDuplicateSubscription = async (restaurantId, excludeId = null) => {
  const existing = await findBlockingSubscription(restaurantId, excludeId);
  if (existing) {
    throw new ApiError(
      409,
      "This hotel already has an active subscription. Only expired or cancelled subscriptions can be replaced."
    );
  }
};

export const assertStatusTransition = (subscription, action) => {
  if (!subscription) throw new ApiError(404, "Subscription not found");

  switch (action) {
    case "extend_trial":
      if (!["trial", "expired"].includes(subscription.status)) {
        throw new ApiError(400, "Trial can only be extended for trial or expired subscriptions");
      }
      break;
    case "convert_plan":
      if (!["trial", "expired", "cancelled"].includes(subscription.status)) {
        throw new ApiError(400, "Plan can only be selected before an active paid subscription exists");
      }
      break;
    case "activate_admin":
      if (subscription.status === "active") {
        throw new ApiError(400, "Subscription is already active");
      }
      break;
    case "suspend":
      if (subscription.status !== "active" && subscription.status !== "trial") {
        throw new ApiError(400, "Only trial or active subscriptions can be suspended");
      }
      break;
    case "cancel":
      if (subscription.status === "cancelled") {
        throw new ApiError(400, "Subscription is already cancelled");
      }
      break;
    default:
      break;
  }
};

export default {
  BLOCKING_STATUSES,
  findBlockingSubscription,
  assertNoDuplicateSubscription,
  assertStatusTransition,
};
