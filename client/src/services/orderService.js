import api from "./api";

const newIdempotencyKey = () => {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `order-${value}`;
};

// The caller may retain and resend the key after a timeout. The backend then
// returns the original order instead of creating a duplicate KOT/order.
const postOrder = (url, payload, idempotencyKey = newIdempotencyKey()) =>
  api.post(url, { ...payload, idempotencyKey }, { headers: { "Idempotency-Key": idempotencyKey } });

export const createOrder = (payload, idempotencyKey) => postOrder("/orders", payload, idempotencyKey);
export const createGuestOrder = (payload, idempotencyKey) => postOrder("/orders/guest", payload, idempotencyKey);
export const getOrders = (params = {}) => api.get("/orders", { params });
export const getOrderById = (id) => api.get(`/orders/${id}`);
export const updateOrder = (id, payload) => api.put(`/orders/${id}`, payload);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status });
export const updateOrderPayment = (id, payload) => api.patch(`/orders/${id}/payment`, payload);
export const payOrder = (id, payload) => api.post(`/orders/${id}/pay`, payload);
export const updateOrderPaymentStatus = (id, payload) => api.put(`/orders/${id}/payment-status`, payload);

export const getOrderStats = () => api.get("/orders/stats");
export const getTodayOrders = () => api.get("/orders/today");
export const getPendingOrders = () => api.get("/orders/pending");

export const searchOrderCustomers = (search = "") =>
	api.get("/orders/customers", { params: { search } });

export const addOrderCustomer = (payload) => api.post("/orders/customers", payload);
