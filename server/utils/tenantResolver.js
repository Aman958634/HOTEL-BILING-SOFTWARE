import mongoose from "mongoose";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "./ApiError.js";

const toId = (value) => (value ? String(value) : null);

export const resolveUserTenant = async (user) => {
  if (!user) throw new ApiError(401, "Unauthorized");

  if (user.role === "super_admin") {
    return { role: "super_admin", restaurantId: null, outletId: null, outlet: null };
  }

  const restaurantId = toId(user.restaurant || user.restaurantId);
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new ApiError(403, "Restaurant context is required");
  }

  const restaurant = await Restaurant.findById(restaurantId).select("_id isActive").lean();
  if (!restaurant) throw new ApiError(403, "Restaurant context is invalid");
  if (restaurant.isActive === false) throw new ApiError(403, "Restaurant is inactive");

  let outlet = null;
  const requestedOutletId = toId(user.outlet || user.outletId);
  if (requestedOutletId) {
    if (!mongoose.isValidObjectId(requestedOutletId)) {
      throw new ApiError(403, "Outlet context is invalid");
    }
    outlet = await Outlet.findOne({
      _id: requestedOutletId,
      restaurant: restaurant._id,
      isActive: { $ne: false },
    }).select("_id restaurant isActive").lean();
    if (!outlet) throw new ApiError(403, "Outlet does not belong to this restaurant");
  } else {
    const outlets = await Outlet.find({
      restaurant: restaurant._id,
      isActive: { $ne: false },
    }).select("_id restaurant isActive").sort({ createdAt: 1 }).limit(2).lean();
    if (outlets.length === 1) outlet = outlets[0];
    else if (outlets.length > 1) {
      throw new ApiError(403, "Outlet context is required for this account");
    } else {
      throw new ApiError(403, "Outlet setup is missing for this restaurant");
    }
  }

  return {
    role: user.role,
    restaurantId: restaurant._id,
    outletId: outlet._id,
    outlet,
  };
};

export const tenantClaims = (user, context = {}) => ({
  hotelId: user.hotelId || null,
  restaurant: user.restaurant || context.restaurantId || null,
  restaurantId: user.restaurant || context.restaurantId || null,
  outlet: user.outlet || context.outletId || null,
  outletId: user.outlet || context.outletId || null,
});
