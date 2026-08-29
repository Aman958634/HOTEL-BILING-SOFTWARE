import api from "./api";

export const getLoyaltySettings = () => api.get("/loyalty/settings");
export const updateLoyaltySettings = (payload) => api.put("/loyalty/settings", payload);
export const getLoyaltyMembers = (params = {}) => api.get("/loyalty/accounts", { params });
export const getLoyaltyTransactions = (params = {}) => api.get("/loyalty/transactions", { params });
export const getLoyaltyRewards = () => api.get("/loyalty/rewards");
export const enrollLoyaltyCustomer = (customerId) => api.post(`/loyalty/accounts/${customerId}/enroll`);
export const adjustLoyaltyPoints = (payload) => api.post("/loyalty/adjustments", payload);
export const redeemLoyaltyPoints = (payload, idempotencyKey) => api.post("/loyalty/redeem", payload, { headers: { "Idempotency-Key": idempotencyKey } });
