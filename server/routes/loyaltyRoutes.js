import { Router } from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { adjustPoints, createReward, enrollCustomer, getCustomerAccount, getSettings, listAccounts, listRewards, listTransactions, redeemPoints, saveSettings, updateReward } from "../controllers/loyaltyController.js";

const router = Router();
router.use(authMiddleware, requireActiveSubscription);
router.use(requireRole("admin", "manager", "cashier"));
const paging = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })];
const orderTypes = ["DINE_IN", "TAKEAWAY", "DELIVERY", "PICKUP"];

router.get("/settings", getSettings);
router.put("/settings", requireRole("admin", "manager"), [body("enabled").optional().isBoolean(), body("spendPerPoint").optional().isFloat({ gt: 0 }), body("minimumOrderAmount").optional().isFloat({ min: 0 }), body("pointValue").optional().isFloat({ gt: 0 }), body("minimumRedemptionPoints").optional().isInt({ min: 1 }), body("maxRedemptionPercent").optional().isFloat({ min: 0, max: 100 }), body("eligibleOrderTypes").optional().isArray(), body("eligibleOrderTypes.*").optional().isIn(orderTypes), body("expiryMonths").optional().isInt({ min: 0, max: 120 })], validate, saveSettings);
router.get("/accounts", paging, validate, listAccounts);
router.get("/accounts/:customerId", [param("customerId").isMongoId()], validate, getCustomerAccount);
router.post("/accounts/:customerId/enroll", requireRole("admin", "manager"), [param("customerId").isMongoId()], validate, enrollCustomer);
router.get("/transactions", [...paging, query("type").optional().isIn(["EARN", "REDEEM", "ADJUSTMENT", "EXPIRY", "REVERSAL"]), query("customerId").optional().isMongoId(), query("dateFrom").optional().isISO8601(), query("dateTo").optional().isISO8601()], validate, listTransactions);
router.post("/adjustments", requireRole("admin", "manager"), [body("accountId").isMongoId(), body("points").isInt({ min: -100000, max: 100000 }).not().equals(0), body("reason").trim().isLength({ min: 1, max: 500 })], validate, adjustPoints);
router.post("/redeem", [body("orderId").isMongoId(), body("customerId").isMongoId(), body("points").optional().isInt({ min: 1 }), body("rewardId").optional().isMongoId()], validate, redeemPoints);
router.get("/rewards", listRewards);
router.post("/rewards", requireRole("admin", "manager"), [body("name").trim().isLength({ min: 1, max: 120 }), body("type").isIn(["DISCOUNT_AMOUNT", "DISCOUNT_PERCENT"]), body("pointsRequired").isInt({ min: 1 }), body("value").isFloat({ gt: 0 }), body("eligibleOrderTypes").optional().isArray(), body("eligibleOrderTypes.*").optional().isIn(orderTypes)], validate, createReward);
router.patch("/rewards/:id", requireRole("admin", "manager"), [param("id").isMongoId(), body("name").optional().trim().isLength({ min: 1, max: 120 }), body("type").optional().isIn(["DISCOUNT_AMOUNT", "DISCOUNT_PERCENT"]), body("pointsRequired").optional().isInt({ min: 1 }), body("value").optional().isFloat({ gt: 0 })], validate, updateReward);

export default router;
