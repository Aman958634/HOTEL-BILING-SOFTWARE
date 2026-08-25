import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { getOverview } from "../controllers/serviceCockpitController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription, requireRole("admin", "manager", "cashier", "waiter", "chef"));

router.get("/", getOverview);

export default router;
