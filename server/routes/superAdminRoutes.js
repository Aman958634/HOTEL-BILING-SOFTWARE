import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/tenantMiddleware.js";
import { dashboardStats } from "../controllers/superAdminController.js";
import * as restaurantsCtrl from "../controllers/superAdminRestaurantsController.js";
import * as subscriptionsCtrl from "../controllers/superAdminSubscriptionsController.js";
import * as activityCtrl from "../controllers/superAdminActivityController.js";
import * as usersCtrl from "../controllers/superAdminUsersController.js";
import * as paymentsCtrl from "../controllers/superAdminPaymentsController.js";
import {
  userListValidation,
  userIdValidation,
  userCreateValidation,
  userUpdateValidation,
  userStatusValidation,
} from "../validators/superAdminUserValidator.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(authMiddleware, requireSuperAdmin);
router.get("/dashboard/stats", dashboardStats);

// Restaurants
router.get("/restaurants", restaurantsCtrl.listRestaurants);
router.post("/restaurants", restaurantsCtrl.createRestaurant);
router.get("/restaurants/:id", restaurantsCtrl.getRestaurant);
router.put("/restaurants/:id", restaurantsCtrl.updateRestaurant);
router.patch("/restaurants/:id/status", restaurantsCtrl.updateStatus);

// Users
router.get("/users", userListValidation, validate, usersCtrl.listUsers);
router.post("/users", userCreateValidation, validate, usersCtrl.createUser);
router.get("/users/:id", userIdValidation, validate, usersCtrl.getUser);
router.put("/users/:id", userIdValidation, userUpdateValidation, validate, usersCtrl.updateUser);
router.patch("/users/:id/status", userIdValidation, userStatusValidation, validate, usersCtrl.updateUserStatus);
router.delete("/users/:id", userIdValidation, validate, usersCtrl.deleteUser);

// Plans (catalog — single source of pricing)
router.get("/plans", subscriptionsCtrl.listPlans);

// Subscriptions
router.get("/subscriptions", subscriptionsCtrl.listSubscriptions);
router.post("/subscriptions", subscriptionsCtrl.createSubscription);
router.get("/subscriptions/:id", subscriptionsCtrl.getSubscription);
router.put("/subscriptions/:id", subscriptionsCtrl.updateSubscription);
router.post("/subscriptions/:id/extend-trial", subscriptionsCtrl.extendTrial);
router.post("/subscriptions/:id/convert", subscriptionsCtrl.convertToPaid);
router.post("/subscriptions/:id/checkout", subscriptionsCtrl.createSubscriptionPaymentCheckout);
router.post("/subscriptions/:id/verify-payment", subscriptionsCtrl.verifySubscriptionPayment);
router.post("/subscriptions/:id/suspend", subscriptionsCtrl.suspendSubscription);
router.post("/subscriptions/:id/cancel", subscriptionsCtrl.cancelSubscription);
router.post("/subscriptions/:id/activate", subscriptionsCtrl.activateSubscription);

// Activity logs
router.get("/activity-logs", activityCtrl.listActivityLogs);

// SaaS subscription payments (Razorpay)
router.get("/payments", paymentsCtrl.listSaasPayments);
router.get("/payments/summary", paymentsCtrl.getSaasPaymentSummary);
router.get("/payments/:id/pdf", paymentsCtrl.downloadSaasPaymentPdf);
router.get("/payments/:id", paymentsCtrl.getSaasPaymentById);
router.delete("/payments/:id", paymentsCtrl.deleteSaasPayment);

export default router;
