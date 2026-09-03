import { getIO } from "../config/socket.js";

export const getPaymentSocketRoom = (payload = {}) => {
  const outletId = payload?.outlet?._id
    || payload?.outlet
    || payload?.orderId?.outlet?._id
    || payload?.orderId?.outlet
    || null;
  return outletId ? `outlet:${outletId}` : null;
};

const emit = (event, payload) => {
  try {
    const io = getIO();
    const room = getPaymentSocketRoom(payload);
    // Payment records are outlet-scoped operational data. A missing outlet on
    // a legacy record must not turn into a restaurant-wide broadcast.
    if (room) io.to(room).emit(event, payload);
  } catch {
    // Socket not ready during bootstrap or tests.
  }
};

export const emitPaymentCreated = (payload) => emit("payment:created", payload);
export const emitPaymentUpdated = (payload) => emit("payment:updated", payload);
export const emitPaymentRefunded = (payload) => emit("payment:refunded", payload);
