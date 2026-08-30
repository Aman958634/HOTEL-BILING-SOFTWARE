import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Outlet from "../models/Outlet.js";
import { emitNotificationCreated } from "../socket/notificationSocket.js";
import { hasAllOutletsAccess } from "../utils/tenantUtils.js";

export const NOTIFICATION_EVENTS = Object.freeze({
  ORDER_CREATED: "ORDER_CREATED", ONLINE_ORDER_RECEIVED: "ONLINE_ORDER_RECEIVED", KOT_CREATED: "KOT_CREATED", KOT_READY: "KOT_READY", CUSTOMER_CREATED: "CUSTOMER_CREATED", STAFF_CREATED: "STAFF_CREATED", BILL_GENERATED: "BILL_GENERATED", PAYMENT_RECEIVED: "PAYMENT_RECEIVED", PARTIAL_PAYMENT_RECEIVED: "PARTIAL_PAYMENT_RECEIVED", BILL_FULLY_PAID: "BILL_FULLY_PAID", REFUND_CREATED: "REFUND_CREATED", REFUND_COMPLETED: "REFUND_COMPLETED", LOYALTY_MEMBER_ENROLLED: "LOYALTY_MEMBER_ENROLLED", INVENTORY_LOW: "INVENTORY_LOW", INVENTORY_OUT_OF_STOCK: "INVENTORY_OUT_OF_STOCK", RECONCILIATION_MISMATCH: "RECONCILIATION_MISMATCH", INTELLIGENCE_ALERT_CREATED: "INTELLIGENCE_ALERT_CREATED", CENTRAL_KITCHEN_REQUISITION_CREATED: "CENTRAL_KITCHEN_REQUISITION_CREATED", CENTRAL_KITCHEN_REQUISITION_APPROVED: "CENTRAL_KITCHEN_REQUISITION_APPROVED", CENTRAL_KITCHEN_REQUISITION_REJECTED: "CENTRAL_KITCHEN_REQUISITION_REJECTED", CENTRAL_KITCHEN_BATCH_COMPLETED: "CENTRAL_KITCHEN_BATCH_COMPLETED", CENTRAL_KITCHEN_TRANSFER_DISPATCHED: "CENTRAL_KITCHEN_TRANSFER_DISPATCHED", CENTRAL_KITCHEN_TRANSFER_RECEIVED: "CENTRAL_KITCHEN_TRANSFER_RECEIVED", CENTRAL_KITCHEN_TRANSFER_DISCREPANCY: "CENTRAL_KITCHEN_TRANSFER_DISCREPANCY",
});

const templates = {
  ORDER_CREATED: ["ORDERS", "INFO", ["manager", "cashier", "waiter"], "New order created", (p) => `Order #${p.orderNumber} has been created${p.tableNumber ? ` for Table ${p.tableNumber}` : ""}.`, "/dashboard/admin/orders"],
  ONLINE_ORDER_RECEIVED: ["ORDERS", "INFO", ["admin", "manager", "cashier"], "New online order", (p) => `Order #${p.orderNumber} has been received.`, "/dashboard/admin/online-orders"],
  KOT_CREATED: ["KITCHEN", "INFO", ["chef", "manager"], "New KOT", (p) => `KOT #${p.kotNumber || p.orderNumber} has been created for Order #${p.orderNumber}.`, "/dashboard/admin/kitchen"],
  KOT_READY: ["KITCHEN", "SUCCESS", ["waiter", "manager"], "Order ready", (p) => `KOT #${p.kotNumber || p.orderNumber}${p.tableNumber ? ` for Table ${p.tableNumber}` : ""} is ready for service.`, "/dashboard/admin/kitchen"],
  CUSTOMER_CREATED: ["CUSTOMER", "INFO", ["admin", "manager"], "New customer added", () => "A new customer has been added to Customer CRM.", "/dashboard/admin/customers"],
  STAFF_CREATED: ["STAFF", "INFO", ["admin", "manager"], "Staff member added", () => "A new staff member has been added.", "/dashboard/admin/staff"],
  BILL_GENERATED: ["BILLING", "INFO", ["admin", "manager", "cashier", "waiter"], "Bill generated", (p) => `Bill #${p.billNumber} has been generated${p.tableNumber ? ` for Table ${p.tableNumber}` : ""}.`, "/dashboard/admin/billing"],
  PAYMENT_RECEIVED: ["PAYMENTS", "SUCCESS", ["admin", "manager", "cashier"], "Payment received", (p) => `₹${p.amount} received for Bill #${p.billNumber || p.orderNumber || "—"}.`, "/dashboard/admin/payments"],
  PARTIAL_PAYMENT_RECEIVED: ["PAYMENTS", "WARNING", ["admin", "manager", "cashier"], "Partial payment received", (p) => `₹${p.amount} received for Bill #${p.billNumber}. ₹${p.balanceDue} remains due.`, "/dashboard/admin/billing"],
  BILL_FULLY_PAID: ["PAYMENTS", "SUCCESS", ["admin", "manager", "cashier"], "Bill fully paid", (p) => `Bill #${p.billNumber} has been fully settled.`, "/dashboard/admin/billing"],
  REFUND_CREATED: ["PAYMENTS", "WARNING", ["admin", "manager", "cashier"], "Refund initiated", (p) => `A refund has been initiated for Payment #${p.paymentNumber || "—"}.`, "/dashboard/admin/payment-reconciliation"],
  REFUND_COMPLETED: ["PAYMENTS", "SUCCESS", ["admin", "manager", "cashier"], "Refund completed", (p) => `Refund of ₹${p.amount} has been completed${p.billNumber ? ` for Bill #${p.billNumber}` : ""}.`, "/dashboard/admin/payment-reconciliation"],
  LOYALTY_MEMBER_ENROLLED: ["LOYALTY", "INFO", ["admin", "manager"], "Loyalty member enrolled", () => "A customer has joined the loyalty program.", "/dashboard/admin/loyalty"],
  INVENTORY_LOW: ["INVENTORY", "WARNING", ["admin", "manager", "inventory_manager"], "Low stock alert", (p) => `${p.itemName || "An inventory item"} is below its reorder level.`, "/dashboard/admin/inventory"],
  INVENTORY_OUT_OF_STOCK: ["INVENTORY", "CRITICAL", ["admin", "manager", "inventory_manager"], "Out of stock", (p) => `${p.itemName || "An inventory item"} is out of stock.`, "/dashboard/admin/inventory"],
  RECONCILIATION_MISMATCH: ["PAYMENTS", "WARNING", ["admin", "manager", "cashier"], "Payment mismatch detected", (p) => `${p.reference || "A payment"} requires reconciliation review.`, "/dashboard/admin/payment-reconciliation"],
  INTELLIGENCE_ALERT_CREATED: ["INTELLIGENCE", "WARNING", ["admin", "manager"], "Management alert", (p) => p.summary || "A new actionable business insight requires review.", "/dashboard/admin/intelligence"],
  CENTRAL_KITCHEN_REQUISITION_CREATED: ["INVENTORY", "INFO", ["admin", "manager", "inventory_manager"], "Central kitchen requisition", (p) => `Requisition #${p.requisitionNumber} was submitted for ${p.outletName || "an outlet"}.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_REQUISITION_APPROVED: ["INVENTORY", "SUCCESS", ["admin", "manager", "inventory_manager"], "Requisition approved", (p) => `Requisition #${p.requisitionNumber} has been approved.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_REQUISITION_REJECTED: ["INVENTORY", "WARNING", ["admin", "manager", "inventory_manager"], "Requisition rejected", (p) => `Requisition #${p.requisitionNumber} was rejected.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_BATCH_COMPLETED: ["INVENTORY", "SUCCESS", ["admin", "manager", "inventory_manager"], "Production batch completed", (p) => `Batch #${p.batchNumber} has completed.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_TRANSFER_DISPATCHED: ["INVENTORY", "INFO", ["admin", "manager", "inventory_manager"], "Transfer dispatched", (p) => `Transfer #${p.transferNumber} is in transit.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_TRANSFER_RECEIVED: ["INVENTORY", "SUCCESS", ["admin", "manager", "inventory_manager"], "Transfer received", (p) => `Transfer #${p.transferNumber} was received.`, "/dashboard/admin/central-kitchen"],
  CENTRAL_KITCHEN_TRANSFER_DISCREPANCY: ["INVENTORY", "WARNING", ["admin", "manager", "inventory_manager"], "Transfer receiving discrepancy", (p) => `Transfer #${p.transferNumber} was partially received and needs review.`, "/dashboard/admin/central-kitchen"],
};

const validId = (value) => value && mongoose.isValidObjectId(value);
const text = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 500);

/** Persists one notification per authorized recipient before Socket.IO delivery. */
export const publishBusinessEvent = async ({ eventType, restaurantId, outletId = null, entityType, entityId, actorUserId = null, payload = {}, recipientUserIds = [] }) => {
  const template = templates[eventType];
  if (!template || !validId(restaurantId)) return [];
  const [category, severity, roles, title, message, route] = template;
  const eventOutlet = validId(outletId)
    ? await Outlet.findOne({ _id: outletId, restaurant: restaurantId, isActive: true }).select("_id").lean()
    : null;
  if (outletId && !eventOutlet) return [];
  const users = await User.find({ restaurant: restaurantId, isActive: true, $or: [{ role: { $in: roles } }, { _id: { $in: recipientUserIds.filter(validId) } }] }).select("_id outletAccess allOutletsAccess role").lean();
  const output = [];
  for (const user of users) {
    if (actorUserId && String(user._id) === String(actorUserId)) continue;
    const assigned = !eventOutlet || hasAllOutletsAccess(user) || (user.outletAccess || []).some((entry) => entry.isActive !== false && String(entry.outlet) === String(eventOutlet._id));
    if (!assigned) continue;
    const dedupeKey = `${eventType}:${validId(entityId) ? entityId : payload.reference || "event"}:${user._id}`;
    try {
      const notification = await Notification.findOneAndUpdate({ user: user._id, dedupeKey }, { $setOnInsert: { user: user._id, restaurantId, outlet: eventOutlet?._id || null, eventType, category, severity, type: eventType, title: text(title), message: text(message(payload)), entityType: entityType || null, entityId: validId(entityId) ? entityId : null, route, dedupeKey, metadata: {} } }, { new: true, upsert: true, setDefaultsOnInsert: true });
      if (notification.createdAt?.getTime() === notification.updatedAt?.getTime()) { emitNotificationCreated(notification); output.push(notification); }
    } catch (error) { if (error?.code !== 11000) throw error; }
  }
  return output;
};

export const notifyNewOrder = (p) => publishBusinessEvent({ eventType: p.online ? NOTIFICATION_EVENTS.ONLINE_ORDER_RECEIVED : NOTIFICATION_EVENTS.ORDER_CREATED, restaurantId: p.restaurantId, outletId: p.outletId, entityType: "Order", entityId: p.orderId, actorUserId: p.actorUserId, payload: p });
export const notifyPaymentReceived = (p) => publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.PAYMENT_RECEIVED, restaurantId: p.restaurantId, outletId: p.outletId, entityType: "Payment", entityId: p.paymentId || p.orderId, actorUserId: p.actorUserId, payload: p });
export const notifyNewStaff = (p) => publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.STAFF_CREATED, restaurantId: p.restaurantId, outletId: p.outletId, entityType: "Staff", entityId: p.staffId, actorUserId: p.actorUserId, payload: p });
export const notifyLowStock = (p) => publishBusinessEvent({ eventType: Number(p.quantity) <= 0 ? NOTIFICATION_EVENTS.INVENTORY_OUT_OF_STOCK : NOTIFICATION_EVENTS.INVENTORY_LOW, restaurantId: p.restaurantId, outletId: p.outletId, entityType: "Inventory", entityId: p.inventoryId, payload: p });

const createLegacyNotification = async ({ userId, restaurantId, type = "system", title, message, entityType = null, entityId = null }) => {
  if (!validId(userId) || !text(title) || !text(message)) return null;
  const dedupeKey = `${type}:${validId(entityId) ? entityId : text(message)}:${userId}`;
  const notification = await Notification.findOneAndUpdate({ user: userId, dedupeKey }, { $setOnInsert: { user: userId, restaurantId: validId(restaurantId) ? restaurantId : null, eventType: type, category: "SYSTEM", severity: "INFO", type, title: text(title), message: text(message), entityType, entityId: validId(entityId) ? entityId : null, dedupeKey, metadata: {} } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (notification.createdAt?.getTime() === notification.updatedAt?.getTime()) emitNotificationCreated(notification);
  return notification;
};
export const createNotification = ({ userId, restaurantId, type, title, message, entityType, entityId }) => createLegacyNotification({ userId, restaurantId, type, title, message, entityType, entityId });
export const createNotificationForAllRoles = async ({ restaurantId, roles = [], excludeUserId = null, ...notification }) => {
  if (!validId(restaurantId)) return [];
  const users = await User.find({ restaurant: restaurantId, role: { $in: roles }, isActive: true }).select("_id").lean();
  return Promise.all(users.filter((user) => String(user._id) !== String(excludeUserId || "")).map((user) => createLegacyNotification({ ...notification, userId: user._id, restaurantId })));
};
export const createNotificationForRole = ({ role, ...args }) => createNotificationForAllRoles({ ...args, roles: [role] });
export const notifyOrderCancelled = (p) => createNotificationForAllRoles({ restaurantId: p.restaurantId, roles: ["admin", "manager", "cashier"], type: "ORDER_CANCELLED", title: "Order cancelled", message: `Order #${p.orderNumber} has been cancelled.`, entityType: "Order", entityId: p.orderId, excludeUserId: p.actorUserId });
export const notifySubscriptionExpiring = async ({ restaurantId, subscriptionId, daysRemaining, isExpired = false }) => createNotificationForAllRoles({ restaurantId, roles: ["admin"], type: "SUBSCRIPTION_EXPIRING", title: isExpired ? "Subscription expired" : "Subscription expiring", message: isExpired ? "Your subscription has expired. Please choose a paid plan to continue." : `Your subscription expires in ${daysRemaining} days.`, entityType: "Subscription", entityId: subscriptionId });
