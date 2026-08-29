import { getIO } from "../config/socket.js";

const safeEmit = (event, payload) => {
  try {
    const io = getIO();
    if (payload?.restaurant) io.to(`restaurant:${payload.restaurant}`).emit(event, payload);
  } catch (_error) {
    // Socket may not be available in scripts.
  }
};

export const emitStaffCreated = (staff) => {
  safeEmit("staff:created", staff);
};

export const emitStaffUpdated = (staff) => {
  safeEmit("staff:updated", staff);
};

export const emitStaffStatusChanged = (staff) => {
  safeEmit("staff:statusChanged", staff);
};
