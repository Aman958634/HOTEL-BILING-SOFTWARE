const PAYMENT_ID_PATTERN = /^PAY-(\d+)$/i;

export const formatPaymentId = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value).trim();
  const match = raw.match(PAYMENT_ID_PATTERN);
  if (match) return `PAY-${match[1].padStart(4, "0")}`;
  if (/^\d+$/.test(raw)) return `PAY-${raw.padStart(4, "0")}`;
  return raw;
};

export const paymentIdLookupPattern = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const match = raw.match(PAYMENT_ID_PATTERN);
  const digits = match ? match[1] : /^\d+$/.test(raw) ? raw : null;
  if (!digits) return null;
  return new RegExp(`^PAY-0*${digits}$`, "i");
};
