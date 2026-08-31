/**
 * Read-only financial consistency audit.
 *
 * Usage:
 *   PAYMENT_AUDIT_MONGO_URI='mongodb://...' npm run audit:payment-consistency
 *
 * The URI is intentionally explicit so this script cannot accidentally run
 * against a developer's default database. It never writes or repairs data.
 */
import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

const uri = String(process.env.PAYMENT_AUDIT_MONGO_URI || "").trim();
if (!uri) throw new Error("PAYMENT_AUDIT_MONGO_URI is required; this read-only audit never falls back to MONGO_URI.");

const SETTLED_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);
const SUCCESS_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED"]);
const EPSILON = 0.01;
const money = (value) => Number(value || 0);
const id = (value) => String(value || "");
const netAmount = (payment) => Math.max(money(payment.amount ?? payment.totalAmount) - money(payment.refundAmount), 0);
const add = (items, type, detail) => items.push({ type, ...detail });

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
try {
  const [orders, payments] = await Promise.all([
    Order.find({ isArchived: { $ne: true } }).select("_id restaurant outlet total paymentStatus status").lean(),
    Payment.find({}).select("_id orderId restaurant outlet amount totalAmount refundAmount paymentStatus transactionId razorpayOrderId razorpayPaymentId").lean(),
  ]);

  const paymentsByOrder = new Map();
  for (const payment of payments) {
    if (!payment.orderId) continue;
    const key = id(payment.orderId);
    paymentsByOrder.set(key, [...(paymentsByOrder.get(key) || []), payment]);
  }

  const inconsistencies = [];
  const reviewWarnings = [];
  const orderIds = new Set(orders.map((order) => id(order._id)));
  for (const order of orders) {
    const related = paymentsByOrder.get(id(order._id)) || [];
    const settled = related.filter((payment) => SETTLED_STATUSES.has(String(payment.paymentStatus || "").toUpperCase()));
    const successful = related.filter((payment) => SUCCESS_STATUSES.has(String(payment.paymentStatus || "").toUpperCase()));
    const paid = settled.reduce((sum, payment) => sum + netAmount(payment), 0);
    const total = money(order.total);
    const orderState = String(order.paymentStatus || "PENDING").toUpperCase();
    const pending = related.filter((payment) => ["PENDING", "PROCESSING"].includes(String(payment.paymentStatus || "").toUpperCase()));
    const context = { orderId: id(order._id), orderPaymentStatus: orderState, paid, total };

    // A completed order can legitimately retain an abandoned provider intent.
    // It is review-worthy but not an accounting mismatch if a verified ledger
    // entry covers the order total. A PAID order with only pending rows is a
    // real mismatch and remains blocking below.
    if (orderState === "PAID" && pending.length && successful.length) {
      add(reviewWarnings, "STALE_PAYMENT_INTENT_ON_PAID_ORDER", { ...context, paymentIds: pending.map((payment) => id(payment._id)) });
    }
    if (orderState === "PAID" && pending.length && !successful.length) {
      add(inconsistencies, "PAID_ORDER_HAS_ONLY_PENDING_PAYMENTS", { ...context, paymentIds: pending.map((payment) => id(payment._id)) });
    }
    if (orderState === "PAID" && !successful.length) add(inconsistencies, "PAID_ORDER_HAS_NO_SUCCESSFUL_PAYMENT", context);
    if (orderState === "PAID" && paid + EPSILON < total) add(inconsistencies, "PAID_ORDER_IS_UNDERPAID", context);
    if (orderState !== "PAID" && paid + EPSILON >= total && total > 0) add(inconsistencies, "FULLY_PAID_ORDER_NOT_MARKED_PAID", context);
    if (orderState === "PENDING" && paid > EPSILON) add(inconsistencies, "SUCCESSFUL_PAYMENT_ON_UNPAID_ORDER", context);
    if (orderState === "PARTIAL" && (paid <= EPSILON || paid + EPSILON >= total)) add(inconsistencies, "INVALID_PARTIAL_ORDER_STATE", context);

    for (const payment of related) {
      if (id(payment.restaurant) !== id(order.restaurant)) add(inconsistencies, "RESTAURANT_MISMATCH", { ...context, paymentId: id(payment._id) });
      if (id(payment.outlet) !== id(order.outlet)) add(inconsistencies, "OUTLET_MISMATCH", { ...context, paymentId: id(payment._id) });
    }
  }

  for (const payment of payments) {
    if (payment.orderId && !orderIds.has(id(payment.orderId))) add(inconsistencies, "PAYMENT_WITHOUT_ORDER", { paymentId: id(payment._id), orderId: id(payment.orderId) });
  }

  const duplicateGatewayReferences = [];
  for (const field of ["transactionId", "razorpayPaymentId"]) {
    const groups = new Map();
    for (const payment of payments) {
      const value = String(payment[field] || "").trim();
      if (!value) continue;
      groups.set(value, [...(groups.get(value) || []), payment]);
    }
    for (const [value, group] of groups) {
      if (group.length > 1) {
        duplicateGatewayReferences.push({ field, value, paymentIds: group.map((payment) => id(payment._id)) });
        add(inconsistencies, "DUPLICATE_GATEWAY_REFERENCE", { field, value, paymentIds: group.map((payment) => id(payment._id)) });
      }
    }
  }

  const status = inconsistencies.length ? "BLOCKED" : "PASS";
  const mismatchedOrderIds = new Set(inconsistencies.map((item) => item.orderId).filter(Boolean));
  console.log("PAYMENT CONSISTENCY AUDIT\n");
  console.log(`Orders checked: ${orders.length}`);
  console.log(`Payments checked: ${payments.length}`);
  console.log(`Consistent: ${Math.max(orders.length - mismatchedOrderIds.size, 0)}`);
  console.log(`Mismatches: ${inconsistencies.length}`);
  console.log(`Manual-review warnings: ${reviewWarnings.length}`);
  console.log(`Duplicate gateway references: ${duplicateGatewayReferences.length}`);
  if (inconsistencies.length) {
    console.log("\nFindings:");
    for (const finding of inconsistencies.slice(0, 100)) console.log(JSON.stringify(finding));
    if (inconsistencies.length > 100) console.log(`... ${inconsistencies.length - 100} additional findings omitted`);
  }
  if (reviewWarnings.length) {
    console.log("\nManual-review warnings:");
    for (const warning of reviewWarnings.slice(0, 100)) console.log(JSON.stringify(warning));
    if (reviewWarnings.length > 100) console.log(`... ${reviewWarnings.length - 100} additional warnings omitted`);
  }
  console.log(`\nSTATUS: ${status}`);
  process.exitCode = status === "PASS" ? 0 : 2;
} finally {
  await mongoose.disconnect();
}
