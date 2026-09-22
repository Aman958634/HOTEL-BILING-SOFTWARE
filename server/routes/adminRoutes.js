import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { dashboardStats, integrationStatus, recentOrders, salesOverview } from "../controllers/adminController.js";
import {
	exportReports,
	getCategoryReport,
	getCustomerReport,
	getOrdersReport,
	getPaymentReport,
	getReportSummary,
	getRevenueReport,
	getSalesReport,
	getTopItemsReport,
} from "../controllers/reportController.js";
import * as billingCtrl from "../controllers/billingController.js";
import {
  selectBillingPlan,
  listMyBillingPayments,
  downloadMyBillingPaymentPdf,
} from "../controllers/publicSubscriptionController.js";
import notificationRoutes from "./notificationRoutes.js";
import restaurantRoutes from "./restaurantRoutes.js";
import { createBackup, listBackups, restoreBackup } from "../controllers/backupController.js";
import settlementRoutes from "./settlementRoutes.js";
import { body, param } from "express-validator";
import { validate } from "../middleware/validate.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

// Billing remains reachable after trial expiry so restaurants can upgrade.
router.get("/billing/plans", billingCtrl.listPlans);
router.get("/billing/subscription", billingCtrl.getMySubscription);
router.get("/billing/payments", listMyBillingPayments);
router.get("/billing/payments/:id/pdf", [param("id").isMongoId().withMessage("Invalid payment id")], validate, downloadMyBillingPaymentPdf);
router.post("/billing/select-plan", [body("planName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid")], validate, selectBillingPlan);
router.post("/billing/checkout", paymentLimiter, [body("planName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid")], validate, billingCtrl.createBillingCheckout);
router.post("/billing/verify", paymentLimiter, [
  body("paymentId").isMongoId().withMessage("Payment reference is invalid"),
  body("razorpay_order_id").optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay order is invalid"),
  body("razorpay_payment_id").optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay payment is invalid"),
  body("razorpay_signature").optional().isString().trim().isLength({ min: 32, max: 200 }).withMessage("Razorpay signature is invalid"),
  body("testSuccess").optional().isBoolean().withMessage("Test payment status is invalid"),
], validate, billingCtrl.verifyBillingPayment);

// Restore is deliberately disabled unless explicit maintenance flags and an
// exact confirmation are supplied. It runs only from a local backup name.
router.get("/backups", listBackups);
router.post("/backups", createBackup);
router.post("/restore-backup", restoreBackup);

router.use(requireActiveSubscription);

router.get("/dashboard/stats", dashboardStats);
router.get("/dashboard/sales", salesOverview);
router.get("/dashboard/recent-orders", recentOrders);
router.get("/integrations/status", integrationStatus);

router.get("/reports/summary", getReportSummary);
router.get("/reports/revenue", getRevenueReport);
router.get("/reports/orders", getOrdersReport);
router.get("/reports/top-items", getTopItemsReport);
router.get("/reports/categories", getCategoryReport);
router.get("/reports/payments", getPaymentReport);
router.get("/reports/customers", getCustomerReport);
router.get("/reports/sales", getSalesReport);
router.get("/reports/export", exportReports);

router.use("/notifications", notificationRoutes);
router.use("/restaurant", restaurantRoutes);
router.use("/settlement", settlementRoutes);

export default router;
