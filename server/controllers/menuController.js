import mongoose from "mongoose";
import Food from "../models/Food.js";
import Category from "../models/Category.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import { buildRestaurantQuery, resolveRestaurantForUser } from "../utils/tenantUtils.js";

const normalizeIngredients = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const resolveRestaurant = async (restaurantId, user) => {
  const restaurant = await resolveRestaurantForUser({ restaurantId, user });
  return restaurant;
};

export const listMenuItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  let filter = {};

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
    ];
  }

  if (req.query.category && mongoose.isValidObjectId(req.query.category)) {
    filter.category = req.query.category;
  }

  if (req.query.available !== undefined) {
    const available = String(req.query.available).toLowerCase() === "true";
    filter.isAvailable = available;
  }

  filter = await buildRestaurantQuery(filter, req.user);

  const sort = req.query.sortBy === "price"
    ? { price: req.query.order === "asc" ? 1 : -1 }
    : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Food.find(filter)
      .populate("category", "name active isActive")
      .populate("restaurant", "name branchCode")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Food.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Menu items fetched", items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const getMenuItemById = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ _id: req.params.id }, req.user);

  const item = await Food.findOne(filter)
    .populate("category", "name active isActive")
    .populate("restaurant", "name branchCode");

  if (!item) throw new ApiError(404, "Menu item not found");

  res.status(200).json(new ApiResponse(true, "Menu item fetched", item));
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    description,
    price,
    discountPrice,
    image,
    preparationTime,
    ingredients,
    spicyLevel,
    foodType,
    available,
    featured,
    restaurant,
  } = req.body;

  const foundRestaurant = await resolveRestaurant(restaurant, req.user);

  if (!mongoose.isValidObjectId(category)) {
    throw new ApiError(400, "Invalid category id");
  }

  const foundCategory = await Category.findOne({ _id: category, restaurant: foundRestaurant._id });
  if (!foundCategory || (!foundCategory.active && !foundCategory.isActive)) {
    throw new ApiError(400, "Category is inactive or not found");
  }

  const item = await Food.create({
    name: String(name).trim(),
    hotelId: req.user?.hotelId || foundRestaurant?.hotelId || null,
    category,
    restaurant: foundRestaurant._id,
    description: description || "",
    price: Number(price),
    discountPrice: Number(discountPrice || 0),
    image: image || "",
    preparationTime: Number(preparationTime || 20),
    prepTimeMins: Number(preparationTime || 20),
    ingredients: normalizeIngredients(ingredients),
    spicyLevel: spicyLevel || "mild",
    foodType: foodType || "vegetarian",
    isVeg: (foodType || "vegetarian") === "vegetarian",
    isAvailable: parseBoolean(available, true),
    available: parseBoolean(available, true),
    featured: parseBoolean(featured, false),
  });

  const populated = await Food.findById(item._id).populate("category", "name active isActive");

  res.status(201).json(new ApiResponse(true, "Menu item created", populated));
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  const filter = await buildRestaurantQuery({ _id: req.params.id }, req.user);
  const currentItem = await Food.findOne(filter).select("restaurant hotelId").lean();
  if (!currentItem) throw new ApiError(404, "Menu item not found");

  let targetRestaurant = currentItem.restaurant;
  if (update.restaurant) {
    const foundRestaurant = await resolveRestaurant(update.restaurant, req.user);
    targetRestaurant = foundRestaurant._id;
    update.restaurant = foundRestaurant._id;
    update.hotelId = foundRestaurant.hotelId || currentItem.hotelId || null;
  }

  if (update.category && !mongoose.isValidObjectId(update.category)) {
    throw new ApiError(400, "Invalid category id");
  }

  if (update.category) {
    const foundCategory = await Category.findOne({ _id: update.category, restaurant: targetRestaurant });
    if (!foundCategory || (!foundCategory.active && !foundCategory.isActive)) {
      throw new ApiError(400, "Category is inactive or not found");
    }
  }

  if (update.preparationTime !== undefined) {
    update.prepTimeMins = Number(update.preparationTime);
    update.preparationTime = Number(update.preparationTime);
  }

  if (update.ingredients !== undefined) {
    update.ingredients = normalizeIngredients(update.ingredients);
  }

  if (update.foodType !== undefined) {
    update.foodType = update.foodType;
    update.isVeg = update.foodType === "vegetarian";
  }

  if (update.available !== undefined) {
    const available = parseBoolean(update.available, true);
    update.available = available;
    update.isAvailable = available;
  }

  if (update.isAvailable !== undefined) {
    const available = parseBoolean(update.isAvailable, true);
    update.available = available;
    update.isAvailable = available;
  }

  if (update.price !== undefined) update.price = Number(update.price);
  if (update.discountPrice !== undefined) update.discountPrice = Number(update.discountPrice || 0);

  const item = await Food.findOneAndUpdate(filter, update, {
    new: true,
    runValidators: true,
  })
    .populate("category", "name active isActive")
    .populate("restaurant", "name branchCode");

  if (!item) throw new ApiError(404, "Menu item not found");

  res.status(200).json(new ApiResponse(true, "Menu item updated", item));
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ _id: req.params.id }, req.user);

  const item = await Food.findOneAndDelete(filter);
  if (!item) throw new ApiError(404, "Menu item not found");

  res.status(200).json(new ApiResponse(true, "Menu item deleted"));
});

export const toggleMenuAvailability = asyncHandler(async (req, res) => {
  const available = parseBoolean(req.body.available, true);

  const filter = await buildRestaurantQuery({ _id: req.params.id }, req.user);

  const item = await Food.findOneAndUpdate(
    filter,
    { isAvailable: available, available },
    { new: true, runValidators: true }
  ).populate("category", "name active isActive");

  if (!item) throw new ApiError(404, "Menu item not found");

  res.status(200).json(new ApiResponse(true, "Availability updated", item));
});
