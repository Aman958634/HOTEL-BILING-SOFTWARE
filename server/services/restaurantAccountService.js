import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";

export const RESTAURANT_ACCOUNT_SUSPENDED_CODE = "RESTAURANT_ACCOUNT_SUSPENDED";
export const RESTAURANT_ACCOUNT_ARCHIVED_CODE = "RESTAURANT_ACCOUNT_ARCHIVED";

const isSuperAdmin = (user) => String(user?.role || "").toLowerCase() === "super_admin";

/**
 * Canonical account-state guard for a restaurant-scoped principal. This always
 * reads the tenant record, so access tokens cannot outlive suspension/archive.
 */
export const assertRestaurantAccountActive = async (user) => {
  if (isSuperAdmin(user) || !user?.restaurant) return null;

  const restaurant = await Restaurant.findById(user.restaurant).select("_id isActive archivedAt").lean();
  if (restaurant?.isActive === true && !restaurant.archivedAt) return restaurant;

  if (restaurant?.archivedAt || !restaurant) {
    throw new ApiError(403, "Restaurant account is archived. Please contact support.", RESTAURANT_ACCOUNT_ARCHIVED_CODE);
  }

  throw new ApiError(403, "Restaurant account is suspended. Please contact support.", RESTAURANT_ACCOUNT_SUSPENDED_CODE);
};
