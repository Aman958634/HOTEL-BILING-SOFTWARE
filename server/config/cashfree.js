const hasValue = (value) => Boolean(String(value || "").trim());

const CASHFREE_ENVIRONMENTS = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

export const getCashfreeConfig = () => {
  const environment = String(process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
  if (!CASHFREE_ENVIRONMENTS[environment]) {
    throw new Error("CASHFREE_ENV must be either sandbox or production");
  }

  return {
    enabled: String(process.env.CASHFREE_ENABLED || "").trim().toLowerCase() === "true",
    environment,
    baseUrl: CASHFREE_ENVIRONMENTS[environment],
    appId: String(process.env.CASHFREE_APP_ID || "").trim(),
    secretKey: String(process.env.CASHFREE_SECRET_KEY || "").trim(),
    apiVersion: String(process.env.CASHFREE_API_VERSION || "2026-01-01").trim(),
  };
};

export const assertCashfreeConfiguration = () => {
  const config = getCashfreeConfig();
  if (config.enabled && (!hasValue(config.appId) || !hasValue(config.secretKey))) {
    throw new Error("Cashfree is enabled but CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing");
  }
  return config;
};

export const getCashfreeReturnUrl = () => {
  const configured = String(process.env.CASHFREE_RETURN_URL || "").trim();
  const clientUrl = String(process.env.CLIENT_URL || "").trim().replace(/\/$/, "");
  const baseUrl = configured || (clientUrl ? `${clientUrl}/payment/cashfree/return` : "");
  if (!baseUrl) throw new Error("CASHFREE_RETURN_URL or CLIENT_URL is required for Cashfree checkout");
  if (getCashfreeConfig().environment === "production" && /^http:\/\/localhost/i.test(baseUrl)) {
    throw new Error("Cashfree production return URL cannot use localhost");
  }
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}order_id={order_id}`;
};
