/**
 * Read-only production payment consistency audit.
 *
 * Preferred: PAYMENT_AUDIT_MONGO_URI (an audit-only secret).
 * Render fallback: MONGO_URI/MONGODB_URI, only when NODE_ENV=production and
 * a Render runtime marker is present. This script never writes or repairs.
 */
import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

const BLOCKED = "PRODUCTION PAYMENT AUDIT BLOCKED";
const EPSILON = 0.01;
const SUCCESSFUL_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED"]);
const SETTLED_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);
const money = (value) => Number(value || 0);
const id = (value) => String(value || "");
const statusOf = (value) => String(value || "PENDING").toUpperCase();
const netAmount = (payment) => Math.max(money(payment.amount ?? payment.totalAmount) - money(payment.refundAmount), 0);
const derivePaymentStatus = (total, paid) => (paid <= EPSILON ? "PENDING" : paid + EPSILON >= total ? "PAID" : "PARTIAL");

let failureReported = false;
const safeFailureReason = (error) => {
  const message = String(error?.message || error || "");
  if (message.includes("NON-PRODUCTION DATABASE")) return "NON-PRODUCTION DATABASE";
  if (message.includes("audit-only URI")) return "AUDIT-ONLY URI REQUIRED OUTSIDE TRUSTED RENDER PRODUCTION";
  if (message.includes("database name is missing")) return "DATABASE NAME MISSING";
  if (message.includes("database name does not match")) return "DATABASE NAME MISMATCH";
  if (message.includes("database URI is invalid")) return "DATABASE URI INVALID";
  return "CONNECTION OR CONFIGURATION FAILURE";
};
const reportBlocked = (error) => {
  if (failureReported) return;
  failureReported = true;
  console.log("Production DB connection: FAIL");
  console.log(`${BLOCKED} — ${safeFailureReason(error)}`);
  console.log("No production records modified: YES");
  process.exitCode = 1;
};
process.on("uncaughtException", reportBlocked);
process.on("unhandledRejection", reportBlocked);

const trustedRenderProduction = () =>
  String(process.env.NODE_ENV || "").toLowerCase() === "production"
  && (String(process.env.RENDER || "").toLowerCase() === "true" || Boolean(process.env.RENDER_SERVICE_ID));

const resolveAuditTarget = () => {
  const auditUri = String(process.env.PAYMENT_AUDIT_MONGO_URI || "").trim();
  if (auditUri) return auditUri;
  if (trustedRenderProduction()) return String(process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  throw new Error("an audit-only URI is required outside trusted Render production");
};

const validateRemoteTarget = (uri) => {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("database URI is invalid");
  }

  const hostname = String(parsed.hostname || "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname)) {
    throw new Error("NON-PRODUCTION DATABASE");
  }

  const databaseName = decodeURIComponent(parsed.pathname || "").replace(/^\/+|\/+$/g, "");
  if (!databaseName) throw new Error("database name is missing");

  const expectedDatabase = String(process.env.PAYMENT_AUDIT_EXPECTED_DATABASE || "").trim();
  if (expectedDatabase && expectedDatabase !== databaseName) throw new Error("database name does not match PAYMENT_AUDIT_EXPECTED_DATABASE");

  return { databaseName, hostType: hostname.endsWith(".mongodb.net") ? "MongoDB Atlas" : "remote" };
};

const auditUri = resolveAuditTarget();
const target = validateRemoteTarget(auditUri);

await mongoose.connect(auditUri, {
  autoIndex: false,
  autoCreate: false,
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 10000,
});

try {
  const [orders, payments] = await Promise.all([
    Order.find({ isArchived: { $ne: true } }).select("_id restaurant outlet total paymentStatus status").lean(),
    Payment.find({}).select("_id orderId restaurant outlet amount totalAmount refundAmount paymentStatus transactionId razorpayPaymentId").lean(),
  ]);

  const paymentsByOrder = new Map();
  for (const payment of payments) {
    if (!payment.orderId) continue;
    const key = id(payment.orderId);
    paymentsByOrder.set(key, [...(paymentsByOrder.get(key) || []), payment]);
  }

  const duplicateProviderReferences = new Set();
  const duplicatePaymentIds = new Set();
  for (const field of ["transactionId", "razorpayPaymentId"]) {
    const groups = new Map();
    for (const payment of payments) {
      if (!SUCCESSFUL_STATUSES.has(statusOf(payment.paymentStatus))) continue;
      const value = String(payment[field] || "").trim();
      if (!value) continue;
      const key = `${field}:${value}`;
      groups.set(key, [...(groups.get(key) || []), payment]);
    }
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      duplicateProviderReferences.add(key);
      group.forEach((payment) => duplicatePaymentIds.add(id(payment._id)));
    }
  }

  const report = {
    totalOrdersScanned: orders.length,
    totalPaymentsScanned: payments.length,
    consistent: 0,
    orderPaidPaymentPending: 0,
    paymentSuccessOrderUnpaid: 0,
    orderPaidMissingSuccessfulPayment: 0,
    missingPayment: 0,
    amountMismatch: 0,
    splitPartialMismatch: 0,
    duplicateProviderPaymentIds: duplicateProviderReferences.size,
    completedUnresolvedPayment: 0,
    tenantOutletOwnershipMismatch: 0,
    safeToRepair: 0,
    needsManualReview: 0,
  };

  for (const order of orders) {
    const related = paymentsByOrder.get(id(order._id)) || [];
    const successful = related.filter((payment) => SUCCESSFUL_STATUSES.has(statusOf(payment.paymentStatus)));
    const pending = related.filter((payment) => ["PENDING", "PROCESSING"].includes(statusOf(payment.paymentStatus)));
    const paid = related.filter((payment) => SETTLED_STATUSES.has(statusOf(payment.paymentStatus))).reduce((sum, payment) => sum + netAmount(payment), 0);
    const total = money(order.total);
    const orderPaymentStatus = statusOf(order.paymentStatus);
    const ownershipMismatch = related.some((payment) => id(payment.restaurant) !== id(order.restaurant) || id(payment.outlet) !== id(order.outlet));
    const duplicateProviderPayment = related.some((payment) => duplicatePaymentIds.has(id(payment._id)));
    const paidWithPending = orderPaymentStatus === "PAID" && pending.length > 0;
    const missingSuccessfulPayment = orderPaymentStatus === "PAID" && successful.length === 0;
    const fullyPaidOrderUnmarked = orderPaymentStatus !== "PAID" && total > 0 && paid + EPSILON >= total;
    const paidOrderUnderpaid = orderPaymentStatus === "PAID" && paid + EPSILON < total;
    const invalidPartial = orderPaymentStatus === "PARTIAL" && (paid <= EPSILON || paid + EPSILON >= total);
    const completedUnresolved = statusOf(order.status) === "COMPLETED" && total > 0 && derivePaymentStatus(total, paid) !== "PAID";

    if (paidWithPending) report.orderPaidPaymentPending += 1;
    if (missingSuccessfulPayment) report.orderPaidMissingSuccessfulPayment += 1;
    if (!related.length) report.missingPayment += 1;
    if (fullyPaidOrderUnmarked) report.paymentSuccessOrderUnpaid += 1;
    if (paidOrderUnderpaid) report.amountMismatch += 1;
    if (invalidPartial) report.splitPartialMismatch += 1;
    if (completedUnresolved) report.completedUnresolvedPayment += 1;
    if (ownershipMismatch) report.tenantOutletOwnershipMismatch += 1;

    const safeToRepair = fullyPaidOrderUnmarked && !ownershipMismatch && !duplicateProviderPayment;
    const needsManualReview = missingSuccessfulPayment || paidOrderUnderpaid || invalidPartial || completedUnresolved || ownershipMismatch || duplicateProviderPayment;
    if (safeToRepair) report.safeToRepair += 1;
    if (needsManualReview) report.needsManualReview += 1;
    if (!safeToRepair && !needsManualReview) report.consistent += 1;
  }

  console.log("Production DB connection: PASS");
  console.log(`Database host type: ${target.hostType}`);
  console.log(`Database name: ${target.databaseName}`);
  console.log(`Total orders scanned: ${report.totalOrdersScanned}`);
  console.log(`Total payments scanned: ${report.totalPaymentsScanned}`);
  console.log(`Consistent: ${report.consistent}`);
  console.log(`Order PAID / Payment PENDING: ${report.orderPaidPaymentPending}`);
  console.log(`Payment SUCCESS / Order unpaid: ${report.paymentSuccessOrderUnpaid}`);
  console.log(`Order PAID / Missing successful payment: ${report.orderPaidMissingSuccessfulPayment}`);
  console.log(`Missing payment: ${report.missingPayment}`);
  console.log(`Amount mismatch: ${report.amountMismatch}`);
  console.log(`Split/partial mismatch: ${report.splitPartialMismatch}`);
  console.log(`Duplicate provider payment IDs: ${report.duplicateProviderPaymentIds}`);
  console.log(`Completed / unresolved payment: ${report.completedUnresolvedPayment}`);
  console.log(`Tenant/outlet ownership mismatch: ${report.tenantOutletOwnershipMismatch}`);
  console.log(`SAFE_TO_REPAIR: ${report.safeToRepair}`);
  console.log(`NEEDS_MANUAL_REVIEW: ${report.needsManualReview}`);
  console.log("No production records modified: YES");
  console.log("FINAL STATUS: PRODUCTION PAYMENT AUDIT COMPLETE");
} finally {
  await mongoose.disconnect();
}
