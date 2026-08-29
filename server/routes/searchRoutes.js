import { Router } from "express";
import { query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { searchLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { search } from "../controllers/searchController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription);

router.get("/", [
  query("q").optional({ values: "falsy" }).isString().isLength({ max: 100 }).withMessage("Search query must not exceed 100 characters"),
  query("type").optional({ values: "falsy" }).isString().isLength({ max: 160 }).withMessage("Search type is invalid"),
  query("limit").optional({ values: "falsy" }).isInt({ min: 1, max: 5 }).withMessage("Search limit must be between 1 and 5"),
], validate, searchLimiter, requireRole("admin", "restaurant_admin", "manager", "cashier", "waiter", "chef", "delivery", "inventory_manager", "receptionist"), search);

export default router;
