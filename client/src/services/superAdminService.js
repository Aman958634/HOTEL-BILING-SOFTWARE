import api from "./api";

export const fetchRestaurants = (params) => api.get("/super-admin/restaurants", { params });
export const createRestaurant = (payload) => api.post("/super-admin/restaurants", payload);
export const getRestaurant = (id) => api.get(`/super-admin/restaurants/${id}`);
export const updateRestaurant = (id, payload) => api.put(`/super-admin/restaurants/${id}`, payload);
export const updateRestaurantStatus = (id, payload) => api.patch(`/super-admin/restaurants/${id}/status`, payload);

export const fetchUsers = (params) => api.get("/super-admin/users", { params });
export const getUser = (id) => api.get(`/super-admin/users/${id}`);
export const createUser = (payload) => api.post("/super-admin/users", payload);
export const updateUser = (id, payload) => api.put(`/super-admin/users/${id}`, payload);
export const updateUserStatus = (id, status) => api.patch(`/super-admin/users/${id}/status`, { status });
export const deleteUser = (id) => api.delete(`/super-admin/users/${id}`);

export const fetchSubscriptions = (params) => api.get("/super-admin/subscriptions", { params });
export const createSubscription = (payload) => api.post("/super-admin/subscriptions", payload);
export const updateSubscription = (id, payload) => api.put(`/super-admin/subscriptions/${id}`, payload);
export const extendSubscriptionTrial = (id, days) =>
  api.post(`/super-admin/subscriptions/${id}/extend-trial`, { days, confirm: true });
export const convertSubscription = (id, planName, planId) =>
  api.post(`/super-admin/subscriptions/${id}/convert`, { planName, planId });
export const createSubscriptionCheckout = (id) => api.post(`/super-admin/subscriptions/${id}/checkout`);
export const verifySubscriptionPayment = (id, payload) =>
  api.post(`/super-admin/subscriptions/${id}/verify-payment`, payload);
export const suspendSubscription = (id) => api.post(`/super-admin/subscriptions/${id}/suspend`, { confirm: true });
export const cancelSubscription = (id) => api.post(`/super-admin/subscriptions/${id}/cancel`, { confirm: true });
export const activateSubscription = (id, planName) =>
  api.post(`/super-admin/subscriptions/${id}/activate`, { planName, confirm: true });
export const fetchPlans = () => api.get("/super-admin/plans");

export const fetchActivityLogs = (params) => api.get("/super-admin/activity-logs", { params });

export const fetchSaasPayments = (params) => api.get("/super-admin/payments", { params });
export const fetchSaasPaymentById = (id) => api.get(`/super-admin/payments/${id}`);
export const fetchSaasPaymentSummary = () => api.get("/super-admin/payments/summary");
export const downloadSaasPaymentPdf = (id) =>
  api.get(`/super-admin/payments/${id}/pdf`, { responseType: "blob" });
export const deleteSaasPayment = (id) => api.delete(`/super-admin/payments/${id}`);

export const getSuperAdminStats = () => api.get("/super-admin/dashboard/stats");
