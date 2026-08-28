import { getIO } from "../config/socket.js";

const safeEmit = (event, payload) => {
  try {
    const io = getIO();
    io.to("dashboard").emit(event, payload);
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

  safeEmit("order:created", payload);
  safeEmit("order:new", order);
};

export const emitOrderStatusChanged = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:statusChanged", payload);
  safeEmit("order:status", order);
};

export const emitOrderCancelled = (order) => {
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  };

  safeEmit("order:cancelled", payload);
  safeEmit("order:status", order);
};

export const emitOrderPaymentUpdated = (order) => {
  safeEmit("order:paymentUpdated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    updatedAt: order.updatedAt,
  });
};

export const emitKitchenItemStatusChanged = (order, itemIndex, kitchenStatus) => {
  safeEmit("kitchen:itemStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    itemIndex,
    kitchenStatus,
    orderStatus: order.status,
    updatedAt: order.updatedAt,
  });
};

export const emitKitchenOrderStatusChanged = (order) => {
  safeEmit("kitchen:orderStatusChanged", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
  });
};

export const emitKitchenTicketCreated = (order) => {
  safeEmit("kitchen:ticketCreated", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
  });
};
