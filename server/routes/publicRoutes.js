import { Router } from "express";
import Food from "../models/Food.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import { verifyQrOrderToken } from "../utils/qrOrderToken.js";
import {
  listPublicPlans,
  publicSubscribeSignup,
} from "../controllers/publicSubscriptionController.js";

const router = Router();

router.get("/plans", listPublicPlans);
router.post("/subscribe/signup", publicSubscribeSignup);

router.get(
  "/foods",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const sort = req.query.sortBy
      ? { [req.query.sortBy]: req.query.order === "asc" ? 1 : -1 }
      : { createdAt: -1 };

    const filters = { isAvailable: true };

    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.category) {
      filters.category = req.query.category;
    }

    if (req.query.isVeg !== undefined) {
      filters.isVeg = req.query.isVeg === "true";
    }

    const [items, total] = await Promise.all([
      Food.find(filters)
        .populate("category", "name slug")
        .populate("restaurant", "name branchCode")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Food.countDocuments(filters),
    ]);

    res.status(200).json(
      new ApiResponse(true, "Public foods fetched", items, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  })
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json(new ApiResponse(true, "Public categories fetched", categories));
  })
);

router.get(
  "/seed-status",
  asyncHandler(async (_req, res) => {
    const user = await User.findOne({ role: "super_admin" }).select("email role fullName");
    if (user) {
      return res.status(200).json(new ApiResponse(true, "Super admin exists", { exists: true, user }));
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

router.get(
  "/tables/:tableNumber",
  asyncHandler(async (req, res) => {
    const tableNumber = String(req.params.tableNumber || "").trim();
    const context = verifyQrOrderToken(req.query.token);
    if (!tableNumber) {
      return res.status(400).json(new ApiResponse(false, "Table number is required"));
    }

    const table = await Table.findOne({ _id: context.tableId, restaurant: context.restaurantId, tableNumber })
      .populate("restaurant", "name branchCode address city")
      .lean();

    if (!table) {
      return res.status(404).json(new ApiResponse(false, "Table not found"));
    }

    res.status(200).json(new ApiResponse(true, "Public table fetched", table));
  })
);

export default router;
