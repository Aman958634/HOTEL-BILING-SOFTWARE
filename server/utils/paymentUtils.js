import PDFDocument from "pdfkit";

export const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

export const PAYMENT_STATUS_LABELS = {
  PENDING: "Pending",
  PROCESSING: "Processing",
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
  stripe: "OTHER",
  online: "OTHER",
  other: "OTHER",
};

const paymentStatusAliases = {
  pending: "PENDING",
  processing: "PROCESSING",
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

export const paymentMethodLabel = (value) => PAYMENT_METHOD_LABELS[normalizePaymentMethod(value)] || "Other";

export const gatewayLabel = (payment = {}) => {
  const method = normalizePaymentMethod(payment.paymentMethod);
  const gateway = String(payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "").trim();
  if (method === "CASH" || gateway.toLowerCase() === "cash") return "—";
  if (!gateway) return "—";
  const lower = gateway.toLowerCase();
  if (lower === "razorpay") return "Razorpay";
  if (lower === "stripe") return "Stripe";
  return gateway;
};

export const paymentStatusLabel = (value) => PAYMENT_STATUS_LABELS[normalizePaymentStatus(value)] || "Pending";

export const paymentStatusTone = (value) => {
  const status = normalizePaymentStatus(value);
  if (status === "PAID") return "success";
  if (status === "PROCESSING") return "processing";
  if (status === "PENDING") return "pending";
  if (status === "FAILED") return "failed";
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "refunded";
  return "pending";
};

export const paymentEventLabel = (value) => PAYMENT_EVENT_LABELS[String(value || "").toUpperCase()] || String(value || "");

export const buildReceiptBuffer = async ({ payment, order, restaurant }) =>
  new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const restaurantName = restaurant?.name || "RestoSphere";
    const restaurantAddress = restaurant?.address || "Restaurant Management System";
    const restaurantContact = [restaurant?.phone, restaurant?.email].filter(Boolean).join(" | ");

    doc.rect(0, 0, doc.page.width, 90).fill("#0f766e");
    doc.fillColor("white").fontSize(24).font("Helvetica-Bold").text(restaurantName, 40, 32);
    doc.fontSize(10).font("Helvetica").text(restaurantAddress, 40, 60);
    if (restaurantContact) doc.text(restaurantContact, 40, 74);

    doc.fillColor("#0f172a");
    doc.moveDown(4);

    doc.fontSize(18).font("Helvetica-Bold").text("Payment Receipt", { align: "center" });
    doc.moveDown(0.75);

    const leftCol = 40;
    const rightCol = 320;

    const drawKeyValue = (label, value, x, y) => {
      doc.fontSize(10).fillColor("#64748b").font("Helvetica").text(label, x, y);
      doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text(value || "-", x, y + 14);
    };

    drawKeyValue("Payment ID", payment.paymentId, leftCol, 140);
    drawKeyValue("Transaction ID", payment.transactionId || "-", rightCol, 140);
    drawKeyValue("Order ID", order?.orderNumber || order?._id?.toString?.() || "-", leftCol, 190);
    drawKeyValue("Payment Status", paymentStatusLabel(payment.paymentStatus), rightCol, 190);
    drawKeyValue("Customer", order?.customer?.fullName || "Guest", leftCol, 240);
    drawKeyValue("Phone", order?.customer?.phone || payment.metadata?.customerPhone || "-", rightCol, 240);
    drawKeyValue("Table", order?.table?.tableNumber || payment.metadata?.tableNumber || "-", leftCol, 290);
    drawKeyValue("Date & Time", formatDateTime(payment.createdAt), rightCol, 290);

    doc.moveTo(40, 335).lineTo(doc.page.width - 40, 335).strokeColor("#cbd5e1").stroke();
    doc.moveDown(2.2);

    doc.fontSize(12).font("Helvetica-Bold").text("Items");
    doc.moveDown(0.5);

    const items = order?.items || [];
    if (items.length === 0) {
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("No items found.");
    } else {
      items.forEach((item) => {
        const name = item.menuItem?.name || item.name || "Item";
        doc.fontSize(10).fillColor("#0f172a").font("Helvetica").text(`${name} x${item.quantity}`, { continued: true });
        doc.text(formatCurrency(item.subtotal ?? item.price * item.quantity), { align: "right" });
      });
    }

    doc.moveDown(1);
    const totals = [
      ["Subtotal", payment.subtotal],
      ["Discount", payment.discount],
      ["Tax / GST", payment.tax],
      ["Service Charge", payment.serviceCharge],
      ["Grand Total", payment.totalAmount],
      ["Refund Amount", payment.refundAmount],
    ];

    totals.forEach(([label, amount], index) => {
      const isGrand = index === totals.length - 2;
      doc.fontSize(isGrand ? 11 : 10).font(isGrand ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, 360, doc.y, { continued: true });
      doc.text(formatCurrency(amount), { align: "right" });
    });

    doc.moveDown(1);
    doc.fontSize(10).fillColor("#334155").text(`Payment Method: ${paymentMethodLabel(payment.paymentMethod)}`);
    doc.text(`Refund Status: ${payment.refundStatus || "-"}`);
    doc.text(`Timeline: ${(payment.timeline || []).map((entry) => `${paymentEventLabel(entry.status)} @ ${formatDateTime(entry.timestamp)}`).join(" | ") || "-"}`);

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
    payment.paymentId,
    payment.orderIdValue || payment.orderNumber || payment.orderId?.orderNumber || payment.orderId || "",
    payment.customerName || payment.customerId?.fullName || "Guest",
    Number(payment.totalAmount ?? payment.amount ?? 0),
    paymentMethodLabel(payment.paymentMethod),
    paymentStatusLabel(payment.paymentStatus),
    payment.transactionId || "",
    formatDateTime(payment.createdAt),
    Number(payment.refundAmount || 0),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
};
