import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { getRestaurantSettings, updateRestaurantSettings } from "../controllers/restaurantController.js";

const router = Router();

router.get("/", requireActiveSubscription, getRestaurantSettings);

router.put(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Restaurant name is required"),
    body("branchCode").trim().notEmpty().withMessage("Branch code is required"),
    body("address").trim().notEmpty().withMessage("Address is required"),
    body("city").optional({ values: "falsy" }).trim().isString().withMessage("City must be a string"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("A valid email is required"),
    body("phone").optional({ values: "falsy" }).trim().isLength({ min: 7, max: 20 }).withMessage("Phone number is invalid"),
    body("gstNumber").optional({ values: "falsy" }).trim().isString().withMessage("GST number must be valid"),
    body("gstRate").optional({ nullable: true }).customSanitizer((value) => {
      const rate = Number(value);
      return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0;
    }).isFloat({ min: 0, max: 100 }).withMessage("GST rate must be between 0 and 100"),
    body("openingHours").optional({ values: "falsy" }).matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/).withMessage("Opening hours must be in HH:MM-HH:MM format"),
    body("logoUrl").optional({ values: "falsy" }).trim().isURL().withMessage("Logo URL must be valid"),
    body("website").optional({ values: "falsy" }).trim().isURL().withMessage("Website must be valid"),
    body("slug").optional({ values: "falsy" }).trim().isString().withMessage("Slug must be valid"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    body("reservationsEnabled").optional().isBoolean().withMessage("reservationsEnabled must be a boolean"),
    body("onlineOrdersEnabled").optional().isBoolean().withMessage("onlineOrdersEnabled must be a boolean"),
    body("kitchenDisplayEnabled").optional().isBoolean().withMessage("kitchenDisplayEnabled must be a boolean"),
    body("simpleOrderWorkflowEnabled").optional().isBoolean().withMessage("simpleOrderWorkflowEnabled must be a boolean"),
  ],
  validate,
  requireActiveSubscription,
  updateRestaurantSettings
);

export default router;
