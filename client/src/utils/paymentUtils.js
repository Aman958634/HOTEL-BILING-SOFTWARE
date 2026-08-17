export const paymentRangeOptions = [
  { label: "All Time", value: "" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
];

export const paymentStatusOptions = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Paid", value: "PAID" },
  { label: "Failed", value: "FAILED" },
  { label: "Refunded", value: "REFUNDED" },
  { label: "Partially Refunded", value: "PARTIALLY_REFUNDED" },
];

export const paymentMethodOptions = [
  { label: "All Methods", value: "" },
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Credit Card", value: "CREDIT_CARD" },
  { label: "Debit Card", value: "DEBIT_CARD" },
  { label: "Net Banking", value: "NET_BANKING" },
  { label: "Wallet", value: "WALLET" },
  { label: "Razorpay", value: "RAZORPAY" },
  { label: "Other", value: "OTHER" },
];

const methodLabels = {
  CASH: "Cash",
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

const statusLabels = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

export const paymentMethodLabel = (value) => methodLabels[String(value || "OTHER").toUpperCase()] || "Other";

export const gatewayLabel = (payment = {}) => {
  const method = String(payment.paymentMethod || "").toUpperCase();
  const gateway = String(payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "").trim();
  if (method === "CASH" || gateway.toLowerCase() === "cash") return "—";
  if (!gateway) return "—";
  const lower = gateway.toLowerCase();
  if (lower === "razorpay") return "Razorpay";
  if (lower === "stripe") return "Stripe";
  return gateway;
};

export const paymentStatusLabel = (value) => statusLabels[String(value || "PENDING").toUpperCase()] || "Pending";

export const getPaymentAmount = (payment) => {
  if (!payment || typeof payment !== "object") return 0;
  const raw = payment.totalAmount ?? payment.amount ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

export const formatPaymentDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "-";

export const formatPaymentDay = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
      }).format(new Date(value))
    : "-";

export const paymentBadgeClasses = (value) => {
  const status = String(value || "PENDING").toUpperCase();
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "PROCESSING") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "FAILED") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export const canRefundPayment = (payment) => {
  if (!payment) return false;
  const status = String(payment.paymentStatus || "").toUpperCase();
  return ["PAID", "PARTIALLY_REFUNDED"].includes(status) && Number(getPaymentAmount(payment) - Number(payment.refundAmount || 0)) > 0;
};
