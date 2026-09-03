import api from "./api";

export const getAdminStats = (config = {}) => api.get("/admin/dashboard/stats", config);
export const getAdminSales = (range = "7d", config = {}) => api.get("/admin/dashboard/sales", { params: { range }, ...config });
export const getAdminRecentOrders = (config = {}) => api.get("/admin/dashboard/recent-orders", config);
export const updateAdminOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status });
export const deleteAdminOrder = (id) => api.delete(`/orders/${id}`);
