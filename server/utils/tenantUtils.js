import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
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

const canAccessEveryOutlet = (user) =>
  user?.allOutletsAccess === true ||
  ["admin", "restaurant_admin", "hotel_admin", "super_admin"].includes(normalizeRole(user?.role));

const hasExplicitOutletAccess = (user, outletId) =>
  (user?.outletAccess || []).some(
    (entry) => entry.isActive !== false && String(entry.outlet || entry) === String(outletId)
  );

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

  const restaurant = await Restaurant.findOne().sort({ hotelId: -1 });
  if (!restaurant) {
    throw new ApiError(400, "Restaurant setup missing. Please create a restaurant first.");
  }
  return restaurant;
};

export const buildRestaurantQuery = async (baseFilters, user) => {
  const filters = { ...baseFilters };
  if (!user) return filters;

  if (user.restaurant) {
    const scoped = mergeTenantFilter(filters, { restaurant: user.restaurant });
    return scoped;
  }

  if (!user.hotelId) return filters;

  const restaurants = await Restaurant.find({ $or: [{ hotelId: user.hotelId }, { hotelId: null }] }).select("_id").lean();
  const restaurantIds = restaurants.map((r) => r._id);

  if (!restaurantIds.length) {
    return mergeTenantFilter(filters, { restaurant: null });
  }

  return mergeTenantFilter(filters, { restaurant: { $in: restaurantIds } });
};

/** Applies a verified active outlet only to operational models with an outlet field. */
export const buildOutletQuery = async (baseFilters, user, { allowAll = false } = {}) => {
  const filters = await buildRestaurantQuery(baseFilters, user);
  const selectedOutletId = user?.activeOutlet || user?.defaultOutlet;

  if (selectedOutletId) {
    // A persisted default outlet is still untrusted context. Confirm it is an
    // active outlet of this tenant and is authorized for this user before it
    // can constrain a database query.
    const outlet = await Outlet.findOne({
      _id: selectedOutletId,
      restaurant: user?.restaurant,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (outlet && (canAccessEveryOutlet(user) || hasExplicitOutletAccess(user, outlet._id))) {
      return mergeTenantFilter(filters, { outlet: outlet._id });
    }

    // Never fall back to a restaurant-wide query after a stale or unauthorized
    // outlet selection. The impossible condition safely returns no records.
    return mergeTenantFilter(filters, { outlet: null });
  }

  // An all-outlets aggregation is server-authorized, never an ObjectId-like
  // client value such as "all".
  if (allowAll && canAccessEveryOutlet(user)) return filters;

  // An unassigned user has no operational outlet scope.
  return mergeTenantFilter(filters, { outlet: null });
};
