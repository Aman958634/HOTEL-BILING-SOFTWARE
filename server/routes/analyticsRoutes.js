import { Router } from "express";
import { dashboardStats } from "../controllers/analyticsController.js";
import { getBusinessIntelligence } from "../controllers/businessIntelligenceController.js";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";

const router = Router();

router.get("/dashboard", protect, requireActiveSubscription, authorize("admin", "manager", "chef", "waiter", "cashier"), dashboardStats);
router.get("/business-intelligence/overview", protect, requireActiveSubscription, authorize("admin", "manager", "cashier"), getBusinessIntelligence);

export default router;
