import Category from "../models/Category.js";
import Food from "../models/Food.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import { resolveRestaurantForUser } from "../utils/tenantUtils.js";

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getRestaurantScope = async (user) => {
  if (!user?.restaurant) throw new ApiError(403, "Restaurant context is required");
  return resolveRestaurantForUser({ restaurantId: user.restaurant, user });
};

export const listCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const restaurant = await getRestaurantScope(req.user);

  const filter = { restaurant: restaurant._id };
  if (req.query.search) {
    filter.name = { $regex: escapeRegex(req.query.search), $options: "i" };
  }

  if (req.query.active !== undefined) {
    const active = String(req.query.active).toLowerCase() === "true";
    filter.$or = [{ active }, { isActive: active }];
  }

  const [categories, total] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Categories fetched", categories, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description = "", image = "", active = true } = req.body;
  const restaurant = await getRestaurantScope(req.user);

  const slug = slugify(name);
  const exists = await Category.findOne({ restaurant: restaurant._id, slug });
  if (exists) throw new ApiError(409, "Category already exists");

  const category = await Category.create({
    restaurant: restaurant._id,
    hotelId: restaurant.hotelId || req.user.hotelId || null,
    name: String(name).trim(),
    slug,
    description,
    image,
    active,
    isActive: active,
  });

  res.status(201).json(new ApiResponse(true, "Category created", category));
});

export const updateCategory = asyncHandler(async (req, res) => {
  const restaurant = await getRestaurantScope(req.user);
  const update = {};
  for (const field of ["name", "description", "image", "active"]) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }

  if (update.name) {
    update.slug = slugify(update.name);
    const exists = await Category.findOne({ restaurant: restaurant._id, slug: update.slug, _id: { $ne: req.params.id } });
    if (exists) throw new ApiError(409, "Category already exists");
  }

  if (update.active !== undefined) {
    const active = String(update.active).toLowerCase() === "true" || update.active === true;
    update.active = active;
    update.isActive = active;
  }

  const category = await Category.findOneAndUpdate({ _id: req.params.id, restaurant: restaurant._id }, update, {
    new: true,
    runValidators: true,
  });

  if (!category) throw new ApiError(404, "Category not found");

  res.status(200).json(new ApiResponse(true, "Category updated", category));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const restaurant = await getRestaurantScope(req.user);
  const category = await Category.findOne({ _id: req.params.id, restaurant: restaurant._id });
  if (!category) throw new ApiError(404, "Category not found");

  const linkedFoods = await Food.countDocuments({ category: category._id, restaurant: restaurant._id });
  if (linkedFoods > 0) {
    throw new ApiError(400, "Cannot delete category linked to menu items");
  }

  await category.deleteOne();

  res.status(200).json(new ApiResponse(true, "Category deleted"));
});

export const toggleCategoryStatus = asyncHandler(async (req, res) => {
  const restaurant = await getRestaurantScope(req.user);
  const active = String(req.body.active).toLowerCase() === "true" || req.body.active === true;

  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, restaurant: restaurant._id },
    { active, isActive: active },
    { new: true, runValidators: true }
  );

  if (!category) throw new ApiError(404, "Category not found");

  res.status(200).json(new ApiResponse(true, "Category status updated", category));
});
