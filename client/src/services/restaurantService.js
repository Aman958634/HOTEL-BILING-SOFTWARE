import api from "./api";

export const getRestaurantSettings = () => api.get("/admin/restaurant");
export const updateRestaurantSettings = (payload) => api.put("/admin/restaurant", payload);
export const getIntegrationStatus = () => api.get("/admin/integrations/status");
