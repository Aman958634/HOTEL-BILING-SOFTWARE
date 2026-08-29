import { Router } from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  closeCashReconciliation,
  getCashPreview,
  getReconciliationSummary,
  listCashReconciliations,
  listReconciliationBills,
  listRefunds,
  reconcilePayment,
} from "../controllers/reconciliationController.js";

const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })];
const dates = [query("dateFrom").optional().isISO8601(), query("dateTo").optional().isISO8601()];
const router = Router();

router.use(authMiddleware, requireActiveSubscription, requireRole("admin", "manager", "cashier"));
router.get("/summary", getReconciliationSummary);
router.get("/bills", [...pagination, ...dates, query("status").optional().isIn(["OPEN", "PARTIALLY_PAID", "PAID", "REFUNDED"]), query("reconciliationStatus").optional().isIn(["MATCHED", "UNDERPAID", "OVERPAID"])], validate, listReconciliationBills);
router.get("/refunds", [...pagination, ...dates, query("status").optional().isIn(["PENDING", "COMPLETED", "FAILED"]), query("paymentId").optional().isMongoId()], validate, listRefunds);
router.patch("/payments/:id/reconcile", requireRole("admin", "manager"), [param("id").isMongoId(), body("note").optional().isString().trim().isLength({ max: 1000 })], validate, reconcilePayment);
router.get("/cash/preview", getCashPreview);
router.post("/cash/close", [body("countedCash").isFloat({ min: 0 }), body("note").optional().isString().trim().isLength({ max: 1000 })], validate, closeCashReconciliation);
router.get("/cash", [...pagination, ...dates], validate, listCashReconciliations);

export default router;
