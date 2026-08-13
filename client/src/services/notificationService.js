import api from "./api";

export const getNotifications = (params = {}) => api.get("/admin/notifications", { params });
export const getNotificationSummary = () => api.get("/admin/notifications/summary");
export const updateNotificationStatus = (id, isRead) => api.patch(`/admin/notifications/${id}/read`, { isRead });
export const markAllNotificationsRead = () => api.patch("/admin/notifications/read-all");
export const deleteNotificationById = (id) => api.delete(`/admin/notifications/${id}`);
