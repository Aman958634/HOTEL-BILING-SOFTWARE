import api from "./api";

export const getAdminStats = () => api.get("/admin/dashboard/stats");
export const getAdminSales = (range = "7d") => api.get("/admin/dashboard/sales", { params: { range } });
export const getAdminRecentOrders = () => api.get("/admin/dashboard/recent-orders");
export const updateAdminOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status });
export const deleteAdminOrder = (id) => api.delete(`/orders/${id}`);
