import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Food from "../models/Food.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Log from "../models/Log.js";
import ApiError from "../utils/ApiError.js";
import {
  notifyNewOrder,
  notifyOrderCancelled,
  notifyPaymentReceived,
} from "./notificationService.js";
import { calculateOrderAmounts } from "./orderCalculationService.js";

export const ORDER_STATUSES = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const ORDER_TYPES = {
  DINE_IN: "DINE_IN",
  TAKEAWAY: "TAKEAWAY",
  DELIVERY: "DELIVERY",
};

export const PAYMENT_METHODS = {
  CASH: "CASH",
  UPI: "UPI",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  RAZORPAY: "RAZORPAY",
  OTHER: "OTHER",
};

export const PAYMENT_STATUSES = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
};

const statusAliases = {
  pending: ORDER_STATUSES.PENDING,
  confirmed: ORDER_STATUSES.CONFIRMED,
  accepted: ORDER_STATUSES.CONFIRMED,
  preparing: ORDER_STATUSES.PREPARING,
  ready: ORDER_STATUSES.READY,
  served: ORDER_STATUSES.SERVED,
  completed: ORDER_STATUSES.COMPLETED,
  delivered: ORDER_STATUSES.COMPLETED,
  cancelled: ORDER_STATUSES.CANCELLED,
  placed: ORDER_STATUSES.PENDING,
};

const paymentStatusAliases = {
  pending: PAYMENT_STATUSES.PENDING,
  paid: PAYMENT_STATUSES.PAID,
  success: PAYMENT_STATUSES.PAID,
  failed: PAYMENT_STATUSES.FAILED,
  refunded: PAYMENT_STATUSES.REFUNDED,
  partially_refunded: PAYMENT_STATUSES.PARTIALLY_REFUNDED,
};

const paymentMethodAliases = {
  cash: PAYMENT_METHODS.CASH,
  upi: PAYMENT_METHODS.UPI,
  card: PAYMENT_METHODS.CREDIT_CARD,
  credit_card: PAYMENT_METHODS.CREDIT_CARD,
  debit_card: PAYMENT_METHODS.DEBIT_CARD,
  online: PAYMENT_METHODS.RAZORPAY,
  stripe: PAYMENT_METHODS.RAZORPAY,
  razorpay: PAYMENT_METHODS.RAZORPAY,
  wallet: PAYMENT_METHODS.OTHER,
  other: PAYMENT_METHODS.OTHER,
};

const orderTypeAliases = {
  dine_in: ORDER_TYPES.DINE_IN,
  takeaway: ORDER_TYPES.TAKEAWAY,
  delivery: ORDER_TYPES.DELIVERY,
};

const statusTransitions = {
  [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.PREPARING, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.PREPARING]: [ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.READY]: [ORDER_STATUSES.SERVED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.SERVED]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.COMPLETED]: [],
  [ORDER_STATUSES.CANCELLED]: [],
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeOrderStatus = (value) => {
  if (!value) return ORDER_STATUSES.PENDING;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(ORDER_STATUSES).includes(upper)) return upper;

  const alias = statusAliases[String(value).trim().toLowerCase()];
  if (!alias) throw new ApiError(422, "Invalid order status");
  return alias;
};

export const normalizeOrderType = (value) => {
  if (!value) return ORDER_TYPES.DINE_IN;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(ORDER_TYPES).includes(upper)) return upper;

  const alias = orderTypeAliases[String(value).trim().toLowerCase()];
  if (!alias) throw new ApiError(422, "Invalid order type");
  return alias;
};

export const normalizePaymentMethod = (value) => {
  if (!value) return PAYMENT_METHODS.CASH;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(PAYMENT_METHODS).includes(upper)) return upper;

  const alias = paymentMethodAliases[String(value).trim().toLowerCase()];
  if (!alias) throw new ApiError(422, "Invalid payment method");
  return alias;
};

export const normalizePaymentStatus = (value) => {
  if (!value) return PAYMENT_STATUSES.PENDING;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(PAYMENT_STATUSES).includes(upper)) return upper;

  const alias = paymentStatusAliases[String(value).trim().toLowerCase()];
  if (!alias) throw new ApiError(422, "Invalid payment status");
  return alias;
};

export const canTransitionOrderStatus = (from, to) => {
  const source = normalizeOrderStatus(from);
  const target = normalizeOrderStatus(to);
  return (statusTransitions[source] || []).includes(target);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const generateOrderNumber = async () => {
  const latest = await Order.findOne({ orderNumber: /^ORD-\d+$/i })
    .select("orderNumber")
    .sort({ createdAt: -1 })
    .lean();

  const latestDigits = Number(latest?.orderNumber?.split("-")[1] || 10000);
  let nextNumber = latestDigits + 1;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `ORD-${nextNumber}`;
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
    nextNumber += 1;
  }

  return `ORD-${Date.now()}${crypto.randomInt(100, 999)}`;
};

const selectMenuItemFields = "name price isAvailable available";

export const prepareOrderItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(422, "An order must contain at least one item.");
  }

  const menuIds = items.map((item) => item.menuItem || item.food).filter(Boolean);
  if (!menuIds.length) throw new ApiError(422, "Menu item is required for each order item.");

  const uniqueMenuIds = [...new Set(menuIds.map((id) => String(id)))];
  const foods = await Food.find({ _id: { $in: uniqueMenuIds } }).select(selectMenuItemFields).lean();
  const foodMap = new Map(foods.map((food) => [String(food._id), food]));

  const normalizedItems = items.map((item) => {
    const menuItemId = item.menuItem || item.food;
    if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) {
      throw new ApiError(422, "Invalid menu item selected");
    }

    const found = foodMap.get(String(menuItemId));
    if (!found) throw new ApiError(404, "Menu item not found");

    const isAvailable = found.isAvailable ?? found.available;
    if (!isAvailable) {
      throw new ApiError(422, `${found.name} is currently unavailable`);
    }

    const quantity = toNumber(item.quantity, 0);
    if (quantity < 1) {
      throw new ApiError(422, "Quantity must be greater than 0");
    }

    const snapshotPrice = toNumber(found.price, 0);

    return {
      menuItem: found._id,
      name: found.name,
      price: snapshotPrice,
      quantity,
      specialInstructions: String(item.specialInstructions || "").trim(),
    };
  });

  return normalizedItems;
};

export const buildCalculatedOrderPayload = ({
  orderType,
  items,
  discount,
  tax,
  taxPercent,
  serviceCharge,
  serviceChargePercent,
  deliveryCharge,
}) => {
  const calculation = calculateOrderAmounts({
    orderType,
    items,
    discount,
    tax,
    taxPercent,
    serviceCharge,
    serviceChargePercent,
    deliveryCharge,
  });

  return {
    items: calculation.items.map((item) => ({
      menuItem: item.menuItem,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      specialInstructions: item.specialInstructions || "",
    })),
    subtotal: calculation.subtotal,
    discount: calculation.discount,
    tax: calculation.tax,
    serviceCharge: calculation.serviceCharge,
    deliveryCharge: calculation.deliveryCharge,
    total: calculation.total,
  };
};

export const buildOrderFilters = ({ query, user }) => {
  const filters = { isArchived: false };

  if (user.role === "customer") {
    filters.customer = user._id;
  }

  if (user.role === "delivery") {
    filters.orderType = ORDER_TYPES.DELIVERY;
  }

  if (query.status) {
    filters.status = normalizeOrderStatus(query.status);
  }

  if (query.orderType) {
    filters.orderType = normalizeOrderType(query.orderType);
  }

  if (query.paymentStatus) {
    filters.paymentStatus = normalizePaymentStatus(query.paymentStatus);
  }

  if (query.date) {
    const start = new Date(query.date);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filters.createdAt = { $gte: start, $lt: end };
    }
  }

  if (query.search) {
    const pattern = escapeRegex(String(query.search).trim());
    filters.$or = [
      { orderNumber: { $regex: pattern, $options: "i" } },
      { "customer.fullName": { $regex: pattern, $options: "i" } },
      { "customer.phone": { $regex: pattern, $options: "i" } },
      { "table.tableNumber": { $regex: pattern, $options: "i" } },
    ];
  }

  return filters;
};

export const getSortCriteria = (sortBy = "newest") => {
  const map = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    amount_high: { total: -1, createdAt: -1 },
    amount_low: { total: 1, createdAt: -1 },
  };

  return map[sortBy] || map.newest;
};

export const ensureOrderEditAllowed = (order) => {
  const status = normalizeOrderStatus(order.status);
  if ([ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED].includes(status)) {
    throw new ApiError(409, "This order cannot be edited in its current status.");
  }
};

export const ensureOrderDeleteAllowed = (order) => {
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
};

export const canRoleUpdateStatus = ({ role, nextStatus, order }) => {
  const normalizedRole = String(role || "").toLowerCase();

  if (["admin", "manager", "cashier"].includes(normalizedRole)) return true;

  if (normalizedRole === "waiter") {
    return [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.SERVED, ORDER_STATUSES.CANCELLED].includes(nextStatus);
  }

  if (normalizedRole === "chef") {
    return [ORDER_STATUSES.PREPARING, ORDER_STATUSES.READY].includes(nextStatus);
  }

  if (normalizedRole === "delivery") {
    return order.orderType === ORDER_TYPES.DELIVERY && nextStatus === ORDER_STATUSES.COMPLETED;
  }

  return false;
};

export const addStatusHistoryEntry = (order, status, userId) => {
  const normalizedStatus = normalizeOrderStatus(status);
  order.statusHistory = [
    ...(order.statusHistory || []),
    {
      status: normalizedStatus,
      changedBy: userId || null,
      changedAt: new Date(),
    },
  ];
};

export const createOrderAuditLog = async ({ user, action, order, context = {} }) => {
  try {
    await Log.create({
      level: "info",
      message: action,
      context: {
        userId: user?._id,
        userRole: user?.role,
        orderId: order?._id,
        orderNumber: order?.orderNumber,
        ...context,
      },
    });
  } catch (_error) {
    // Ignore audit write failures to prevent flow blocking.
  }
};

export const createOrderNotifications = async ({ title, message, actorUserId = null, type = "order", restaurantId, entityType, entityId, orderNumber, customerName, total, paymentMethod, reason }) => {
  try {
    const safeRestaurantId = restaurantId && mongoose.isValidObjectId(restaurantId) ? restaurantId : null;
    const safeEntityId = entityId && mongoose.isValidObjectId(entityId) ? entityId : null;

    if (type === "NEW_ORDER") {
      await notifyNewOrder({
        restaurantId: safeRestaurantId,
        orderId: safeEntityId,
        orderNumber: orderNumber || "",
        customerName: customerName || null,
        total: total || 0,
        actorUserId,
      });
      return;
    }

    if (type === "ORDER_CANCELLED") {
      await notifyOrderCancelled({
        restaurantId: safeRestaurantId,
        orderId: safeEntityId,
        orderNumber: orderNumber || "",
        customer: customerName || null,
        total: total || 0,
        reason: reason || null,
        actorUserId,
      });
      return;
    }

    if (type === "PAYMENT_RECEIVED") {
      await notifyPaymentReceived({
        restaurantId: safeRestaurantId,
        paymentId: safeEntityId,
        orderId: safeEntityId,
        orderNumber: orderNumber || "",
        amount: total || 0,
        paymentMethod: paymentMethod || "Unknown",
        actorUserId,
      });
      return;
    }

    const recipients = await User.find({
      role: { $in: ["admin", "manager", "waiter", "chef", "cashier"] },
      isActive: true,
      ...(safeRestaurantId ? { restaurant: safeRestaurantId } : {}),
      ...(actorUserId ? { _id: { $ne: actorUserId } } : {}),
    }).select("_id");

    if (!recipients.length) return;

    const notifications = [];
    for (const recipient of recipients) {
      const existing = await Notification.findOne({
        user: recipient._id,
        type,
        entityType: entityType || null,
        entityId: safeEntityId,
      }).select("_id");

      if (existing) continue;

      const notification = await Notification.create({
        user: recipient._id,
        restaurantId: safeRestaurantId,
        title,
        message,
        type,
        entityType: entityType || null,
        entityId: safeEntityId,
        isRead: false,
      });
      notifications.push(notification);
    }
  } catch (_error) {
    // Ignore notification write failures to prevent flow blocking.
  }
};

export const searchCustomers = async (term) => {
  const search = String(term || "").trim();
  if (!search) return [];

  const pattern = new RegExp(escapeRegex(search), "i");
  return User.find({
    role: "customer",
    $or: [{ fullName: pattern }, { email: pattern }, { phone: pattern }],
  })
    .select("fullName email phone")
    .sort({ fullName: 1 })
    .limit(15)
    .lean();
};

export const findOrCreateCustomer = async ({ fullName, email, phone }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").trim();

  const existing = await User.findOne({
    role: "customer",
    $or: [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ],
  }).select("fullName email phone role isActive");

  if (existing) return { customer: existing, created: false };

  const randomPassword = `Cust@${crypto.randomInt(100000, 999999)}`;
  const created = await User.create({
    fullName: String(fullName || "Guest Customer").trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    password: randomPassword,
    role: "customer",
  });

  const customer = await User.findById(created._id).select("fullName email phone role isActive");
  return { customer, created: true };
};
