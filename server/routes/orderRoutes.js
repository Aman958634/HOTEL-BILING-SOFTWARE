import { Router } from "express";
import { body, param, query } from "express-validator";
import mongoose from "mongoose";
import {
	addOrderCustomer,
	createOrder,
	deleteOrder,
	downloadInvoice,
	getOrderById,
	getOrderStats,
	getPendingOrders,
	getTodayOrders,
	listOrders,
	searchOrderCustomers,
	payOrder,
	updateOrder,
	updateOrderPayment,
	updateOrderPaymentStatus,
	updateOrderStatus,
} from "../controllers/orderController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post(
  "/guest",
  [
    body("orderType").notEmpty().withMessage("Order type is required"),
    body("items").isArray({ min: 1 }).withMessage("At least one order item is required"),
    body("items.*.menuItem").optional().isMongoId().withMessage("Invalid menu item id"),
    body("items.*.food").optional().isMongoId().withMessage("Invalid menu item id"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Item quantity must be at least 1"),
    body("table")
      .notEmpty().withMessage("Table is required for guest orders")
      .isMongoId()
      .withMessage("Table id is invalid"),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { createGuestOrder } = await import("../controllers/orderController.js");
    return createGuestOrder(req, res);
  })
);

router.use(authMiddleware, requireActiveSubscription);

router.get(
	"/",
	[
		query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
		query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
	],
	validate,
	listOrders
);

router.get("/stats", getOrderStats);
router.get("/today", getTodayOrders);
router.get("/pending", getPendingOrders);
router.get("/customers", searchOrderCustomers);
router.post(
	"/customers",
	[
		body("fullName").trim().notEmpty().withMessage("Customer name is required"),
		body("email").optional().isEmail().withMessage("Email must be valid"),
		body("phone").optional().isLength({ min: 10, max: 15 }).withMessage("Phone must be 10 to 15 digits"),
	],
	validate,
	addOrderCustomer
);

router.post(
	"/",
	[
		body("orderType").notEmpty().withMessage("Order type is required"),
		body("items").isArray({ min: 1 }).withMessage("At least one order item is required"),
		body("items.*.menuItem").optional().isMongoId().withMessage("Invalid menu item id"),
		body("items.*.food").optional().isMongoId().withMessage("Invalid menu item id"),
		body("items.*.quantity").isInt({ min: 1 }).withMessage("Item quantity must be at least 1"),
		body("table")
			.optional({ nullable: true, values: "falsy" })
			.isMongoId()
			.withMessage("Table id is invalid"),
	],
	validate,
	createOrder
);

router.get("/:id", [param("id").isMongoId().withMessage("Invalid order id")], validate, getOrderById);

router.put(
	"/:id",
	[
		param("id").isMongoId().withMessage("Invalid order id"),
		body("items").optional().isArray({ min: 1 }).withMessage("At least one order item is required"),
		body("items.*.menuItem").optional().isMongoId().withMessage("Invalid menu item id"),
		body("items.*.food").optional().isMongoId().withMessage("Invalid menu item id"),
		body("items.*.quantity").optional().isInt({ min: 1 }).withMessage("Item quantity must be at least 1"),
	],
	validate,
	updateOrder
);

router.delete("/:id", deleteOrder);

router.patch(
	"/:id/status",
	[
		param("id").isMongoId().withMessage("Invalid order id"),
		body("status").notEmpty().withMessage("Order status is required"),
	],
	validate,
	updateOrderStatus
);

router.patch(
	"/:id/payment",
	[
		param("id").isMongoId().withMessage("Invalid order id"),
		body("paymentMethod").optional().isString().withMessage("Payment method is invalid"),
		body("paymentStatus").optional().isString().withMessage("Payment status is invalid"),
		body("amount").optional().isFloat({ gt: 0 }).withMessage("Payment amount must be greater than zero"),
	],
	validate,
	updateOrderPayment
);

router.post(
	"/:id/pay",
	[
		param("id").isMongoId().withMessage("Invalid order id"),
		body("paymentMethod").optional().isString().withMessage("Payment method is invalid"),
		body("paymentStatus").optional().isString().withMessage("Payment status is invalid"),
		body("amount").optional().isFloat({ gt: 0 }).withMessage("Payment amount must be greater than zero"),
	],
	validate,
	payOrder
);

router.put(
	"/:id/payment-status",
	[
		param("id").isMongoId().withMessage("Invalid order id"),
		body("paymentMethod").optional().isString().withMessage("Payment method is invalid"),
		body("paymentStatus").optional().isString().withMessage("Payment status is invalid"),
		body("amount").optional().isFloat({ gt: 0 }).withMessage("Payment amount must be greater than zero"),
	],
	validate,
	updateOrderPaymentStatus
);

router.get("/:id/invoice", downloadInvoice);

export default router;
