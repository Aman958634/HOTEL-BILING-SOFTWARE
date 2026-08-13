import Category from "../models/Category.js";
import Food from "../models/Food.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const listCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
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

  const slug = slugify(name);
  const exists = await Category.findOne({ slug });
  if (exists) throw new ApiError(409, "Category already exists");

  const category = await Category.create({
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
  const update = { ...req.body };

  if (update.name) {
    update.slug = slugify(update.name);
  }

  if (update.active !== undefined) {
    const active = String(update.active).toLowerCase() === "true" || update.active === true;
    update.active = active;
    update.isActive = active;
  }

  const category = await Category.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!category) throw new ApiError(404, "Category not found");

  res.status(200).json(new ApiResponse(true, "Category updated", category));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found");

  const linkedFoods = await Food.countDocuments({ category: category._id });
  if (linkedFoods > 0) {
    throw new ApiError(400, "Cannot delete category linked to menu items");
  }

  await category.deleteOne();

  res.status(200).json(new ApiResponse(true, "Category deleted"));
});

export const toggleCategoryStatus = asyncHandler(async (req, res) => {
  const active = String(req.body.active).toLowerCase() === "true" || req.body.active === true;

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { active, isActive: active },
    { new: true, runValidators: true }
  );

  if (!category) throw new ApiError(404, "Category not found");

  res.status(200).json(new ApiResponse(true, "Category status updated", category));
});
