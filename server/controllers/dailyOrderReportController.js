import PDFDocument from "pdfkit";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { resolveBusinessRange } from "../services/businessIntelligenceService.js";

const SUCCESS_PAYMENT_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
const CANCELLED_STATUSES = new Set(["CANCELLED", "REJECTED"]);
const asMoney = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));
const orderKey = (value) => String(value?._id || value || "");
const paymentNet = (payment) => asMoney((payment.amount ?? payment.totalAmount ?? 0) - (payment.refundAmount || 0));

const formatMoney = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(asMoney(value));
const formatInZone = (value, timeZone, options) => new Intl.DateTimeFormat("en-IN", { timeZone, ...options }).format(new Date(value));

export const summarizeDailyOrders = (orders = [], collectedByOrder = new Map()) => {
  const summary = { totalOrders: orders.length, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, paidOrders: 0, unpaidOrders: 0, totalSales: 0, outstandingPaymentAmount: 0 };
  const rows = orders.map((order) => {
    const total = asMoney(order.total);
    const status = String(order.status || "PENDING").toUpperCase();
    const cancelled = CANCELLED_STATUSES.has(status);
    const collected = cancelled ? 0 : asMoney(Math.min(total, collectedByOrder.get(orderKey(order)) || 0));
    const outstanding = cancelled ? 0 : asMoney(total - collected);
    const paid = !cancelled && total > 0 && outstanding < 0.01;
    if (cancelled) summary.cancelledOrders += 1;
    else {
      if (["COMPLETED", "SERVED"].includes(status)) summary.completedOrders += 1;
      if (status === "PENDING") summary.pendingOrders += 1;
      if (paid) summary.paidOrders += 1;
      else summary.unpaidOrders += 1;
      summary.totalSales = asMoney(summary.totalSales + collected);
      summary.outstandingPaymentAmount = asMoney(summary.outstandingPaymentAmount + outstanding);
    }
    return {
      ...order,
      finalAmount: total,
      collectedAmount: collected,
      outstandingAmount: outstanding,
      reportPaymentStatus: cancelled ? "CANCELLED" : paid ? "PAID" : collected > 0 ? "PARTIALLY_PAID" : "UNPAID",
    };
  });
  return { summary, rows };
};

const resolveDailyRange = async (date, user) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new ApiError(422, "date must use YYYY-MM-DD");
  const restaurant = user?.restaurant ? await Restaurant.findById(user.restaurant).select("name timeZone").lean() : null;
  const timeZone = restaurant?.timeZone || "Asia/Kolkata";
  return { restaurant, range: resolveBusinessRange({ range: "custom", startDate: date, endDate: date, timeZone }) };
};

export const buildDailyOrderReport = async ({ date, user }) => {
  const [{ restaurant, range }, scope] = await Promise.all([resolveDailyRange(date, user), buildOutletQuery({}, user)]);
  const orders = await Order.find({ ...scope, isArchived: { $ne: true }, createdAt: { $gte: range.start, $lt: range.end } })
    .select("orderNumber createdAt table orderType status discount total billingBill")
    .populate("table", "tableNumber")
    .sort({ createdAt: 1 })
    .lean();
  const orderIds = orders.map((order) => order._id);
  const billIds = [...new Set(orders.map((order) => order.billingBill).filter(Boolean).map(String))];
  const [directPayments, bills, billPayments] = await Promise.all([
    orderIds.length ? Payment.find({ ...scope, orderId: { $in: orderIds }, paymentStatus: { $in: SUCCESS_PAYMENT_STATUSES } }).select("orderId amount totalAmount refundAmount").lean() : [],
    billIds.length ? Bill.find({ _id: { $in: billIds } }).select("_id total allocations").lean() : [],
    billIds.length ? Payment.find({ ...scope, bill: { $in: billIds }, paymentStatus: { $in: SUCCESS_PAYMENT_STATUSES } }).select("bill amount totalAmount refundAmount").lean() : [],
  ]);
  const collectedByOrder = new Map();
  const add = (id, amount) => collectedByOrder.set(String(id), asMoney((collectedByOrder.get(String(id)) || 0) + amount));
  directPayments.forEach((payment) => add(payment.orderId, paymentNet(payment)));
  const paidByBill = billPayments.reduce((map, payment) => {
    const key = String(payment.bill);
    map.set(key, asMoney((map.get(key) || 0) + paymentNet(payment)));
    return map;
  }, new Map());
  bills.forEach((bill) => {
    const billNet = paidByBill.get(String(bill._id)) || 0;
    const allocations = bill.allocations || [];
    const allocationTotal = allocations.reduce((sum, allocation) => sum + asMoney(allocation.total), 0) || asMoney(bill.total);
    allocations.forEach((allocation) => add(allocation.order, allocationTotal ? billNet * asMoney(allocation.total) / allocationTotal : 0));
  });
  return { hotelName: restaurant?.name || "Hotel", timeZone: range.timeZone, date, ...summarizeDailyOrders(orders, collectedByOrder) };
};

export const buildDailyOrderReportPdf = (payload) => new Promise((resolve) => {
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  const chunks = [];
  let page = 0;
  const header = () => {
    page += 1;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(17).text(payload.hotelName, 32, 28);
    doc.fontSize(12).text("Daily Order Report", 32, 50);
    doc.font("Helvetica").fontSize(9).fillColor("#475569").text(`${formatInZone(payload.date, payload.timeZone, { day: "2-digit", month: "long", year: "numeric" })} ? ${payload.timeZone}`, 32, 67);
    doc.moveTo(32, 84).lineTo(564, 84).strokeColor("#0f172a").stroke();
    doc.fillColor("#64748b").fontSize(8).text(`Page ${page}`, 520, 812);
  };
  const ensureSpace = (height) => { if (doc.y + height > 800) { doc.addPage(); header(); } };
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  header();
  const cards = [["Total Orders", payload.summary.totalOrders], ["Completed", payload.summary.completedOrders], ["Pending", payload.summary.pendingOrders], ["Cancelled", payload.summary.cancelledOrders], ["Paid", payload.summary.paidOrders], ["Unpaid", payload.summary.unpaidOrders], ["Paid Sales", formatMoney(payload.summary.totalSales)], ["Outstanding", formatMoney(payload.summary.outstandingPaymentAmount)]];
  cards.forEach(([label, value], index) => {
    const x = 32 + (index % 2) * 265; const y = 100 + Math.floor(index / 2) * 43;
    doc.roundedRect(x, y, 250, 34, 4).fillAndStroke("#f8fafc", "#cbd5e1");
    doc.fillColor("#475569").font("Helvetica").fontSize(8).text(label, x + 9, y + 7);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(String(value), x + 9, y + 18);
  });
  doc.y = 286;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Order Details");
  const columns = [["Order", 32, 56], ["Time", 89, 48], ["Table / Type", 138, 70], ["Payment", 209, 61], ["Status", 271, 55], ["Discount", 327, 58], ["Final", 386, 65], ["Paid", 452, 65], ["Due", 518, 46]];
  const tableHeader = () => {
    ensureSpace(28); const y = doc.y + 5;
    doc.rect(32, y, 532, 18).fill("#e2e8f0");
    columns.forEach(([label, x, width]) => doc.fillColor("#334155").font("Helvetica-Bold").fontSize(6.5).text(label, x + 2, y + 6, { width: width - 3, ellipsis: true }));
    doc.y = y + 23;
  };
  tableHeader();
  if (!payload.rows.length) doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("No orders were received for this day.", 32, doc.y + 14);
  payload.rows.forEach((row) => {
    ensureSpace(27); if (doc.y < 105) tableHeader();
    const y = doc.y;
    const table = row.table?.tableNumber ? `Table ${row.table.tableNumber}` : String(row.orderType || "-").replaceAll("_", " ");
    const values = [row.orderNumber, formatInZone(row.createdAt, payload.timeZone, { hour: "2-digit", minute: "2-digit", hour12: true }), table, row.reportPaymentStatus, row.status, formatMoney(row.discount), formatMoney(row.finalAmount), formatMoney(row.collectedAmount), formatMoney(row.outstandingAmount)];
    columns.forEach(([, x, width], index) => doc.fillColor("#0f172a").font("Helvetica").fontSize(6.5).text(String(values[index] || "-"), x + 2, y + 3, { width: width - 3, height: 19, ellipsis: true }));
    doc.moveTo(32, y + 23).lineTo(564, y + 23).strokeColor("#e2e8f0").stroke(); doc.y = y + 24;
  });
  doc.end();
});

export const downloadDailyOrderReport = asyncHandler(async (req, res) => {
  const payload = await buildDailyOrderReport({ date: req.query.date, user: req.user });
  const buffer = await buildDailyOrderReportPdf(payload);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=daily-order-report-${payload.date}.pdf`);
  res.status(200).send(buffer);
});
