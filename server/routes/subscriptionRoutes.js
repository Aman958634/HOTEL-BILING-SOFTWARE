import { Router } from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import {
  createRazorpaySubscriptionOrder,
  verifyRazorpaySubscriptionPayment,
} from "../controllers/superAdminSubscriptionsController.js";

const router = Router();

// No active-subscription middleware here: an expired/trial tenant must be able
// to purchase access. auth + admin role establish tenant ownership instead.
router.use(authMiddleware, requireRole("admin"), paymentLimiter);

router.post(
  "/razorpay/create-order",
  [body("planId").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan identifier is invalid")],
  validate,
  createRazorpaySubscriptionOrder
);
router.post(
  "/razorpay/verify-payment",
  [
    body("paymentId").isMongoId().withMessage("Payment reference is invalid"),
    body("razorpay_order_id").isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay order is invalid"),
    body("razorpay_payment_id").isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay payment is invalid"),
    body("razorpay_signature").isString().trim().isLength({ min: 32, max: 200 }).withMessage("Razorpay signature is invalid"),
  ],
  validate,
  verifyRazorpaySubscriptionPayment
);

export default router;
