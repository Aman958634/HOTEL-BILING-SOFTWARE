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
    enabled: String(process.env.CASHFREE_PAYMENTS_ENABLED ?? process.env.CASHFREE_ENABLED ?? "").trim().toLowerCase() === "true",
    easySplitEnabled: String(process.env.CASHFREE_EASY_SPLIT_ENABLED || "false").trim().toLowerCase() === "true",
    // Payment allocation is intentionally a separate opt-in from Phase 1 vendor
    // onboarding.  This prevents an account-verification deployment from ever
    // changing how customer payments are settled.
    easySplitPaymentsEnabled: String(process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED || "false").trim().toLowerCase() === "true",
    settlementReconciliationEnabled: String(process.env.CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED || "false").trim().toLowerCase() === "true",
    environment,
    baseUrl: CASHFREE_ENVIRONMENTS[environment] || "",
    appId,
    secretKey,
    configured: Boolean(environment && appId && secretKey),
    apiVersion: String(process.env.CASHFREE_API_VERSION || "2026-01-01").trim(),
    easySplitApiVersion: String(process.env.CASHFREE_EASY_SPLIT_API_VERSION || "2023-08-01").trim(),
    // Cashfree documents Split After Payment with this contract version.  Keep
    // it separate from vendor onboarding so a verified onboarding version is
    // not silently changed.
    easySplitSplitApiVersion: String(process.env.CASHFREE_EASY_SPLIT_SPLIT_API_VERSION || "2022-09-01").trim(),
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
  const available = config.easySplitEnabled && config.configured && ["sandbox", "production"].includes(config.environment);
  return {
    enabled: config.easySplitEnabled,
    available,
    sandboxOnly,
    status: available ? (sandboxOnly ? "SANDBOX_ENABLED" : "PRODUCTION_ENABLED") : "ACTIVATION_REQUIRED",
    message: available
      ? (config.easySplitPaymentsEnabled
        ? "Cashfree Easy Split sandbox payment allocation is enabled."
        : "Cashfree Easy Split sandbox onboarding is enabled. Payment allocation is disabled.")
      : "Cashfree Easy Split sandbox activation and backend credentials are required before settlement onboarding can be used.",
  };
};

export const getCashfreeReturnUrl = () => {
  const configured = String(process.env.CASHFREE_RETURN_URL || "").trim();
  const clientUrl = String(process.env.CLIENT_URL || "").trim().replace(/\/$/, "");
  const baseUrl = configured || (clientUrl ? `${clientUrl}/payment/cashfree/return` : "");
  if (!baseUrl) throw new Error("CASHFREE_RETURN_URL or CLIENT_URL is required for Cashfree checkout");
  if (baseUrl.includes(",") || /^(javascript|data|file):/i.test(baseUrl)) throw new Error("Cashfree return URL must be a single HTTP(S) URL");
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error("Cashfree return URL must be a valid URL"); }
  if (parsed.protocol !== "https:" && getCashfreeConfig().environment === "production") throw new Error("Cashfree production return URL must use HTTPS");
  if (getCashfreeConfig().environment === "production" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) throw new Error("Cashfree return URL cannot use localhost or loopback addresses");
  if (parsed.username || parsed.password) throw new Error("Cashfree return URL cannot contain credentials");
  const canonical = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  if (!/\/payment\/cashfree\/return$/i.test(canonical)) throw new Error("Cashfree return URL must use the canonical payment return path");
  return `${canonical}?order_id={order_id}`;
};
