import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { resolveRestaurantForUser } from "../utils/tenantUtils.js";

// Navigation visibility is not an authorization boundary. Direct KDS requests
// must follow the tenant preference as well.
export const requireKitchenDisplayEnabled = asyncHandler(async (req, _res, next) => {
  if (String(req.user?.role || "").toLowerCase() === "super_admin") return next();

  const restaurant = await resolveRestaurantForUser({ user: req.user });
  const setting = await Restaurant.findById(restaurant._id).select("kitchenDisplayEnabled").lean();
  if (!setting || setting.kitchenDisplayEnabled === false) {
    throw new ApiError(404, "Kitchen Display is disabled for this restaurant.");
  }
  next();
});
