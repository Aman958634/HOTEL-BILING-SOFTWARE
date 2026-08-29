import { Router } from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import { addBillPayment, cancelBill, createBill, downloadBillReceipt, getBill, listBills, listEligibleOrders, splitBillByOrders } from "../controllers/billController.js";

const router = Router();
router.use(authMiddleware, requireActiveSubscription, requireRole("admin", "manager", "cashier"));
router.get("/eligible-orders", [query("tableId").optional().isMongoId()], validate, listEligibleOrders);
router.get("/", [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 }), query("status").optional().isIn(["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED", "REFUNDED"]), query("tableId").optional().isMongoId(), query("search").optional().isString()], validate, listBills);
router.post("/", [body("orderIds").isArray({ min: 1, max: 50 }), body("orderIds.*").isMongoId()], validate, createBill);
router.get("/:id", [param("id").isMongoId()], validate, getBill);
router.get("/:id/receipt", [param("id").isMongoId()], validate, downloadBillReceipt);
router.post("/:id/payments", [param("id").isMongoId(), body("amount").isFloat({ gt: 0 }), body("paymentMethod").isIn(["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "NET_BANKING", "WALLET", "RAZORPAY", "OTHER"]), body("transactionId").optional().isString().trim().isLength({ max: 200 })], validate, addBillPayment);
router.post("/:id/split-by-orders", requireRole("admin", "manager", "cashier"), [param("id").isMongoId(), body("groups").isArray({ min: 2 }), body("groups.*").isArray({ min: 1 }), body("groups.*.*").isMongoId()], validate, splitBillByOrders);
router.patch("/:id/cancel", requireRole("admin", "manager"), [param("id").isMongoId(), body("reason").optional().isString().trim().isLength({ max: 500 })], validate, cancelBill);
export default router;
