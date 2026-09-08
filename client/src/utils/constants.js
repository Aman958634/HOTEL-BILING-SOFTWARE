export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CHEF: "chef",
  WAITER: "waiter",
  CASHIER: "cashier",
  DELIVERY: "delivery",
  CUSTOMER: "customer",
};

const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const configuredSocketUrl = String(import.meta.env.VITE_SOCKET_URL || "").trim().replace(/\/+$/, "");

const isLocalUrl = (url) => /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
if (import.meta.env.PROD && (!configuredApiUrl || !configuredSocketUrl || isLocalUrl(configuredApiUrl) || isLocalUrl(configuredSocketUrl))) {
  throw new Error("Production frontend configuration requires VITE_API_URL and VITE_SOCKET_URL.");
}

const developmentApiUrl = "http://localhost:5002/api/v1";
const developmentSocketUrl = "http://localhost:5002";
const normalizeApiUrl = (url) => /\/api\/v1$/i.test(url) ? url : `${url}/api/v1`;

export const API_URL = normalizeApiUrl(configuredApiUrl || developmentApiUrl);
export const SOCKET_URL = configuredSocketUrl || developmentSocketUrl;
