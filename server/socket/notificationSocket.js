import { getIO } from "../config/socket.js";

const safeEmit = (event, payload, userId) => {
  try {
    const io = getIO();
    if (userId) io.to(`user:${userId}`).emit(event, payload);
  } catch (_error) {
    // Socket may be unavailable in script-only contexts.
  }
};

export const emitNotificationCreated = (notification) => {
  const payload = {
    notificationId: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };

  safeEmit("notification:new", payload, notification.user);
};
