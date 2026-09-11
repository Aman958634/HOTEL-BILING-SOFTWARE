const present = (name) => {
  const value = String(process.env[name] || "").trim();
  return Boolean(value) && !/^replace_with|^your_/i.test(value);
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

  const required = [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "CLIENT_URL",
    "ALLOWED_ORIGINS",
    "MONGO_URI or MONGODB_URI",
    "CASHFREE_ENV",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "CASHFREE_API_VERSION",
    "CASHFREE_PAYMENTS_ENABLED",
    "CASHFREE_EASY_SPLIT_ENABLED",
    "CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED",
  ];

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
