const PAYMENT_ID_PATTERN = /^PAY-(\d+)$/i;

export const formatPaymentId = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value).trim();
  const match = raw.match(PAYMENT_ID_PATTERN);
  if (match) return `PAY-${match[1].padStart(4, "0")}`;
  if (/^\d+$/.test(raw)) return `PAY-${raw.padStart(4, "0")}`;
  return raw;
};
