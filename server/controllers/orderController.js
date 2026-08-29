import mongoose from "mongoose";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildInvoiceBuffer, refreshInvoice } from "../services/invoiceService.js";
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
  generateOrderNumber,
  getSortCriteria,
  normalizeOrderStatus,
  normalizeOrderSource,
  normalizeOrderType,
  normalizePaymentMethod,
  normalizePaymentStatus,
  prepareOrderItems,
  searchCustomers,
  stampOrderLifecycle,
} from "../services/orderService.js";
import { findOrCreateRestaurantCustomer, getAuthorizedRestaurantIds, linkCustomerToRestaurant } from "../services/customerService.js";
import { recordVerifiedPayment, syncPaymentFromOrder, updateOrderPaymentState } from "../services/paymentService.js";
import { restoreRedeemedPointsForCancelledOrder } from "../services/loyaltyService.js";
import { assignTableForDineInOrder, maybeReleaseTableAfterSettlement, releaseOrderTableIfNeeded } from "../services/tableOrderService.js";
import { syncKotForOrder } from "../services/kotService.js";
import { resolveGstType } from "../services/gstService.js";
import { buildRestaurantQuery, resolveRestaurantForUser } from "../utils/tenantUtils.js";
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
  const inferredSource = data.orderType === ORDER_TYPES.DELIVERY ? "DELIVERY" : data.orderType === ORDER_TYPES.PICKUP ? "PICKUP" : data.orderType;
  return {
    ...data,
    // Legacy records predate orderSource; expose a stable value without mutating history.
    orderSource: data.orderSource || inferredSource,
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

const ONLINE_ORDER_SOURCES = ["ONLINE", "DELIVERY", "PICKUP"];
const isOnlineOrder = (order) => ONLINE_ORDER_SOURCES.includes(String(order?.orderSource || "").toUpperCase());

const findExistingExternalOrder = async ({ restaurantId, externalOrderId }) => {
  const key = String(externalOrderId || "").trim();
  if (!key) return null;
  return Order.findOne({ restaurant: restaurantId, externalOrderId: key, isArchived: false })
    .populate("customer", "fullName email phone")
    .populate("table", "tableNumber floor section status")
    .populate("items.menuItem", "name");
};

const resolveOrderGstType = async (restaurantId, billingState) => {
  const restaurant = restaurantId ? await Restaurant.findById(restaurantId).select("state").lean() : null;
  return resolveGstType({ restaurantState: restaurant?.state, billingState });
};

export const createOrder = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!["admin", "manager", "cashier", "waiter", "customer"].includes(role)) {
    throw new ApiError(403, "Forbidden");
  }

  const orderType = normalizeOrderType(req.body.orderType);
  const orderSource = normalizeOrderSource(req.body.orderSource, orderType);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || PAYMENT_METHODS.CASH);
  const paymentStatus = PAYMENT_STATUSES.PENDING;

  let customerId = req.body.customer || null;
  if (role === "customer") {
    customerId = req.user._id;
  }

  const restaurantId = await resolveOrderRestaurant({ orderType, tableId: req.body.table, user: req.user });
  const duplicate = await findExistingExternalOrder({ restaurantId, externalOrderId: req.body.externalOrderId });
  if (duplicate) {
    return res.status(200).json(new ApiResponse(true, "Existing order returned for this external order id", normalizeOrderOutput(duplicate)));
  }

  // Anonymous dine-in remains supported. When a reliable customer identifier
  // arrives with an order, use the shared CRM identity resolver instead.
  if (role === "customer") {
    await linkCustomerToRestaurant(req.user._id, restaurantId);
  } else if (!customerId && req.body.customerDetails) {
    const details = req.body.customerDetails;
    const resolved = await findOrCreateRestaurantCustomer({
      fullName: details.fullName || details.name,
      email: details.email,
      phone: details.phone,
      address: details.address || req.body.deliveryAddress,
      restaurantId,
    });
    customerId = resolved.customer._id;
  } else if (customerId) {
    const existingCustomer = await User.findOne({ _id: customerId, role: "customer" }).select("_id");
    if (!existingCustomer) throw new ApiError(404, "Customer not found");
    await linkCustomerToRestaurant(existingCustomer._id, restaurantId);
  }

  const processedItems = await prepareOrderItems(req.body.items || []);
  const orderNumber = await generateOrderNumber();
  const billingState = req.body.billingState || req.body.customerState || "";
  const calculated = buildCalculatedOrderPayload({
    orderType,
    items: processedItems,
    discount: req.body.discount,
    serviceCharge: req.body.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge,
    gstType: await resolveOrderGstType(restaurantId, billingState),
  });

  const order = await Order.create({
    orderNumber,
    customer: customerId,
    table: orderType === ORDER_TYPES.DINE_IN ? req.body.table || null : null,
    restaurant: restaurantId,
    outlet: req.user.activeOutlet || null,
    orderType,
    orderSource,
    externalOrderId: String(req.body.externalOrderId || "").trim() || undefined,
    items: calculated.items,
    subtotal: calculated.subtotal,
    discount: calculated.discount,
    tax: calculated.tax,
    serviceCharge: calculated.serviceCharge,
    deliveryCharge: calculated.deliveryCharge,
    taxableAmount: calculated.taxableAmount,
    gstType: calculated.gstType,
    cgst: calculated.cgst,
    sgst: calculated.sgst,
    igst: calculated.igst,
    total: calculated.total,
    paymentMethod,
    paymentStatus,
    status: ORDER_STATUSES.PENDING,
    specialInstructions: req.body.specialInstructions || "",
    createdBy: req.user._id,
    statusHistory: [{ status: ORDER_STATUSES.PENDING, changedBy: req.user._id, changedAt: new Date() }],
    deliveryAddress: req.body.deliveryAddress || "",
    pickupDetails: req.body.pickupDetails || "",
    billingState,
    notes: req.body.notes || "",
  });

  if (orderType === ORDER_TYPES.DINE_IN) {
    try {
      await assignTableForDineInOrder(order.table, order._id, { restaurantId });
    } catch (error) {
      await Order.deleteOne({ _id: order._id });
      throw error;
    }
  }

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
    online: isOnlineOrder(populated),
  });

  await syncPaymentFromOrder(populated, {
    status: paymentStatus,
    metadata: { paymentMethod, paymentStatus, orderType },
    note: paymentStatus === PAYMENT_STATUSES.PAID ? "Payment received during order creation" : "Payment initiated during order creation",
  });

  // Online orders enter KDS only once a staff member accepts them.
  if (!isOnlineOrder(populated)) await syncKotForOrder(populated);
  emitOrderCreated(normalizeOrderOutput(populated));
  if (!isOnlineOrder(populated)) emitKitchenTicketCreated(populated);

  res.status(201).json(new ApiResponse(true, "Order created", normalizeOrderOutput(populated)));
});

export const createGuestOrder = asyncHandler(async (req, res) => {
  const orderType = normalizeOrderType(req.body.orderType);
  const orderSource = normalizeOrderSource(req.body.orderSource, orderType);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || PAYMENT_METHODS.CASH);
  const paymentStatus = PAYMENT_STATUSES.PENDING;

  const tableId = req.body.table || null;
  const restaurantId = await resolveOrderRestaurant({ orderType, tableId, user: null });
  const duplicate = await findExistingExternalOrder({ restaurantId, externalOrderId: req.body.externalOrderId });
  if (duplicate) {
    return res.status(200).json(new ApiResponse(true, "Existing order returned for this external order id", normalizeOrderOutput(duplicate)));
  }

  const processedItems = await prepareOrderItems(req.body.items || []);
  const orderNumber = await generateOrderNumber();
  const billingState = req.body.billingState || req.body.customerState || "";
  const calculated = buildCalculatedOrderPayload({
    orderType,
    items: processedItems,
    discount: req.body.discount,
    serviceCharge: req.body.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge,
    gstType: await resolveOrderGstType(restaurantId, billingState),
  });

  const order = await Order.create({
    orderNumber,
    customer: null,
    table: orderType === ORDER_TYPES.DINE_IN ? tableId : null,
    restaurant: restaurantId,
    outlet: req.user.activeOutlet || null,
    orderType,
    orderSource,
    externalOrderId: String(req.body.externalOrderId || "").trim() || undefined,
    items: calculated.items,
    subtotal: calculated.subtotal,
    discount: calculated.discount,
    tax: calculated.tax,
    serviceCharge: calculated.serviceCharge,
    deliveryCharge: calculated.deliveryCharge,
    taxableAmount: calculated.taxableAmount,
    gstType: calculated.gstType,
    cgst: calculated.cgst,
    sgst: calculated.sgst,
    igst: calculated.igst,
    total: calculated.total,
    paymentMethod,
    paymentStatus,
    status: ORDER_STATUSES.PENDING,
    specialInstructions: req.body.specialInstructions || "",
    createdBy: null,
    statusHistory: [{ status: ORDER_STATUSES.PENDING, changedAt: new Date() }],
    deliveryAddress: req.body.deliveryAddress || "",
    pickupDetails: req.body.pickupDetails || "",
    billingState,
    notes: req.body.notes || "",
  });

  if (orderType === ORDER_TYPES.DINE_IN) {
    try {
      await assignTableForDineInOrder(order.table, order._id, { restaurantId });
    } catch (error) {
      await Order.deleteOne({ _id: order._id });
      throw error;
    }
  }

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

  await syncPaymentFromOrder(populated, {
    status: paymentStatus,
    metadata: { paymentMethod, paymentStatus, orderType },
    note: paymentStatus === PAYMENT_STATUSES.PAID ? "Payment received during guest order creation" : "Payment initiated during guest order creation",
  });

  if (!isOnlineOrder(populated)) await syncKotForOrder(populated);
  emitOrderCreated(normalizeOrderOutput(populated));
  if (!isOnlineOrder(populated)) emitKitchenTicketCreated(populated);

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
  if (req.query.orderSource) filters.orderSource = normalizeOrderSource(req.query.orderSource);
  if (req.query.paymentStatus) filters.paymentStatus = normalizePaymentStatus(req.query.paymentStatus);

  if (String(req.query.onlineOnly || "").toLowerCase() === "true") {
    filters.$and = [
      {
        $or: [
          { orderSource: { $in: ["ONLINE", "DELIVERY", "PICKUP"] } },
          // Existing delivery orders predate orderSource and are still operational online orders.
          { orderSource: { $exists: false }, orderType: ORDER_TYPES.DELIVERY },
          { orderSource: null, orderType: ORDER_TYPES.DELIVERY },
        ],
      },
    ];
  }

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
  const nextItems = req.body.items ? await prepareOrderItems(req.body.items) : order.items;

  // Retain kitchen progress only for an exactly matching pre-existing item.
  // Extra copies of an item are new kitchen work and must start as NEW.
  const kitchenItemKey = (item) => [
    String(item.menuItem?._id || item.menuItem || ""),
    String(item.name || ""),
    Number(item.price || 0),
    Number(item.quantity || 0),
    String(item.specialInstructions || ""),
  ].join("|");
  const existingStatusMap = new Map();
  (order.items || []).forEach((item) => {
    const key = kitchenItemKey(item);
    const statuses = existingStatusMap.get(key) || [];
    statuses.push(item.kitchenStatus || "NEW");
    existingStatusMap.set(key, statuses);
  });
  const takeExistingKitchenStatus = (item) => {
    const statuses = existingStatusMap.get(kitchenItemKey(item));
    return statuses?.length ? statuses.shift() : null;
  };

  const itemsWithKitchenStatus = nextItems.map((item) => ({
    ...item,
    kitchenStatus: takeExistingKitchenStatus(item) || "NEW",
  }));

  const calculated = buildCalculatedOrderPayload({
    orderType: nextOrderType,
    items: itemsWithKitchenStatus,
    discount: req.body.discount !== undefined ? req.body.discount : order.discount,
    serviceCharge: req.body.serviceCharge !== undefined ? req.body.serviceCharge : order.serviceCharge,
    serviceChargePercent: req.body.serviceChargePercent,
    deliveryCharge: req.body.deliveryCharge !== undefined ? req.body.deliveryCharge : order.deliveryCharge,
    gstType: await resolveOrderGstType(
      order.restaurant,
      req.body.billingState ?? req.body.customerState ?? order.billingState
    ),
  });

  const previousTable = order.table ? String(order.table) : null;

  order.orderType = nextOrderType;
  order.items = calculated.items.map((item) => ({
    ...item,
    kitchenStatus: item.kitchenStatus || "NEW",
  }));
  order.subtotal = calculated.subtotal;
  order.discount = calculated.discount;
  order.tax = calculated.tax;
  order.serviceCharge = calculated.serviceCharge;
  order.deliveryCharge = calculated.deliveryCharge;
  order.taxableAmount = calculated.taxableAmount;
  order.gstType = calculated.gstType;
  order.cgst = calculated.cgst;
  order.sgst = calculated.sgst;
  order.igst = calculated.igst;
  order.total = calculated.total;
  order.specialInstructions = req.body.specialInstructions ?? order.specialInstructions;
  order.billingState = req.body.billingState ?? req.body.customerState ?? order.billingState;

  if (nextOrderType !== ORDER_TYPES.DINE_IN) {
    order.table = null;
  } else if (req.body.table !== undefined) {
    order.table = req.body.table;
  }

  await order.save();

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

  await syncKotForOrder(populated);
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

  await syncKotForOrder(order);
  await refreshInvoice(order);
  await restoreRedeemedPointsForCancelledOrder(order);
  await releaseOrderTableIfNeeded(order);
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

  if (!canTransitionOrderStatus(currentStatus, nextStatus, order)) {
    throw new ApiError(409, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }

  if (!canRoleUpdateStatus({ role: req.user.role, nextStatus, order })) {
    throw new ApiError(403, "You do not have permission to set this status");
  }

  if (nextStatus === ORDER_STATUSES.REJECTED && !String(req.body.rejectionReason || "").trim()) {
    throw new ApiError(422, "A rejection reason is required");
  }

  order.status = nextStatus;
  stampOrderLifecycle(order, nextStatus);
  if (nextStatus === ORDER_STATUSES.REJECTED) order.rejectionReason = String(req.body.rejectionReason).trim();
  addStatusHistoryEntry(order, nextStatus, req.user._id);
  await order.save();
  if (!isOnlineOrder(order) || ![ORDER_STATUSES.REJECTED, ORDER_STATUSES.CANCELLED].includes(nextStatus)) {
    await syncKotForOrder(order);
  }
  if ([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REJECTED].includes(nextStatus)) await refreshInvoice(order);
  if ([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REJECTED].includes(nextStatus)) await restoreRedeemedPointsForCancelledOrder(order);

  if ([ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REJECTED].includes(nextStatus)) {
    await maybeReleaseTableAfterSettlement(order);
  }

  if ([ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REJECTED].includes(nextStatus)) {
    await createOrderNotifications({
      title: nextStatus === ORDER_STATUSES.REJECTED ? "Order Rejected" : "Order Cancelled",
      message: `${order.orderNumber} has been ${nextStatus === ORDER_STATUSES.REJECTED ? "rejected" : "cancelled"}`,
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

  if (!["admin", "manager", "cashier", "waiter"].includes(req.user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || order.paymentMethod);
  const paymentStatus = normalizePaymentStatus(req.body.paymentStatus || order.paymentStatus);

  if (paymentStatus === PAYMENT_STATUSES.PAID && paymentMethod !== PAYMENT_METHODS.CASH && !req.body.gatewayVerified) {
    throw new ApiError(422, "Payment cannot be marked as PAID without gateway verification");
  }

  const result = paymentStatus === PAYMENT_STATUSES.PAID
    ? await recordVerifiedPayment(order, {
        amount: req.body.amount,
        paymentMethod,
        gateway: req.body.gateway || req.body.provider || paymentMethod,
        transactionId: req.body.transactionId || "",
        razorpayOrderId: req.body.razorpayOrderId || "",
        razorpayPaymentId: req.body.razorpayPaymentId || "",
        idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey || "",
        paidAt: req.body.paidAt || new Date(),
        note: "Payment updated to paid",
        receivedBy: req.user._id,
      })
    : await updateOrderPaymentState(order, {
        paymentMethod,
        paymentStatus,
        gateway: req.body.gateway || req.body.provider || paymentMethod,
        transactionId: req.body.transactionId || "",
        razorpayOrderId: req.body.razorpayOrderId || "",
        razorpayPaymentId: req.body.razorpayPaymentId || "",
        paidAt: req.body.paidAt || null,
        note: "Payment updated",
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
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  if (!["admin", "manager", "cashier", "waiter"].includes(req.user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || order.paymentMethod);
  const paymentStatus = normalizePaymentStatus(req.body.paymentStatus || "PAID");

  if (paymentStatus !== PAYMENT_STATUSES.PAID) {
    throw new ApiError(422, "Pay endpoint only supports completed payments");
  }

  const result = await recordVerifiedPayment(order, {
    amount: req.body.amount,
    paymentMethod,
    gateway: req.body.gateway || paymentMethod,
    transactionId: req.body.transactionId || req.body.paymentId || "",
    razorpayOrderId: req.body.razorpayOrderId || "",
    razorpayPaymentId: req.body.razorpayPaymentId || "",
    idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey || "",
    paidAt: req.body.paidAt || new Date(),
    note: paymentMethod === PAYMENT_METHODS.CASH ? "Cash payment confirmed" : "Gateway payment verified",
    receivedBy: req.user._id,
  });

  await createOrderAuditLog({ user: req.user, action: "Order Paid", order: result.order, context: { paymentMethod, paymentStatus: PAYMENT_STATUSES.PAID } });
  await createOrderNotifications({
    title: "Payment Received",
    message: `${result.order.orderNumber} payment completed`,
    actorUserId: req.user._id,
    type: "PAYMENT_RECEIVED",
    restaurantId: result.order.restaurant,
    entityType: "Order",
    entityId: result.order._id,
    orderNumber: result.order.orderNumber,
    total: result.order.total,
    paymentMethod: paymentMethod,
  });

  emitOrderPaymentUpdated(result.order);
  await maybeReleaseTableAfterSettlement(result.order);
  res.status(200).json(new ApiResponse(true, "Order payment completed", normalizeOrderOutput(result.order)));
});

export const updateOrderPaymentStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Order not found");

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  if (!["admin", "manager", "cashier", "waiter"].includes(req.user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  const paymentStatus = normalizePaymentStatus(req.body.paymentStatus || order.paymentStatus);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod || order.paymentMethod);

  const result = paymentStatus === PAYMENT_STATUSES.PAID
    ? await recordVerifiedPayment(order, {
        amount: req.body.amount,
        paymentMethod,
        gateway: req.body.gateway || req.body.provider || paymentMethod,
        transactionId: req.body.transactionId || "",
        razorpayOrderId: req.body.razorpayOrderId || "",
        razorpayPaymentId: req.body.razorpayPaymentId || "",
        idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey || "",
        paidAt: req.body.paidAt || new Date(),
        note: "Payment verified successfully",
        receivedBy: req.user._id,
      })
    : await updateOrderPaymentState(order, {
        paymentMethod,
        paymentStatus,
        gateway: req.body.gateway || req.body.provider || paymentMethod,
        transactionId: req.body.transactionId || "",
        razorpayOrderId: req.body.razorpayOrderId || "",
        razorpayPaymentId: req.body.razorpayPaymentId || "",
        paidAt: req.body.paidAt || null,
        note: "Payment status updated",
      });

  if (paymentStatus === PAYMENT_STATUSES.PAID) {
    await createOrderNotifications({
      title: "Payment Received",
      message: `${result.order.orderNumber} payment is now PAID`,
      actorUserId: req.user._id,
      type: "PAYMENT_RECEIVED",
      restaurantId: result.order.restaurant,
      entityType: "Order",
      entityId: result.order._id,
      orderNumber: result.order.orderNumber,
      total: result.order.total,
      paymentMethod: paymentMethod,
    });
  }

  emitOrderPaymentUpdated(result.order);
  await maybeReleaseTableAfterSettlement(result.order);
  res.status(200).json(new ApiResponse(true, "Order payment status updated", normalizeOrderOutput(result.order)));
});

export const getOrderStats = asyncHandler(async (req, res) => {
  const roleFilter = req.user.role === "customer" ? { customer: req.user._id } : {};
  const statsBase = { isArchived: false, ...roleFilter };
  if (String(req.query.onlineOnly || "").toLowerCase() === "true") {
    statsBase.$or = [
      { orderSource: { $in: ["ONLINE", "DELIVERY", "PICKUP"] } },
      { orderSource: { $exists: false }, orderType: ORDER_TYPES.DELIVERY },
      { orderSource: null, orderType: ORDER_TYPES.DELIVERY },
    ];
  }
  const tenantFilter = await buildRestaurantQuery(statsBase, req.user);

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
    newOrders: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    outForDelivery: 0,
    completed: 0,
    cancelled: 0,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
  };

  for (const row of statusRows) {
    const status = normalizeOrderStatus(row._id);
    stats.totalOrders += row.count;
    if (status === ORDER_STATUSES.PENDING || status === ORDER_STATUSES.CONFIRMED) stats.pending += row.count;
    if (status === ORDER_STATUSES.PENDING) stats.newOrders += row.count;
    if (status === ORDER_STATUSES.CONFIRMED) stats.accepted += row.count;
    if (status === ORDER_STATUSES.PREPARING) stats.preparing += row.count;
    if (status === ORDER_STATUSES.READY || status === ORDER_STATUSES.SERVED) stats.ready += row.count;
    if (status === ORDER_STATUSES.OUT_FOR_DELIVERY) stats.outForDelivery += row.count;
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

  const customers = await searchCustomers(req.query.search || "", await getAuthorizedRestaurantIds(req.user));
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

  const restaurantId = await resolveOrderRestaurant({ user: req.user });
  const { customer, created } = await findOrCreateRestaurantCustomer({ fullName, email, phone, restaurantId });
  const message = created ? "Customer created" : "Existing customer found";

  res.status(created ? 201 : 200).json(new ApiResponse(true, message, customer));
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));

  if (!order) throw new ApiError(404, "Order not found");
  if (String(order.paymentStatus).toUpperCase() !== PAYMENT_STATUSES.PAID) {
    throw new ApiError(409, "Invoice is available only after verified full payment");
  }
  const invoice = await Invoice.findOne({ order: order._id });
  if (!invoice) throw new ApiError(404, "Final invoice not found");

  const buffer = await buildInvoiceBuffer(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoiceNumber}.pdf`);
  res.send(buffer);
});
