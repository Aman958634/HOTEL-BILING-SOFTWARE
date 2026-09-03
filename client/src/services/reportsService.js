import api from "./api";

const withConfig = (params, config) => ({ params, ...config });
export const getReportsSummary = (params = {}, config = {}) => api.get("/admin/reports/summary", withConfig(params, config));
export const getReportsRevenue = (params = {}, config = {}) => api.get("/admin/reports/revenue", withConfig(params, config));
export const getReportsOrders = (params = {}, config = {}) => api.get("/admin/reports/orders", withConfig(params, config));
export const getReportsTopItems = (params = {}, config = {}) => api.get("/admin/reports/top-items", withConfig(params, config));
export const getReportsCategories = (params = {}, config = {}) => api.get("/admin/reports/categories", withConfig(params, config));
export const getReportsPayments = (params = {}, config = {}) => api.get("/admin/reports/payments", withConfig(params, config));
export const getReportsCustomers = (params = {}, config = {}) => api.get("/admin/reports/customers", withConfig(params, config));
export const getReportsSales = (params = {}, config = {}) => api.get("/admin/reports/sales", withConfig(params, config));
export const exportReports = (params = {}) => api.get("/admin/reports/export", { params, responseType: "blob" });
