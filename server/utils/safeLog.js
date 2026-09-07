const secretKey = /(authorization|cookie|password|passwordHash|token|accessToken|refreshToken|jwt|otp|secret|apiKey|signature|razorpaySignature|privateKey|mongoUri|smtpPassword)/i;

export const redactSensitive = (value, seen = new WeakSet()) => {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? "[REDACTED]" : redactSensitive(item, seen)]));
};

export const safeErrorContext = (error) => ({
  name: error?.name || "Error",
  message: String(error?.message || "Internal server error").slice(0, 500),
  code: typeof error?.code === "string" ? error.code : undefined,
});
