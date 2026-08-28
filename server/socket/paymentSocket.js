import { getIO } from "../config/socket.js";

const emit = (event, payload) => {
  try {
    const io = getIO();
    io.to("dashboard").emit(event, payload);
  } catch {
    // Socket not ready during bootstrap or tests.
  }
};

export const emitPaymentCreated = (payload) => emit("payment:created", payload);
export const emitPaymentUpdated = (payload) => emit("payment:updated", payload);
export const emitPaymentRefunded = (payload) => emit("payment:refunded", payload);
