import api from "./api";

export const getReportsSummary = (params = {}) => api.get("/admin/reports/summary", { params });
export const getReportsRevenue = (params = {}) => api.get("/admin/reports/revenue", { params });
export const getReportsOrders = (params = {}) => api.get("/admin/reports/orders", { params });
export const getReportsTopItems = (params = {}) => api.get("/admin/reports/top-items", { params });
export const getReportsCategories = (params = {}) => api.get("/admin/reports/categories", { params });
export const getReportsPayments = (params = {}) => api.get("/admin/reports/payments", { params });
export const getReportsCustomers = (params = {}) => api.get("/admin/reports/customers", { params });
export const getReportsSales = (params = {}) => api.get("/admin/reports/sales", { params });
export const exportReports = (params = {}) => api.get("/admin/reports/export", { params, responseType: "blob" });
