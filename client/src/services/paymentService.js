import api from "./api";

export const getPayments = (params = {}) => api.get("/payments", { params });
export const getPaymentById = (id) => api.get(`/payments/${id}`);
export const getPaymentByOrderId = (orderId) => api.get(`/payments/order/${orderId}`);
export const getPaymentStats = (params = {}) => api.get("/payments/stats", { params });
export const getPaymentReceipt = (id) => api.get(`/payments/${id}/receipt`, { responseType: "blob" });
export const refundPayment = (id, payload, idempotencyKey) => api.post(`/payments/${id}/refund`, payload, { headers: { "Idempotency-Key": idempotencyKey } });
export const deletePayment = (id) => api.delete(`/payments/${id}`);
export const exportPayments = (params = {}) => api.get("/payments/export", { params, responseType: "blob" });
export const createGatewayPayment = (payload) => api.post("/payments/create-order", payload);
export const verifyGatewayPayment = (payload) => api.post("/payments/verify", payload);
export const getReconciliationSummary = () => api.get("/reconciliation/summary");
export const getReconciliationBills = (params = {}) => api.get("/reconciliation/bills", { params });
export const getCashReconciliationPreview = () => api.get("/reconciliation/cash/preview");
export const closeCashReconciliation = (payload) => api.post("/reconciliation/cash/close", payload);
export const reconcilePayment = (id, payload = {}) => api.patch(`/reconciliation/payments/${id}/reconcile`, payload);
