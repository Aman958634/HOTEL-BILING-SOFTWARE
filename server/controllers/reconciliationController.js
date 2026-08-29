import Bill from "../models/Bill.js";
import CashReconciliation from "../models/CashReconciliation.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery as buildRestaurantQuery } from "../utils/tenantUtils.js";
import {
  deriveBillReconciliation,
  previewCashReconciliation,
  reconcileBillPayment,
  reconcileCash,
} from "../services/reconciliationService.js";

const paginate = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const singleRestaurant = async (user) => {
  const filter = await buildRestaurantQuery({}, user);
  if (!filter.restaurant || Array.isArray(filter.restaurant?.$in)) {
    throw new ApiError(403, "A single restaurant context is required for cash reconciliation");
  }
  return filter.restaurant;
};

const dateFilter = (filter, query) => {
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
};

export const getReconciliationSummary = asyncHandler(async (req, res) => {
  const [billFilter, paymentFilter, refundFilter] = await Promise.all([
    buildRestaurantQuery({ status: { $nin: ["CANCELLED"] } }, req.user),
    buildRestaurantQuery({}, req.user),
    buildRestaurantQuery({}, req.user),
  ]);
  const [billTotals, paymentTotals, statusRows, refundTotals] = await Promise.all([
    Bill.aggregate([{ $match: billFilter }, { $group: { _id: null, expected: { $sum: "$total" }, bills: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: paymentFilter }, { $match: { paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } } }, { $group: { _id: null, received: { $sum: "$amount" }, refunded: { $sum: "$refundAmount" }, successfulPayments: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: paymentFilter }, { $group: { _id: "$reconciliationStatus", count: { $sum: 1 } } }]),
    Refund.aggregate([{ $match: { ...refundFilter, status: "PENDING" } }, { $group: { _id: null, pending: { $sum: 1 } } }]),
  ]);
  const expected = Number(billTotals[0]?.expected || 0);
  const received = Number(paymentTotals[0]?.received || 0) - Number(paymentTotals[0]?.refunded || 0);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row._id || "UNRECONCILED", row.count]));
  res.json(new ApiResponse(true, "Reconciliation summary fetched", {
    expectedAmount: expected,
    receivedAmount: received,
    difference: Number((received - expected).toFixed(2)),
    billCount: billTotals[0]?.bills || 0,
    successfulPayments: paymentTotals[0]?.successfulPayments || 0,
    pendingRefunds: refundTotals[0]?.pending || 0,
    statuses: byStatus,
  }));
});

export const listReconciliationBills = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await buildRestaurantQuery({ status: { $nin: ["CANCELLED"] } }, req.user);
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  dateFilter(filter, req.query);
  const [bills, total] = await Promise.all([
    Bill.find(filter).select("billNumber customer table total paidAmount balanceDue status createdAt").populate("customer", "fullName phone").populate("table", "tableNumber").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Bill.countDocuments(filter),
  ]);
  const data = await Promise.all(bills.map(async (bill) => ({ ...bill, ...(await deriveBillReconciliation(bill)) })));
  const reconciliationStatus = String(req.query.reconciliationStatus || "").toUpperCase();
  const filtered = reconciliationStatus ? data.filter((bill) => bill.reconciliationStatus === reconciliationStatus) : data;
  res.json(new ApiResponse(true, "Reconciliation bills fetched", filtered, { page, limit, total: reconciliationStatus ? filtered.length : total, totalPages: reconciliationStatus ? 1 : Math.max(Math.ceil(total / limit), 1) }));
});

export const reconcilePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!payment) throw new ApiError(404, "Payment not found");
  const reconciled = await reconcileBillPayment({ payment, user: req.user, note: req.body.note });
  res.json(new ApiResponse(true, "Payment reconciled", reconciled));
});

export const listRefunds = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await buildRestaurantQuery({}, req.user);
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.paymentId) filter.payment = req.query.paymentId;
  dateFilter(filter, req.query);
  const [rows, total] = await Promise.all([
    Refund.find(filter).populate("payment", "paymentId paymentMethod paymentStatus").populate("initiatedBy", "fullName role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Refund.countDocuments(filter),
  ]);
  res.json(new ApiResponse(true, "Refunds fetched", rows, { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }));
});

export const getCashPreview = asyncHandler(async (req, res) => {
  const restaurantId = await singleRestaurant(req.user);
  res.json(new ApiResponse(true, "Cash reconciliation preview fetched", await previewCashReconciliation({ restaurantId, cashier: req.user._id })));
});

export const closeCashReconciliation = asyncHandler(async (req, res) => {
  const restaurantId = await singleRestaurant(req.user);
  const record = await reconcileCash({ restaurantId, cashier: req.user._id, countedCash: req.body.countedCash, note: req.body.note, reconciledBy: req.user._id });
  res.status(201).json(new ApiResponse(true, "Cash reconciliation recorded", record));
});

export const listCashReconciliations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await buildRestaurantQuery({}, req.user);
  dateFilter(filter, req.query);
  const [rows, total] = await Promise.all([
    CashReconciliation.find(filter).populate("cashier", "fullName role").populate("reconciledBy", "fullName role").sort({ closedAt: -1 }).skip(skip).limit(limit).lean(),
    CashReconciliation.countDocuments(filter),
  ]);
  res.json(new ApiResponse(true, "Cash reconciliations fetched", rows, { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }));
});
