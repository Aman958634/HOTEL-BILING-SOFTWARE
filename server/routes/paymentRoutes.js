import { Router } from "express";
import { body, param } from "express-validator";
import {
	createPaymentIntent,
	deletePayment,
	exportPayments,
	getPaymentById,
	getPaymentByOrderId,
	getPaymentReceipt,
	getPaymentStats,
	listPayments,
	refundPayment,
	verifyPayment,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { requirePaymentAdminAccess, requirePaymentViewAccess } from "../middleware/paymentAuth.js";

const router = Router();

const paymentIntentValidation = [
  body("orderId").isMongoId().withMessage("Invalid order id"),
  body("provider").optional().isIn(["razorpay", "stripe"]).withMessage("Unsupported payment provider"),
  body("paymentMethod").optional().isString().isLength({ max: 40 }).withMessage("Payment method is invalid"),
];
const verifyPaymentValidation = [
  ...paymentIntentValidation,
  body("status").optional().isIn(["success", "failed", "pending"]).withMessage("Payment status is invalid"),
  body("razorpay_order_id").optional().isString().isLength({ max: 200 }).withMessage("Razorpay order id is invalid"),
  body("razorpay_payment_id").optional().isString().isLength({ max: 200 }).withMessage("Razorpay payment id is invalid"),
  body("razorpay_signature").optional().isString().isLength({ max: 200 }).withMessage("Razorpay signature is invalid"),
];

router.post("/intent", protect, paymentIntentValidation, validate, createPaymentIntent);
router.post("/create-order", protect, paymentIntentValidation, validate, createPaymentIntent);
router.post("/verify", protect, verifyPaymentValidation, validate, verifyPayment);
router.get("/stats", protect, requirePaymentViewAccess, getPaymentStats);
router.get("/export", protect, requirePaymentViewAccess, exportPayments);
router.get("/:id/receipt", protect, requirePaymentViewAccess, [param("id").isMongoId().withMessage("Invalid payment id")], validate, getPaymentReceipt);
router.get("/order/:orderId", protect, requirePaymentViewAccess, [param("orderId").isMongoId().withMessage("Invalid order id")], validate, getPaymentByOrderId);
router.get("/:id", protect, requirePaymentViewAccess, [param("id").isMongoId().withMessage("Invalid payment id")], validate, getPaymentById);
router.get("/", protect, requirePaymentViewAccess, listPayments);
router.delete("/:id", protect, requirePaymentAdminAccess, [param("id").isMongoId().withMessage("Invalid payment id")], validate, deletePayment);
router.post(
	"/:id/refund",
	protect,
	requirePaymentAdminAccess,
	[
		param("id").isMongoId().withMessage("Invalid payment id"),
		body("refundType").optional().isIn(["full", "partial"]).withMessage("Refund type is invalid"),
		body("refundAmount").optional().isFloat({ gt: 0 }).withMessage("Refund amount must be greater than 0"),
		body("refundReason").isString().trim().isLength({ min: 1, max: 500 }).withMessage("Refund reason is required"),
	],
	validate,
	refundPayment
);

export default router;
