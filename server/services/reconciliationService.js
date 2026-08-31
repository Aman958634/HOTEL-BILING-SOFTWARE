import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Refund from "../models/Refund.js";
import CashReconciliation from "../models/CashReconciliation.js";
import Staff from "../models/Staff.js";
import ApiError from "../utils/ApiError.js";
import { createActivity } from "./activityService.js";
import { reversePointsForFullRefund } from "./loyaltyService.js";
import { emitPaymentRefunded, emitPaymentUpdated } from "../socket/paymentSocket.js";
import { NOTIFICATION_EVENTS, publishBusinessEvent } from "./notificationService.js";
import { deriveOrderPaymentState } from "./paymentService.js";

const paise = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100);
const money = (value) => Number((Math.round(value) / 100).toFixed(2));
const validPayment = { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] };

export const deriveBillReconciliation = async (bill) => {
  const payments = await Payment.find({ bill: bill._id }).select("amount totalAmount refundAmount paymentStatus").lean();
  const received = payments.filter((item) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(item.paymentStatus)).reduce((sum, item) => sum + Math.max(paise(item.amount || item.totalAmount) - paise(item.refundAmount), 0), 0);
  const expected = paise(bill.total); const difference = received - expected;
  return { expectedAmount: money(expected), receivedAmount: money(received), difference: money(difference), reconciliationStatus: difference === 0 ? "MATCHED" : difference < 0 ? "UNDERPAID" : "OVERPAID" };
};

export const refundRecordedPayment = async ({ paymentId, restaurantId, amount, reason, initiatedBy, idempotencyKey }) => {
  if (!idempotencyKey) throw new ApiError(422, "Idempotency-Key is required for refunds");
  if (!String(reason || "").trim()) throw new ApiError(422, "Refund reason is required");
  const requested = paise(amount); if (requested <= 0) throw new ApiError(422, "Refund amount must be greater than zero");
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const prior = await Refund.findOne({ payment: paymentId, idempotencyKey }).session(session);
      if (prior) { result = { refund: prior, payment: await Payment.findById(paymentId).session(session), idempotent: true }; return; }
      const payment = await Payment.findOne({ _id: paymentId, restaurant: restaurantId }).session(session);
      if (!payment) throw new ApiError(404, "Payment not found");
      if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.paymentStatus)) throw new ApiError(409, "Only successful payments can be refunded");
      // A manual status update must never pretend a card/UPI/gateway refund was
      // completed. Gateway refunds need a verified provider response before they
      // are recorded as completed in the ledger.
      if (payment.paymentMethod !== "CASH") throw new ApiError(409, "Digital refunds must be completed through the verified payment provider");
      const remaining = paise(payment.amount || payment.totalAmount) - paise(payment.refundAmount);
      if (requested > remaining) throw new ApiError(422, "Refund amount exceeds the remaining refundable amount");
      const totalRefunded = paise(payment.refundAmount) + requested; const fullyRefunded = totalRefunded === paise(payment.amount || payment.totalAmount);
      payment.refundAmount = money(totalRefunded); payment.refundReason = String(reason).trim(); payment.refundStatus = fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED"; payment.refundedAt = new Date(); payment.refundedBy = initiatedBy; payment.paymentStatus = payment.refundStatus; payment.reconciliationStatus = fullyRefunded ? "REFUND_PENDING" : "UNRECONCILED";
      payment.timeline.push({ status: fullyRefunded ? "REFUND_COMPLETED" : "PARTIAL_REFUND_COMPLETED", timestamp: new Date(), note: payment.refundReason });
      await payment.save({ session });
      const [refund] = await Refund.create([{ payment: payment._id, bill: payment.bill || null, restaurant: payment.restaurant, amount: money(requested), reason: payment.refundReason, status: "COMPLETED", method: payment.paymentMethod, idempotencyKey, initiatedBy, processedAt: new Date() }], { session });
      if (payment.bill) {
        const bill = await Bill.findById(payment.bill).session(session);
        if (bill) {
          const rows = await Payment.find({ bill: bill._id, paymentStatus: validPayment }).session(session).select("amount totalAmount refundAmount").lean();
          const paid = rows.reduce((sum, row) => sum + Math.max(paise(row.amount || row.totalAmount) - paise(row.refundAmount), 0), 0);
          bill.paidAmount = money(paid); bill.balanceDue = money(Math.max(paise(bill.total) - paid, 0)); bill.status = bill.balanceDue === 0 ? "PAID" : bill.paidAmount > 0 ? "PARTIALLY_PAID" : "OPEN"; await bill.save({ session });
          const { syncBillOrderPaymentMirrors } = await import("./billService.js");
          await syncBillOrderPaymentMirrors(bill, session);
        }
      }
      if (payment.orderId) {
        const order = await Order.findById(payment.orderId).session(session);
        if (order) {
          const settlement = await deriveOrderPaymentState(order, session);
          order.paymentStatus = settlement.paymentStatus;
          order.paidAt = settlement.fullyPaid ? order.paidAt || new Date() : null;
          await order.save({ session });
        }
      }
      result = { refund, payment, idempotent: false };
    });
  } catch (error) {
    if (error?.code === 11000) { const prior = await Refund.findOne({ payment: paymentId, idempotencyKey }); if (prior) return { refund: prior, payment: await Payment.findById(paymentId), idempotent: true }; }
    if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Refunds require MongoDB replica-set transactions.");
    throw error;
  } finally { await session.endSession(); }
  if (!result.idempotent && result.payment.orderId && result.payment.paymentStatus === "REFUNDED") await reversePointsForFullRefund({ order: result.payment.orderId, payment: result.payment });
  await createActivity({ action: "Refund Completed", description: `Refund ${result.refund._id} recorded`, performedBy: initiatedBy, restaurantId, targetId: result.refund._id, targetType: "Refund" });
  if (!result.idempotent) {
    const payload = { amount: result.refund.amount, paymentNumber: result.payment.paymentId };
    await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.REFUND_CREATED, restaurantId, entityType: "Refund", entityId: result.refund._id, actorUserId: initiatedBy, payload });
    await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.REFUND_COMPLETED, restaurantId, entityType: "Refund", entityId: result.refund._id, actorUserId: initiatedBy, payload });
  }
  if (!result.idempotent) emitPaymentRefunded(result.payment.toObject ? result.payment.toObject() : result.payment);
  return result;
};

export const reconcileBillPayment = async ({ payment, user, note }) => {
  if (payment.paymentStatus !== "PAID") throw new ApiError(409, "Only successful, non-refunded payments can be reconciled");
  if (!payment.bill) throw new ApiError(422, "This payment is not linked to a consolidated bill");
  const bill = await Bill.findById(payment.bill); if (!bill) throw new ApiError(404, "Bill not found");
  const derived = await deriveBillReconciliation(bill);
  if (derived.reconciliationStatus !== "MATCHED") throw new ApiError(409, "Only matched payments can be reconciled");
  payment.reconciliationStatus = "RECONCILED"; payment.reconciledAt = new Date(); payment.reconciledBy = user._id; payment.reconciliationNote = String(note || "").trim(); await payment.save();
  await createActivity({ action: "Payment Reconciled", description: `Payment ${payment.paymentId} reconciled`, performedBy: user._id, restaurantId: payment.restaurant, targetId: payment._id, targetType: "Payment" });
  emitPaymentUpdated(payment.toObject ? payment.toObject() : payment);
  return payment;
};

export const reconcileCash = async ({ restaurantId, cashier, countedCash, note, reconciledBy }) => {
  const staff = await Staff.findOne({ user: cashier, restaurant: restaurantId }).select("_id shiftStartedAt").lean(); const startedAt = staff?.shiftStartedAt || new Date(new Date().setHours(0, 0, 0, 0));
  const rows = await Payment.find({ restaurant: restaurantId, receivedBy: cashier, paymentMethod: "CASH", paymentStatus: validPayment, createdAt: { $gte: startedAt } }).select("amount totalAmount refundAmount").lean();
  const expected = rows.reduce((sum, row) => sum + Math.max(paise(row.amount || row.totalAmount) - paise(row.refundAmount), 0), 0); const counted = paise(countedCash); const difference = counted - expected;
  if (difference !== 0 && !String(note || "").trim()) throw new ApiError(422, "A note is required for a cash variance");
  const record = await CashReconciliation.create({ restaurant: restaurantId, cashier, staff: staff?._id || null, startedAt, closedAt: new Date(), expectedCash: money(expected), countedCash: money(counted), difference: money(difference), note: String(note || "").trim(), status: difference === 0 ? "MATCHED" : "MISMATCHED", reconciledBy });
  if (record.status === "MISMATCHED") await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.RECONCILIATION_MISMATCH, restaurantId, entityType: "CashReconciliation", entityId: record._id, actorUserId: reconciledBy, payload: { reference: "Cash reconciliation" } });
  await createActivity({ action: "Cash Reconciled", description: `Cash reconciliation ${record.status}`, performedBy: reconciledBy, restaurantId, targetId: record._id, targetType: "CashReconciliation" }); return record;
};

export const previewCashReconciliation = async ({ restaurantId, cashier }) => {
  const staff = await Staff.findOne({ user: cashier, restaurant: restaurantId }).select("_id shiftStartedAt").lean();
  const startedAt = staff?.shiftStartedAt || new Date(new Date().setHours(0, 0, 0, 0));
  const rows = await Payment.find({ restaurant: restaurantId, receivedBy: cashier, paymentMethod: "CASH", paymentStatus: validPayment, createdAt: { $gte: startedAt } }).select("amount totalAmount refundAmount").lean();
  const expected = rows.reduce((sum, row) => sum + Math.max(paise(row.amount || row.totalAmount) - paise(row.refundAmount), 0), 0);
  return { startedAt, expectedCash: money(expected), paymentCount: rows.length, staffId: staff?._id || null };
};
