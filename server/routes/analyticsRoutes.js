import { Router } from "express";
import { dashboardStats } from "../controllers/analyticsController.js";
import { getBusinessIntelligence } from "../controllers/businessIntelligenceController.js";
import { askIntelligence, getIntelligenceSummary, listIntelligenceInsights, refreshIntelligence, updateInsightStatus } from "../controllers/intelligenceController.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { intelligenceLimiter } from "../middleware/rateLimiter.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/dashboard", protect, requireActiveSubscription, requirePermission("reports.view_basic"), dashboardStats);
router.get("/business-intelligence/overview", protect, requireActiveSubscription, requirePermission("reports.view_full"), getBusinessIntelligence);
router.get("/intelligence/summary", protect, requireActiveSubscription, requirePermission("reports.view_full"), getIntelligenceSummary);
router.post("/intelligence/refresh", protect, requireActiveSubscription, requirePermission("reports.view_full"), intelligenceLimiter, [body("range").optional().isIn(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]), body("startDate").optional().isISO8601(), body("endDate").optional().isISO8601()], validate, refreshIntelligence);
router.get("/intelligence/insights", protect, requireActiveSubscription, requirePermission("reports.view_full"), [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 }), query("status").optional().isIn(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"])], validate, listIntelligenceInsights);
router.patch("/intelligence/insights/:id/status", protect, requireActiveSubscription, requirePermission("reports.view_full"), [param("id").isMongoId(), body("status").isIn(["ACKNOWLEDGED", "RESOLVED"])], validate, updateInsightStatus);
router.post("/intelligence/ask", protect, requireActiveSubscription, requirePermission("reports.view_full"), intelligenceLimiter, [body("question").isString().trim().isLength({ min: 2, max: 300 }), body("range").optional().isIn(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]), body("startDate").optional().isISO8601(), body("endDate").optional().isISO8601()], validate, askIntelligence);

export default router;
