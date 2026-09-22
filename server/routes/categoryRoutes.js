import { Router } from "express";
import { body, param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  toggleCategoryStatus,
  updateCategory,
} from "../controllers/categoryController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription, requireRole("admin"));

router.get("/", listCategories);
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Category name is required"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("image").optional({ values: "falsy" }).isURL().withMessage("Image must be a valid URL"),
  ],
  validate,
  createCategory
);
router.put("/:id", [
  param("id").isMongoId().withMessage("Invalid category id"),
  body("name").optional().trim().isLength({ min: 1, max: 120 }).withMessage("Category name is invalid"),
  body("description").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Description must be less than 500 characters"),
  body("image").optional({ values: "falsy" }).isURL().withMessage("Image must be a valid URL"),
], validate, updateCategory);
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid category id")], validate, deleteCategory);
router.patch("/:id/status", [param("id").isMongoId().withMessage("Invalid category id"), body("active").isBoolean().withMessage("Active must be boolean")], validate, toggleCategoryStatus);

export default router;
