import api from "./api";

export const getFoods = (params = {}) => api.get("/public/foods", { params });
export const getCategories = () => api.get("/public/categories");

export const getAdminMenu = (params = {}) => api.get("/menu", { params });
export const getAdminMenuItem = (id) => api.get(`/menu/${id}`);
export const createAdminMenuItem = (payload) => api.post("/menu", payload);
export const updateAdminMenuItem = (id, payload) => api.put(`/menu/${id}`, payload);
export const deleteAdminMenuItem = (id) => api.delete(`/menu/${id}`);
export const toggleAdminMenuAvailability = (id, available) =>
	api.patch(`/menu/${id}/availability`, { available });
