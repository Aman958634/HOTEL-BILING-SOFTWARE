import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/tenantMiddleware.js";
import { dashboardStats } from "../controllers/superAdminController.js";
import * as restaurantsCtrl from "../controllers/superAdminRestaurantsController.js";
import * as subscriptionsCtrl from "../controllers/superAdminSubscriptionsController.js";
import * as activityCtrl from "../controllers/superAdminActivityController.js";
import * as usersCtrl from "../controllers/superAdminUsersController.js";
import * as paymentsCtrl from "../controllers/superAdminPaymentsController.js";
import * as settlementsCtrl from "../controllers/superAdminSettlementController.js";
import { body, param, query } from "express-validator";
import {
  userListValidation,
  userIdValidation,
  userCreateValidation,
  userUpdateValidation,
  userStatusValidation,
} from "../validators/superAdminUserValidator.js";
import { validate } from "../middleware/validate.js";
import { paymentLimiter, settlementRefreshLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const restaurantCreateValidation = [
  body("name").trim().isLength({ min: 1, max: 160 }).withMessage("Restaurant name is required"),
  body("adminFullName").trim().isLength({ min: 1, max: 120 }).withMessage("Admin name is required"),
  body("adminEmail").trim().normalizeEmail().isEmail().isLength({ max: 254 }).withMessage("Enter a valid email address."),
  body("phone").optional({ values: "falsy" }).trim().isLength({ min: 7, max: 20 }).withMessage("Enter a valid mobile number."),
  body("address").trim().isLength({ min: 1, max: 500 }).withMessage("Address is required"),
  body("city").optional({ values: "falsy" }).trim().isLength({ max: 120 }).withMessage("City is invalid"),
  body("status").optional().isIn(["trial", "active", "suspended"]).withMessage("Status is invalid"),
  body("plan").optional({ values: "falsy" }).isString().trim().isLength({ max: 120 }).withMessage("Plan is invalid"),
  body("password").optional({ values: "falsy" }).isString().isLength({ min: 8, max: 128 }).withMessage("Password must be between 8 and 128 characters"),
];
const restaurantUpdateValidation = [
  param("id").isMongoId().withMessage("Invalid restaurant id"),
  body("name").optional().trim().isLength({ min: 1, max: 160 }).withMessage("Restaurant name is invalid"),
  body("email").optional({ values: "falsy" }).trim().normalizeEmail().isEmail().isLength({ max: 254 }).withMessage("Enter a valid email address."),
  body("phone").optional({ values: "falsy" }).trim().isLength({ min: 7, max: 20 }).withMessage("Enter a valid mobile number."),
  body("address").optional().trim().isLength({ min: 1, max: 500 }).withMessage("Address is invalid"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];
const subscriptionIdValidation = [param("id").isMongoId().withMessage("Invalid subscription id")];
const subscriptionPaymentValidation = [
  ...subscriptionIdValidation,
  body("paymentId").isMongoId().withMessage("Payment reference is invalid"),
  body("razorpay_order_id").optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay order is invalid"),
  body("razorpay_payment_id").optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage("Razorpay payment is invalid"),
  body("razorpay_signature").optional().isString().trim().isLength({ min: 32, max: 200 }).withMessage("Razorpay signature is invalid"),
  body("testSuccess").optional().isBoolean().withMessage("Test payment status is invalid"),
];

router.use(authMiddleware, requireSuperAdmin);
router.get("/dashboard/stats", dashboardStats);

// Restaurants
router.get("/restaurants", [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 }), query("status").optional().isIn(["active", "suspended"]), query("q").optional().isString().trim().isLength({ max: 120 })], validate, restaurantsCtrl.listRestaurants);
router.post("/restaurants", restaurantCreateValidation, validate, restaurantsCtrl.createRestaurant);
router.get("/restaurants/:id", [param("id").isMongoId().withMessage("Invalid restaurant id")], validate, restaurantsCtrl.getRestaurant);
router.put("/restaurants/:id", restaurantUpdateValidation, validate, restaurantsCtrl.updateRestaurant);
router.patch("/restaurants/:id/status", [param("id").isMongoId().withMessage("Invalid restaurant id"), body("status").isIn(["active", "suspended"]).withMessage("Status is invalid")], validate, restaurantsCtrl.updateStatus);

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
router.post("/subscriptions", [body("restaurantId").isMongoId().withMessage("Invalid restaurant id"), body("planName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid"), body("status").optional().isIn(["trial", "active"]).withMessage("Status is invalid")], validate, subscriptionsCtrl.createSubscription);
router.get("/subscriptions/:id", subscriptionIdValidation, validate, subscriptionsCtrl.getSubscription);
router.put("/subscriptions/:id", [...subscriptionIdValidation, body("planName").optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid"), body("price").optional().isFloat({ min: 0 }).withMessage("Price is invalid"), body("billingCycle").optional().isString().trim().isLength({ min: 1, max: 40 }).withMessage("Billing cycle is invalid"), body("metadata").optional().isObject().withMessage("Metadata is invalid")], validate, subscriptionsCtrl.updateSubscription);
router.post("/subscriptions/:id/extend-trial", [...subscriptionIdValidation, body("days").isInt({ min: 1, max: 90 }).withMessage("Days must be between 1 and 90"), body("confirm").custom((value) => value === true).withMessage("Confirmation is required")], validate, subscriptionsCtrl.extendTrial);
router.post("/subscriptions/:id/convert", [...subscriptionIdValidation, body("planName").optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid"), body("planId").optional().isMongoId().withMessage("Plan selection is invalid")], validate, subscriptionsCtrl.convertToPaid);
router.post("/subscriptions/:id/checkout", paymentLimiter, subscriptionIdValidation, validate, subscriptionsCtrl.createSubscriptionPaymentCheckout);
router.post("/subscriptions/:id/verify-payment", paymentLimiter, subscriptionPaymentValidation, validate, subscriptionsCtrl.verifySubscriptionPayment);
router.post("/subscriptions/:id/suspend", [...subscriptionIdValidation, body("confirm").custom((value) => value === true).withMessage("Confirmation is required")], validate, subscriptionsCtrl.suspendSubscription);
router.post("/subscriptions/:id/cancel", [...subscriptionIdValidation, body("confirm").custom((value) => value === true).withMessage("Confirmation is required")], validate, subscriptionsCtrl.cancelSubscription);
router.post("/subscriptions/:id/activate", [...subscriptionIdValidation, body("confirm").custom((value) => value === true).withMessage("Confirmation is required"), body("planName").optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage("Plan selection is invalid")], validate, subscriptionsCtrl.activateSubscription);

// Activity logs
router.get("/activity-logs", activityCtrl.listActivityLogs);

// SaaS subscription payments (Razorpay)
router.get("/payments", paymentsCtrl.listSaasPayments);
router.get("/payments/summary", paymentsCtrl.getSaasPaymentSummary);
router.get("/payments/:id/pdf", [param("id").isMongoId().withMessage("Invalid payment id")], validate, paymentsCtrl.downloadSaasPaymentPdf);
router.get("/payments/:id", [param("id").isMongoId().withMessage("Invalid payment id")], validate, paymentsCtrl.getSaasPaymentById);
router.delete("/payments/:id", [param("id").isMongoId().withMessage("Invalid payment id")], validate, paymentsCtrl.deleteSaasPayment);

// Cashfree Easy Split commercial controls. The router itself is guarded by
// requireSuperAdmin, so a restaurant admin cannot alter another tenant's fee.
router.get("/settlements/commission", settlementsCtrl.getCommissionConfig);
router.put("/settlements/commission/:restaurantId", [param("restaurantId").isMongoId().withMessage("Invalid restaurant id"), body("commissionType").optional().isIn(["NONE", "PERCENTAGE", "FIXED"]).withMessage("Commission type is invalid"), body("commissionPercentage").optional().isFloat({ min: 0, max: 100 }).withMessage("Commission percentage is invalid"), body("fixedAmount").optional().isFloat({ min: 0 }).withMessage("Fixed commission amount is invalid")], validate, settlementsCtrl.updateCommissionConfig);
router.get("/settlements/transactions", settlementsCtrl.listSettlementTransactions);
router.post("/settlements/transactions/:id/refresh", settlementRefreshLimiter, [param("id").isMongoId()], validate, settlementsCtrl.refreshSettlementTransaction);

export default router;
