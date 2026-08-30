import api from "./api";

export const getPublicMenu = (qrToken, params = {}) => api.get(`/public/menu/${encodeURIComponent(qrToken)}`, { params });

export const getAdminMenu = (params = {}) => api.get("/menu", { params });
export const getAdminMenuItem = (id) => api.get(`/menu/${id}`);
export const createAdminMenuItem = (payload) => api.post("/menu", payload);
export const updateAdminMenuItem = (id, payload) => api.put(`/menu/${id}`, payload);
export const deleteAdminMenuItem = (id) => api.delete(`/menu/${id}`);
export const toggleAdminMenuAvailability = (id, available) =>
	api.patch(`/menu/${id}/availability`, { available });
