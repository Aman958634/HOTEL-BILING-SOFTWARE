const CASHFREE_ENVIRONMENTS = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

const CASHFREE_ENVIRONMENT_ALIASES = {
  sandbox: "sandbox",
  test: "sandbox",
  production: "production",
  prod: "production",
  live: "production",
};

export const normalizeCashfreeEnvironment = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const environment = CASHFREE_ENVIRONMENT_ALIASES[normalized];
  if (!environment) throw new Error("CASHFREE_ENV must be sandbox, test, production, prod, or live");
  return environment;
};

export const getCashfreeConfig = () => {
  const configuredEnvironment = String(process.env.CASHFREE_ENV || "").trim();
  const environment = configuredEnvironment ? normalizeCashfreeEnvironment(configuredEnvironment) : "";

  const appId = String(process.env.CASHFREE_APP_ID || "").trim();
  const secretKey = String(process.env.CASHFREE_SECRET_KEY || "").trim();

  return {
    enabled: String(process.env.CASHFREE_ENABLED || "").trim().toLowerCase() === "true",
    easySplitEnabled: String(process.env.CASHFREE_EASY_SPLIT_ENABLED || "false").trim().toLowerCase() === "true",
    environment,
    baseUrl: CASHFREE_ENVIRONMENTS[environment] || "",
    appId,
    secretKey,
    configured: Boolean(environment && appId && secretKey),
    apiVersion: String(process.env.CASHFREE_API_VERSION || "2026-01-01").trim(),
    easySplitApiVersion: String(process.env.CASHFREE_EASY_SPLIT_API_VERSION || "2023-08-01").trim(),
  };
};

export const assertCashfreeConfiguration = () => {
  const config = getCashfreeConfig();
  if (config.enabled && !config.configured) {
    throw new Error("Cashfree is enabled but CASHFREE_ENV, CASHFREE_APP_ID, or CASHFREE_SECRET_KEY is missing");
  }
  return config;
};

export const getCashfreeEasySplitStatus = () => {
  const config = getCashfreeConfig();
  const sandboxOnly = config.environment === "sandbox";
  const available = config.easySplitEnabled && config.configured && sandboxOnly;
  return {
    enabled: config.easySplitEnabled,
    available,
    sandboxOnly,
    status: available ? "SANDBOX_ENABLED" : "ACTIVATION_REQUIRED",
    message: available
      ? "Cashfree Easy Split sandbox onboarding is enabled. No payment distribution is enabled."
      : "Cashfree Easy Split sandbox activation and backend credentials are required before settlement onboarding can be used.",
  };
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
