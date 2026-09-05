import api from "./api";

export const getSuppliers = (config = {}) => api.get("/procurement/suppliers", config);
export const createSupplier = (payload) => api.post("/procurement/suppliers", payload);
export const updateSupplier = (id, payload) => api.patch(`/procurement/suppliers/${id}`, payload);
export const toggleSupplier = (id) => api.patch(`/procurement/suppliers/${id}/toggle`);
export const getPurchaseOrders = (config = {}) => api.get("/procurement/purchase-orders", config);
export const createPurchaseOrder = (payload) => api.post("/procurement/purchase-orders", payload, { headers: { "Idempotency-Key": globalThis.crypto?.randomUUID?.() || `po-${Date.now()}` } });
export const updatePurchaseOrder = (id, payload) => api.patch(`/procurement/purchase-orders/${id}`, payload);
export const placePurchaseOrder = (id) => api.post(`/procurement/purchase-orders/${id}/place`);
export const cancelPurchaseOrder = (id) => api.post(`/procurement/purchase-orders/${id}/cancel`);
export const receivePurchaseOrder = (id, payload, idempotencyKey) => api.post(`/procurement/purchase-orders/${id}/receive`, payload, { headers: { "Idempotency-Key": idempotencyKey } });