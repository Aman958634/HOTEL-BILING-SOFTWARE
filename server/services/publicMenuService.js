import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import { getPagination } from "../utils/pagination.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const activeCategoryFilter = { active: { $ne: false }, isActive: { $ne: false } };
const activeOutletFilter = { isActive: true };

const publicRestaurantError = (message, code) => new ApiError(400, message, code);

const resolvePublicOutlet = async (restaurantId) => {
  const defaultOutlet = await Outlet.findOne({ restaurant: restaurantId, ...activeOutletFilter, isDefault: true }).lean();
  if (defaultOutlet) return defaultOutlet;

  // A legacy single-outlet restaurant remains safe to publish. A multi-outlet
  // restaurant must mark one outlet as default rather than choosing arbitrarily.
  const outlets = await Outlet.find({ restaurant: restaurantId, ...activeOutletFilter }).sort({ _id: 1 }).limit(2).lean();
  if (outlets.length === 1) return outlets[0];
  if (outlets.length === 0) {
    throw new ApiError(404, "No active public outlet is available for this restaurant", "PUBLIC_MENU_OUTLET_NOT_FOUND");
  }
  throw publicRestaurantError("This restaurant needs a default public outlet", "PUBLIC_MENU_OUTLET_REQUIRED");
};

export const resolvePublicRestaurantContext = async (restaurantSlug = "") => {
  const requestedSlug = String(restaurantSlug || "").trim().toLowerCase();
  let restaurant;

  if (requestedSlug) {
    if (!/^[a-z0-9-]{1,120}$/.test(requestedSlug)) {
      throw publicRestaurantError("The restaurant context is invalid", "PUBLIC_MENU_RESTAURANT_INVALID");
    }
    restaurant = await Restaurant.findOne({ slug: requestedSlug, isActive: true }).lean();
    if (!restaurant) {
      throw new ApiError(404, "The requested restaurant is not available", "PUBLIC_MENU_RESTAURANT_NOT_FOUND");
    }
  } else {
    const configuredSlug = String(process.env.PUBLIC_MENU_DEFAULT_RESTAURANT_SLUG || "").trim().toLowerCase();
    if (configuredSlug) {
      restaurant = await Restaurant.findOne({ slug: configuredSlug, isActive: true }).lean();
      if (!restaurant) {
        throw new ApiError(503, "The default public menu is not available", "PUBLIC_MENU_DEFAULT_UNAVAILABLE");
      }
    } else {
      // Plain /menu is supported for a single-restaurant demo only. Once more
      // than one active tenant exists, a slug is mandatory to prevent leakage.
      const restaurants = await Restaurant.find({ isActive: true }).sort({ _id: 1 }).limit(2).lean();
      if (restaurants.length !== 1) {
        throw publicRestaurantError("A restaurant context is required for this menu", "PUBLIC_MENU_RESTAURANT_REQUIRED");
      }
      [restaurant] = restaurants;
    }
  }

  const outlet = await resolvePublicOutlet(restaurant._id);
  return { restaurant, outlet, table: null, source: "browse" };
};

export const listPublicMenu = async ({ context, query = {} }) => {
  const { page, limit, skip } = getPagination(query);
  const sortFields = new Set(["createdAt", "price", "name"]);
  const sortBy = sortFields.has(query.sortBy) ? query.sortBy : "createdAt";
  const sort = { [sortBy]: query.order === "asc" ? 1 : -1 };
  const categoryFilter = { restaurant: context.restaurant._id, ...activeCategoryFilter };

  if (query.category) {
    if (!mongoose.isValidObjectId(query.category)) {
      throw new ApiError(400, "Invalid menu category", "PUBLIC_MENU_CATEGORY_INVALID");
    }
    categoryFilter._id = query.category;
  }

  const categories = await Category.find(categoryFilter)
    .select("name slug description image")
    .sort({ name: 1 })
    .lean();

  if (query.category && categories.length === 0) {
    throw new ApiError(404, "Menu category not found", "PUBLIC_MENU_CATEGORY_NOT_FOUND");
  }

  const filters = {
    restaurant: context.restaurant._id,
    category: { $in: categories.map((category) => category._id) },
    isAvailable: true,
  };

  if (query.search) {
    const search = escapeRegex(query.search);
    filters.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }
  if (query.isVeg !== undefined) filters.isVeg = query.isVeg === "true";

  const [items, total] = await Promise.all([
    Food.find(filters)
      .select("name category description image price discountPrice rating prepTimeMins preparationTime spicyLevel foodType isVeg isAvailable featured tags createdAt")
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Food.countDocuments(filters),
  ]);

  return {
    ...(context.table ? { table: { _id: context.table._id, tableNumber: context.table.tableNumber, floor: context.table.floor, section: context.table.section } } : {}),
    restaurant: { _id: context.restaurant._id, name: context.restaurant.name, slug: context.restaurant.slug, branchCode: context.restaurant.branchCode },
    outlet: { _id: context.outlet._id, name: context.outlet.name, code: context.outlet.code },
    categories,
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
