import { Router } from "express";
import { body } from "express-validator";
import Food from "../models/Food.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import { getPublicMenuContextToken, resolvePublicMenuContext } from "../utils/publicMenuContext.js";
import { signupLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import {
  listPublicPlans,
  publicSubscribeSignup,
} from "../controllers/publicSubscriptionController.js";

const router = Router();

router.get("/plans", listPublicPlans);
router.post(
  "/subscribe/signup",
  signupLimiter,
  [
    body("planName").isString().trim().isLength({ min: 1, max: 80 }).withMessage("Plan selection is invalid"),
    body("fullName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Owner name is invalid"),
    body("ownerName").optional({ values: "falsy" }).isString().trim().isLength({ max: 120 }).withMessage("Owner name is invalid"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isString().isLength({ min: 8, max: 128 }).withMessage("Password must be between 8 and 128 characters"),
    body("phone").isString().trim().isLength({ min: 7, max: 20 }).withMessage("Phone number is invalid"),
    body("restaurantName").isString().trim().isLength({ min: 1, max: 160 }).withMessage("Restaurant name is invalid"),
    body("address").isString().trim().isLength({ min: 1, max: 500 }).withMessage("Address is invalid"),
    body("city").optional({ values: "falsy" }).isString().trim().isLength({ max: 120 }).withMessage("City is invalid"),
  ],
  validate,
  publicSubscribeSignup
);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getPublicMenu = async (req) => {
  const context = await resolvePublicMenuContext(getPublicMenuContextToken(req));
  const { page, limit, skip } = getPagination(req.query);
  const sortFields = new Set(["createdAt", "price", "name"]);
  const sortBy = sortFields.has(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const sort = { [sortBy]: req.query.order === "asc" ? 1 : -1 };
  const filters = { restaurant: context.restaurant._id, isAvailable: true };

  if (req.query.search) {
    const search = escapeRegex(req.query.search);
    filters.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }
  if (req.query.category) {
    const category = await Category.findOne({ _id: req.query.category, restaurant: context.restaurant._id, isActive: true }).select("_id").lean();
    if (!category) throw new ApiError(404, "Menu category not found");
    filters.category = category._id;
  }
  if (req.query.isVeg !== undefined) filters.isVeg = req.query.isVeg === "true";

  const [items, total, categories] = await Promise.all([
    Food.find(filters).populate("category", "name slug").sort(sort).skip(skip).limit(limit).lean(),
    Food.countDocuments(filters),
    Category.find({ restaurant: context.restaurant._id, isActive: true }).sort({ name: 1 }).lean(),
  ]);
  return {
    table: { _id: context.table._id, tableNumber: context.table.tableNumber, floor: context.table.floor, section: context.table.section },
    restaurant: { _id: context.restaurant._id, name: context.restaurant.name, branchCode: context.restaurant.branchCode },
    outlet: { _id: context.outlet._id, name: context.outlet.name, code: context.outlet.code },
    categories,
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

router.get("/menu/:qrToken", asyncHandler(async (req, res) => {
  const menu = await getPublicMenu(req);
  res.status(200).json(new ApiResponse(true, "Public menu fetched", menu, menu.meta));
}));

router.get("/foods", asyncHandler(async (req, res) => {
  const menu = await getPublicMenu(req);
  res.status(200).json(new ApiResponse(true, "Public foods fetched", menu.items, menu.meta));
}));

router.get("/categories", asyncHandler(async (req, res) => {
  const menu = await getPublicMenu(req);
  res.status(200).json(new ApiResponse(true, "Public categories fetched", menu.categories));
}));

router.get(
  "/seed-status",
  asyncHandler(async (_req, res) => {
    const user = await User.findOne({ role: "super_admin" }).select("email role fullName");
    if (user) {
      const data = process.env.NODE_ENV === "production" ? { exists: true } : { exists: true, user };
      return res.status(200).json(new ApiResponse(true, "Super admin exists", data));
    }
    return res.status(200).json(new ApiResponse(true, "No super admin found", { exists: false }));
  })
);

router.post(
  "/create-super-admin",
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json(new ApiResponse(false, "Not allowed in production"));
    }

    const { email, password, fullName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json(new ApiResponse(false, "Email and password are required"));
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json(new ApiResponse(false, "User already exists"));
    }

    const user = await User.create({ fullName: fullName || "Super Admin", email, password, role: "super_admin" });
    return res.status(201).json(new ApiResponse(true, "Super admin created", { email: user.email, id: user._id }));
  })
);

export default router;
