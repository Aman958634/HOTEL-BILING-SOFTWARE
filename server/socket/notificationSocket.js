import { getIO } from "../config/socket.js";

const safeEmitToUser = (userId, event, payload) => {
  try {
    const io = getIO();
    if (userId) io.to(`user:${userId}`).emit(event, payload);
  } catch (_error) {
    // Socket may be unavailable in script-only contexts.
  }
};

export const emitNotificationCreated = (notification) => {
  const payload = {
    id: notification._id,
    notificationId: notification._id,
    eventType: notification.eventType || notification.type,
    category: notification.category || "SYSTEM",
    severity: notification.severity || "INFO",
    type: notification.type,
    title: notification.title,
    message: notification.message,
    route: notification.route || "",
    readAt: notification.readAt || null,
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt,
  };

  safeEmitToUser(notification.user, "notification:new", payload);
};
