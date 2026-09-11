// Only these four fields may leave a provider failure. Raw bodies and headers
// are never retained. Provider text can echo request data, so redact it first.
const safeText = (value, max) => {
  if (typeof value !== "string") return "";
  let text = value;
  for (const secret of [process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY]) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text
    .replace(/\b(?:authorization|client[_-]?secret|api[_-]?key|account[_ -]?(?:number|no)|bank|pan|upi|vpa)\b["'\s]*[:=][^\r\n]*/gi, "[redacted]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[redacted]")
    .replace(/[\w.+-]+@[\w.-]+/g, "[redacted]")
    .replace(/\b\d{8,}\b/g, "[redacted]")
    .replace(/[\r\n\t\x00-\x1f]+/g, " ").trim().slice(0, max);
};

export const safeCashfreeError = (status, payload = {}) => {
  const error = payload?.error && typeof payload.error === "object" ? payload.error : {};
  return {
    providerHttpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    providerErrorCode: safeText(payload?.code || payload?.error_code || error.code, 120),
    providerErrorType: safeText(payload?.type || payload?.error_type || error.type, 120),
    providerErrorMessage: safeText(payload?.message || payload?.error_message || error.message, 500),
  };
};

export const diagnosticsFromError = (error) => safeCashfreeError(error?.details?.providerHttpStatus, {
  code: error?.details?.providerErrorCode,
  type: error?.details?.providerErrorType,
  message: error?.details?.providerErrorMessage,
});
