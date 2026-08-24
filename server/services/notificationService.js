import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitNotificationCreated } from "../socket/notificationSocket.js";

const notificationRecipientRoles = ["admin", "manager", "waiter", "chef", "cashier"];

export const createNotification = async ({
  userId,
  restaurantId,
  type,
  title,
  message,
  entityType,
  entityId,
}) => {
  try {
    if (!userId || !type || !title || !message) {
      return null;
    }

    const safeRestaurantId = restaurantId && mongoose.isValidObjectId(restaurantId) ? restaurantId : null;
    const safeEntityId = entityId && mongoose.isValidObjectId(entityId) ? entityId : null;

    if (entityType && safeEntityId) {
      const existing = await Notification.findOne({
        user: userId,
        entityType,
        entityId: safeEntityId,
        type,
      }).select("_id");

      if (existing) {
        return existing;
      }
    }

    const notification = await Notification.create({
      user: userId,
      restaurantId: safeRestaurantId,
      type,
      title,
      message,
      entityType: entityType || null,
      entityId: safeEntityId,
      isRead: false,
    });

    emitNotificationCreated(notification);

    return notification;
  } catch (_error) {
    return null;
  }
};

export const createNotificationForRole = async ({
  restaurantId,
  role,
  type,
  title,
  message,
  entityType,
  entityId,
  excludeUserId = null,
}) => {
  try {
    const recipients = await User.find({
      role: { $in: [role] },
      isActive: true,
      ...(restaurantId && mongoose.isValidObjectId(restaurantId) ? { restaurant: restaurantId } : {}),
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    }).select("_id");

    if (!recipients.length) return [];

    const notifications = [];
    for (const recipient of recipients) {
      const notification = await createNotification({
        userId: recipient._id,
        restaurantId,
        type,
        title,
        message,
        entityType,
        entityId,
      });
      if (notification) notifications.push(notification);
    }

    return notifications;
  } catch (_error) {
    return [];
  }
};

export const createNotificationForAllRoles = async ({
  restaurantId,
  roles = notificationRecipientRoles,
  type,
  title,
  message,
  entityType,
  entityId,
  excludeUserId = null,
}) => {
  try {
    const recipients = await User.find({
      role: { $in: roles },
      isActive: true,
      ...(restaurantId && mongoose.isValidObjectId(restaurantId) ? { restaurant: restaurantId } : {}),
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    }).select("_id");

    if (!recipients.length) return [];

    const notifications = [];
    for (const recipient of recipients) {
      const notification = await createNotification({
        userId: recipient._id,
        restaurantId,
        type,
        title,
        message,
        entityType,
        entityId,
      });
      if (notification) notifications.push(notification);
    }

    return notifications;
  } catch (_error) {
    return [];
  }
};

export const notifyNewOrder = async ({ restaurantId, orderId, orderNumber, customerName, total, actorUserId }) => {
  const title = "New Order Received";
  const message = customerName
    ? `New order #${orderNumber} has been received from ${customerName}. Amount: ₹${total}.`
    : `New order #${orderNumber} has been received. Amount: ₹${total}.`;

  return createNotificationForAllRoles({
    restaurantId,
    type: "NEW_ORDER",
    title,
    message,
    entityType: "Order",
    entityId: orderId,
    excludeUserId: actorUserId,
  });
};

export const notifyPaymentReceived = async ({ restaurantId, paymentId, orderId, orderNumber, amount, paymentMethod, actorUserId }) => {
  const title = "Payment Received";
  const message = `Payment of ₹${amount} received for order #${orderNumber} via ${paymentMethod}.`;

  return createNotificationForAllRoles({
    restaurantId,
    type: "PAYMENT_RECEIVED",
    title,
    message,
    entityType: "Payment",
    entityId: paymentId || orderId,
    excludeUserId: actorUserId,
  });
};

export const notifyOrderCancelled = async ({ restaurantId, orderId, orderNumber, customer, total, reason, actorUserId }) => {
  const title = "Order Cancelled";
  const message = reason
    ? `Order #${orderNumber} has been cancelled. Reason: ${reason}`
    : `Order #${orderNumber} has been cancelled.`;

  return createNotificationForAllRoles({
    restaurantId,
    type: "ORDER_CANCELLED",
    title,
    message,
    entityType: "Order",
    entityId: orderId,
    excludeUserId: actorUserId,
  });
};

export const notifySubscriptionExpiring = async ({ restaurantId, subscriptionId, daysRemaining, isExpired = false }) => {
  let title;
  let message;

  if (isExpired) {
    title = "Subscription Expired";
    message = "Your subscription has expired. Please choose a paid plan to continue.";
  } else if (daysRemaining === 1) {
    title = "Subscription Expiring";
    message = "Your subscription expires tomorrow.";
  } else if (daysRemaining === 3) {
    title = "Subscription Expiring";
    message = "Your subscription expires in 3 days.";
  } else if (daysRemaining === 7) {
    title = "Subscription Expiring";
    message = "Your subscription expires in 7 days.";
  } else {
    title = "Subscription Expiring";
    message = `Your subscription expires in ${daysRemaining} days.`;
  }

  const recipients = await User.find({
    role: "admin",
    isActive: true,
    ...(restaurantId && mongoose.isValidObjectId(restaurantId) ? { restaurant: restaurantId } : {}),
  }).select("_id");

  if (!recipients.length) return [];

  const notifications = [];
  for (const recipient of recipients) {
    const existing = await Notification.findOne({
      user: recipient._id,
      type: "SUBSCRIPTION_EXPIRING",
      message,
    }).select("_id");

    if (existing) continue;

    const notification = await Notification.create({
      user: recipient._id,
      restaurantId: restaurantId && mongoose.isValidObjectId(restaurantId) ? restaurantId : null,
      type: "SUBSCRIPTION_EXPIRING",
      title,
      message,
      entityType: "Subscription",
      entityId: subscriptionId && mongoose.isValidObjectId(subscriptionId) ? subscriptionId : null,
      isRead: false,
    });

    emitNotificationCreated(notification);
    notifications.push(notification);
  }

  return notifications;
};

export const notifyLowStock = async ({ restaurantId, inventoryId, itemName, quantity, reorderLevel }) => {
  const title = "Low Stock Alert";
  const message = `${itemName} stock is running low. Only ${quantity} units remaining (minimum: ${reorderLevel}).`;

  return createNotificationForRole({
    restaurantId,
    role: "admin",
    type: "LOW_STOCK",
    title,
    message,
    entityType: "Inventory",
    entityId: inventoryId,
  });
};

export const notifyNewStaff = async ({ restaurantId, staffId, staffName, role, actorUserId }) => {
  const title = "New Staff Member Added";
  const message = `${staffName} has been added as ${role}.`;

  return createNotificationForAllRoles({
    restaurantId,
    type: "NEW_STAFF",
    title,
    message,
    entityType: "Staff",
    entityId: staffId,
    excludeUserId: actorUserId,
  });
};
