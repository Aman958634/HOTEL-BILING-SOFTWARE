/** Shared allowed browser origins for Express CORS and Socket.IO. */
const parseOriginList = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .filter((item) => item.startsWith("http://") || item.startsWith("https://"));

export const getAllowedOrigins = () => {
  const configured = [
    ...parseOriginList(process.env.ALLOWED_ORIGINS),
    ...parseOriginList(process.env.CLIENT_URL),
  ];

  if (process.env.NODE_ENV === "production") {
    return [...new Set(configured)];
  }

  const devDefaults = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ];

  return [...new Set([...configured, ...devDefaults])];
};

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
};
