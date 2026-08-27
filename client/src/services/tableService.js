import api from "./api";

export const getTables = (params = {}, options = {}) =>
  api.get("/tables", { params, ...options });
export const getTableById = (id) => api.get(`/tables/${id}`);
export const getTableByNumber = (tableNumber, token) => api.get(`/public/tables/${tableNumber}`, { params: { token } });
export const getTableQr = (id) => api.get(`/tables/${id}/qr`, { responseType: "blob" });
export const createTable = (payload) => api.post("/tables", payload);
export const updateTable = (id, payload) => api.put(`/tables/${id}`, payload);
export const deleteTable = (id) => api.delete(`/tables/${id}`);
export const updateTableStatus = (id, status) => api.patch(`/tables/${id}/status`, { status });
export const getTableStats = () => api.get("/tables/stats");
export const getAvailableTables = (params = {}) => api.get("/tables/available", { params });
