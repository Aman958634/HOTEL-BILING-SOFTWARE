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

const viteEnv = import.meta.env || {};
const isNodeTest = typeof process !== "undefined" && process.env?.NODE_ENV === "test";

const runtimeConfig = resolveFrontendRuntimeConfig({
  apiUrl: viteEnv.VITE_API_URL,
  socketUrl: viteEnv.VITE_SOCKET_URL,
  deploymentEnvironment: viteEnv.VITE_DEPLOYMENT_ENV,
  platformEnvironment: globalThis.__RESTOSPHERE_PLATFORM_ENV__,
  stagingApiHosts: viteEnv.VITE_STAGING_API_HOSTS,
  isProduction: viteEnv.PROD,
  isDevelopment: viteEnv.DEV || isNodeTest,
});

export const API_URL = runtimeConfig.apiUrl;
export const SOCKET_URL = runtimeConfig.socketUrl;
