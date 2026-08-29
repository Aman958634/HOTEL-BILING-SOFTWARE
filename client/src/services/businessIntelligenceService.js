import api from "./api";

export const getBusinessIntelligence = (params = {}) => api.get("/analytics/business-intelligence/overview", { params });
