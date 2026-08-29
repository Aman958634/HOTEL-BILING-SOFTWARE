import { Router } from "express";
import { dashboardStats } from "../controllers/analyticsController.js";
import { getBusinessIntelligence } from "../controllers/businessIntelligenceController.js";
import { askIntelligence, getIntelligenceSummary, listIntelligenceInsights, refreshIntelligence, updateInsightStatus } from "../controllers/intelligenceController.js";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { intelligenceLimiter } from "../middleware/rateLimiter.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/dashboard", protect, requireActiveSubscription, authorize("admin", "manager", "chef", "waiter", "cashier"), dashboardStats);
router.get("/business-intelligence/overview", protect, requireActiveSubscription, authorize("admin", "manager", "cashier"), getBusinessIntelligence);
router.get("/intelligence/summary", protect, requireActiveSubscription, authorize("admin", "manager"), getIntelligenceSummary);
router.post("/intelligence/refresh", protect, requireActiveSubscription, authorize("admin", "manager"), intelligenceLimiter, [body("range").optional().isIn(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]), body("startDate").optional().isISO8601(), body("endDate").optional().isISO8601()], validate, refreshIntelligence);
router.get("/intelligence/insights", protect, requireActiveSubscription, authorize("admin", "manager"), [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 }), query("status").optional().isIn(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"])], validate, listIntelligenceInsights);
router.patch("/intelligence/insights/:id/status", protect, requireActiveSubscription, authorize("admin", "manager"), [param("id").isMongoId(), body("status").isIn(["ACKNOWLEDGED", "RESOLVED"])], validate, updateInsightStatus);
router.post("/intelligence/ask", protect, requireActiveSubscription, authorize("admin", "manager"), intelligenceLimiter, [body("question").isString().trim().isLength({ min: 2, max: 300 }), body("range").optional().isIn(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]), body("startDate").optional().isISO8601(), body("endDate").optional().isISO8601()], validate, askIntelligence);

export default router;
