/** Shared allowed browser origins for Express CORS and Socket.IO. */
export const getAllowedOrigins = () => {
  const configured = String(process.env.CLIENT_URL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const devDefaults = ["http://localhost:5173", "http://localhost:5174"];

  return [...new Set([...configured, ...devDefaults])];
};

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};
