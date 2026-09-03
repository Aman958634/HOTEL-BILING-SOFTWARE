import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { dashboardStats, recentOrders, salesOverview } from "../controllers/adminController.js";
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

const router = Router();

router.use(authMiddleware, requireRole("admin"));

// Billing remains reachable after trial expiry so restaurants can upgrade.
router.get("/billing/plans", billingCtrl.listPlans);
router.get("/billing/subscription", billingCtrl.getMySubscription);
router.get("/billing/payments", listMyBillingPayments);
router.get("/billing/payments/:id/pdf", downloadMyBillingPaymentPdf);
router.post("/billing/select-plan", selectBillingPlan);
router.post("/billing/checkout", billingCtrl.createBillingCheckout);
router.post("/billing/verify", billingCtrl.verifyBillingPayment);

// Restore is deliberately disabled unless explicit maintenance flags and an
// exact confirmation are supplied. It runs only from a local backup name.
router.get("/backups", listBackups);
router.post("/backups", createBackup);
router.post("/restore-backup", restoreBackup);

router.use(requireActiveSubscription);

router.get("/dashboard/stats", dashboardStats);
router.get("/dashboard/sales", salesOverview);
router.get("/dashboard/recent-orders", recentOrders);

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

export default router;
