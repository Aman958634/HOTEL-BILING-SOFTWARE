import QRCode from "qrcode";
import mongoose from "mongoose";
import HotelPaymentSettings from "../models/HotelPaymentSettings.js";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Bill from "../models/Bill.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery, hasAllOutletsAccess, hasExplicitOutletAccess } from "../utils/tenantUtils.js";
import { deriveOrderPaymentState, recordVerifiedPayment, serializePayment } from "../services/paymentService.js";
import { recordBillPayment } from "../services/billService.js";
import { getHotelPaymentCapability, isValidHotelUpiId } from "../services/hotelPaymentCapability.js";

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const validateOptionalObjectId = (value, label) => {
  if (value !== null && value !== undefined && value !== "" && !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
};

const resolveAuthorizedHotelScope = async (req, { restaurantId = null, outletId = null, requireOutlet = false } = {}) => {
  const hotelId = req.user?.hotelId;
  if (!hotelId) throw new ApiError(400, "Hotel context is required for hotel payment settings.");
  validateOptionalObjectId(restaurantId, "restaurant context");
  validateOptionalObjectId(outletId, "outlet context");

  if (req.user?.restaurant && restaurantId && String(req.user.restaurant) !== String(restaurantId)) {
    throw new ApiError(403, "Restaurant does not belong to your account.");
  }

  const restaurantQuery = restaurantId ? { _id: restaurantId, hotelId } : req.user.restaurant ? { _id: req.user.restaurant, hotelId } : { hotelId };
  const restaurants = await Restaurant.find(restaurantQuery).select("_id hotelId").lean();
  if (!restaurants.length) throw new ApiError(403, "Restaurant does not belong to your hotel.");

  const restaurantIds = restaurants.map((restaurant) => restaurant._id);
  let outlet = null;
  if (outletId) {
    outlet = await Outlet.findOne({ _id: outletId, restaurant: { $in: restaurantIds }, isActive: true }).select("_id restaurant").lean();
    if (!outlet) throw new ApiError(403, "Outlet does not belong to your hotel or restaurant.");
    if (!hasAllOutletsAccess(req.user) && !hasExplicitOutletAccess(req.user, outlet._id)) {
      throw new ApiError(403, "You do not have access to this outlet.");
    }
  }
  if (requireOutlet && !outlet) throw new ApiError(403, "An authorized outlet context is required.");

  // A hotel-level user can have access to multiple restaurants, while an
  // active outlet always belongs to exactly one of them. Resolve that
  // restaurant before downstream ownership checks.
  const resolvedRestaurantId = restaurantId || (req.user.restaurant ? restaurants[0]._id : outlet?.restaurant || null);

  return { hotelId, restaurantIds, restaurantId: resolvedRestaurantId, outletId: outlet?._id || null };
};

const rejectClientScopeOverride = (req, scope) => {
  const suppliedRestaurantId = req.body?.restaurantId ?? req.query?.restaurantId;
  const suppliedOutletId = req.body?.outletId ?? req.query?.outletId;
  validateOptionalObjectId(suppliedRestaurantId, "restaurant id");
  validateOptionalObjectId(suppliedOutletId, "outlet id");
  if (suppliedRestaurantId && String(suppliedRestaurantId) !== String(scope.restaurantId || "")) {
    throw new ApiError(403, "The requested restaurant is outside your authorized scope.");
  }
  if (suppliedOutletId && String(suppliedOutletId) !== String(scope.outletId || "")) {
    throw new ApiError(403, "The requested outlet is outside your authorized scope.");
  }
};

const resolveHotelPaymentSettings = async (req, { allowCreate = false, restaurantId = null, outletId = null } = {}) => {
  const scope = await resolveAuthorizedHotelScope(req, { restaurantId, outletId });

  const candidateFilters = [
    { hotelId: scope.hotelId, restaurant: scope.restaurantId || null, outlet: scope.outletId || null },
    { hotelId: scope.hotelId, restaurant: scope.restaurantId || null, outlet: null },
    { hotelId: scope.hotelId, restaurant: null, outlet: null },
  ];

  let settings = null;
  for (const filter of candidateFilters) {
    settings = await HotelPaymentSettings.findOne(filter).lean();
    if (settings) break;
  }

  if (!settings && !allowCreate) {
    throw new ApiError(404, "Hotel payment configuration not found.");
  }

  return settings;
};

const toUpiUri = ({ upiId, payeeName, amount, orderNumber }) => {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
    tn: `Order ${orderNumber || "Payment"}`,
  });
  return `upi://pay?${params.toString()}`;
};

const HOTEL_UPI_QR_EXPIRY_MS = 15 * 60 * 1000;

const hotelPaymentCapability = (settings) => getHotelPaymentCapability({
  settings,
  environment: process.env.NODE_ENV,
  liveDigitalPayments: process.env.LIVE_DIGITAL_PAYMENTS,
  topologyType: mongoose.connection.client?.topology?.description?.type,
});

const resolveHotelPaymentScope = async (req) => {
  return resolveAuthorizedHotelScope(req, {
    restaurantId: req.user?.restaurant || null,
    outletId: req.user?.activeOutlet || req.user?.defaultOutlet || null,
    requireOutlet: true,
  });
};

const findScopedHotelPayment = async (req, lookupId) => {
  const scope = await resolveHotelPaymentScope(req);
  const payment = await Payment.findOne({
    $or: [
      ...(mongoose.isValidObjectId(lookupId) ? [{ _id: lookupId }] : []),
      { paymentId: lookupId },
    ],
    provider: "HOTEL_UPI",
    restaurant: { $in: scope.restaurantIds },
    outlet: scope.outletId,
  }).populate("orderId");
  if (!payment) throw new ApiError(404, "Hotel UPI payment record not found for this hotel and outlet.");
  if (!payment.restaurant || !payment.outlet || String(payment.restaurant) !== String(scope.restaurantId) || String(payment.outlet) !== String(scope.outletId)) {
    throw new ApiError(403, "This payment does not belong to the authorized hotel outlet.");
  }
  return payment;
};

const getExistingAwaitingPayment = async ({ orderId = null, billId = null }) => {
  const payment = await Payment.findOne({
    ...(orderId ? { orderId } : { bill: billId }),
    provider: "HOTEL_UPI",
    paymentStatus: "AWAITING_VERIFICATION",
  }).sort({ createdAt: -1 }).lean();

  if (payment && payment.createdAt && Date.now() - new Date(payment.createdAt).getTime() > HOTEL_UPI_QR_EXPIRY_MS) {
    await Payment.updateOne(
      { _id: payment._id, paymentStatus: "AWAITING_VERIFICATION" },
      {
        $set: { paymentStatus: "FAILED", providerStatus: "EXPIRED" },
        $push: { timeline: { status: "PAYMENT_FAILED", timestamp: new Date(), note: "Hotel UPI QR expired before manual verification" } },
      }
    );
    return null;
  }

  return payment;
};

export const getHotelPaymentSettings = asyncHandler(async (req, res) => {
  const scope = await resolveAuthorizedHotelScope(req, {
    restaurantId: req.user?.restaurant || null,
    outletId: req.user?.activeOutlet || req.user?.defaultOutlet || null,
  });
  rejectClientScopeOverride(req, scope);
  let settings = null;

  try {
    settings = await resolveHotelPaymentSettings(req, { restaurantId: scope.restaurantId, outletId: scope.outletId });
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
  }
  const effectiveSettings = settings || {
    hotelId: req.user.hotelId,
    restaurant: scope.restaurantId,
    outlet: scope.outletId,
    payeeName: "",
    upiId: "",
    isEnabled: false,
    status: "DISABLED",
    notes: "",
  };

  return res.status(200).json(new ApiResponse(true, "Hotel payment configuration loaded", {
    settings: effectiveSettings,
    capability: hotelPaymentCapability(effectiveSettings),
  }));
});

export const saveHotelPaymentSettings = asyncHandler(async (req, res) => {
  const scope = await resolveAuthorizedHotelScope(req, {
    restaurantId: req.user?.restaurant || null,
    outletId: req.user?.activeOutlet || req.user?.defaultOutlet || null,
  });
  rejectClientScopeOverride(req, scope);

  const payeeName = normalizeText(req.body?.payeeName, "");
  const upiId = normalizeText(req.body?.upiId, "");
  const isEnabled = Boolean(req.body?.isEnabled);
  const notes = normalizeText(req.body?.notes, "");

  if (!payeeName || !isValidHotelUpiId(upiId)) {
    throw new ApiError(400, "A payee name and valid UPI ID are required to configure hotel payment collection.");
  }
  const capability = hotelPaymentCapability({ payeeName, upiId, isEnabled: true });
  if (isEnabled && !capability.canEnable) throw new ApiError(503, capability.reason);

  const settings = await HotelPaymentSettings.findOneAndUpdate(
    { hotelId: scope.hotelId, restaurant: scope.restaurantId || null, outlet: scope.outletId || null },
    {
      $set: {
        hotelId: scope.hotelId,
        restaurant: scope.restaurantId || null,
        outlet: scope.outletId || null,
        payeeName,
        upiId,
        isEnabled,
        status: isEnabled ? "ACTIVE" : "DISABLED",
        notes,
        updatedBy: req.user._id,
      },
      $setOnInsert: {
        createdBy: req.user._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(200).json(new ApiResponse(true, "Hotel payment settings saved", { settings }));
});

export const createHotelPaymentQr = asyncHandler(async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) {
    throw new ApiError(400, "Order ID is required to generate a hotel payment QR.");
  }

  const order = await Order.findOne(await buildOutletQuery({ _id: orderId }, req.user));
  if (!order) throw new ApiError(404, "Order not found for this hotel.");

  const settings = await resolveHotelPaymentSettings(req, { restaurantId: order.restaurant || req.user.restaurant, outletId: order.outlet || req.user.activeOutlet || req.user.defaultOutlet });
  const capability = hotelPaymentCapability(settings);
  if (!capability.deploymentAllowed || !capability.transactionSupport) throw new ApiError(503, capability.reason);
  if (!capability.canCollect) throw new ApiError(400, capability.reason);

  if (order.paymentStatus === "PAID") {
    throw new ApiError(409, "This order is already paid.");
  }

  const bill = order.billingBill
    ? await Bill.findOne({ _id: order.billingBill, restaurant: order.restaurant, outlet: order.outlet || null, status: { $in: ["OPEN", "PARTIALLY_PAID"] } }).lean()
    : null;
  if (order.billingBill && !bill) throw new ApiError(409, "This order is linked to a bill that cannot accept payment.");
  const settlement = bill ? { remainingAmount: bill.balanceDue } : await deriveOrderPaymentState(order);
  const amount = Number(settlement.remainingAmount || 0);
  if (!amount) {
    throw new ApiError(409, "This order has no outstanding amount to collect.");
  }

  const paymentReference = `HOTEL-UPI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let payment = null;
  let reused = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const existingPayment = await Payment.findOne({
        ...(bill ? { bill: bill._id } : { orderId: order._id }),
        provider: "HOTEL_UPI",
        paymentStatus: "AWAITING_VERIFICATION",
      }).sort({ createdAt: -1 }).session(session);
      if (existingPayment) {
        if (existingPayment.createdAt && Date.now() - new Date(existingPayment.createdAt).getTime() > HOTEL_UPI_QR_EXPIRY_MS) {
          await Payment.updateOne(
            { _id: existingPayment._id, paymentStatus: "AWAITING_VERIFICATION" },
            {
              $set: { paymentStatus: "FAILED", providerStatus: "EXPIRED" },
              $push: { timeline: { status: "PAYMENT_FAILED", timestamp: new Date(), note: "Hotel UPI QR expired before manual verification" } },
            },
            { session }
          );
        } else {
          payment = existingPayment;
          reused = true;
          return;
        }
      }

      const [createdPayment] = await Payment.create([{
    paymentId: paymentReference,
    orderId: bill ? null : order._id,
    bill: bill?._id || null,
    customerId: order.customer || null,
    tableId: order.table || null,
    restaurant: order.restaurant || null,
    outlet: order.outlet || null,
    amount,
    subtotal: Number(order.subtotal || 0),
    tax: Number(order.tax || 0),
    discount: Number(order.discount || 0),
    serviceCharge: Number(order.serviceCharge || 0),
    totalAmount: amount,
    paymentMethod: "UPI",
    gateway: "HOTEL_UPI",
    provider: "HOTEL_UPI",
    paymentStatus: "AWAITING_VERIFICATION",
    transactionId: paymentReference,
    paidAt: null,
    receivedBy: req.user._id,
    metadata: {
      hotelPayment: true,
      hotelId: req.user.hotelId,
      restaurantId: order.restaurant || null,
      outletId: order.outlet || null,
      provider: "HOTEL_UPI",
      orderNumber: order.orderNumber,
      orderAmount: amount,
      generatedBy: req.user._id,
      ...(bill ? { billPayment: true, billId: bill._id, billNumber: bill.billNumber } : {}),
    },
    timeline: [{ status: "PAYMENT_INITIATED", timestamp: new Date(), note: "Hotel-owned UPI QR generated for manual verification" }],
      }], { session });
      payment = createdPayment;

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: { $ne: "PAID" } },
        { $set: { paymentMethod: "UPI", paymentStatus: "AWAITING_VERIFICATION", transactionId: paymentReference } },
        { new: true, session }
      );
      if (!updatedOrder) throw new ApiError(409, "This order is already paid.");
    });
  } catch (error) {
    if (error?.code === 11000) {
      payment = await getExistingAwaitingPayment({ orderId: bill ? null : order._id, billId: bill?._id || null });
      if (!payment) throw error;
      reused = true;
    } else if (String(error?.message || "").includes("Transaction numbers are only allowed")) {
      throw new ApiError(503, "Hotel UPI QR generation requires MongoDB replica-set transactions.");
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  const upiLink = toUpiUri({ upiId: settings.upiId, payeeName: settings.payeeName, amount, orderNumber: order.orderNumber });
  const qrCode = await QRCode.toDataURL(upiLink, { margin: 1, width: 280, errorCorrectionLevel: "M" });

  return res.status(reused ? 200 : 201).json(new ApiResponse(true, reused ? "QR already issued; waiting for manual verification." : "Hotel payment QR generated. Manual verification is required before marking as paid.", {
    payment,
    qrCode,
    upiLink,
    amount,
    orderId: order._id,
    payeeName: settings.payeeName,
    upiId: settings.upiId,
    paymentStatus: "AWAITING_VERIFICATION",
    expiresAt: new Date(new Date(payment.createdAt || Date.now()).getTime() + HOTEL_UPI_QR_EXPIRY_MS).toISOString(),
  }));
});

export const verifyHotelPayment = asyncHandler(async (req, res) => {
  const { paymentId, orderId, transactionId, amount } = req.body || {};
  const lookupId = paymentId || orderId;
  if (!lookupId) {
    throw new ApiError(400, "Payment ID or order ID is required to verify a hotel payment.");
  }

  const payment = await findScopedHotelPayment(req, lookupId);

  // QR generation is a payment-request action, not proof of a bank credit.
  // A second cashier must independently match the hotel-account credit before
  // the attempt can affect an order, bill, invoice, or revenue.
  const generatedBy = payment.metadata?.generatedBy || payment.receivedBy;
  if (!generatedBy || String(generatedBy) === String(req.user?._id || "")) {
    throw new ApiError(403, "Hotel UPI verification must be completed by a different cashier than the QR generator.");
  }

  const order = payment.orderId || await Order.findOne(await buildOutletQuery(
    payment.bill ? { billingBill: payment.bill } : { _id: orderId },
    req.user
  ));
  if (!order) {
    throw new ApiError(404, "Order not found for verification.");
  }
  if (payment.orderId && (
    !order.restaurant || !order.outlet || String(order.restaurant) !== String(payment.restaurant) || String(order.outlet) !== String(payment.outlet)
  )) {
    throw new ApiError(403, "Payment and order tenant relationships do not match.");
  }
  if (payment.bill && (!order.billingBill || String(order.billingBill) !== String(payment.bill))) {
    throw new ApiError(403, "Payment and bill tenant relationships do not match.");
  }

  if (payment.paymentStatus === "PAID") {
    throw new ApiError(409, "This hotel payment has already been verified and marked as paid.");
  }

  const finalAmount = Number(amount ?? payment.totalAmount ?? payment.amount ?? order.total ?? 0);
  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    throw new ApiError(400, "A valid settlement amount is required.");
  }

  const reference = normalizeText(transactionId, "");
  if (!reference) throw new ApiError(422, "A bank or UPI transaction reference is required for approval.");
  const currentStatus = String(payment.paymentStatus || "").toUpperCase();
  if (currentStatus !== "AWAITING_VERIFICATION" && currentStatus !== "PENDING" && currentStatus !== "PROCESSING") {
    throw new ApiError(409, "This hotel payment cannot be verified from its current state.");
  }

  const bill = payment.bill ? await Bill.findOne({ _id: payment.bill, restaurant: payment.restaurant, outlet: payment.outlet || null, status: { $in: ["OPEN", "PARTIALLY_PAID"] } }).lean() : null;
  if (payment.bill && !bill) throw new ApiError(409, "This bill is no longer payable.");
  const settlement = bill ? { remainingAmount: bill.balanceDue } : await deriveOrderPaymentState(order);
  const finalOrderAmount = Number(settlement.remainingAmount || 0);
  const amountTolerance = 0.01;
  if (Math.abs(finalAmount - finalOrderAmount) > amountTolerance) {
    throw new ApiError(400, "Hotel UPI approval must match the exact server-calculated outstanding balance; partial Hotel UPI collection is not supported.");
  }

  const result = bill
    ? await recordBillPayment({
      billId: bill._id, restaurantId: payment.restaurant, amount: finalAmount, paymentMethod: "UPI", transactionId: reference,
      idempotencyKey: `hotel-payment:${payment.paymentId}`, existingPaymentId: payment._id, receivedBy: req.user._id,
      metadata: { hotelPayment: true, verifiedBy: req.user._id, verificationReference: reference, provider: "HOTEL_UPI" },
    })
    : await recordVerifiedPayment(order, {
      amount: finalAmount, paymentMethod: "UPI", gateway: "HOTEL_UPI", transactionId: reference,
      idempotencyKey: `hotel-payment:${payment.paymentId}`, existingPaymentId: payment._id, receivedBy: req.user._id,
      note: `Hotel UPI payment verified by ${req.user.fullName || "staff"}`,
      metadata: { hotelPayment: true, verifiedBy: req.user._id, verificationReference: reference, provider: "HOTEL_UPI" },
    });

  return res.status(200).json(new ApiResponse(true, "Hotel UPI payment verified and marked as paid.", {
    payment: serializePayment(result.payment),
    order: order || null,
  }));
});

export const rejectHotelPayment = asyncHandler(async (req, res) => {
  const { paymentId, orderId, note } = req.body || {};
  if (!paymentId && !orderId) {
    throw new ApiError(400, "A payment ID or order ID is required to reject a hotel payment.");
  }
  if (!normalizeText(note, "")) {
    throw new ApiError(422, "A rejection reason is required for a hotel payment.");
  }

  const payment = await findScopedHotelPayment(req, paymentId || orderId);

  const paymentRestaurant = payment.restaurant ? await Restaurant.findById(payment.restaurant).select("hotelId").lean() : null;
  if (paymentRestaurant && req.user?.hotelId && String(paymentRestaurant.hotelId || "") !== String(req.user.hotelId)) {
    throw new ApiError(403, "This payment belongs to another hotel.");
  }

  if (payment.paymentStatus === "PAID") {
    throw new ApiError(409, "A verified hotel payment cannot be rejected after it has been marked as paid.");
  }

  payment.paymentStatus = "PENDING";
  payment.metadata = { ...(payment.metadata || {}), rejectedBy: req.user._id, rejectedAt: new Date().toISOString(), rejectionNote: normalizeText(note) };
  payment.timeline = Array.isArray(payment.timeline) ? payment.timeline : [];
  payment.timeline.push({ status: "PAYMENT_FAILED", timestamp: new Date(), note: normalizeText(note) });

  if (payment.orderId) {
    payment.orderId.paymentStatus = "PENDING";
    payment.orderId.paymentMethod = "UPI";
    await payment.orderId.save();
  } else if (payment.bill) {
    await Order.updateMany(
      { billingBill: payment.bill, paymentStatus: "AWAITING_VERIFICATION" },
      { $set: { paymentStatus: "PENDING", paymentMethod: "UPI" } }
    );
  }

  await payment.save();

  return res.status(200).json(new ApiResponse(true, "Hotel UPI payment was rejected and returned to pending review.", { payment }));
});
