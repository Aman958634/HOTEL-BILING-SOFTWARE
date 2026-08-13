import { Router } from "express";
import { dashboardStats } from "../controllers/analyticsController.js";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";

const router = Router();

router.get("/dashboard", protect, requireActiveSubscription, authorize("admin", "manager", "chef", "waiter", "cashier"), dashboardStats);

export default router;
