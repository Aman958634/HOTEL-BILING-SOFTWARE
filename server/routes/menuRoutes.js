import { Router } from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItemById,
  listMenuItems,
  toggleMenuAvailability,
  updateMenuItem,
} from "../controllers/menuController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription, requireRole("admin"));

router.get("/", listMenuItems);
router.get("/:id", getMenuItemById);
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Food name required"),
    body("category").notEmpty().withMessage("Category required"),
    body("description")
      .optional()
      .isLength({ min: 10, max: 1200 })
      .withMessage("Description must be between 10 and 1200 characters"),
    body("price").isFloat({ gt: 0 }).withMessage("Price must be greater than 0"),
    body("discountPrice")
      .optional({ values: "falsy" })
      .isFloat({ min: 0 })
      .withMessage("Discount price must be 0 or greater"),
    body("image")
      .optional({ values: "falsy" })
      .isURL()
      .withMessage("Food image must be a valid URL"),
    body("preparationTime")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Preparation time must be at least 1 minute"),
  ],
  validate,
  createMenuItem
);
router.put(
  "/:id",
  [
    body("name").optional().trim().notEmpty().withMessage("Food name required"),
    body("description")
      .optional()
      .isLength({ min: 10, max: 1200 })
      .withMessage("Description must be between 10 and 1200 characters"),
    body("price").optional().isFloat({ gt: 0 }).withMessage("Price must be greater than 0"),
    body("image").optional({ values: "falsy" }).isURL().withMessage("Food image must be a valid URL"),
  ],
  validate,
  updateMenuItem
);
router.delete("/:id", deleteMenuItem);
router.patch(
  "/:id/availability",
  [body("available").isBoolean().withMessage("Available must be boolean")],
  validate,
  toggleMenuAvailability
);

export default router;
