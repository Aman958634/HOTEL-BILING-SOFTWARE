import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import TableLifecycleEvent from "../models/TableLifecycleEvent.js";
import ApiError from "../utils/ApiError.js";
import { assertTableTransition } from "./lifecycleService.js";
import { inspectTableOrderConsistency } from "./posValidationService.js";

export const transitionTable = async ({ table, toStatus, order = null, actor = null, reason, session = null }) => {
  const fromStatus = String(table.status || "AVAILABLE").toUpperCase();
  const nextStatus = String(toStatus).toUpperCase();
  if (fromStatus === nextStatus) return table;
  assertTableTransition(fromStatus, nextStatus);
  table.status = nextStatus;
  await table.save(session ? { session } : undefined);
  await TableLifecycleEvent.create([{
    restaurant: table.restaurant, table: table._id, order: order?._id || order || null,
    fromStatus, toStatus: nextStatus, actor: actor?._id || actor || null, reason,
  }], session ? { session } : undefined);
  return table;
};

export const assertVerifiedSettlement = ({ order, payment, provider, actor }) => {
  if (!order || order.isArchived || ["CANCELLED", "VOIDED"].includes(String(order.status).toUpperCase())) {
    throw new ApiError(409, "A cancelled or voided order cannot be settled");
  }
  if (["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(String(order.paymentStatus).toUpperCase())) {
    throw new ApiError(409, "Order payment is already settled");
  }
  if (provider === "cash" && !["admin", "manager", "cashier"].includes(String(actor?.role || "").toLowerCase())) {
    throw new ApiError(403, "Only a cashier, manager, or admin can verify cash payment");
  }
  if (payment && String(payment.restaurant) !== String(order.restaurant)) {
    throw new ApiError(409, "Payment and order tenant mismatch");
  }
};

// Read-only: can be run by monitoring without changing a table's lifecycle.
export const checkRestaurantConsistency = async (restaurant, { session = null } = {}) => {
  let tables = Table.find({ restaurant }).lean();
  let orders = Order.find({ restaurant, isArchived: { $ne: true } })
    .select("_id table status paymentStatus billingStatus createdAt isArchived").lean();
  let payments = Payment.find({ restaurant }).select("_id orderId paymentStatus").lean();
  if (session) [tables, orders, payments].forEach((query) => query.session(session));
  const [tableRows, orderRows, paymentRows] = await Promise.all([tables, orders, payments]);
  const paymentByOrder = new Map(paymentRows.map((payment) => [String(payment.orderId), payment]));
  const issues = [];
  for (const table of tableRows) {
    const result = inspectTableOrderConsistency({ table, orders: orderRows.filter((order) => String(order.table || "") === String(table._id)) });
    if (!result.valid) issues.push({ type: "TABLE_ORDER", table: table._id, ...result });
  }
  for (const order of orderRows) {
    if (String(order.paymentStatus).toUpperCase() === "PAID" && String(order.status).toUpperCase() !== "COMPLETED") {
      issues.push({ type: "PAID_ORDER_NOT_COMPLETED", order: order._id });
    }
    const payment = paymentByOrder.get(String(order._id));
    if (payment && String(payment.paymentStatus).toUpperCase() !== String(order.paymentStatus).toUpperCase()) {
      issues.push({ type: "PAYMENT_STATUS_MISMATCH", order: order._id, payment: payment._id });
    }
  }
  return { valid: issues.length === 0, issues, checkedAt: new Date() };
};
