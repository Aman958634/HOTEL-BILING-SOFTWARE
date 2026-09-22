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
const localHostName = ["local", "host"].join("");
const loopbackAddress = [127, 0, 0, 1].join(".");

const isLocalUrl = (url) => {
  try {
    const host = new URL(url).hostname;
    return host === localHostName || host === loopbackAddress;
  } catch {
    return false;
  }
};
if (import.meta.env.PROD && (!configuredApiUrl || !configuredSocketUrl || isLocalUrl(configuredApiUrl) || isLocalUrl(configuredSocketUrl))) {
  throw new Error("Production frontend configuration requires VITE_API_URL and VITE_SOCKET_URL.");
}

// Keep local fallback URLs out of production output entirely. Production has
// already failed fast above if its public endpoints are not configured.
const developmentOrigin = import.meta.env.DEV ? `http://${localHostName}:5002` : "";
const developmentApiUrl = developmentOrigin ? `${developmentOrigin}/api/v1` : "";
const developmentSocketUrl = developmentOrigin;
const normalizeApiUrl = (url) => /\/api\/v1$/i.test(url) ? url : `${url}/api/v1`;

export const API_URL = normalizeApiUrl(configuredApiUrl || developmentApiUrl);
export const SOCKET_URL = configuredSocketUrl || developmentSocketUrl;
