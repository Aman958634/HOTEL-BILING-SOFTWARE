import { getIO } from "../config/socket.js";

const safeEmit = (event, payload, restaurantId = null) => {
  try {
    const io = getIO();
    if (restaurantId) io.to(`restaurant:${restaurantId}`).emit(event, payload);
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

  safeEmit("order:created", payload, order.restaurant);
  safeEmit("order:new", order, order.restaurant);
};

export const emitOrderStatusChanged = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:statusChanged", payload, order.restaurant);
  safeEmit("order:status", order, order.restaurant);
};

export const emitOrderCancelled = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:cancelled", payload, order.restaurant);
  safeEmit("order:status", order, order.restaurant);
};

export const emitOrderPaymentUpdated = (order) => {
  safeEmit("order:paymentUpdated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    updatedAt: order.updatedAt,
  }, order.restaurant);
};

export const emitKitchenItemStatusChanged = (order, itemIndex, kitchenStatus) => {
  safeEmit("kitchen:itemStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    itemIndex,
    kitchenStatus,
    orderStatus: order.status,
    updatedAt: order.updatedAt,
  }, order.restaurant);
};

export const emitKitchenOrderStatusChanged = (order) => {
  safeEmit("kitchen:orderStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  }, order.restaurant);
};

export const emitKitchenTicketCreated = (order) => {
  safeEmit("kitchen:ticketCreated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
  }, order.restaurant);
};
