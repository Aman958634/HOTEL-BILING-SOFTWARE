import api from "./api";

export const getServiceSummary = () => api.get("/service-mode/summary");
export const getServiceTable = (id) => api.get(`/service-mode/tables/${id}`);
export const getServiceMenu = () => api.get("/service-mode/menu");
