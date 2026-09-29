import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Hotel from "../models/Hotel.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import { rejectHotelPayment } from "../controllers/hotelPaymentController.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const id = () => new mongoose.Types.ObjectId();
const created = { hotels: [], restaurants: [], outlets: [], orders: [], payments: [], bills: [] };

const invoke = (handler, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ statusCode: this.statusCode, body }); },
  };
  handler(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});

try {
  await mongoose.connect(uri);

  const [hotelA, hotelB] = await Hotel.create([
    { name: `Reject Hotel A ${suffix}`, slug: `reject-hotel-a-${suffix}` },
    { name: `Reject Hotel B ${suffix}`, slug: `reject-hotel-b-${suffix}` },
  ]);
  created.hotels.push(hotelA._id, hotelB._id);

  const [restaurantA, restaurantB] = await Restaurant.create([
    { name: `Reject Restaurant A ${suffix}`, slug: `reject-restaurant-a-${suffix}`, branchCode: `RA${suffix}`, address: "Local test", hotelId: hotelA._id },
    { name: `Reject Restaurant B ${suffix}`, slug: `reject-restaurant-b-${suffix}`, branchCode: `RB${suffix}`, address: "Local test", hotelId: hotelB._id },
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [outletA, outletA2, outletB] = await Outlet.create([
    { restaurant: restaurantA._id, name: "Reject A", code: `RA${suffix}`, isDefault: true },
    { restaurant: restaurantA._id, name: "Reject A2", code: `RA2${suffix}` },
    { restaurant: restaurantB._id, name: "Reject B", code: `RB${suffix}`, isDefault: true },
  ]);
  created.outlets.push(outletA._id, outletA2._id, outletB._id);

  const staffA = { _id: id(), hotelId: hotelA._id, restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true };
  const staffB = { _id: id(), hotelId: hotelB._id, restaurant: restaurantB._id, activeOutlet: outletB._id, defaultOutlet: outletB._id, allOutletsAccess: true };
  const staffAOtherOutlet = { ...staffA, activeOutlet: outletA2._id, defaultOutlet: outletA2._id };
  const request = (user, body) => ({ user, body, query: {} });

  const makeOrder = async ({
    restaurant = restaurantA,
    outlet = outletA,
    paymentStatus = "AWAITING_VERIFICATION",
    billingBill = null,
    label = "ORDER",
  } = {}) => {
    const order = await Order.create({
      orderNumber: `${label}-${suffix}-${created.orders.length}`,
      restaurant: restaurant._id,
      outlet: outlet._id,
      orderType: "TAKEAWAY",
      items: [{ menuItem: id(), name: "Local test item", price: 10, quantity: 1, subtotal: 10 }],
      subtotal: 10,
      total: 10,
      paymentMethod: "UPI",
      paymentStatus,
      billingBill,
    });
    created.orders.push(order._id);
    return order;
  };

  const makePayment = async ({ order = null, bill = null, paymentStatus = "AWAITING_VERIFICATION", label = "PAYMENT" } = {}) => {
    const payment = await Payment.create({
      paymentId: `${label}-${suffix}-${created.payments.length}`,
      orderId: order?._id || null,
      bill: bill?._id || null,
      restaurant: restaurantA._id,
      outlet: outletA._id,
      amount: 10,
      totalAmount: 10,
      paymentMethod: "UPI",
      gateway: "HOTEL_UPI",
      provider: "HOTEL_UPI",
      paymentStatus,
      metadata: { preserved: true },
      timeline: [{ status: "PAYMENT_INITIATED", timestamp: new Date(), note: "Test Hotel UPI request" }],
    });
    created.payments.push(payment._id);
    return payment;
  };

  const missingNote = await invoke(rejectHotelPayment, request(staffA, { paymentId: id() }));
  assert.equal(missingNote.statusCode, 422, "A rejection note is required");

  const scopedOrder = await makeOrder({ label: "SCOPED" });
  const scopedPayment = await makePayment({ order: scopedOrder, label: "SCOPED" });
  const crossTenant = await invoke(rejectHotelPayment, request(staffB, { paymentId: scopedPayment.paymentId, note: "No credit" }));
  assert.ok([403, 404].includes(crossTenant.statusCode), "Cross-hotel rejection is denied");
  const crossOutlet = await invoke(rejectHotelPayment, request(staffAOtherOutlet, { paymentId: scopedPayment.paymentId, note: "No credit" }));
  assert.ok([403, 404].includes(crossOutlet.statusCode), "Cross-outlet rejection is denied");

  const paidOrder = await makeOrder({ paymentStatus: "PAID", label: "PAID" });
  const paidPayment = await makePayment({ order: paidOrder, paymentStatus: "PAID", label: "PAID" });
  const paidRejection = await invoke(rejectHotelPayment, request(staffA, { paymentId: paidPayment.paymentId, note: "No credit" }));
  assert.equal(paidRejection.statusCode, 409, "A paid payment is never rejectable");

  const pendingOrder = await makeOrder({ paymentStatus: "PENDING", label: "PENDING" });
  const pendingPayment = await makePayment({ order: pendingOrder, paymentStatus: "PENDING", label: "PENDING" });
  const pendingRejection = await invoke(rejectHotelPayment, request(staffA, { paymentId: pendingPayment.paymentId, note: "No credit" }));
  assert.equal(pendingRejection.statusCode, 409, "Only awaiting verification may enter rejection");

  const order = await makeOrder({ label: "ORDER-ATOMIC" });
  const payment = await makePayment({ order, label: "ORDER-ATOMIC" });
  const orderRejection = await invoke(rejectHotelPayment, request(staffA, { paymentId: payment.paymentId, note: "No matching bank transaction" }));
  assert.equal(orderRejection.statusCode, 200);
  const [rejectedPayment, rejectedOrder] = await Promise.all([
    Payment.findById(payment._id).lean(),
    Order.findById(order._id).lean(),
  ]);
  assert.equal(rejectedPayment.paymentStatus, "PENDING");
  assert.equal(rejectedPayment.providerStatus, "REJECTED");
  assert.equal(rejectedPayment.metadata.preserved, true);
  assert.equal(rejectedPayment.metadata.rejectionNote, "No matching bank transaction");
  assert.equal(rejectedPayment.timeline.at(-1).status, "PAYMENT_FAILED");
  assert.equal(rejectedOrder.paymentStatus, "PENDING");
  assert.equal(rejectedOrder.paymentMethod, "UPI");
  const repeatedRejection = await invoke(rejectHotelPayment, request(staffA, { paymentId: payment.paymentId, note: "Try again" }));
  assert.equal(repeatedRejection.statusCode, 409, "A rejected payment cannot be rejected twice");

  const billOrderA = await makeOrder({ label: "BILL-A" });
  const billOrderB = await makeOrder({ label: "BILL-B" });
  const bill = await Bill.create({
    billNumber: `REJECT-BILL-${suffix}`,
    restaurant: restaurantA._id,
    outlet: outletA._id,
    allocations: [
      { order: billOrderA._id, orderNumber: billOrderA.orderNumber, subtotal: 10, total: 10 },
      { order: billOrderB._id, orderNumber: billOrderB.orderNumber, subtotal: 10, total: 10 },
    ],
    subtotal: 20,
    total: 20,
    balanceDue: 20,
    createdBy: staffA._id,
  });
  created.bills.push(bill._id);
  await Order.updateMany({ _id: { $in: [billOrderA._id, billOrderB._id] } }, { $set: { billingBill: bill._id } });
  const billPayment = await makePayment({ bill, label: "BILL-ATOMIC" });
  const billRejection = await invoke(rejectHotelPayment, request(staffA, { paymentId: billPayment.paymentId, note: "Bank credit not found" }));
  assert.equal(billRejection.statusCode, 200);
  const [rejectedBillPayment, linkedOrders, unchangedBill] = await Promise.all([
    Payment.findById(billPayment._id).lean(),
    Order.find({ _id: { $in: [billOrderA._id, billOrderB._id] } }).sort({ orderNumber: 1 }).lean(),
    Bill.findById(bill._id).lean(),
  ]);
  assert.equal(rejectedBillPayment.paymentStatus, "PENDING");
  assert.deepEqual(linkedOrders.map((row) => row.paymentStatus), ["PENDING", "PENDING"]);
  assert.equal(unchangedBill.total, 20, "Rejection never changes bill totals");
  assert.equal(unchangedBill.paidAmount, 0, "Rejection never records a collection");

  const raceOrder = await makeOrder({ label: "RACE" });
  const racePayment = await makePayment({ order: raceOrder, label: "RACE" });
  const raceResults = await Promise.all([
    invoke(rejectHotelPayment, request(staffA, { paymentId: racePayment.paymentId, note: "Race one" })),
    invoke(rejectHotelPayment, request(staffA, { paymentId: racePayment.paymentId, note: "Race two" })),
  ]);
  assert.deepEqual(raceResults.map((result) => result.statusCode).sort((a, b) => a - b), [200, 409], "A concurrent state change rejects exactly once");

  const rollbackOrder = await makeOrder({ label: "ROLLBACK" });
  const rollbackPayment = await makePayment({ order: rollbackOrder, label: "ROLLBACK" });
  const originalPaymentSave = Payment.prototype.save;
  Payment.prototype.save = async function saveWithForcedFailure(...args) {
    if (String(this._id) === String(rollbackPayment._id)) throw new Error("forced payment write failure");
    return originalPaymentSave.apply(this, args);
  };
  try {
    const rollbackResult = await invoke(rejectHotelPayment, request(staffA, { paymentId: rollbackPayment.paymentId, note: "Force rollback" }));
    assert.equal(rollbackResult.statusCode, 500, "A transaction write failure is reported");
  } finally {
    Payment.prototype.save = originalPaymentSave;
  }
  const [paymentAfterRollback, orderAfterRollback] = await Promise.all([
    Payment.findById(rollbackPayment._id).lean(),
    Order.findById(rollbackOrder._id).lean(),
  ]);
  assert.equal(paymentAfterRollback.paymentStatus, "AWAITING_VERIFICATION", "Failed transactions roll back payment changes");
  assert.equal(orderAfterRollback.paymentStatus, "AWAITING_VERIFICATION", "Failed transactions roll back order changes");

  console.log("hotelPaymentRejectTransaction.integration.test.mjs passed: scoped Hotel UPI rejection is transactional, state-gated, and rollback-safe.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Payment.deleteMany({ _id: { $in: created.payments } }),
      Bill.deleteMany({ _id: { $in: created.bills } }),
      Order.deleteMany({ _id: { $in: created.orders } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
      Hotel.deleteMany({ _id: { $in: created.hotels } }),
    ]);
    await mongoose.disconnect();
  }
}
