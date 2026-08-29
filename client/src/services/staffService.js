import api from "./api";

export const getStaff = (params = {}) => api.get("/staff", { params });
export const getStaffById = (id) => api.get(`/staff/${id}`);
export const getMyStaffProfile = () => api.get("/staff/me");
export const createStaff = (payload) => api.post("/staff", payload);
export const updateStaff = (id, payload) => api.put(`/staff/${id}`, payload);
export const updateStaffStatus = (id, status) => api.patch(`/staff/${id}/status`, { status });
export const deleteStaff = (id) => api.delete(`/staff/${id}`);
export const getStaffStats = () => api.get("/staff/stats");
export const getActiveStaff = () => api.get("/staff/active");
export const getStaffByRole = (role) => api.get(`/staff/by-role/${role}`);
export const getStaffCommandCenter = () => api.get("/staff/command-center");
export const updateStaffDuty = (id, action) => api.patch(`/staff/${id}/duty`, { action });
export const assignStaffWork = (payload) => api.post("/staff/assignments", payload);
