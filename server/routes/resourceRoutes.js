import { Router } from "express";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { createOne, deleteOne, findAll, findOne, updateOne } from "../controllers/resourceController.js";

const router = Router();

// This legacy generic API can address multiple models and accepts model-shaped
// JSON. It is intentionally platform-admin-only; restaurant roles use the
// dedicated, field-allowlisted APIs for operational records.
router.use(protect, requireActiveSubscription, authorize("super_admin"));
router.get("/:resource", findAll);
router.get("/:resource/:id", findOne);
router.post("/:resource", createOne);
router.put("/:resource/:id", updateOne);
router.patch("/:resource/:id", updateOne);
router.delete("/:resource/:id", deleteOne);

export default router;
