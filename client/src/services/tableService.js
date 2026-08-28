import api from "./api";

export const getTables = (params = {}, options = {}) =>
  api.get("/tables", { params, ...options });
export const getTableById = (id) => api.get(`/tables/${id}`);
export const getTableByNumber = (tableNumber) => api.get(`/public/tables/${tableNumber}`);
export const getTableQr = (id) => api.get(`/tables/${id}/qr`);
export const createTable = (payload) => api.post("/tables", payload);
export const updateTable = (id, payload) => api.put(`/tables/${id}`, payload);
export const deleteTable = (id) => api.delete(`/tables/${id}`);
export const getTableStats = () => api.get("/tables/stats");
export const getAvailableTables = (params = {}) => api.get("/tables/available", { params });
