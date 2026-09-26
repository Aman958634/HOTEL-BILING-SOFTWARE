import { resolveFrontendRuntimeConfig } from "./runtimeEnvironment";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CHEF: "chef",
  WAITER: "waiter",
  CASHIER: "cashier",
  DELIVERY: "delivery",
  CUSTOMER: "customer",
};

const runtimeConfig = resolveFrontendRuntimeConfig({
  apiUrl: import.meta.env.VITE_API_URL,
  socketUrl: import.meta.env.VITE_SOCKET_URL,
  deploymentEnvironment: import.meta.env.VITE_DEPLOYMENT_ENV,
  platformEnvironment: globalThis.__RESTOSPHERE_PLATFORM_ENV__,
  stagingApiHosts: import.meta.env.VITE_STAGING_API_HOSTS,
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
});

export const API_URL = runtimeConfig.apiUrl;
export const SOCKET_URL = runtimeConfig.socketUrl;
