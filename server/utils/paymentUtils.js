import PDFDocument from "pdfkit";
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
const receiptNumber = (payment) => payment?.paymentId ? formatPaymentId(payment.paymentId) : "-";

/** Presentation-only snapshot of stored values; it never changes settlement data. */
export const buildPaymentReceiptData = ({ payment = {}, order = {}, restaurant = {} } = {}) => {
  const serviceCharge = firstDefined(order?.serviceCharge, payment?.serviceCharge);
  return {
    restaurantName: restaurant?.name || "RestoSphere",
    receiptNumber: receiptNumber(payment),
    orderNumber: order?.orderNumber || order?._id?.toString?.() || "-",
    paymentDate: formatDateTime(payment?.paidAt || payment?.createdAt),
    customerName: order?.customer?.fullName || payment?.customerName || payment?.metadata?.customerName || "Guest",
    customerPhone: order?.customer?.phone || payment?.customerPhone || payment?.metadata?.customerPhone || "-",
    tableNumber: order?.table?.tableNumber || payment?.tableNumber || payment?.metadata?.tableNumber || "-",
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
    },
    paymentMethod: paymentMethodLabel(payment?.paymentMethod, payment?.provider),
    paymentId: receiptNumber(payment),
    transactionReference: payment?.transactionId || payment?.razorpayPaymentId || payment?.cashfreePaymentId || "-",
    status: "SUCCESS",
  };
};

export const buildReceiptBuffer = async ({ payment, order, restaurant }) => new Promise((resolve) => {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  const chunks = [];
  const data = buildPaymentReceiptData({ payment, order, restaurant });
  const left = 40; const right = doc.page.width - 40; const width = right - left;
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));

  const spaceFor = (height, includeItemHeader = false) => {
    if (doc.y + height <= doc.page.height - 70) return;
    doc.addPage(); doc.y = 45;
    if (includeItemHeader) itemsHeader();
  };
  const field = (label, value, x, y, fieldWidth) => {
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text(label.toUpperCase(), x, y, { width: fieldWidth });
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(String(value || "-"), x, y + 12, { width: fieldWidth, ellipsis: true });
  };
  const itemsHeader = () => {
    const y = doc.y;
    doc.roundedRect(left, y, width, 23, 4).fill("#f1f5f9");
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8);
    [["#", 48, 24], ["ITEM", 76, 255], ["QTY", 337, 40], ["PRICE", 385, 76], ["TOTAL", 468, 83]]
      .forEach(([text, x, columnWidth]) => doc.text(text, x, y + 8, { width: columnWidth, align: x > 80 ? "right" : "left" }));
    doc.y = y + 31;
  };

  const center = doc.page.width / 2;
  doc.circle(center, 66, 18).fill("#16a34a");
  doc.moveTo(center - 8, 66).lineTo(center - 2, 72).lineTo(center + 9, 59).lineWidth(2.5).strokeColor("#fff").stroke();
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(20).text("Payment Successful!", left, 96, { width, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("Thank you! Your payment has been completed.", left, 122, { width, align: "center" });
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(22).text("RestoSphere", left, 158, { width, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("Restaurant Management System", left, 184, { width, align: "center" });
  doc.moveTo(left, 208).lineTo(right, 208).lineWidth(1).strokeColor("#d1d5db").stroke();
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(15).text("PAYMENT RECEIPT", left, 220, { width, align: "center", characterSpacing: 1.4 });

  const infoY = 255;
  field("Receipt No.", data.receiptNumber, left, infoY, 246);
  field("Order No.", data.orderNumber, left, infoY + 38, 246);
  field("Payment Date", data.paymentDate, left, infoY + 76, 246);
  field("Restaurant", data.restaurantName, 306, infoY, 246);
  field("Customer", data.customerName, 306, infoY + 38, 246);
  field("Phone / Table", data.customerPhone + " / " + data.tableNumber, 306, infoY + 76, 246);
  doc.y = infoY + 122;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor("#e2e8f0").stroke();
  doc.y += 16; itemsHeader();

  if (!data.items.length) {
    doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("No item details were recorded for this payment.", left, doc.y + 4, { width });
    doc.y += 26;
  } else data.items.forEach((item) => {
    const rowHeight = Math.max(28, doc.heightOfString(item.name, { width: 255, font: "Helvetica" }) + 12);
    spaceFor(rowHeight + 5, true);
    const y = doc.y;
    doc.fillColor("#64748b").font("Helvetica").fontSize(9).text(String(item.number), 48, y, { width: 24 });
    doc.fillColor("#0f172a").font("Helvetica").text(item.name, 76, y, { width: 255 });
    doc.text(String(item.quantity), 337, y, { width: 40, align: "right" });
    doc.text(formatCurrency(item.price), 385, y, { width: 76, align: "right" });
    doc.font("Helvetica-Bold").text(formatCurrency(item.total), 468, y, { width: 83, align: "right" });
    doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    doc.y = y + rowHeight + 5;
  });

  spaceFor(150);
  const total = (label, amount, emphasis = false, negative = false) => {
    const y = doc.y;
    if (emphasis) doc.roundedRect(345, y - 5, 207, 26, 4).fill("#ecfdf5");
    doc.fillColor(emphasis ? "#166534" : "#475569").font(emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(emphasis ? 11 : 9).text(label, 353, y, { width: 110 });
    doc.text((negative ? "-" : "") + formatCurrency(amount), 463, y, { width: 80, align: "right" });
    doc.y = y + (emphasis ? 31 : 18);
  };
  total("Subtotal", data.totals.subtotal);
  total("Discount", data.totals.discount, false, data.totals.discount > 0);
  total("Tax / GST", data.totals.tax);
  if (data.totals.serviceCharge !== null) total("Service Charge", data.totals.serviceCharge);
  total("Grand Total", data.totals.grandTotal, true);

  spaceFor(130);
  doc.moveTo(left, doc.y + 5).lineTo(right, doc.y + 5).lineWidth(1).strokeColor("#e2e8f0").stroke(); doc.y += 17;
  [["Payment Method", data.paymentMethod], ["Payment ID", data.paymentId], ["Transaction / Reference", data.transactionReference], ["Status", data.status]]
    .forEach(([label, value]) => {
      const y = doc.y;
      doc.fillColor("#64748b").font("Helvetica").fontSize(9).text(label, left, y, { width: 170 });
      doc.fillColor(label === "Status" ? "#15803d" : "#0f172a").font("Helvetica-Bold").text(value, 215, y, { width: 337, align: "right", ellipsis: true });
      doc.y = y + 18;
    });
  doc.moveTo(left, doc.y + 5).lineTo(right, doc.y + 5).lineWidth(1).strokeColor("#e2e8f0").stroke();
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(10).text("Thank you for choosing RestoSphere!", left, doc.y + 18, { width, align: "center" });
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(8).text("This is a computer-generated receipt.", left, doc.y + 34, { width, align: "center" });
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
