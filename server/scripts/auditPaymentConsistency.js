import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Bill from "../models/Bill.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

const paise = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100);
const money = (value) => Number((Math.round(value) / 100).toFixed(2));
const collectedStatuses = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

const directSettlement = (order, payments) => {
  const netCollected = payments.reduce((sum, payment) => (
    collectedStatuses.has(payment.paymentStatus)
      ? sum + Math.max(paise(payment.amount ?? payment.totalAmount) - paise(payment.refundAmount), 0)
      : sum
  ), 0);
  const hasRefund = payments.some((payment) => ["PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.paymentStatus));
  const hasPending = payments.some((payment) => ["PENDING", "PROCESSING"].includes(payment.paymentStatus));
  const hasFailed = payments.some((payment) => payment.paymentStatus === "FAILED");
  const payable = paise(order.total);
  let status = "PENDING";
  if (netCollected >= payable && payable > 0) status = "PAID";
  else if (netCollected === 0 && hasRefund) status = "REFUNDED";
  else if (netCollected > 0 && hasRefund) status = "PARTIALLY_REFUNDED";
  else if (netCollected === 0 && hasFailed && !hasPending) status = "FAILED";
  return { status, netCollected, hasPending, hasFailed, hasRefund };
};

await mongoose.connect(mongoUri);

try {
  const [orders, payments, bills] = await Promise.all([
    Order.find({ isArchived: { $ne: true } }).select("_id orderNumber total paymentStatus billingBill").lean(),
    Payment.find({}).select("orderId bill amount totalAmount refundAmount paymentStatus").lean(),
    Bill.find({}).select("_id billNumber total paidAmount status allocations").lean(),
  ]);
  const paymentsByOrder = new Map();
  const paymentsByBill = new Map();
  payments.forEach((payment) => {
    const map = payment.orderId ? paymentsByOrder : payment.bill ? paymentsByBill : null;
    const key = String(payment.orderId || payment.bill || "");
    if (!map || !key) return;
    map.set(key, [...(map.get(key) || []), payment]);
  });
  const billsById = new Map(bills.map((bill) => [String(bill._id), bill]));
  const summary = new Map();

  for (const order of orders) {
    const direct = paymentsByOrder.get(String(order._id)) || [];
    const settlement = directSettlement(order, direct);
    const bill = order.billingBill ? billsById.get(String(order.billingBill)) : null;
    const billPayments = bill ? paymentsByBill.get(String(bill._id)) || [] : [];
    const billSettled = bill?.status === "PAID";
    const derivedStatus = billSettled ? "PAID" : settlement.status;
    const successfulDirectTotal = direct.reduce((sum, payment) => sum + (collectedStatuses.has(payment.paymentStatus) ? paise(payment.amount ?? payment.totalAmount) : 0), 0);
    const pendingTotal = direct.reduce((sum, payment) => sum + (["PENDING", "PROCESSING"].includes(payment.paymentStatus) ? paise(payment.amount ?? payment.totalAmount) : 0), 0);
    const failedTotal = direct.reduce((sum, payment) => sum + (payment.paymentStatus === "FAILED" ? paise(payment.amount ?? payment.totalAmount) : 0), 0);
    const refundedTotal = direct.reduce((sum, payment) => sum + paise(payment.refundAmount), 0);
    const duplicate = settlement.netCollected > paise(order.total);
    let consistencyStatus = "CONSISTENT";
    if (billSettled) consistencyStatus = order.paymentStatus === "PAID" ? "BILL_SETTLED" : "PARTIAL_MISMATCH";
    else if (order.paymentStatus === "PAID" && settlement.netCollected === 0 && settlement.hasPending) consistencyStatus = "ORDER_PAID_PAYMENT_PENDING";
    else if (order.paymentStatus === "PENDING" && settlement.status === "PAID") consistencyStatus = "ORDER_PENDING_PAYMENT_PAID";
    else if (!direct.length && !bill) consistencyStatus = "MISSING_PAYMENT_RECORD";
    else if (duplicate) consistencyStatus = "DUPLICATE_PAYMENT";
    else if (order.paymentStatus !== derivedStatus) consistencyStatus = settlement.hasRefund ? "REFUND_MISMATCH" : "PARTIAL_MISMATCH";
    summary.set(consistencyStatus, (summary.get(consistencyStatus) || 0) + 1);
    console.log(JSON.stringify({
      orderId: String(order._id), orderNumber: order.orderNumber, orderTotal: money(paise(order.total)),
      orderPaymentStatus: order.paymentStatus, directPaymentCount: direct.length,
      successfulDirectTotal: money(successfulDirectTotal), pendingTotal: money(pendingTotal), failedTotal: money(failedTotal),
      linkedBill: bill ? { id: String(bill._id), number: bill.billNumber, status: bill.status, settledTotal: money(paise(bill.paidAmount)) } : null,
      billPaymentCount: billPayments.length, refundedTotal: money(refundedTotal), netCollected: money(settlement.netCollected),
      derivedCorrectStatus: derivedStatus, consistencyStatus,
    }));
  }
  console.log(JSON.stringify({ summary: Object.fromEntries(summary), ordersAudited: orders.length }));
} finally {
  await mongoose.disconnect();
}
