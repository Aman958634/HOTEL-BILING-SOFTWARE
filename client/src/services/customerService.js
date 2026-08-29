import api from "./api";

export const getCustomers = (params = {}) => api.get("/customers", { params });
export const getCustomerProfile = (id) => api.get(`/customers/${id}`);
export const createCustomer = (payload) => api.post("/customers", payload);
export const updateCustomer = (id, payload) => api.put(`/customers/${id}`, payload);
export const archiveCustomer = (id) => api.patch(`/customers/${id}/archive`);
