import PDFDocument from "pdfkit";
import { getSaasReceiptNumber } from "./saasPaymentReceipt.js";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(amount || 0));
  } catch {
    return (currency || "INR") + " " + Number(amount || 0);
  }
};

const formatDateTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
};

const formatDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

const defined = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

/**
 * Creates a display model only from persisted payment/subscription records.
 * Subscription tax/discount are omitted unless those amounts are actually
 * present on the stored payment record; no financial value is inferred.
 */
export const buildSaasPaymentReceiptData = (payment = {}, subscription = null) => {
  const amount = Number(payment.amount || 0);
  const tax = defined(payment.tax, payment.metadata?.tax);
  const discount = defined(payment.discount, payment.metadata?.discount);

  return {
    receiptNumber: getSaasReceiptNumber(payment) || "-",
    verifiedAt: payment.paidAt || payment.paymentDate || "-",
    provider: String(payment.provider || payment.gateway || "").toUpperCase() === "RAZORPAY" || String(payment.gateway || "").toLowerCase() === "razorpay"
      ? "Razorpay"
      : payment.paymentMethod || payment.gateway || "-",
    paymentMethod: payment.paymentMethod || (String(payment.gateway || "").toLowerCase() === "razorpay" ? "Razorpay" : payment.gateway || "-"),
    customerName: payment.customerName || payment.customer?.name || "Guest",
    customerEmail: payment.customer?.email || "-",
    restaurantName: payment.restaurantName || payment.restaurant?.name || "-",
    planName: payment.plan || payment.planName || subscription?.planName || "-",
    durationLabel: payment.durationLabel || subscription?.durationLabel || "",
    subscriptionStart: subscription?.subscriptionStartAt || subscription?.startDate || null,
    subscriptionEnd: subscription?.subscriptionEndAt || subscription?.renewalDate || null,
    amount,
    currency: payment.currency || "INR",
    tax: tax === undefined ? null : Number(tax || 0),
    discount: discount === undefined ? null : Number(discount || 0),
    paymentId: payment.paymentId || payment.gatewayPaymentId || payment.razorpayPaymentId || payment.providerPaymentId || "-",
    orderId: payment.orderId || payment.gatewayOrderId || payment.razorpayOrderId || payment.providerOrderId || "-",
    // PDF callers guard canonical paid status before building this view.
    status: "SUCCESS",
  };
};

/** Build the separate SaaS subscription-payment receipt PDF. */
export const buildSaasPaymentReceiptBuffer = async (payment, subscription = null) => new Promise((resolve, reject) => {
  if (!payment) {
    reject(new Error("Payment data is required"));
    return;
  }

  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  const chunks = [];
  const data = buildSaasPaymentReceiptData(payment, subscription);
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const row = (label, value, y, rowWidth = width) => {
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text(label.toUpperCase(), left, y, { width: 160 });
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(String(value || "-"), left + 165, y, { width: rowWidth - 165, align: "right", ellipsis: true });
  };

  const center = doc.page.width / 2;
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(22).text("RestoSphere", left, 34, { width, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("SaaS Restaurant Management Platform", left, 60, { width, align: "center" });
  doc.circle(center, 104, 18).fill("#16a34a");
  doc.moveTo(center - 8, 104).lineTo(center - 2, 110).lineTo(center + 9, 97).lineWidth(2.5).strokeColor("#ffffff").stroke();
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(20).text("Payment Successful!", left, 134, { width, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("Thank you! Your payment has been completed.", left, 160, { width, align: "center" });
  doc.text("Your RestoSphere subscription is now active.", left, 175, { width, align: "center" });
  doc.moveTo(left, 202).lineTo(right, 202).lineWidth(1).strokeColor("#d1d5db").stroke();
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(15).text("PAYMENT RECEIPT", left, 215, { width, align: "center", characterSpacing: 1.2 });

  let y = 252;
  row("Receipt No.", data.receiptNumber, y); y += 22;
  row("Date & Time", formatDateTime(data.verifiedAt), y); y += 22;
  row("Payment Method", data.paymentMethod, y); y += 22;
  if (data.provider !== data.paymentMethod) { row("Provider", data.provider, y); y += 22; }

  doc.moveTo(left, y + 4).lineTo(right, y + 4).lineWidth(1).strokeColor("#e2e8f0").stroke();
  y += 20;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Customer & Restaurant Details", left, y);
  y += 24;
  row("Customer", data.customerName, y); y += 22;
  row("Email", data.customerEmail, y); y += 22;
  row("Restaurant / Hotel", data.restaurantName, y); y += 22;
  row("Plan", data.planName, y); y += 22;
  if (data.durationLabel) { row("Billing Period", data.durationLabel, y); y += 22; }

  doc.moveTo(left, y + 4).lineTo(right, y + 4).lineWidth(1).strokeColor("#e2e8f0").stroke();
  y += 20;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Subscription", left, y);
  y += 24;
  doc.roundedRect(left, y, width, 24, 4).fill("#f1f5f9");
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8).text("#", left + 8, y + 8, { width: 24 });
  doc.text("DESCRIPTION", left + 36, y + 8, { width: 330 });
  doc.text("AMOUNT", right - 105, y + 8, { width: 97, align: "right" });
  y += 31;
  const description = "RestoSphere Subscription\nPlan: " + data.planName + (data.subscriptionStart !== null ? "\nValid From: " + formatDate(data.subscriptionStart) : "") + (data.subscriptionEnd !== null ? "\nValid Until: " + formatDate(data.subscriptionEnd) : "");
  const descriptionHeight = doc.heightOfString(description, { width: 330 });
  doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("1", left + 8, y, { width: 24 });
  doc.fillColor("#0f172a").font("Helvetica").text(description, left + 36, y, { width: 330 });
  doc.font("Helvetica-Bold").text(formatMoney(data.amount, data.currency), right - 105, y, { width: 97, align: "right" });
  y += Math.max(42, descriptionHeight + 12);

  const totals = [["Subtotal", data.amount]];
  if (data.discount !== null) totals.push(["Discount", data.discount]);
  if (data.tax !== null) totals.push(["Tax (GST)", data.tax]);
  totals.push(["Total Paid", data.amount]);
  totals.forEach(([label, amount], index) => {
    const emphasized = index === totals.length - 1;
    if (emphasized) doc.roundedRect(right - 210, y - 5, 210, 26, 4).fill("#ecfdf5");
    doc.fillColor(emphasized ? "#166534" : "#475569").font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(emphasized ? 11 : 9).text(label, right - 202, y, { width: 110 });
    doc.text(formatMoney(amount, data.currency), right - 94, y, { width: 86, align: "right" });
    y += emphasized ? 31 : 18;
  });

  doc.moveTo(left, y + 4).lineTo(right, y + 4).lineWidth(1).strokeColor("#e2e8f0").stroke();
  y += 20;
  row("Payment ID", data.paymentId, y); y += 22;
  row("Order ID", data.orderId, y); y += 22;
  row("Currency", data.currency, y); y += 22;
  row("Payment Status", data.status, y);

  doc.moveTo(left, y + 28).lineTo(right, y + 28).lineWidth(1).strokeColor("#e2e8f0").stroke();
  doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(10).text("Thank you for choosing RestoSphere!", left, y + 40, { width, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("For any support, please contact us.", left, y + 56, { width, align: "center" });
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(8).text("This is a computer-generated receipt.", left, doc.page.height - 45, { width, align: "center" });
  doc.end();
});

export default { buildSaasPaymentReceiptBuffer, buildSaasPaymentReceiptData };