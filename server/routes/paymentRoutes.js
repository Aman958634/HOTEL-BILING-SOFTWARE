import { Router } from "express";
import { body } from "express-validator";
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
	createSplitPayment,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { requirePaymentAdminAccess, requirePaymentSettlementAccess, requirePaymentViewAccess } from "../middleware/paymentAuth.js";

const router = Router();

router.post("/intent", protect, createPaymentIntent);
router.post("/create-order", protect, createPaymentIntent);
router.post(
	"/split",
	protect,
	requirePaymentSettlementAccess,
	[
		body("orderId").isMongoId().withMessage("A valid order id is required"),
		body("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
		body("paymentMethod").isString().notEmpty().withMessage("Payment method is required"),
		body("idempotencyKey").optional().isLength({ min: 8, max: 128 }),
	],
	validate,
	createSplitPayment
);
router.post(
  "/verify",
  protect,
  requirePaymentSettlementAccess,
  [
    body("orderId").isMongoId().withMessage("A valid order id is required"),
    body("provider").isIn(["razorpay", "cash"]).withMessage("Unsupported payment provider"),
    body("paymentMethod").optional().isString().withMessage("Payment method is invalid"),
    body("razorpay_order_id").if(body("provider").equals("razorpay")).notEmpty().withMessage("Razorpay order id is required"),
    body("razorpay_payment_id").if(body("provider").equals("razorpay")).notEmpty().withMessage("Razorpay payment id is required"),
    body("razorpay_signature").if(body("provider").equals("razorpay")).notEmpty().withMessage("Razorpay signature is required"),
  ],
  validate,
  verifyPayment
);
router.get("/stats", protect, requirePaymentViewAccess, getPaymentStats);
router.get("/export", protect, requirePaymentViewAccess, exportPayments);
router.get("/:id/receipt", protect, requirePaymentViewAccess, getPaymentReceipt);
router.get("/order/:orderId", protect, requirePaymentViewAccess, getPaymentByOrderId);
router.get("/:id", protect, requirePaymentViewAccess, getPaymentById);
router.get("/", protect, requirePaymentViewAccess, listPayments);
router.delete("/:id", protect, requirePaymentAdminAccess, deletePayment);
router.post(
	"/:id/refund",
	protect,
	requirePaymentAdminAccess,
	[
		body("refundType").optional().isIn(["full", "partial"]).withMessage("Refund type is invalid"),
		body("refundAmount").optional().isFloat({ gt: 0 }).withMessage("Refund amount must be greater than 0"),
		body("refundReason").optional().isString().trim(),
	],
	validate,
	refundPayment
);

export default router;
