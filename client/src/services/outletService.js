import api from "./api";
export const getMyOutlets = () => api.get("/outlets/me");
export const getOutlets = () => api.get("/outlets");
export const createOutlet = (payload) => api.post("/outlets", payload);
export const updateOutletStatus = (id, isActive) => api.patch(`/outlets/${id}/status`, { isActive });
