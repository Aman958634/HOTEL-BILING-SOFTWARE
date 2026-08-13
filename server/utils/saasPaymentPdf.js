import PDFDocument from "pdfkit";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || "INR"} ${Number(amount) || 0}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(d.getHours() || d.getMinutes() ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const safeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value);
};

const drawKeyValue = (doc, label, value, y, left = 40, right = 310) => {
  doc.fontSize(10).fillColor("#64748b").font("Helvetica").text(label, left, y);
  doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text(safeString(value) || "—", right, y, {
    width: doc.page.width - right - 40,
    align: "left",
  });
};

const drawSectionTitle = (doc, title, y) => {
  doc.fontSize(12).fillColor("#0f172a").font("Helvetica-Bold").text(title, 40, y);
  doc.moveTo(40, y + 18).lineTo(doc.page.width - 40, y + 18).strokeColor("#e2e8f0").stroke();
};

/** Build a SaaS payment receipt PDF buffer from safe payment + optional subscription data. */
export const buildSaasPaymentReceiptBuffer = async (payment, subscription = null) =>
  new Promise((resolve, reject) => {
    if (!payment) {
      reject(new Error("Payment data is required"));
      return;
    }

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const receiptNo = payment.razorpayPaymentId || payment.paymentId || String(payment.id || payment._id || "—");
    const paymentDate = formatDateTime(payment.paymentDate || payment.paidAt);
    const subscriptionStart =
      formatDateTime(subscription?.subscriptionStartAt || subscription?.trialStartDate || subscription?.startDate) ||
      formatDateTime(subscription?.trialStartAt) ||
      null;
    const renewalDate = formatDateTime(subscription?.renewalDate || subscription?.trialEndDate);

    // Header band
    doc.rect(0, 0, doc.page.width, 90).fill("#0f766e");
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("RestoSphere", 40, 28);
    doc.fontSize(10).font("Helvetica").text("SaaS Restaurant Management Platform", 40, 54);

    doc.fillColor("#0f172a");
    doc.fontSize(20).font("Helvetica-Bold").text("Payment Receipt", 40, 110, { align: "center" });
    doc.fontSize(10).fillColor("#64748b").font("Helvetica").text(`Receipt No: ${receiptNo}`, { align: "center" });
    doc.moveDown(1);

    let y = 155;
    drawSectionTitle(doc, "Payment Information", y);
    y += 32;

    // Required fields always show; optional fields are omitted when missing.
    // We'll use a local row helper to control the cursor (y) as we add rows.
    const row = (label, value, opts = {}) => {
      const { required = false } = opts;
      const val = value === undefined || value === null || value === "" ? "" : value;
      if (!required && !val) return;
      drawKeyValue(doc, label, val || "—", y);
      y += 24;
    };

    // Payment rows
    row("Payment ID", payment.paymentId || payment.razorpayPaymentId, { required: true });
    row("Order ID", payment.razorpayOrderId || payment.orderId || "", { required: false });
    row("Customer", payment.customerName || payment.customer?.name || "", { required: false });
    row("Email", payment.customer?.email || "", { required: false });
    row("Restaurant/Hotel", payment.restaurantName || "", { required: false });
    row("Plan", payment.plan || "", { required: true });
    row("Amount", payment.amount !== undefined ? formatMoney(payment.amount, payment.currency) : "", { required: true });
    row("Currency", payment.currency || "INR", { required: true });
    row("Payment Method", payment.paymentMethod || payment.paymentMethodRaw || payment.gateway || "", { required: false });
    row("Payment Status", payment.status || "", { required: true });
    row("Payment Date", paymentDate || "", { required: true });

    // Transaction/order details (best effort, omit if missing)
    row("Transaction Details", payment.transactionId || payment.metadata?.transactionId || "", { required: false });

    // Subscription info section
    y += 10;
    drawSectionTitle(doc, "Subscription Information", y);
    y += 32;
    row("Plan", subscription?.planName || payment.plan || "", { required: true });
    row("Subscription Start", subscriptionStart || "", { required: false });
    row("Renewal Date", renewalDate || "", { required: false });

    // Footer
    doc.moveTo(40, y + 22).lineTo(doc.page.width - 40, y + 22).strokeColor("#e2e8f0").stroke();
    doc.fontSize(10).fillColor("#475569").font("Helvetica").text("Thank you for using RestoSphere.", 40, y + 34, {
      align: "center",
      width: doc.page.width - 80,
    });

    doc.fontSize(9).fillColor("#94a3b8").font("Helvetica").text("This is a computer-generated receipt.", 40, doc.page.height - 50, {
      align: "center",
      width: doc.page.width - 80,
    });

    doc.end();
  });

export default { buildSaasPaymentReceiptBuffer };
