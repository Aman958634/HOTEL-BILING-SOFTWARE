const trimTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");
const productionApiHosts = new Set(["hotel-biling-software.onrender.com"]);

const parseHttpsUrl = (value, variableName) => {
  const normalized = trimTrailingSlashes(value);
  if (!normalized) throw new Error(`${variableName} is required.`);

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`${variableName} must be an HTTPS URL.`);
  }
  if (url.protocol !== "https:") throw new Error(`${variableName} must be an HTTPS URL.`);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    throw new Error(`${variableName} must not use a loopback host.`);
  }
  return url;
};

const hostAllowlist = (value) =>
  String(value || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

export const resolveFrontendRuntimeConfig = ({
  apiUrl,
  socketUrl,
  deploymentEnvironment,
  platformEnvironment,
  stagingApiHosts,
  isProduction,
  isDevelopment,
}) => {
  const environment = String(deploymentEnvironment || "").trim().toLowerCase();
  const platform = String(platformEnvironment || "").trim().toLowerCase();
  const isPreview = platform === "preview";
  const isStaging = environment === "staging" || isPreview;

  if (isPreview && environment !== "staging") {
    throw new Error("Vercel Preview requires VITE_DEPLOYMENT_ENV=staging.");
  }

  if (isStaging) {
    if (environment !== "staging") throw new Error("Staging frontend requires VITE_DEPLOYMENT_ENV=staging.");
    const api = parseHttpsUrl(apiUrl, "VITE_API_URL");
    const socket = parseHttpsUrl(socketUrl, "VITE_SOCKET_URL");
    const approvedHosts = hostAllowlist(stagingApiHosts);
    if (!approvedHosts.length) throw new Error("Staging frontend requires VITE_STAGING_API_HOSTS.");
    if (approvedHosts.some((host) => productionApiHosts.has(host))) {
      throw new Error("VITE_STAGING_API_HOSTS must not contain a production API host.");
    }
    if (productionApiHosts.has(api.hostname.toLowerCase()) || productionApiHosts.has(socket.hostname.toLowerCase())) {
      throw new Error("Staging frontend cannot use the production API host.");
    }
    if (!approvedHosts.includes(api.hostname.toLowerCase())) {
      throw new Error("VITE_API_URL is not an approved staging API host.");
    }
    if (!approvedHosts.includes(socket.hostname.toLowerCase())) {
      throw new Error("VITE_SOCKET_URL is not an approved staging API host.");
    }
    return { apiUrl: `${trimTrailingSlashes(api.href)}/api/v1`.replace(/\/api\/v1\/api\/v1$/i, "/api/v1"), socketUrl: trimTrailingSlashes(socket.href) };
  }

  if (isProduction) {
    const api = parseHttpsUrl(apiUrl, "VITE_API_URL");
    const socket = parseHttpsUrl(socketUrl, "VITE_SOCKET_URL");
    return { apiUrl: /\/api\/v1$/i.test(trimTrailingSlashes(api.href)) ? trimTrailingSlashes(api.href) : `${trimTrailingSlashes(api.href)}/api/v1`, socketUrl: trimTrailingSlashes(socket.href) };
  }

  if (isDevelopment) {
    const localOrigin = "http://localhost:5002";
    return {
      apiUrl: trimTrailingSlashes(apiUrl) ? (/\/api\/v1$/i.test(trimTrailingSlashes(apiUrl)) ? trimTrailingSlashes(apiUrl) : `${trimTrailingSlashes(apiUrl)}/api/v1`) : `${localOrigin}/api/v1`,
      socketUrl: trimTrailingSlashes(socketUrl) || localOrigin,
    };
  }

  throw new Error("Frontend configuration requires an explicit deployment environment.");
};
