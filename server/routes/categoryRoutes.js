import { Router } from "express";
import { body } from "express-validator";
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
router.put("/:id", validate, updateCategory);
router.delete("/:id", deleteCategory);
router.patch("/:id/status", [body("active").isBoolean().withMessage("Active must be boolean")], validate, toggleCategoryStatus);

export default router;
