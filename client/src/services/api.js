import axios from "axios";
import { API_URL } from "../utils/constants";
import { getApiErrorMessage } from "../utils/apiError";

const api = axios.create({
  baseURL: API_URL,
});

const refreshClient = axios.create({
  baseURL: API_URL,
});

let authStore = null;
let isRefreshing = false;
let failedQueue = [];
let outletRecoveryPromise = null;
let outletAccessToastShown = false;
const outletRequestControllers = new Set();

const AUTH_SKIP_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

const shouldSkipRefresh = (url = "") =>
  AUTH_SKIP_REFRESH_PATHS.some((path) => url.includes(path));

const shouldSkipOutletHeader = (url = "") => String(url).includes("/auth/") || String(url).startsWith("/outlets");

const isOutletAccessDenied = (error) =>
  error?.response?.status === 403 &&
  (error?.response?.data?.code === "OUTLET_ACCESS_DENIED" ||
    error?.response?.data?.message === "You do not have access to the requested outlet");

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
  localStorage.removeItem("selectedOutletId");
  localStorage.removeItem("activeOutletId");
  localStorage.removeItem("activeOutlet");
  localStorage.removeItem("currentOutletId");
  authStore?.dispatch({ type: "auth/logout" });
  if (window.location.pathname !== "/login" && window.location.pathname !== "/super-admin-login") {
    window.location.replace("/login");
  }
};

export const setupAuthInterceptor = (store) => {
  authStore = store;
};

if (typeof window !== "undefined") {
  window.addEventListener("restosphere:outlet-changed", () => {
    outletRequestControllers.forEach((controller) => controller.abort());
    outletRequestControllers.clear();
  });
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // This is intentionally read at request time. It must never capture an
  // outlet selected by a previous user session.
  delete config.headers["X-Outlet-Id"];
  const outletId = localStorage.getItem("selectedOutletId");
  if (outletId && !shouldSkipOutletHeader(config.url || "")) config.headers["X-Outlet-Id"] = outletId;
  const method = String(config.method || "get").toLowerCase();
  const url = String(config.url || "");
  if (!config.signal && !shouldSkipOutletHeader(url)) {
    const controller = new AbortController();
    config.signal = controller.signal;
    config._outletRequestController = controller;
    outletRequestControllers.add(controller);
  }
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
  (response) => {
    if (response.config?._outletRequestController) outletRequestControllers.delete(response.config._outletRequestController);
    if (!response.config?._connectivityProbe) {
      window.dispatchEvent(new CustomEvent("restosphere:api-reachability", { detail: { ok: true } }));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config;
    if (originalRequest?._outletRequestController) outletRequestControllers.delete(originalRequest._outletRequestController);
    const payload = error?.response?.data;
    const code = payload?.code;
    // Existing toast calls can safely read this normalized message.
    error.userMessage = getApiErrorMessage(error);
    if (payload && typeof payload === "object" && typeof payload.message === "string") {
      payload.message = error.userMessage;
    }
    if (!error.response) {
      window.dispatchEvent(new CustomEvent("restosphere:api-reachability", { detail: { ok: false, hasResponse: false } }));
    }

    if (isOutletAccessDenied(error) && originalRequest && !originalRequest._outletRetry) {
      originalRequest._outletRetry = true;
      authStore?.dispatch({ type: "auth/outletRecoveryStarted" });
      if (!outletAccessToastShown) {
        outletAccessToastShown = true;
        window.dispatchEvent(new CustomEvent("restosphere:outlet-access-denied"));
      }

      if (!outletRecoveryPromise) {
        outletRecoveryPromise = (async () => {
          const token = localStorage.getItem("accessToken");
          const { data } = await refreshClient.get("/outlets/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const outlets = data?.data || [];
          authStore?.dispatch({ type: "auth/resolveAuthorizedOutlets", payload: outlets });
          if (authStore?.getState()?.auth?.outletStatus !== "ready") {
            throw new Error("No authorized outlet is available for this user");
          }
          outletAccessToastShown = false;
        })().finally(() => {
          outletRecoveryPromise = null;
        });
      }

      try {
        await outletRecoveryPromise;
        return api(originalRequest);
      } catch (recoveryError) {
        return Promise.reject(recoveryError);
      }
    }

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
