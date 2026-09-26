const present = (name) => {
  const value = String(process.env[name] || "").trim();
  return Boolean(value) && !/^replace_with|^your_/i.test(value);
};

const list = (value) => String(value || "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const stagingMongoTarget = (uri) => {
  try {
    const parsed = new URL(String(uri || "").replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return {
      host: String(parsed.hostname || "").toLowerCase(),
      database: decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "").split("/")[0],
    };
  } catch {
    throw new Error("Staging MONGO_URI must be a valid MongoDB connection URI");
  }
};

export const isApprovedStagingMongoTarget = (uri, env = process.env) => {
  try {
    const rawUri = String(uri || "").trim();
    if (!/^mongodb\+srv:\/\//i.test(rawUri) || /(?:[?&](?:tls|ssl)=false(?:&|$))/i.test(rawUri)) return false;
    const target = stagingMongoTarget(uri);
    const allowedHosts = list(env.STAGING_MONGODB_HOSTS);
    const productionHosts = list(env.STAGING_PRODUCTION_MONGODB_HOSTS);
    const expectedDatabase = String(env.STAGING_MONGODB_DATABASE || "").trim();
    return Boolean(
      expectedDatabase
      && allowedHosts.length
      && productionHosts.length
      && allowedHosts.includes(target.host)
      && !productionHosts.includes(target.host)
      && target.database === expectedDatabase
      && !/production|prod|live/i.test(target.database)
    );
  } catch {
    return false;
  }
};

const assertStagingHttpsOrigins = (value, label) => {
  const origins = list(value);
  if (!origins.length || origins.some((origin) => !/^https:\/\/[^/]+$/i.test(origin) || /localhost|127\.0\.0\.1/.test(origin))) {
    throw new Error(`Staging ${label} must contain only explicit HTTPS origins without localhost`);
  }
  return origins;
};

const isLocalMongoUri = (uri) => {
  try {
    const parsed = new URL(String(uri).replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return ["localhost", "127.0.0.1", "::1"].includes(String(parsed.hostname || "").toLowerCase());
  } catch {
    return false;
  }
};

export const validateProductionEnvironment = () => {
  if (process.env.NODE_ENV !== "production") return;

  const whatsappEnabled = String(process.env.WHATSAPP_ENABLED || "false").trim().toLowerCase();
  if (!["true", "false"].includes(whatsappEnabled)) throw new Error("WHATSAPP_ENABLED must be explicitly true or false");

  const required = [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "CLIENT_URL",
    "ALLOWED_ORIGINS",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USER",
    "EMAIL_PASS",
    "MONGO_URI or MONGODB_URI",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "CASHFREE_ENV",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "CASHFREE_API_VERSION",
    "CASHFREE_PAYMENTS_ENABLED",
    "CASHFREE_EASY_SPLIT_ENABLED",
    "CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED",
    "CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED",
  ];

  if (whatsappEnabled === "true") {
    required.push("WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_API_VERSION", "WHATSAPP_RECEIPT_TEMPLATE_NAME");
  }

  if (String(process.env.PUBLIC_MENU_ENABLED || "true").toLowerCase() !== "false") {
    required.push("PUBLIC_MENU_CONTEXT_SECRET");
  }

  const missing = required.filter((name) => {
    if (name === "MONGO_URI or MONGODB_URI") return !present("MONGO_URI") && !present("MONGODB_URI");
    if (name === "ALLOWED_ORIGINS") return !present("ALLOWED_ORIGINS") && !present("CLIENT_URL");
    if (name.startsWith("CASHFREE_") && name.endsWith("_ENABLED")) return !["true", "false"].includes(String(process.env[name] || "").trim().toLowerCase());
    return !present(name);
  });

  if (missing.length) {
    throw new Error(`Production configuration is missing: ${missing.join(", ")}`);
  }

  if (String(process.env.BILLING_TEST_MODE || "").trim().toLowerCase() === "true") {
    throw new Error("Production runtime requires BILLING_TEST_MODE=false");
  }

  const emailPort = Number(process.env.EMAIL_PORT);
  if (!Number.isInteger(emailPort) || emailPort < 1 || emailPort > 65535) {
    throw new Error("Production EMAIL_PORT must be a valid SMTP port");
  }
  const emailSecure = String(process.env.EMAIL_SECURE || "").trim().toLowerCase();
  if (emailSecure && !["true", "false"].includes(emailSecure)) {
    throw new Error("EMAIL_SECURE must be true or false when configured");
  }

  const cashfreeEnvironment = String(process.env.CASHFREE_ENV || "").trim().toLowerCase();
  if (cashfreeEnvironment !== "production") {
    throw new Error("Production runtime requires CASHFREE_ENV=production");
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri || isLocalMongoUri(mongoUri) || String(mongoUri).includes("TEST_MONGO_URI")) {
    throw new Error("Production configuration must use a remote MongoDB database without localhost or test URI fallback");
  }

  const clientOrigin = String(process.env.CLIENT_URL || "").trim();
  if (!clientOrigin || clientOrigin.includes(",") || !/^https:\/\/[^/]+$/i.test(clientOrigin) || /localhost|127\.0\.0\.1|http:/.test(clientOrigin)) {
    throw new Error("Production CLIENT_URL must be a valid HTTPS origin without localhost or http://");
  }

  const cashfreeReturnUrl = String(process.env.CASHFREE_RETURN_URL || "").trim();
  if (cashfreeReturnUrl && (cashfreeReturnUrl.includes(",") || !/^https:\/\/[^/]+\/payment\/cashfree\/return$/i.test(cashfreeReturnUrl) || /localhost|127\.0\.0\.1/.test(cashfreeReturnUrl))) {
    throw new Error("Production CASHFREE_RETURN_URL must be HTTPS and cannot use localhost or loopback addresses");
  }

  const allowedOriginValue = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (allowedOriginValue && (allowedOriginValue.includes(",") || /localhost|127\.0\.0\.1|http:/.test(allowedOriginValue))) {
    throw new Error("Production ALLOWED_ORIGINS must not include localhost, 127.0.0.1, or http:// values");
  }

  const cashfreeAppId = String(process.env.CASHFREE_APP_ID || "").trim();
  const cashfreeSecretKey = String(process.env.CASHFREE_SECRET_KEY || "").trim();
  if (cashfreeAppId.toLowerCase().includes("sandbox") || cashfreeSecretKey.toLowerCase().includes("sandbox")) {
    throw new Error("Production Cashfree credentials cannot contain sandbox values");
  }

  if (String(process.env.CASHFREE_API_VERSION || "").trim() === "") {
    throw new Error("Production requires a valid CASHFREE_API_VERSION");
  }

  if (String(process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED || "").trim().toLowerCase() !== "true" && String(process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED || "").trim().toLowerCase() !== "false") {
    throw new Error("CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED must be explicitly true or false");
  }
};

/**
 * Staging is deliberately fail-closed: its MongoDB hostname and database must
 * match the platform-provided staging allowlist and may never match a listed
 * production hostname. This runs before the application opens a connection.
 */
export const validateStagingEnvironment = () => {
  if (String(process.env.NODE_ENV || "").toLowerCase() !== "staging") return;

  const mongoUri = String(process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  const secondaryUri = String(process.env.MONGO_URI && process.env.MONGODB_URI ? process.env.MONGODB_URI : "").trim();
  const allowedHosts = list(process.env.STAGING_MONGODB_HOSTS);
  const productionHosts = list(process.env.STAGING_PRODUCTION_MONGODB_HOSTS);
  const expectedDatabase = String(process.env.STAGING_MONGODB_DATABASE || "").trim();
  const missing = [
    !mongoUri && "MONGO_URI or MONGODB_URI",
    !allowedHosts.length && "STAGING_MONGODB_HOSTS",
    !productionHosts.length && "STAGING_PRODUCTION_MONGODB_HOSTS",
    !expectedDatabase && "STAGING_MONGODB_DATABASE",
    !present("JWT_ACCESS_SECRET") && "JWT_ACCESS_SECRET",
    !present("JWT_REFRESH_SECRET") && "JWT_REFRESH_SECRET",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Staging configuration is missing: ${missing.join(", ")}`);
  if (secondaryUri && secondaryUri !== mongoUri) throw new Error("Staging must configure only one MongoDB URI value");
  if (allowedHosts.some((host) => productionHosts.includes(host))) throw new Error("Staging MongoDB allowlist overlaps the production hostname denylist");

  const target = stagingMongoTarget(mongoUri);
  if (!/^mongodb\+srv:\/\//i.test(mongoUri) || /(?:[?&](?:tls|ssl)=false(?:&|$))/i.test(mongoUri)) {
    throw new Error("Staging MongoDB requires an Atlas mongodb+srv TLS URI without tls=false or ssl=false");
  }
  if (!allowedHosts.includes(target.host)) throw new Error("Staging MongoDB hostname is not on STAGING_MONGODB_HOSTS");
  if (productionHosts.includes(target.host)) throw new Error("Staging MongoDB hostname is listed as production");
  if (target.database !== expectedDatabase) throw new Error("Staging MongoDB database does not match STAGING_MONGODB_DATABASE");
  if (/production|prod|live/i.test(target.database)) throw new Error("Staging MongoDB database name is unsafe");
  if (!isApprovedStagingMongoTarget(mongoUri)) throw new Error("Staging MongoDB target failed allowlist validation");

  const clientOrigins = assertStagingHttpsOrigins(process.env.CLIENT_URL, "CLIENT_URL");
  const allowedOrigins = assertStagingHttpsOrigins(process.env.ALLOWED_ORIGINS, "ALLOWED_ORIGINS");
  if (clientOrigins.some((origin) => !allowedOrigins.includes(origin))) {
    throw new Error("Staging CLIENT_URL must be included in ALLOWED_ORIGINS for API and Socket.IO CORS");
  }

  if (String(process.env.BILLING_TEST_MODE || "").toLowerCase() !== "true") {
    throw new Error("Staging requires BILLING_TEST_MODE=true");
  }
  if (String(process.env.CASHFREE_ENV || "").toLowerCase() !== "sandbox") {
    throw new Error("Staging requires CASHFREE_ENV=sandbox");
  }
  for (const name of ["LIVE_DIGITAL_PAYMENTS", "CASHFREE_PAYMENTS_ENABLED", "CASHFREE_EASY_SPLIT_ENABLED", "CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED"]) {
    if (String(process.env[name] || "").toLowerCase() !== "false") throw new Error(`Staging requires ${name}=false`);
  }
  const razorpayKeyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  if (razorpayKeyId && !/^rzp_test_/i.test(razorpayKeyId)) {
    throw new Error("Staging Razorpay key ID must be a Razorpay test key");
  }
};
