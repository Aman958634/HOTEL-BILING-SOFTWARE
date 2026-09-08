import { Router } from "express";
import { body } from "express-validator";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPublicMenuContextToken, resolvePublicMenuContext } from "../utils/publicMenuContext.js";
import { listPublicMenu, resolvePublicRestaurantContext } from "../services/publicMenuService.js";
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

const getPublicMenu = async (req, context) => listPublicMenu({ context, query: req.query });
const recordPublicMenuContext = (req, context, source) => {
  req.publicMenuContext = {
    source,
    restaurantId: context?.restaurant?._id ? String(context.restaurant._id) : null,
    outletId: context?.outlet?._id ? String(context.outlet._id) : null,
    tableId: context?.table?._id ? String(context.table._id) : null,
  };
};

router.get("/menu", asyncHandler(async (req, res) => {
  req.publicMenuContext = { source: "browse", restaurantSlug: String(req.query.restaurant || "").slice(0, 120) || null };
  const context = await resolvePublicRestaurantContext(req.query.restaurant);
  recordPublicMenuContext(req, context, "browse");
  const menu = await getPublicMenu(req, context);
  res.status(200).json(new ApiResponse(true, "Public menu fetched", menu, menu.meta));
}));

router.get("/menu/:qrToken", asyncHandler(async (req, res) => {
  req.publicMenuContext = { source: "table_qr" };
  const context = await resolvePublicMenuContext(getPublicMenuContextToken(req));
  recordPublicMenuContext(req, context, "table_qr");
  const menu = await getPublicMenu(req, context);
  res.status(200).json(new ApiResponse(true, "Public menu fetched", menu, menu.meta));
}));

router.get("/foods", asyncHandler(async (req, res) => {
  req.publicMenuContext = { source: "table_qr" };
  const context = await resolvePublicMenuContext(getPublicMenuContextToken(req));
  recordPublicMenuContext(req, context, "table_qr");
  const menu = await getPublicMenu(req, context);
  res.status(200).json(new ApiResponse(true, "Public foods fetched", menu.items, menu.meta));
}));

router.get("/categories", asyncHandler(async (req, res) => {
  req.publicMenuContext = { source: "table_qr" };
  const context = await resolvePublicMenuContext(getPublicMenuContextToken(req));
  recordPublicMenuContext(req, context, "table_qr");
  const menu = await getPublicMenu(req, context);
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
