import api from "./api";

export const getAdminCategories = (params = {}) => api.get("/categories", { params });
export const createAdminCategory = (payload) => api.post("/categories", payload);
export const updateAdminCategory = (id, payload) => api.put(`/categories/${id}`, payload);
export const deleteAdminCategory = (id) => api.delete(`/categories/${id}`);
export const toggleAdminCategoryStatus = (id, active) => api.patch(`/categories/${id}/status`, { active });
