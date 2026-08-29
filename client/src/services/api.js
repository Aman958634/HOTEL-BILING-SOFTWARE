import axios from "axios";
import { API_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_URL,
});

const refreshClient = axios.create({
  baseURL: API_URL,
});

let authStore = null;
let isRefreshing = false;
let failedQueue = [];

const AUTH_SKIP_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

const shouldSkipRefresh = (url = "") =>
  AUTH_SKIP_REFRESH_PATHS.some((path) => url.includes(path));

const processQueue = (error, token = null) => {
  const queue = failedQueue;
  failedQueue = [];
  queue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      delete config._retry;
      config.headers.Authorization = `Bearer ${token}`;
      resolve(api(config));
    }
  });
};

const clearAuthAndRedirectToLogin = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  authStore?.dispatch({ type: "auth/logout" });
  if (window.location.pathname !== "/login" && window.location.pathname !== "/super-admin-login") {
    window.location.replace("/login");
  }
};

export const setupAuthInterceptor = (store) => {
  authStore = store;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const outletId = localStorage.getItem("activeOutletId");
  if (outletId && !String(config.url || "").startsWith("/outlets")) config.headers["X-Outlet-Id"] = outletId;
  const method = String(config.method || "get").toLowerCase();
  const url = String(config.url || "");
  const isPaymentWrite =
    /\/orders\/[^/]+\/(pay|payment|payment-status)$/.test(url) ||
    /\/payments\/verify$/.test(url) ||
    /\/payments\/[^/]+\/refund$/.test(url);
  if (["post", "put", "patch"].includes(method) && isPaymentWrite && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random()}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const payload = error?.response?.data;
    const code = payload?.code;

    if (
      code === "SUBSCRIPTION_EXPIRED" ||
      code === "SUBSCRIPTION_CANCELLED" ||
      code === "SUBSCRIPTION_SUSPENDED" ||
      code === "SUBSCRIPTION_INACTIVE"
    ) {
      window.dispatchEvent(
        new CustomEvent("restosphere:subscription-blocked", {
          detail: {
            code,
            message: payload?.message,
            details: payload?.details || null,
          },
        })
      );
    }

    if (
      !originalRequest ||
      error?.response?.status === 429 ||
      error?.response?.status !== 401 ||
      originalRequest._retry ||
      shouldSkipRefresh(originalRequest.url || "")
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      clearAuthAndRedirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await refreshClient.post("/auth/refresh", { refreshToken });
      const newAccessToken = data?.data?.accessToken;
      if (!newAccessToken) {
        throw new Error("Refresh response missing access token");
      }

      localStorage.setItem("accessToken", newAccessToken);
      authStore?.dispatch({
        type: "auth/setAccessToken",
        payload: newAccessToken,
      });

      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthAndRedirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
