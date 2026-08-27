import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildInvoiceBuffer } from "../services/invoiceService.js";
import {
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  addStatusHistoryEntry,
  buildCalculatedOrderPayload,
  canRoleUpdateStatus,
  canTransitionOrderStatus,
  createOrderAuditLog,
  createOrderNotifications,
  ensureOrderDeleteAllowed,
  ensureOrderEditAllowed,
  findOrCreateCustomer,
  generateOrderNumber,
  getSortCriteria,
  normalizeOrderStatus,
  normalizeOrderType,
  normalizePaymentMethod,
  normalizePaymentStatus,
  prepareOrderItems,
  searchCustomers,
} from "../services/orderService.js";
import { syncPaymentFromOrder } from "../services/paymentService.js";
import { updateOrderPaymentState } from "../services/paymentService.js";
import { assignTableForDineInOrder, maybeReleaseTableAfterSettlement, releaseOrderTableIfNeeded } from "../services/tableOrderService.js";
import { cancelKotTickets, createKotRevision, mergeItemsWithKitchenState } from "../services/kotService.js";
import { buildRestaurantQuery, resolveRestaurantForUser } from "../utils/tenantUtils.js";
import { verifyQrOrderToken } from "../utils/qrOrderToken.js";
import { assertOrderTableConsistency } from "../services/posValidationService.js";
import { runInTransaction } from "../services/transactionService.js";
import {
  emitOrderCancelled,
  emitOrderCreated,
  emitOrderPaymentUpdated,
  emitOrderStatusChanged,
  emitKitchenTicketCreated,
} from "../socket/orderSocket.js";

const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const canAccessOrder = (user, order) => {
  if (!user || !order) return false;
  if (["admin", "manager", "cashier", "waiter", "chef"].includes(user.role)) return true;
  if (user.role === "delivery") return order.orderType === ORDER_TYPES.DELIVERY;
  if (user.role === "customer") return String(order.customer?._id || order.customer) === String(user._id);
  return false;
};

const buildOrderSearchFilter = async (search) => {
  const query = String(search || "").trim();
  if (!query) return {};

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const [customers, tables] = await Promise.all([
    User.find({ role: "customer", $or: [{ fullName: regex }, { phone: regex }] }).select("_id").lean(),
    Table.find({ tableNumber: regex }).select("_id").lean(),
  ]);

  return {
    $or: [
      { orderNumber: regex },
      ...(customers.length ? [{ customer: { $in: customers.map((c) => c._id) } }] : []),
      ...(tables.length ? [{ table: { $in: tables.map((t) => t._id) } }] : []),
    ],
  };
};

const normalizeOrderOutput = (order) => {
  const data = order.toObject ? order.toObject() : order;
  return {
    ...data,
    items: (data.items || []).map((item) => ({
      ...item,
      menuItem: item.menuItem,
      food: item.menuItem,
    })),
  };
};

const resolveOrderRestaurant = async ({ orderType, tableId, user }) => {
  if (orderType === ORDER_TYPES.DINE_IN && tableId) {
    const table = await Table.findById(tableId).select("restaurant");
    if (!table) throw new ApiError(404, "Table not found");
    if (table.restaurant) {
      const restaurant = await resolveRestaurantForUser({ restaurantId: table.restaurant, user });
      return restaurant._id;
    }
  }

  if (user?.restaurant) {
    return user.restaurant;
  }

  const restaurant = await resolveRestaurantForUser({ user });
  return restaurant._id;
};

const getRestaurantGstRate = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select("gstRate").lean();
  if (!restaurant) throw new ApiError(404, "Restaurant not found");
  return Number(restaurant.gstRate || 0);
};

const getIdempotencyKey = (req) => {
  const value = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim();
  if (!value) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value)) {
    throw new ApiError(422, "Idempotency-Key must be 8-128 URL-safe characters");
  }
  return value;
};

const findIdempotentOrder = async ({ restaurant, idempotencyKey }) => {
  if (!idempotencyKey) return null;
  return Order.findOne({ restaurant, idempotencyKey, isArchived: { $ne: true } })
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name");
};

const createOrderAtomically = async ({ payload, restaurantId, tableDoc, actorId = null }) =>
  runInTransaction(async (session) => {
    if (payload.idempotencyKey) {
      const existing = await Order.findOne({ restaurant: restaurantId, idempotencyKey: payload.idempotencyKey, isArchived: { $ne: true } }).session(session);
      if (existing) return { order: existing, duplicate: true };
    }
    const orderNumber = await generateOrderNumber(session);
    const [order] = await Order.create([{ ...payload, orderNumber }], { session });
    if (order.orderType === ORDER_TYPES.DINE_IN) {
      await assignTableForDineInOrder(order.table, order._id, { restaurantId, actor: actorId, session });
    }
    await syncPaymentFromOrder(order, {
      status: PAYMENT_STATUSES.PENDING,
      metadata: { paymentMethod: order.paymentMethod, paymentStatus: PAYMENT_STATUSES.PENDING, orderType: order.orderType },
      note: "Payment initiated during order creation",
      session,
      emit: false,
      notify: false,
    });
    await createKotRevision({ order, userId: actorId, session });
    return { order, duplicate: false };
  });

export const createOrder = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!["admin", "manager", "cashier", "waiter", "customer"].includes(role)) {
    throw new ApiError(403, "Forbidden");
  }

  const orderType = normalizeOrderType(req.body.orderType);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || PAYMENT_METHODS.CASH);
  const paymentStatus = PAYMENT_STATUSES.PENDING;

  let customerId = req.body.customer || null;
  if (role === "customer") {
    customerId = req.user._id;
  }

  const restaurantId = await resolveOrderRestaurant({ orderType, tableId: req.body.table, user: req.user });
  const gstRate = await getRestaurantGstRate(restaurantId);
  const processedItems = await prepareOrderItems(req.body.items || [], { restaurant: restaurantId });
  const calculated = buildCalculatedOrderPayload({
    orderType,
    items: processedItems,
    discount: req.body.discount,
    tax: null,
    taxPercent: gstRate,
    serviceCharge: req.body.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge,
  });

  const idempotencyKey = getIdempotencyKey(req);
  const existing = await findIdempotentOrder({ restaurant: restaurantId, idempotencyKey });
  if (existing) return res.status(200).json(new ApiResponse(true, "Order already created", normalizeOrderOutput(existing)));

  const tableDoc = orderType === ORDER_TYPES.DINE_IN
    ? await Table.findOne({ _id: req.body.table, restaurant: restaurantId }).select("restaurant")
    : null;
  assertOrderTableConsistency({ orderType, table: req.body.table, restaurant: restaurantId, tableRestaurant: tableDoc?.restaurant });
  if (orderType === ORDER_TYPES.DINE_IN && !tableDoc) throw new ApiError(404, "Table not found");

  const result = await createOrderAtomically({
    restaurantId,
    tableDoc,
    actorId: req.user._id,
    payload: {
    customer: customerId,
    table: orderType === ORDER_TYPES.DINE_IN ? req.body.table || null : null,
    restaurant: restaurantId,
    outlet: req.outletId,
    orderType,
    items: calculated.items,
    subtotal: calculated.subtotal,
    discount: calculated.discount,
    tax: calculated.tax,
    serviceCharge: calculated.serviceCharge,
    deliveryCharge: calculated.deliveryCharge,
    total: calculated.total,
    paymentMethod,
    paymentStatus,
    status: ORDER_STATUSES.PENDING,
    specialInstructions: req.body.specialInstructions || "",
    createdBy: req.user._id,
    statusHistory: [{ status: ORDER_STATUSES.PENDING, changedBy: req.user._id, changedAt: new Date() }],
    deliveryAddress: req.body.deliveryAddress || "",
    notes: req.body.notes || "",
    idempotencyKey,
    },
  });
  if (result.duplicate) {
    const existingOrder = await findIdempotentOrder({ restaurant: restaurantId, idempotencyKey });
    return res.status(200).json(new ApiResponse(true, "Order already created", normalizeOrderOutput(existingOrder)));
  }
  const order = result.order;

  const populated = await Order.findById(order._id)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name");

  await createOrderAuditLog({ user: req.user, action: "Order Created", order: populated });
  await createOrderNotifications({
    title: "New Order Received",
    message: `New order #${populated.orderNumber} has been received. Amount: ₹${populated.total}.`,
    actorUserId: req.user._id,
    type: "NEW_ORDER",
    restaurantId: populated.restaurant,
    entityType: "Order",
    entityId: populated._id,
    orderNumber: populated.orderNumber,
    customerName: populated.customer?.fullName || null,
    total: populated.total,
  });

  emitOrderCreated(normalizeOrderOutput(populated));
  emitKitchenTicketCreated(populated);

  res.status(201).json(new ApiResponse(true, "Order created", normalizeOrderOutput(populated)));
});

export const createGuestOrder = asyncHandler(async (req, res) => {
  const orderType = normalizeOrderType(req.body.orderType);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || PAYMENT_METHODS.CASH);
  const paymentStatus = PAYMENT_STATUSES.PENDING;

  const tableId = req.body.table || null;
  const qrContext = verifyQrOrderToken(req.body.qrToken);
  if (String(qrContext.tableId) !== String(tableId)) {
    throw new ApiError(403, "QR token does not match the selected table");
  }
  const restaurantId = await resolveOrderRestaurant({ orderType, tableId, user: null });
  if (String(qrContext.restaurantId) !== String(restaurantId)) {
    throw new ApiError(403, "QR token does not match the selected restaurant");
  }

  const processedItems = await prepareOrderItems(req.body.items || [], { restaurant: restaurantId });
  const gstRate = await getRestaurantGstRate(restaurantId);
  const calculated = buildCalculatedOrderPayload({
    orderType,
    items: processedItems,
    discount: req.body.discount,
    tax: null,
    taxPercent: gstRate,
    serviceCharge: req.body.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge,
  });

  if (orderType !== ORDER_TYPES.DINE_IN) throw new ApiError(422, "QR ordering supports DINE_IN orders only");
  const idempotencyKey = getIdempotencyKey(req);
  const existing = await findIdempotentOrder({ restaurant: restaurantId, idempotencyKey });
  if (existing) return res.status(200).json(new ApiResponse(true, "Order already created", normalizeOrderOutput(existing)));
  const tableDoc = await Table.findOne({ _id: tableId, restaurant: restaurantId }).select("restaurant");
  assertOrderTableConsistency({ orderType, table: tableId, restaurant: restaurantId, tableRestaurant: tableDoc?.restaurant });
  if (!tableDoc) throw new ApiError(404, "Table not found");

  const result = await createOrderAtomically({
    restaurantId,
    tableDoc,
    payload: {
    customer: null,
    table: orderType === ORDER_TYPES.DINE_IN ? tableId : null,
    restaurant: restaurantId,
    orderType,
    items: calculated.items,
    subtotal: calculated.subtotal,
    discount: calculated.discount,
    tax: calculated.tax,
    serviceCharge: calculated.serviceCharge,
    deliveryCharge: calculated.deliveryCharge,
    total: calculated.total,
    paymentMethod,
    paymentStatus,
    status: ORDER_STATUSES.PENDING,
    specialInstructions: req.body.specialInstructions || "",
    createdBy: null,
    statusHistory: [{ status: ORDER_STATUSES.PENDING, changedAt: new Date() }],
    deliveryAddress: req.body.deliveryAddress || "",
    notes: req.body.notes || "",
    idempotencyKey,
    },
  });
  if (result.duplicate) {
    const existingOrder = await findIdempotentOrder({ restaurant: restaurantId, idempotencyKey });
    return res.status(200).json(new ApiResponse(true, "Order already created", normalizeOrderOutput(existingOrder)));
  }
  const order = result.order;

  const populated = await Order.findById(order._id)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name");

  await createOrderAuditLog({ user: null, action: "Guest Order Created", order: populated });
  await createOrderNotifications({
    title: "New Guest Order Received",
    message: `New guest order #${populated.orderNumber} has been received. Amount: ₹${populated.total}.`,
    actorUserId: null,
    type: "NEW_ORDER",
    restaurantId: populated.restaurant,
    entityType: "Order",
    entityId: populated._id,
    orderNumber: populated.orderNumber,
    customerName: null,
    total: populated.total,
  });

  emitOrderCreated(normalizeOrderOutput(populated));
  emitKitchenTicketCreated(populated);

  res.status(201).json(new ApiResponse(true, "Guest order created", normalizeOrderOutput(populated)));
});

export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filters = { isArchived: false };

  if (req.user.role === "customer") {
    filters.customer = req.user._id;
  }

  if (req.user.role === "delivery") {
    filters.orderType = ORDER_TYPES.DELIVERY;
  }

  if (req.query.status) filters.status = normalizeOrderStatus(req.query.status);
  if (req.query.orderType) filters.orderType = normalizeOrderType(req.query.orderType);
  if (req.query.paymentStatus) filters.paymentStatus = normalizePaymentStatus(req.query.paymentStatus);

  if (req.query.date) {
    const start = new Date(req.query.date);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filters.createdAt = { $gte: start, $lt: end };
    }
  }

  const searchFilter = await buildOrderSearchFilter(req.query.search);
  const queryFilters = {
    ...filters,
    ...(Object.keys(searchFilter).length ? searchFilter : {}),
  };

  const finalFilters = await buildRestaurantQuery(queryFilters, req.user);
  const sort = getSortCriteria(req.query.sortBy);

  const [orders, total] = await Promise.all([
    Order.find(finalFilters)
      .populate("customer", "fullName email phone")
      .populate("table", "tableNumber floor section")
      .populate("items.menuItem", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(finalFilters),
  ]);

  res.status(200).json(
    new ApiResponse(
      true,
      "Orders fetched",
      orders.map(normalizeOrderOutput),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    )
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user))
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name")
    .populate("statusHistory.changedBy", "fullName role");

  if (!order || order.isArchived) throw new ApiError(404, "Order not found");
  if (!canAccessOrder(req.user, order)) throw new ApiError(403, "Forbidden");

  res.status(200).json(new ApiResponse(true, "Order fetched", normalizeOrderOutput(order)));
});

export const updateOrder = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  if (!["admin", "manager", "cashier", "waiter"].includes(req.user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  ensureOrderEditAllowed(order);

  const nextOrderType = req.body.orderType ? normalizeOrderType(req.body.orderType) : order.orderType;
  const gstRate = await getRestaurantGstRate(order.restaurant);
  const nextItems = req.body.items ? await prepareOrderItems(req.body.items, { restaurant: order.restaurant }) : order.items;

  const itemsWithKitchenStatus = mergeItemsWithKitchenState({
    previousItems: order.items || [],
    nextItems,
  });

  const calculated = buildCalculatedOrderPayload({
    orderType: nextOrderType,
    items: itemsWithKitchenStatus,
    discount: req.body.discount !== undefined ? req.body.discount : order.discount,
    tax: null,
    taxPercent: gstRate,
    serviceCharge: req.body.serviceCharge !== undefined ? req.body.serviceCharge : order.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge !== undefined ? req.body.deliveryCharge : order.deliveryCharge,
  });

  const previousTable = order.table ? String(order.table) : null;
  const requestedTable = nextOrderType === ORDER_TYPES.DINE_IN
    ? (req.body.table !== undefined ? req.body.table : order.table)
    : null;
  const targetTable = nextOrderType === ORDER_TYPES.DINE_IN
    ? await Table.findOne({ _id: requestedTable, restaurant: order.restaurant }).select("restaurant")
    : null;
  assertOrderTableConsistency({
    orderType: nextOrderType,
    table: requestedTable,
    restaurant: order.restaurant,
    tableRestaurant: targetTable?.restaurant,
  });
  if (nextOrderType === ORDER_TYPES.DINE_IN && !targetTable) throw new ApiError(404, "Table not found");

  order.orderType = nextOrderType;
  order.items = mergeItemsWithKitchenState({
    previousItems: order.items || [],
    nextItems: calculated.items,
  });
  order.subtotal = calculated.subtotal;
  order.discount = calculated.discount;
  order.tax = calculated.tax;
  order.serviceCharge = calculated.serviceCharge;
  order.deliveryCharge = calculated.deliveryCharge;
  order.total = calculated.total;
  order.specialInstructions = req.body.specialInstructions ?? order.specialInstructions;

  if (nextOrderType !== ORDER_TYPES.DINE_IN) {
    order.table = null;
  } else {
    order.table = requestedTable;
  }

  const itemsChanged = req.body.items !== undefined;
  if (itemsChanged) order.kotRevision = Number(order.kotRevision || 0) + 1;
  await runInTransaction(async (session) => {
    await order.save({ session });
    if (itemsChanged) {
      await createKotRevision({ order, userId: req.user._id, session });
    }
  });

  if (order.orderType === ORDER_TYPES.DINE_IN) {
    await assignTableForDineInOrder(order.table, order._id, { restaurantId: order.restaurant });
  }

  if (previousTable && previousTable !== String(order.table || "")) {
    await releaseOrderTableIfNeeded({ _id: order._id, table: previousTable });
  }

  if (order.orderType !== ORDER_TYPES.DINE_IN && previousTable) {
    await releaseOrderTableIfNeeded({ _id: order._id, table: previousTable });
  }

  const populated = await Order.findById(order._id)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name")
    .populate("statusHistory.changedBy", "fullName role");

  await createOrderAuditLog({ user: req.user, action: "Order Updated", order: populated });

  emitOrderStatusChanged(populated);

  res.status(200).json(new ApiResponse(true, "Order updated", normalizeOrderOutput(populated)));
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const identifier = String(req.params.id || "").trim();
  const order = mongoose.isValidObjectId(identifier)
    ? await Order.findOne(await buildRestaurantQuery({ _id: identifier }, req.user))
    : await Order.findOne(await buildRestaurantQuery({ orderNumber: identifier }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  if (!["admin", "manager"].includes(req.user.role)) throw new ApiError(403, "Forbidden");

  ensureOrderDeleteAllowed(order);

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        isArchived: true,
        status: ORDER_STATUSES.CANCELLED,
      },
      $push: {
        statusHistory: {
          status: ORDER_STATUSES.CANCELLED,
          changedBy: req.user._id,
          changedAt: new Date(),
        },
      },
    },
    { runValidators: false }
  );

  order.isArchived = true;
  order.status = ORDER_STATUSES.CANCELLED;
  addStatusHistoryEntry(order, ORDER_STATUSES.CANCELLED, req.user._id);

  await releaseOrderTableIfNeeded(order);
  await cancelKotTickets({ order });
  await createOrderAuditLog({ user: req.user, action: "Order Cancelled", order });
  await createOrderNotifications({
    title: "Order Cancelled",
    message: `Order #${order.orderNumber} has been cancelled.`,
    actorUserId: req.user._id,
    type: "ORDER_CANCELLED",
    restaurantId: order.restaurant,
    entityType: "Order",
    entityId: order._id,
    orderNumber: order.orderNumber,
  });

  emitOrderCancelled(order);

  res.status(200).json(new ApiResponse(true, "Order archived"));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  const currentStatus = normalizeOrderStatus(order.status);
  const nextStatus = normalizeOrderStatus(req.body.status);

  if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
    throw new ApiError(409, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }

  if (!canRoleUpdateStatus({ role: req.user.role, nextStatus, order })) {
    throw new ApiError(403, "You do not have permission to set this status");
  }

  order.status = nextStatus;
  addStatusHistoryEntry(order, nextStatus, req.user._id);
  await order.save();

  if ([ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED].includes(nextStatus)) {
    await maybeReleaseTableAfterSettlement(order);
  }

  if (nextStatus === ORDER_STATUSES.CANCELLED) {
    await cancelKotTickets({ order });
    await createOrderNotifications({
      title: "Order Cancelled",
      message: `${order.orderNumber} has been cancelled`,
      actorUserId: req.user._id,
      type: "ORDER_CANCELLED",
      restaurantId: order.restaurant,
      entityType: "Order",
      entityId: order._id,
      orderNumber: order.orderNumber,
    });
    emitOrderCancelled(order);
  } else {
    await createOrderNotifications({
      title: `Order ${nextStatus}`,
      message: `${order.orderNumber} moved to ${nextStatus}`,
      actorUserId: req.user._id,
      type: "order",
      restaurantId: order.restaurant,
      entityType: "Order",
      entityId: order._id,
    });
    emitOrderStatusChanged(order);
  }

  await createOrderAuditLog({ user: req.user, action: "Order Status Changed", order, context: { status: nextStatus } });

  const populated = await Order.findById(order._id)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name")
    .populate("statusHistory.changedBy", "fullName role");

  res.status(200).json(new ApiResponse(true, "Order status updated", normalizeOrderOutput(populated)));
});

export const updateOrderPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  if (!["admin", "manager", "cashier"].includes(req.user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  if (req.body.paymentStatus !== undefined || req.body.transactionId || req.body.razorpayOrderId || req.body.razorpayPaymentId) {
    throw new ApiError(422, "Payment status and transaction details are server-owned. Use payment verification.");
  }

  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || order.paymentMethod);
  const paymentStatus = normalizePaymentStatus(order.paymentStatus);

  if (paymentStatus !== PAYMENT_STATUSES.PENDING && paymentStatus !== PAYMENT_STATUSES.FAILED) {
    throw new ApiError(409, "Payment method cannot be changed after settlement has started");
  }

  const result = await updateOrderPaymentState(order, {
    paymentMethod,
    paymentStatus,
    gateway: paymentMethod,
    note: "Payment method selected",
  });

  const orderUpdate = result.order;

  await createOrderAuditLog({ user: req.user, action: "Order Payment Updated", order, context: { paymentMethod, paymentStatus } });

  await createOrderNotifications({
    title: paymentStatus === PAYMENT_STATUSES.PAID ? "Payment Received" : "Payment Updated",
    message: `${order.orderNumber} payment is now ${paymentStatus}`,
    actorUserId: req.user._id,
    type: paymentStatus === PAYMENT_STATUSES.PAID ? "PAYMENT_RECEIVED" : "payment",
    restaurantId: order.restaurant,
    entityType: "Order",
    entityId: order._id,
    orderNumber: order.orderNumber,
    total: order.total,
    paymentMethod: paymentMethod,
  });

  emitOrderPaymentUpdated(orderUpdate);
  await maybeReleaseTableAfterSettlement(orderUpdate);

  res.status(200).json(new ApiResponse(true, "Order payment updated", normalizeOrderOutput(orderUpdate)));
});

export const payOrder = asyncHandler(async (req, res) => {
  throw new ApiError(410, "This endpoint is retired. Create a payment intent and use server-side verification.");
});

export const updateOrderPaymentStatus = asyncHandler(async (req, res) => {
  throw new ApiError(410, "This endpoint is retired. Use the payment verification workflow.");
});

export const getOrderStats = asyncHandler(async (req, res) => {
  const roleFilter = req.user.role === "customer" ? { customer: req.user._id } : {};
  const tenantFilter = await buildRestaurantQuery({ isArchived: false, ...roleFilter }, req.user);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [statusRows, todayRevenueAgg] = await Promise.all([
    Order.aggregate([
      { $match: tenantFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      {
        $match: {
          ...tenantFilter,
          createdAt: { $gte: todayStart },
          paymentStatus: PAYMENT_STATUSES.PAID,
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  const stats = {
    totalOrders: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
  };

  for (const row of statusRows) {
    const status = normalizeOrderStatus(row._id);
    stats.totalOrders += row.count;
    if (status === ORDER_STATUSES.PENDING || status === ORDER_STATUSES.CONFIRMED) stats.pending += row.count;
    if (status === ORDER_STATUSES.PREPARING) stats.preparing += row.count;
    if (status === ORDER_STATUSES.READY || status === ORDER_STATUSES.SERVED) stats.ready += row.count;
    if (status === ORDER_STATUSES.COMPLETED) stats.completed += row.count;
    if (status === ORDER_STATUSES.CANCELLED) stats.cancelled += row.count;
  }

  res.status(200).json(new ApiResponse(true, "Order stats fetched", stats));
});

export const getTodayOrders = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const filters = await buildRestaurantQuery({
    isArchived: false,
    createdAt: { $gte: start, $lt: end },
    ...(req.user.role === "customer" ? { customer: req.user._id } : {}),
  }, req.user);

  const orders = await Order.find(filters)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber")
    .populate("items.menuItem", "name")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(true, "Today orders fetched", orders.map(normalizeOrderOutput)));
});

export const getPendingOrders = asyncHandler(async (req, res) => {
  const filters = await buildRestaurantQuery({
    isArchived: false,
    status: { $in: [ORDER_STATUSES.PENDING, ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.PREPARING, ORDER_STATUSES.READY] },
    ...(req.user.role === "customer" ? { customer: req.user._id } : {}),
  }, req.user);

  const orders = await Order.find(filters)
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber")
    .populate("items.menuItem", "name")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(true, "Pending orders fetched", orders.map(normalizeOrderOutput)));
});

export const searchOrderCustomers = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!["admin", "manager", "cashier", "waiter"].includes(role)) {
    throw new ApiError(403, "Forbidden");
  }

  const customers = await searchCustomers(req.query.search || "");
  res.status(200).json(new ApiResponse(true, "Customers fetched", customers));
});

export const addOrderCustomer = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!["admin", "manager", "cashier", "waiter"].includes(role)) {
    throw new ApiError(403, "Forbidden");
  }

  const { fullName, email, phone } = req.body;
  if (!fullName || (!email && !phone)) {
    throw new ApiError(422, "Customer name with email or phone is required");
  }

  const { customer, created } = await findOrCreateCustomer({ fullName, email, phone });
  const message = created ? "Customer created" : "Existing customer found";

  res.status(created ? 201 : 200).json(new ApiResponse(true, message, customer));
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user))
    .populate("customer", "fullName")
    .populate("items.menuItem", "name");

  if (!order) throw new ApiError(404, "Order not found");

  const buffer = await buildInvoiceBuffer(order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.orderNumber}.pdf`);
  res.send(buffer);
});
