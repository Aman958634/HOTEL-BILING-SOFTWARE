import api from "./api";

export const getEligibleBillOrders = (params = {}) => api.get("/bills/eligible-orders", { params });
export const getBills = (params = {}) => api.get("/bills", { params });
export const getBill = (id) => api.get(`/bills/${id}`);
export const createBill = (payload, idempotencyKey) => api.post("/bills", payload, { headers: { "Idempotency-Key": idempotencyKey } });
export const addBillPayment = (id, payload, idempotencyKey) => api.post(`/bills/${id}/payments`, payload, { headers: { "Idempotency-Key": idempotencyKey } });
export const cancelBill = (id, payload) => api.patch(`/bills/${id}/cancel`, payload);
export const downloadBillReceipt = (id) => api.get(`/bills/${id}/receipt`, { responseType: "blob" });
