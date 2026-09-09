import api from "./api";

export const getRestaurantSettings = () => api.get("/admin/restaurant");
export const updateRestaurantSettings = (payload) => api.put("/admin/restaurant", payload);
export const getIntegrationStatus = () => api.get("/admin/integrations/status");
export const getSettlementProfile = () => api.get("/admin/settlement");
export const createSettlementVendor = (payload, idempotencyKey) => api.post("/admin/settlement/cashfree/vendor", payload, { headers: { "Idempotency-Key": idempotencyKey } });
export const refreshSettlementVendor = () => api.post("/admin/settlement/cashfree/vendor/refresh");
