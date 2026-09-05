import api from "./api";

export const getBusinessIntelligence = (params = {}, config = {}) => api.get("/analytics/business-intelligence/overview", { params, ...config });
