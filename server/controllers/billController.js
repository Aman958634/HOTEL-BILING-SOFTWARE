import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { createActivity } from "../services/activityService.js";
import { buildBillReceiptBuffer, cancelOpenBill, createConsolidatedBill, recordBillPayment, serializeBill, splitOpenBillByOrders } from "../services/billService.js";
import { NOTIFICATION_EVENTS, publishBusinessEvent } from "../services/notificationService.js";

const pagination = (query) => { const page = Math.max(Number(query.page) || 1, 1); const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100); return { page, limit, skip: (page - 1) * limit }; };

export const listEligibleOrders = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ isArchived: { $ne: true }, status: { $nin: ["CANCELLED", "REJECTED"] }, billingBill: null }, req.user);
  if (req.query.tableId) filter.table = req.query.tableId;
  const orders = await Order.find(filter).select("orderNumber table customer orderType status paymentStatus subtotal discount loyaltyDiscount tax serviceCharge deliveryCharge total createdAt").populate("table", "tableNumber").populate("customer", "fullName phone").sort({ createdAt: -1 }).limit(100).lean();
  res.json(new ApiResponse(true, "Eligible orders fetched", orders));
});

export const createBill = asyncHandler(async (req, res) => {
  const restaurantFilter = await buildRestaurantQuery({}, req.user); const restaurantId = restaurantFilter.restaurant;
  if (!restaurantId || Array.isArray(restaurantId?.$in)) throw new ApiError(403, "A single restaurant context is required to create a bill");
  const result = await createConsolidatedBill({ orderIds: req.body.orderIds, restaurantId, user: req.user, idempotencyKey: String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim() });
  await createActivity({ action: "Bill Generated", description: `Bill ${result.bill.billNumber} generated`, performedBy: req.user._id, restaurantId, targetId: result.bill._id, targetType: "Bill" });
  if (!result.idempotent) await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.BILL_GENERATED, restaurantId, entityType: "Bill", entityId: result.bill._id, actorUserId: req.user._id, payload: { billNumber: result.bill.billNumber } });
  res.status(result.idempotent ? 200 : 201).json(new ApiResponse(true, result.idempotent ? "Bill already generated" : "Bill generated", await serializeBill(result.bill)));
});

export const listBills = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query); const filter = await buildRestaurantQuery({}, req.user);
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.tableId) filter.table = req.query.tableId;
  if (req.query.search) { const pattern = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ billNumber: pattern }, { "allocations.orderNumber": pattern }]; }
  const [bills, total] = await Promise.all([Bill.find(filter).populate("table", "tableNumber").populate("customer", "fullName phone").sort({ createdAt: -1 }).skip(skip).limit(limit), Bill.countDocuments(filter)]);
  res.json(new ApiResponse(true, "Bills fetched", await Promise.all(bills.map(serializeBill)), { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }));
});

export const getBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user)).populate("table", "tableNumber").populate("customer", "fullName phone email");
  if (!bill) throw new ApiError(404, "Bill not found"); res.json(new ApiResponse(true, "Bill fetched", await serializeBill(bill)));
});

export const addBillPayment = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({}, req.user); const restaurantId = filter.restaurant;
  if (!restaurantId || Array.isArray(restaurantId?.$in)) throw new ApiError(403, "A single restaurant context is required to settle a bill");
  const result = await recordBillPayment({ billId: req.params.id, restaurantId, amount: req.body.amount, paymentMethod: req.body.paymentMethod, transactionId: String(req.body.transactionId || "").trim(), idempotencyKey: String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim(), receivedBy: req.user._id });
  await createActivity({ action: "Bill Payment Recorded", description: `Payment recorded for ${result.bill.billNumber}`, performedBy: req.user._id, restaurantId, targetId: result.payment._id, targetType: "Payment" });
  if (!result.idempotent) {
    const payload = { billNumber: result.bill.billNumber, amount: result.payment.amount, balanceDue: result.bill.balanceDue };
    await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.PAYMENT_RECEIVED, restaurantId, entityType: "Payment", entityId: result.payment._id, actorUserId: req.user._id, payload });
    await publishBusinessEvent({ eventType: result.bill.status === "PAID" ? NOTIFICATION_EVENTS.BILL_FULLY_PAID : NOTIFICATION_EVENTS.PARTIAL_PAYMENT_RECEIVED, restaurantId, entityType: "Bill", entityId: result.bill._id, actorUserId: req.user._id, payload });
  }
  res.json(new ApiResponse(true, result.idempotent ? "Bill payment already recorded" : "Bill payment recorded", { bill: await serializeBill(result.bill), payment: result.payment }));
});

export const cancelBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user)); if (!bill) throw new ApiError(404, "Bill not found");
  const cancelled = await cancelOpenBill({ bill, user: req.user, reason: req.body.reason });
  await createActivity({ action: "Bill Cancelled", description: `Bill ${cancelled.billNumber} cancelled`, performedBy: req.user._id, restaurantId: cancelled.restaurant, targetId: cancelled._id, targetType: "Bill" });
  res.json(new ApiResponse(true, "Bill cancelled", await serializeBill(cancelled)));
});

export const splitBillByOrders = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({}, req.user); const restaurantId = filter.restaurant;
  if (!restaurantId || Array.isArray(restaurantId?.$in)) throw new ApiError(403, "A single restaurant context is required to split a bill");
  const bills = await splitOpenBillByOrders({ billId: req.params.id, restaurantId, groups: req.body.groups, user: req.user });
  await createActivity({ action: "Bill Split", description: `Bill ${req.params.id} split by original orders`, performedBy: req.user._id, restaurantId, targetId: req.params.id, targetType: "Bill" });
  res.status(201).json(new ApiResponse(true, "Bill split successfully", await Promise.all(bills.map(serializeBill))));
});

export const downloadBillReceipt = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user)); if (!bill) throw new ApiError(404, "Bill not found");
  const buffer = await buildBillReceiptBuffer(bill); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename=receipt-${bill.billNumber}.pdf`); res.send(buffer);
});
