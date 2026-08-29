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
} from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { requirePaymentAdminAccess, requirePaymentViewAccess } from "../middleware/paymentAuth.js";

const router = Router();

router.post("/intent", protect, createPaymentIntent);
router.post("/create-order", protect, createPaymentIntent);
router.post("/verify", protect, verifyPayment);
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
		body("refundReason").isString().trim().isLength({ min: 1, max: 500 }).withMessage("Refund reason is required"),
	],
	validate,
	refundPayment
);

export default router;
