import api from "./api";

export const getPayments = (params = {}) => api.get("/payments", { params });
export const getPaymentById = (id) => api.get(`/payments/${id}`);
export const getPaymentByOrderId = (orderId) => api.get(`/payments/order/${orderId}`);
export const getPaymentStats = (params = {}) => api.get("/payments/stats", { params });
export const getPaymentReceipt = (id) => api.get(`/payments/${id}/receipt`, { responseType: "blob" });
export const refundPayment = (id, payload) => api.post(`/payments/${id}/refund`, payload);
export const deletePayment = (id) => api.delete(`/payments/${id}`);
export const exportPayments = (params = {}) => api.get("/payments/export", { params, responseType: "blob" });
export const createGatewayPayment = (payload) => api.post("/payments/create-order", payload);
export const verifyGatewayPayment = (payload) => api.post("/payments/verify", payload);
