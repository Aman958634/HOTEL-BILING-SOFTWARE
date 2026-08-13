import { Router } from "express";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { createOne, deleteOne, findAll, findOne, updateOne } from "../controllers/resourceController.js";

const router = Router();

router.get("/:resource", protect, requireActiveSubscription, findAll);
router.get("/:resource/:id", protect, requireActiveSubscription, findOne);
router.post("/:resource", protect, requireActiveSubscription, authorize("admin", "manager"), createOne);
router.put("/:resource/:id", protect, requireActiveSubscription, authorize("admin", "manager"), updateOne);
router.patch("/:resource/:id", protect, requireActiveSubscription, authorize("admin", "manager"), updateOne);
router.delete("/:resource/:id", protect, requireActiveSubscription, authorize("admin", "manager"), deleteOne);

export default router;
