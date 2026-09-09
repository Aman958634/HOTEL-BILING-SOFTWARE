import { Router } from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createSettlementVendor, getSettlementProfile, refreshSettlementVendor } from "../controllers/settlementController.js";

const router = Router();
router.use(authMiddleware, requireActiveSubscription);
router.get("/", requirePermission("settlements.view"), getSettlementProfile);
router.post("/cashfree/vendor", requirePermission("settlements.manage"), [
  body("method").isIn(["BANK", "UPI"]),
  body("email").isEmail(),
  body("phone").isLength({ min: 7, max: 20 }),
  body("accountType").isString().isLength({ min: 3, max: 80 }),
  body("pan").isString().matches(/^[A-Za-z]{5}\d{4}[A-Za-z]$/),
  body("accountNumber").optional().isString().isLength({ min: 4, max: 34 }),
  body("confirmAccountNumber").optional().isString(),
  body("ifsc").optional().isString().isLength({ min: 4, max: 20 }),
  body("upiVpa").optional().isString().isLength({ min: 3, max: 200 }),
], validate, createSettlementVendor);
router.post("/cashfree/vendor/refresh", requirePermission("settlements.manage"), refreshSettlementVendor);
export default router;
