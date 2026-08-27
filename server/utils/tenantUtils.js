import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import ApiError from "./ApiError.js";

const ROLE_ALIASES = {
  admin: ["admin", "restaurant_admin"],
  restaurant_admin: ["admin", "restaurant_admin"],
  manager: ["manager"],
  waiter: ["waiter"],
  chef: ["chef"],
  cashier: ["cashier"],
  delivery: ["delivery"],
  customer: ["customer"],
  inventory_manager: ["inventory_manager"],
  receptionist: ["receptionist"],
};

export const normalizeRole = (role) => String(role || "").trim().toLowerCase();
export const expandRoles = (roles = []) => [
  ...new Set(
    roles.flatMap((role) => ROLE_ALIASES[normalizeRole(role)] || [normalizeRole(role)])
  ),
];

export const isAdminRole = (role) => expandRoles([role]).includes("admin");

const mergeTenantFilter = (filters, tenantCondition) => {
  if (filters.$or) {
    return { $and: [filters, tenantCondition] };
  }
  return { ...filters, ...tenantCondition };
};

export const resolveRestaurantForUser = async ({ restaurantId, user }) => {
  if (restaurantId) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new ApiError(400, "Invalid restaurant id");
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new ApiError(404, "Restaurant not found");
    }

    if (user?.restaurant && String(restaurant._id) !== String(user.restaurant)) {
      throw new ApiError(403, "Restaurant does not belong to your account");
    }

    if (user?.hotelId && restaurant.hotelId && String(restaurant.hotelId) !== String(user.hotelId)) {
      throw new ApiError(403, "Restaurant does not belong to your hotel");
    }

    return restaurant;
  }

  if (user?.restaurant) {
    const restaurant = await Restaurant.findById(user.restaurant);
    if (!restaurant) {
      throw new ApiError(404, "Restaurant not found");
    }
    return restaurant;
  }

  if (user?.hotelId) {
    const query = { $or: [{ hotelId: user.hotelId }, { hotelId: null }] };
    const restaurant = await Restaurant.findOne(query).sort({ hotelId: -1 });
    if (!restaurant) {
      throw new ApiError(400, "Restaurant setup missing. Please create a restaurant first.");
    }
    return restaurant;
  }

  // Selecting an arbitrary restaurant is a cross-tenant data leak. Guests can
  // resolve their restaurant only through a verified table/QR context above;
  // staff tokens must carry a restaurant or hotel scope.
  throw new ApiError(403, "Restaurant context is required");
};

export const buildRestaurantQuery = async (baseFilters, user) => {
  const filters = { ...baseFilters };
  if (!user) return filters;

  if (user.role === "super_admin") return filters;

  if (user.restaurant) {
    return mergeTenantFilter(filters, { restaurant: user.restaurant });
  }

  if (!user.hotelId) {
    throw new ApiError(403, "Restaurant context is required");
  }

  const restaurants = await Restaurant.find({ $or: [{ hotelId: user.hotelId }, { hotelId: null }] }).select("_id").lean();
  const restaurantIds = restaurants.map((r) => r._id);

  if (!restaurantIds.length) {
    return mergeTenantFilter(filters, { restaurant: null });
  }

  return mergeTenantFilter(filters, { restaurant: { $in: restaurantIds } });
};
