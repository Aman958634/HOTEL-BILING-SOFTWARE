import { Router } from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { archiveCustomer, createCustomer, getCustomerProfile, listCustomers, updateCustomer } from "../controllers/customerController.js";

const router = Router();
router.use(authMiddleware, requireActiveSubscription);
router.use(requireRole("admin", "manager", "cashier"));

router.get("/", [
  query("page").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional({ values: "falsy" }).isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("search").optional({ values: "falsy" }).isString().withMessage("Search must be text"),
  query("segment").optional({ values: "falsy" }).isIn(["new", "returning", "recent", "inactive"]).withMessage("Invalid customer segment"),
  query("tag").optional({ values: "falsy" }).isString().withMessage("Tag must be text"),
], validate, listCustomers);
router.post("/", [body("fullName").trim().notEmpty().withMessage("Customer name is required"), body("email").optional({ values: "falsy" }).isEmail().withMessage("Email is invalid"), body("phone").optional({ values: "falsy" }).isLength({ min: 7, max: 20 }).withMessage("Phone is invalid"), body("tags").optional().isArray({ max: 20 }), body("address").optional().isString().isLength({ max: 500 })], validate, createCustomer);
router.get("/:id", [param("id").isMongoId()], validate, getCustomerProfile);
router.put("/:id", [param("id").isMongoId(), body("fullName").optional().trim().notEmpty(), body("email").optional({ values: "falsy" }).isEmail(), body("phone").optional({ values: "falsy" }).isLength({ min: 7, max: 20 }), body("tags").optional().isArray({ max: 20 }), body("address").optional().isString().isLength({ max: 500 }), body("note").optional().isString().trim().isLength({ min: 1, max: 1000 })], validate, updateCustomer);
router.patch("/:id/archive", requireRole("admin", "manager"), [param("id").isMongoId()], validate, archiveCustomer);

export default router;
