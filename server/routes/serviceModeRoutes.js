import { Router } from "express";
import { param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { getServiceSummary, getServiceTable, getServiceMenu } from "../controllers/serviceModeController.js";

const router = Router();
router.use(authMiddleware, requireActiveSubscription, requireRole("admin", "manager", "cashier", "waiter"));
router.get("/summary", getServiceSummary);
router.get("/menu", getServiceMenu);
router.get("/tables/:id", [param("id").isMongoId()], validate, getServiceTable);
export default router;
