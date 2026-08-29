import api from "./api";

export const getIntelligenceSummary = (params = {}) => api.get("/analytics/intelligence/summary", { params });
export const refreshIntelligence = (payload = {}) => api.post("/analytics/intelligence/refresh", payload);
export const askIntelligence = (payload) => api.post("/analytics/intelligence/ask", payload);
export const updateIntelligenceInsight = (id, status) => api.patch(`/analytics/intelligence/insights/${id}/status`, { status });
