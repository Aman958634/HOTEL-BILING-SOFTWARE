import axios from "axios";
import { API_URL } from "../utils/constants";
import { getApiErrorMessage } from "../utils/apiError";
import { activateGlobalErrorCondition, observeApiError, reportGlobalError, resolveGlobalErrorCondition } from "./errorNotificationService";
import { clearStoredAuthTokens, getAccessToken, persistAccessToken } from "../utils/authSession";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let authStore = null;
let isRefreshing = false;
let failedQueue = [];
let outletRecoveryPromise = null;
let outletAccessToastShown = false;
const outletRequestControllers = new Set();

const AUTH_SKIP_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];
const supportsAbortController = typeof AbortController === "function";
const createClientIdempotencyKey = () => {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  return cryptoApi?.randomUUID?.() || `payment-${Date.now()}-${Math.random()}`;
};

const shouldSkipRefresh = (url = "") =>
  AUTH_SKIP_REFRESH_PATHS.some((path) => url.includes(path));

const isPublicRequest = (url = "") => String(url).includes("/public/");
const shouldSkipOutletHeader = (url = "") => isPublicRequest(url) || String(url).includes("/auth/") || String(url).startsWith("/outlets");

const isOutletAccessDenied = (error) =>
  error?.response?.status === 403 &&
  (error?.response?.data?.code === "OUTLET_ACCESS_DENIED" ||
    error?.response?.data?.message === "You do not have access to the requested outlet");

const isRestaurantAccountBlocked = (error) =>
  error?.response?.status === 403 &&
  ["RESTAURANT_ACCOUNT_SUSPENDED", "RESTAURANT_ACCOUNT_ARCHIVED"].includes(error?.response?.data?.code);

const processQueue = (error, token = null) => {
  const queue = failedQueue;
  failedQueue = [];
  queue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
      resolve(api(config));
    }
  });
};

const clearAuthAndRedirectToLogin = (accountStatusMessage = "") => {
  if (accountStatusMessage) {
    try {
      sessionStorage.setItem("restaurantAccountStatusMessage", accountStatusMessage);
    } catch {
      // A restricted browser storage context still clears its auth state below.
    }
  }
  clearStoredAuthTokens();
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
  const url = String(config.url || "");
  const token = getAccessToken();
  if (token && !isPublicRequest(url)) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (isPublicRequest(url)) {
    delete config.headers.Authorization;
  }
  // This is intentionally read at request time. It must never capture an
  // outlet selected by a previous user session.
  delete config.headers["X-Outlet-Id"];
  const outletId = localStorage.getItem("selectedOutletId");
  if (outletId && !shouldSkipOutletHeader(config.url || "")) config.headers["X-Outlet-Id"] = outletId;
  const method = String(config.method || "get").toLowerCase();
  if (!config.signal && !shouldSkipOutletHeader(url) && supportsAbortController) {
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
    config.headers["Idempotency-Key"] = createClientIdempotencyKey();
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config?._outletRequestController) outletRequestControllers.delete(response.config._outletRequestController);
    resolveGlobalErrorCondition("NETWORK_UNAVAILABLE");
    const subscriptionStatus = String(
      response?.data?.data?.subscription?.status || response?.data?.data?.status || ""
    ).toLowerCase();
    if (/subscription|billing/i.test(String(response.config?.url || "")) && ["active", "trial"].includes(subscriptionStatus)) {
      resolveGlobalErrorCondition();
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
    // Preserve server-side field validation so forms can show feedback next to
    // the affected control instead of relying only on a global notification.
    error.fieldErrors = payload?.errors || payload?.details?.fields || {};
    if (payload && typeof payload === "object" && typeof payload.message === "string") {
      payload.message = error.userMessage;
    }
    const notificationMetadata = observeApiError(error);
    if (isRestaurantAccountBlocked(error) && originalRequest && !String(originalRequest.url || "").includes("/auth/login")) {
      clearAuthAndRedirectToLogin(payload?.message || "Restaurant account access is unavailable. Please contact support.");
      return Promise.reject(error);
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
          const token = getAccessToken();
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
      activateGlobalErrorCondition(error);
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

    if (!error?.response && error?.code !== "ERR_CANCELED") {
      const networkError = Object.assign(error, {
        userMessage: "Unable to connect. Check your connection and try again.",
        code: "NETWORK_UNAVAILABLE",
      });
      reportGlobalError(networkError, { context: "network" });
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

    if (isRefreshing) {
      // Mark queued requests before retrying them so each original request can
      // enter the refresh path only once.
      originalRequest._retry = true;
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await refreshClient.post("/auth/refresh");
      const newAccessToken = data?.data?.accessToken;
      if (!newAccessToken) {
        throw new Error("Refresh response missing access token");
      }

      persistAccessToken(newAccessToken);
      authStore?.dispatch({
        type: "auth/setAccessToken",
        payload: newAccessToken,
      });

      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      const refreshStatus = Number(refreshError?.response?.status || 0);
      const invalidRefreshSession = refreshStatus === 401;
      const blockedAccount = isRestaurantAccountBlocked(refreshError);

      // A network timeout/cold start/5xx is not evidence that the refresh
      // session is invalid. Keep the local session intact so the user can
      // retry normally without being sent to Login.
      if (!invalidRefreshSession && !blockedAccount) {
        if (!refreshError?.response) {
          reportGlobalError(Object.assign(refreshError || new Error("Refresh unavailable"), {
            code: "NETWORK_UNAVAILABLE",
            userMessage: "Unable to renew your session right now. Please check your connection and try again.",
          }), { context: "auth-refresh" });
        }
        return Promise.reject(refreshError);
      }

      if (invalidRefreshSession) {
        reportGlobalError({
          code: "AUTH_SESSION_EXPIRED",
          userMessage: "Your session has expired. Please sign in again.",
          config: { method: "POST", url: "/auth/refresh" },
        }, { context: "auth-refresh" });
      }
      clearAuthAndRedirectToLogin(blockedAccount ? refreshError?.response?.data?.message : "");
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
