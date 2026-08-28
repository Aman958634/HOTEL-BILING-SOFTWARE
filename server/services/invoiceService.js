import PDFDocument from "pdfkit";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";

const GST_RATE = 0.18;
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getInvoiceNumber = async () => {
  const sequence = await Sequence.findOneAndUpdate(
    { key: "invoiceNumber" },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `INV-${String(sequence.value).padStart(6, "0")}`;
};

const normalizeState = (value) => String(value || "").trim().toLowerCase();

const getGstType = (restaurant, order) => {
  const restaurantState = normalizeState(restaurant?.state);
  const customerState = normalizeState(order?.billingState || order?.customer?.state);
  return restaurantState && customerState && restaurantState !== customerState ? "IGST" : "CGST_SGST";
};

const buildInvoiceSnapshot = async (order) => {
  const restaurantId = order.restaurant?._id || order.restaurant || null;
  const restaurant = restaurantId ? await Restaurant.findById(restaurantId).select("state").lean() : null;
  const items = (order.items || []).map((item) => ({
    name: item.name || item.menuItem?.name || "Item",
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    subtotal: round2(Number(item.price || 0) * Number(item.quantity || 0)),
  }));
  const subtotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  const gstType = getGstType(restaurant, order);
  const totalTax = round2(subtotal * GST_RATE);
  const cgst = gstType === "CGST_SGST" ? round2(totalTax / 2) : 0;
  const sgst = gstType === "CGST_SGST" ? round2(totalTax - cgst) : 0;
  const igst = gstType === "IGST" ? totalTax : 0;
  const total = round2(subtotal + totalTax);
  const payments = await Payment.find({ orderId: order._id, paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } })
    .sort({ paidAt: 1, createdAt: 1 })
    .lean();
  const paymentBreakdown = payments.map((payment) => ({
    paymentId: payment.paymentId,
    paymentMethod: payment.paymentMethod,
    amount: Number(payment.amount || payment.totalAmount || 0),
    refundedAmount: Number(payment.refundAmount || 0),
    paidAt: payment.paidAt || null,
  }));
  const totalPaid = round2(paymentBreakdown.reduce((sum, payment) => sum + payment.amount, 0));
  const refundTotal = round2(paymentBreakdown.reduce((sum, payment) => sum + payment.refundedAmount, 0));
  const netTotal = round2(Math.max(total - refundTotal, 0));
  const netTax = total > 0 ? round2(totalTax * (netTotal / total)) : 0;
  const status = refundTotal >= total ? "REFUNDED" : refundTotal > 0 ? "PARTIALLY_REFUNDED" : "FINAL";
  return { restaurant: restaurantId, items, gstType, subtotal, cgst, sgst, igst, totalTax, total, totalPaid, refundTotal, netTotal, netTax, paymentBreakdown, status };
};

/** Create one immutable-number invoice only after the order is fully paid. */
export const generateInvoice = async (order) => {
  if (!order?._id) throw new ApiError(422, "Order is required for invoice generation");
  if (String(order.status || "").toUpperCase() === "CANCELLED" || String(order.paymentStatus || "").toUpperCase() !== "PAID") {
    return null;
  }
  const snapshot = await buildInvoiceSnapshot(order);
  if (snapshot.totalPaid + 0.01 < snapshot.total) return null;

  const existing = await Invoice.findOne({ order: order._id });
  if (existing) {
    Object.assign(existing, snapshot);
    await existing.save();
    return existing;
  }
  return Invoice.create({ invoiceNumber: await getInvoiceNumber(), order: order._id, issuedAt: new Date(), ...snapshot });
};

/** Keep payment breakdown/refund-adjusted report totals synchronized post-issue. */
export const refreshInvoice = async (order) => {
  if (!order?._id) return null;
  const invoice = await Invoice.findOne({ order: order._id });
  if (!invoice) return null;
  const snapshot = await buildInvoiceSnapshot(order);
  Object.assign(invoice, snapshot);
  if (String(order.status || "").toUpperCase() === "CANCELLED") invoice.status = "VOID";
  await invoice.save();
  return invoice;
};

export const buildInvoiceBuffer = (invoice) =>
  new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(20).text("Tax Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(11).text(`Invoice: ${invoice.invoiceNumber}`);
    doc.text(`Date: ${new Date(invoice.issuedAt).toLocaleDateString("en-IN")}`);
    doc.text(`Order: ${invoice.order?.orderNumber || invoice.orderNumber || "-"}`);
    doc.moveDown();
    (invoice.items || []).forEach((item) => doc.text(`${item.name} x${item.quantity}  ₹${item.subtotal.toFixed(2)}`));
    doc.moveDown();
    doc.text(`Subtotal: ₹${Number(invoice.subtotal || 0).toFixed(2)}`, { align: "right" });
    if (invoice.gstType === "IGST") doc.text(`IGST (18%): ₹${Number(invoice.igst || 0).toFixed(2)}`, { align: "right" });
    else {
      doc.text(`CGST (9%): ₹${Number(invoice.cgst || 0).toFixed(2)}`, { align: "right" });
      doc.text(`SGST (9%): ₹${Number(invoice.sgst || 0).toFixed(2)}`, { align: "right" });
    }
    doc.fontSize(12).text(`Total: ₹${Number(invoice.total || 0).toFixed(2)}`, { align: "right" });
    doc.moveDown();
    doc.fontSize(11).text("Payment breakdown");
    (invoice.paymentBreakdown || []).forEach((payment) => doc.text(`${payment.paymentMethod}: ₹${Number(payment.amount).toFixed(2)}${payment.refundedAmount ? ` (Refunded ₹${Number(payment.refundedAmount).toFixed(2)})` : ""}`));
    doc.end();
  });
