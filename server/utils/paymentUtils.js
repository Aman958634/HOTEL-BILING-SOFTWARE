import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPaymentId } from "./paymentId.js";

export const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "Razorpay",
  CASHFREE: "Cashfree",
  HOTEL_UPI: "Hotel UPI",
  OTHER: "Other",
};

export const PAYMENT_STATUS_LABELS = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  AWAITING_VERIFICATION: "Awaiting Verification",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

export const PAYMENT_EVENT_LABELS = {
  ORDER_CREATED: "Order Created",
  PAYMENT_INITIATED: "Payment Initiated",
  PAYMENT_PROCESSING: "Payment Processing",
  PAYMENT_SUCCESSFUL: "Payment Successful",
  PAYMENT_FAILED: "Payment Failed",
  ORDER_COMPLETED: "Order Completed",
  REFUND_COMPLETED: "Refund Completed",
  PARTIAL_REFUND_COMPLETED: "Partial Refund Completed",
};

const paymentMethodAliases = {
  cash: "CASH",
  upi: "UPI",
  card: "CREDIT_CARD",
  credit: "CREDIT_CARD",
  credit_card: "CREDIT_CARD",
  debit: "DEBIT_CARD",
  debit_card: "DEBIT_CARD",
  net_banking: "NET_BANKING",
  netbanking: "NET_BANKING",
  wallet: "WALLET",
  razorpay: "RAZORPAY",
  cashfree: "CASHFREE",
  stripe: "OTHER",
  online: "OTHER",
  other: "OTHER",
};

const paymentStatusAliases = {
  pending: "PENDING",
  processing: "PROCESSING",
  awaiting_verification: "AWAITING_VERIFICATION",
  awaitingverification: "AWAITING_VERIFICATION",
  paid: "PAID",
  success: "PAID",
  failed: "FAILED",
  refunded: "REFUNDED",
  partial_refunded: "PARTIALLY_REFUNDED",
  partially_refunded: "PARTIALLY_REFUNDED",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

export const formatDateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDateOnly = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

export const normalizePaymentMethod = (value) => {
  if (!value) return "OTHER";
  const upper = String(value).trim().toUpperCase();
  if (Object.keys(PAYMENT_METHOD_LABELS).includes(upper)) return upper;
  return paymentMethodAliases[String(value).trim().toLowerCase()] || upper || "OTHER";
};

export const normalizePaymentStatus = (value) => {
  if (!value) return "PENDING";
  const upper = String(value).trim().toUpperCase();
  if (Object.keys(PAYMENT_STATUS_LABELS).includes(upper)) return upper;
  return paymentStatusAliases[String(value).trim().toLowerCase()] || upper || "PENDING";
};

// Receipts are only evidence of a completed ledger payment. This strict
// canonical-state check intentionally rejects unknown future states too.
export const isPaymentReceiptAvailable = (payment) => payment?.paymentStatus === "PAID";

export const paymentMethodLabel = (value, provider = "") => String(provider || "").toUpperCase() === "HOTEL_UPI"
  ? "Hotel UPI"
  : PAYMENT_METHOD_LABELS[normalizePaymentMethod(value)] || "Other";

export const gatewayLabel = (payment = {}) => {
  const method = normalizePaymentMethod(payment.paymentMethod);
  const gateway = String(payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "").trim();
  if (String(payment.provider || gateway).toUpperCase() === "HOTEL_UPI") return "Hotel UPI";
  if (method === "CASH" || gateway.toLowerCase() === "cash") return "—";
  if (!gateway) return "—";
  const lower = gateway.toLowerCase();
  if (lower === "razorpay") return "Razorpay";
  if (lower === "cashfree") return "Cashfree";
  if (lower === "stripe") return "Stripe";
  return gateway;
};

export const paymentStatusLabel = (value) => PAYMENT_STATUS_LABELS[normalizePaymentStatus(value)] || "Pending";

export const paymentStatusTone = (value) => {
  const status = normalizePaymentStatus(value);
  if (status === "PAID") return "success";
  if (status === "AWAITING_VERIFICATION") return "warning";
  if (status === "PROCESSING") return "processing";
  if (status === "PENDING") return "pending";
  if (status === "FAILED") return "failed";
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "refunded";
  return "pending";
};

export const paymentEventLabel = (value) => PAYMENT_EVENT_LABELS[String(value || "").toUpperCase()] || String(value || "");

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const receiptTableOrType = (order = {}, payment = {}) => {
  const tableNumber = order?.table?.tableNumber || payment?.tableNumber || payment?.metadata?.tableNumber;
  if (tableNumber) return `Table ${tableNumber}`;
  const orderType = String(order?.orderType || payment?.orderType || "").toUpperCase();
  if (orderType === "TAKEAWAY" || orderType === "PICKUP") return "PARCEL";
  if (orderType === "DELIVERY") return "DELIVERY";
  return "-";
};
const receiptLogoPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/public/restosphere-logo.png");

/** Presentation-only snapshot of stored values; it never changes settlement data. */
export const buildPaymentReceiptData = ({ payment = {}, order = {}, restaurant = {} } = {}) => {
  const serviceCharge = firstDefined(order?.serviceCharge, payment?.serviceCharge);
  return {
    restaurantName: restaurant?.name || "RestoSphere",
    orderNumber: order?.orderNumber || order?._id?.toString?.() || "-",
    paymentDate: formatDateTime(payment?.paidAt || payment?.createdAt),
    tableOrType: receiptTableOrType(order, payment),
    items: (Array.isArray(order?.items) ? order.items : []).map((item, index) => ({
      number: index + 1, name: item?.menuItem?.name || item?.name || "Item",
      quantity: Number(item?.quantity || 0), price: Number(item?.price || 0),
      total: Number(firstDefined(item?.subtotal, Number(item?.price || 0) * Number(item?.quantity || 0)) || 0),
    })),
    totals: {
      subtotal: Number(firstDefined(order?.subtotal, payment?.subtotal, 0) || 0),
      discount: Number(firstDefined(order?.discount, payment?.discount, 0) || 0),
      tax: Number(firstDefined(order?.tax, payment?.tax, 0) || 0),
      serviceCharge: serviceCharge === undefined ? null : Number(serviceCharge || 0),
      grandTotal: Number(firstDefined(payment?.totalAmount, payment?.amount, order?.total, 0) || 0),
      gstRate: Number(firstDefined(order?.gstRate, payment?.gstRate, 0) || 0),
    },
  };
};

export const buildReceiptBuffer = async ({ payment, order, restaurant }) => new Promise((resolve) => {
  const data = buildPaymentReceiptData({ payment, order, restaurant });
  const receiptWidth = 226.77; // 80 mm thermal roll
  const itemHeight = (item) => Math.max(16, Math.ceil(String(item.name).length / 24) * 10 + 6);
  const receiptHeight = Math.max(330, 272 + data.items.reduce((total, item) => total + itemHeight(item), 0));
  const doc = new PDFDocument({ margin: 11, size: [receiptWidth, receiptHeight], bufferPages: true });
  const chunks = [];
  const left = 11; const right = doc.page.width - 11; const width = right - left;
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  const row = (label, value, y, emphasized = false) => {
    if (emphasized) doc.roundedRect(left, y - 4, width, 23, 4).fill("#ecfdf5");
    doc.fillColor(emphasized ? "#166534" : "#475569").font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(emphasized ? 11 : 9).text(label, left + 4, y, { width: 105 });
    doc.text(formatCurrency(value), left + 112, y, { width: width - 116, align: "right" });
  };
  let y = 12;
  if (existsSync(receiptLogoPath)) { doc.image(receiptLogoPath, left + (width - 48) / 2, y, { fit: [48, 16] }); y += 20; }
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(12).text("RestoSphere", left, y, { width, align: "center" }); y += 14;
  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(8).text(String(data.restaurantName).toUpperCase(), left, y, { width, align: "center" }); y += 17;
  doc.roundedRect(left + 32, y, width - 64, 19, 4).fill("#ecfdf5");
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(9).text("✓  Payment Successful", left, y + 5, { width, align: "center" }); y += 29;
  [["Order No", data.orderNumber], ["Date & Time", data.paymentDate], ["Table / Type", data.tableOrType]].forEach(([label, value]) => {
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text(label, left, y, { width: 72 });
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(String(value || "-"), left + 76, y, { width: width - 76, align: "right", ellipsis: true });
    y += 14;
  });
  doc.moveTo(left, y + 2).lineTo(right, y + 2).lineWidth(0.5).strokeColor("#cbd5e1").stroke(); y += 10;
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8).text("ITEM", left, y, { width: 112 });
  doc.text("QTY", left + 114, y, { width: 25, align: "right" });
  doc.text("AMOUNT", left + 142, y, { width: width - 142, align: "right" }); y += 13;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#cbd5e1").stroke(); y += 5;
  if (!data.items.length) { doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("No item details were recorded for this payment.", left, y, { width }); y += 17; }
  data.items.forEach((item) => {
    const height = itemHeight(item); const rowY = y;
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(item.name, left, rowY, { width: 112 });
    doc.text(String(item.quantity), left + 114, rowY, { width: 25, align: "right" });
    doc.font("Helvetica-Bold").text(formatCurrency(item.total), left + 142, rowY, { width: width - 142, align: "right" });
    y += height; doc.moveTo(left, y - 2).lineTo(right, y - 2).lineWidth(0.35).strokeColor("#e2e8f0").stroke();
  });
  y += 7;
  row("Subtotal", data.totals.subtotal, y); y += 14;
  row("Discount", data.totals.discount, y); y += 14;
  row(`GST (${data.totals.gstRate}%)`, data.totals.tax, y); y += 14;
  row("Service Charge", data.totals.serviceCharge ?? 0, y); y += 19;
  row("GRAND TOTAL", data.totals.grandTotal, y, true);
  doc.end();
});
const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const buildPaymentCsv = (payments = []) => {
  const headers = ["Payment ID", "Order ID", "Customer", "Amount", "Payment Method", "Status", "Transaction ID", "Date", "Refund Amount"];
  const rows = payments.map((payment) => [
    formatPaymentId(payment.paymentId),
    payment.orderIdValue || payment.orderNumber || payment.orderId?.orderNumber || payment.orderId || "",
    payment.customerName || payment.customerId?.fullName || "Guest",
    Number(payment.totalAmount ?? payment.amount ?? 0),
    paymentMethodLabel(payment.paymentMethod, payment.provider),
    paymentStatusLabel(payment.paymentStatus),
    payment.transactionId || "",
    formatDateTime(payment.createdAt),
    Number(payment.refundAmount || 0),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
};
