import api from "./api";

export const registerUser = (payload) => api.post("/auth/register", payload);
export const loginUser = (payload) => api.post("/auth/login", payload);
export const getMyProfile = () => api.get("/auth/me");
export const refreshAccessToken = (refreshToken) => api.post("/auth/refresh", { refreshToken });
export const requestPasswordReset = (email) => api.post("/auth/forgot-password", { email });
export const resetPassword = (token, password) => api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password });
export const logoutUser = () => {
  const refreshToken = localStorage.getItem("refreshToken");
  return api.post("/auth/logout", { refreshToken: refreshToken || undefined });
};
