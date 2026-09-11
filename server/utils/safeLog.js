const secretKey = /(authorization|cookie|password|token|jwt|otp|secret|api[_-]?key|signature|privateKey|mongoUri|smtpPassword|account[_-]?(number|no)|bank|^pan$|upi|vpa|sessionId|client[_-]?id|app[_-]?id)/i;

export const redactLogText = (value) => {
  let text = String(value);
  for (const key of ["CASHFREE_APP_ID", "CASHFREE_SECRET_KEY", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "MONGO_URI", "MONGODB_URI"]) {
    if (process.env[key]) text = text.split(process.env[key]).join("[REDACTED]");
  }
  return text
    .replace(/(?:mongodb(?:\+srv)?|https?):\/\/[^\s/@]+:[^\s/@]+@[^\s]+/gi, "[REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:password|secret|token|api[_-]?key|client[_-]?secret|account[_ -]?(?:number|no)|pan|upi|vpa)\b["'\s]*[:=]\s*[^\s,;]+/gi, "[REDACTED]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[REDACTED]")
    .replace(/[\w.+-]+@[\w.-]+/g, "[REDACTED]");
};

export const redactSensitive = (value, seen = new WeakSet()) => {
  if (typeof value === "string") return redactLogText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? "[REDACTED]" : redactSensitive(item, seen)]));
};

export const safeErrorContext = (error) => ({
  name: error?.name || "Error",
  message: redactLogText(error?.message || "Internal server error").slice(0, 500),
  code: typeof error?.code === "string" ? error.code : undefined,
});
