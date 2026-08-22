import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import { search } from "../controllers/searchController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription);

router.get("/", validate, search);

export default router;
