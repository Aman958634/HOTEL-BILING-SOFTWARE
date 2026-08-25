import api from "./api";

export const getCockpitOverview = (params = {}) => api.get("/cockpit", { params });
