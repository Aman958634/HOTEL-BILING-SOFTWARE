import { getIO } from "../config/socket.js";

const safeEmit = (event, payload, restaurantId = null, outletId = null) => {
  try {
    const io = getIO();
    if (outletId) io.to(`outlet:${outletId}`).emit(event, payload);
    else if (restaurantId) io.to(`restaurant:${restaurantId}`).emit(event, payload);
  } catch (_error) {
    // Socket may be unavailable in script-only contexts.
  }
};

export const emitOrderCreated = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
    order,
  };

  safeEmit("order:created", payload, order.restaurant, order.outlet);
  safeEmit("order:new", order, order.restaurant, order.outlet);
};

export const emitOrderStatusChanged = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:statusChanged", payload, order.restaurant, order.outlet);
  safeEmit("order:status", order, order.restaurant, order.outlet);
};

export const emitOrderCancelled = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:cancelled", payload, order.restaurant, order.outlet);
  safeEmit("order:status", order, order.restaurant, order.outlet);
};

export const emitOrderPaymentUpdated = (order) => {
  safeEmit("order:paymentUpdated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    updatedAt: order.updatedAt,
  }, order.restaurant, order.outlet);
};

export const emitKitchenItemStatusChanged = (order, itemIndex, kitchenStatus) => {
  safeEmit("kitchen:itemStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    itemIndex,
    kitchenStatus,
    orderKitchenStatus: order.kitchenStatus,
    orderStatus: order.status,
    updatedAt: order.updatedAt,
  }, order.restaurant, order.outlet);
};

export const emitKitchenOrderStatusChanged = (order) => {
  safeEmit("kitchen:orderStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    kitchenStatus: order.kitchenStatus,
    updatedAt: order.updatedAt,
  }, order.restaurant, order.outlet);
};

export const emitKitchenTicketCreated = (order) => {
  safeEmit("kitchen:ticketCreated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
  }, order.restaurant, order.outlet);
};

export const emitKotCreated = (kot) => {
  try {
    getIO().to(`outlet:${kot.outlet}`).emit("new_kot", kot.toObject ? kot.toObject() : kot);
  } catch (_error) {
    // Socket may be unavailable in script-only contexts.
  }
};

export const emitKotUpdated = (kot) => {
  try {
    getIO().to(`outlet:${kot.outlet}`).emit("kot_updated", kot.toObject ? kot.toObject() : kot);
  } catch (_error) {
    // Socket may be unavailable in script-only contexts.
  }
};
