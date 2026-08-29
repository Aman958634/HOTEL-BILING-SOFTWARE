import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";
import { formatPaymentId } from "../utils/paymentId.js";
import { normalizePaymentMethod, paymentMethodLabel } from "../utils/paymentUtils.js";
import { serializePayment } from "./paymentService.js";

const OPEN_STATUSES = ["OPEN", "PARTIALLY_PAID"];
const MONEY_FACTOR = 100;
const toPaise = (value) => Math.round((Number(value || 0) + Number.EPSILON) * MONEY_FACTOR);
const fromPaise = (value) => Number((Math.round(value) / MONEY_FACTOR).toFixed(2));
const id = (value) => value?._id || value;

const nextBillNumber = async (session) => {
  const sequence = await Sequence.findOneAndUpdate({ key: "restaurant-bill-number" }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `BILL-${String(sequence.value).padStart(6, "0")}`;
};
const nextPaymentNumber = async (session) => {
  const sequence = await Sequence.findOneAndUpdate({ key: "paymentId" }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return formatPaymentId(sequence.value);
};

const buildSnapshot = (orders) => {
  const totals = orders.reduce((sum, order) => ({
    subtotal: sum.subtotal + toPaise(order.subtotal), discount: sum.discount + toPaise(order.discount), loyaltyDiscount: sum.loyaltyDiscount + toPaise(order.loyaltyDiscount), taxableAmount: sum.taxableAmount + toPaise(order.taxableAmount), tax: sum.tax + toPaise(order.tax), serviceCharge: sum.serviceCharge + toPaise(order.serviceCharge), deliveryCharge: sum.deliveryCharge + toPaise(order.deliveryCharge), total: sum.total + toPaise(order.total),
  }), { subtotal: 0, discount: 0, loyaltyDiscount: 0, taxableAmount: 0, tax: 0, serviceCharge: 0, deliveryCharge: 0, total: 0 });
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, fromPaise(value)]));
};
const allocationFromOrder = (order) => ({ order: order._id, orderNumber: order.orderNumber, subtotal: Number(order.subtotal || 0), discount: Number(order.discount || 0), loyaltyDiscount: Number(order.loyaltyDiscount || 0), tax: Number(order.tax || 0), serviceCharge: Number(order.serviceCharge || 0), deliveryCharge: Number(order.deliveryCharge || 0), total: Number(order.total || 0) });

const activeBillForOrders = (orderIds, session) => Bill.findOne({ "allocations.order": { $in: orderIds }, status: { $in: OPEN_STATUSES } }).session(session);

export const createConsolidatedBill = async ({ orderIds, restaurantId, user, idempotencyKey = "" }) => {
  const uniqueOrderIds = [...new Set((orderIds || []).map(String))];
  if (!uniqueOrderIds.length) throw new ApiError(422, "Select at least one order");
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      if (idempotencyKey) {
        const existing = await Bill.findOne({ restaurant: restaurantId, idempotencyKey }).session(session);
        if (existing) { result = { bill: existing, idempotent: true }; return; }
      }
      const orders = await Order.find({ _id: { $in: uniqueOrderIds }, restaurant: restaurantId, isArchived: { $ne: true }, status: { $nin: ["CANCELLED", "REJECTED"] } }).session(session);
      if (orders.length !== uniqueOrderIds.length) throw new ApiError(404, "One or more eligible orders were not found");
      const tableIds = [...new Set(orders.map((order) => String(order.table || "")))].filter(Boolean);
      if (tableIds.length > 1) throw new ApiError(422, "Consolidated orders must belong to the same table/session");
      const existing = await activeBillForOrders(orders.map((order) => order._id), session);
      if (existing) throw new ApiError(409, "One or more orders already belong to an open bill");
      const snapshot = buildSnapshot(orders);
      const bill = new Bill({ billNumber: await nextBillNumber(session), restaurant: restaurantId, table: orders[0].table || null, customer: orders.find((order) => order.customer)?.customer || null, allocations: orders.map(allocationFromOrder), ...snapshot, paidAmount: 0, balanceDue: snapshot.total, status: "OPEN", idempotencyKey, createdBy: user._id });
      await bill.save({ session });
      const claimed = await Order.updateMany({ _id: { $in: orders.map((order) => order._id) }, $or: [{ billingBill: null }, { billingBill: { $exists: false } }] }, { $set: { billingBill: bill._id, billingState: "BILLED" } }, { session });
      if (claimed.modifiedCount !== orders.length) throw new ApiError(409, "One or more orders were billed concurrently");
      result = { bill, idempotent: false };
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) { const existing = await Bill.findOne({ restaurant: restaurantId, idempotencyKey }); if (existing) return { bill: existing, idempotent: true }; }
    if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Bill generation requires MongoDB replica-set transactions.");
    throw error;
  } finally { await session.endSession(); }
  return result;
};

export const recordBillPayment = async ({ billId, restaurantId, amount, paymentMethod, transactionId = "", idempotencyKey, receivedBy }) => {
  const requested = toPaise(amount);
  if (!idempotencyKey) throw new ApiError(422, "Idempotency-Key is required for bill settlement");
  if (requested <= 0) throw new ApiError(422, "Payment amount must be greater than zero");
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const prior = await Payment.findOne({ bill: billId, idempotencyKey }).session(session);
      if (prior) { result = { payment: prior, bill: await Bill.findById(billId).session(session), idempotent: true }; return; }
      const bill = await Bill.findOne({ _id: billId, restaurant: restaurantId }).session(session);
      if (!bill) throw new ApiError(404, "Bill not found");
      if (!OPEN_STATUSES.includes(bill.status)) throw new ApiError(409, "This bill is not open for settlement");
      const due = toPaise(bill.balanceDue);
      if (requested > due) throw new ApiError(422, "Payment amount exceeds the remaining balance");
      const now = new Date();
      const payment = new Payment({ paymentId: await nextPaymentNumber(session), bill: bill._id, orderId: null, customerId: bill.customer || null, tableId: bill.table || null, restaurant: bill.restaurant, amount: fromPaise(requested), totalAmount: fromPaise(requested), currency: "INR", subtotal: 0, tax: 0, discount: 0, serviceCharge: 0, paymentMethod: normalizePaymentMethod(paymentMethod), paymentStatus: "PAID", transactionId: transactionId || `BILL-${bill.billNumber}-${idempotencyKey}`, idempotencyKey, paidAt: now, receivedBy, metadata: { billNumber: bill.billNumber, consolidatedBill: true }, timeline: [{ status: "PAYMENT_SUCCESSFUL", timestamp: now, note: `Settlement for ${bill.billNumber}` }] });
      await payment.save({ session });
      const paidAmount = fromPaise(toPaise(bill.paidAmount) + requested); const balanceDue = fromPaise(Math.max(toPaise(bill.total) - toPaise(paidAmount), 0));
      bill.paidAmount = paidAmount; bill.balanceDue = balanceDue; bill.status = balanceDue === 0 ? "PAID" : "PARTIALLY_PAID";
      if (balanceDue === 0) { bill.settledBy = receivedBy; bill.settledAt = now; await Order.updateMany({ billingBill: bill._id }, { $set: { billingState: "SETTLED" } }, { session }); }
      await bill.save({ session }); result = { payment, bill, idempotent: false };
    });
  } catch (error) {
    if (error?.code === 11000) { const prior = await Payment.findOne({ bill: billId, idempotencyKey }); if (prior) return { payment: prior, bill: await Bill.findById(billId), idempotent: true }; }
    if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Bill settlement requires MongoDB replica-set transactions.");
    throw error;
  } finally { await session.endSession(); }
  if (result.bill.status === "PAID" && result.bill.table) {
    const { maybeReleaseTableAfterSettlement } = await import("./tableOrderService.js");
    await maybeReleaseTableAfterSettlement({ table: result.bill.table });
  }
  return result;
};

export const cancelOpenBill = async ({ bill, user, reason }) => {
  if (!OPEN_STATUSES.includes(bill.status) || Number(bill.paidAmount || 0) > 0) throw new ApiError(409, "Only unpaid bills can be cancelled");
  bill.status = "CANCELLED"; bill.cancelledBy = user._id; bill.cancelledAt = new Date(); bill.cancellationReason = String(reason || "").trim();
  await bill.save(); await Order.updateMany({ billingBill: bill._id }, { $set: { billingBill: null, billingState: "" } }); return bill;
};

export const splitOpenBillByOrders = async ({ billId, restaurantId, groups, user }) => {
  if (!Array.isArray(groups) || groups.length < 2) throw new ApiError(422, "Provide at least two order groups");
  const session = await mongoose.startSession(); let children = [];
  try {
    await session.withTransaction(async () => {
      const bill = await Bill.findOne({ _id: billId, restaurant: restaurantId }).session(session);
      if (!bill) throw new ApiError(404, "Bill not found");
      if (bill.status !== "OPEN" || Number(bill.paidAmount || 0) > 0) throw new ApiError(409, "Only unpaid open bills can be split");
      const original = new Map(bill.allocations.map((row) => [String(row.order), row])); const consumed = new Set();
      for (const group of groups) {
        if (!Array.isArray(group) || !group.length) throw new ApiError(422, "Each split group requires at least one order");
        group.forEach((orderId) => { if (!original.has(String(orderId)) || consumed.has(String(orderId))) throw new ApiError(422, "Split orders must belong to the original bill exactly once"); consumed.add(String(orderId)); });
      }
      if (consumed.size !== original.size) throw new ApiError(422, "Every original order must be assigned to exactly one split bill");
      bill.status = "CANCELLED"; bill.cancelledBy = user._id; bill.cancelledAt = new Date(); bill.cancellationReason = "Split by orders"; await bill.save({ session });
      children = [];
      for (const group of groups) {
        const allocations = group.map((orderId) => original.get(String(orderId))); const snapshot = buildSnapshot(allocations);
        const child = new Bill({ billNumber: await nextBillNumber(session), restaurant: bill.restaurant, table: bill.table, customer: bill.customer, allocations, ...snapshot, paidAmount: 0, balanceDue: snapshot.total, status: "OPEN", createdBy: user._id, parentBill: bill._id });
        await child.save({ session }); await Order.updateMany({ _id: { $in: allocations.map((row) => row.order) }, billingBill: bill._id }, { $set: { billingBill: child._id, billingState: "BILLED" } }, { session }); children.push(child);
      }
    });
  } catch (error) { if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Bill splitting requires MongoDB replica-set transactions."); throw error; } finally { await session.endSession(); }
  return children;
};

export const buildBillReceiptBuffer = async (bill) => {
  const populated = bill?.populate ? await bill.populate([{ path: "restaurant", select: "name address phone email" }, { path: "table", select: "tableNumber" }]) : await Bill.findById(bill).populate("restaurant", "name address phone email").populate("table", "tableNumber");
  if (!populated) throw new ApiError(404, "Bill not found"); const payments = await Payment.find({ bill: populated._id, paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }).sort({ paidAt: 1 }).lean();
  return new Promise((resolve) => { const doc = new PDFDocument({ margin: 36 }); const chunks = []; doc.on("data", (chunk) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.fontSize(20).text(populated.restaurant?.name || "RestoSphere", { align: "center" }); doc.fontSize(14).text("Bill Receipt", { align: "center" }); doc.moveDown(); doc.fontSize(10).text(`Bill: ${populated.billNumber}`); doc.text(`Table: ${populated.table?.tableNumber || "-"}`); doc.text(`Status: ${populated.status}`); doc.moveDown(); populated.allocations.forEach((row) => doc.text(`Order #${row.orderNumber}  ₹${Number(row.total).toFixed(2)}`)); doc.moveDown(); [["Subtotal", populated.subtotal], ["Discount", populated.discount], ["Loyalty redemption", populated.loyaltyDiscount], ["Tax", populated.tax], ["Service charge", populated.serviceCharge], ["Delivery charge", populated.deliveryCharge], ["Grand total", populated.total], ["Paid", populated.paidAmount], ["Balance due", populated.balanceDue]].forEach(([label, value]) => doc.text(`${label}: ₹${Number(value || 0).toFixed(2)}`, { align: "right" })); doc.moveDown(); doc.text("Payments"); payments.forEach((payment) => doc.text(`${paymentMethodLabel(payment.paymentMethod)} · ${payment.paymentId} · ₹${Number(payment.amount).toFixed(2)}`)); doc.end(); });
};

export const serializeBill = async (bill) => {
  const data = bill.toObject ? bill.toObject() : bill; const payments = await Payment.find({ bill: data._id }).sort({ paidAt: 1, createdAt: 1 }).lean();
  return { ...data, payments: payments.map(serializePayment) };
};
