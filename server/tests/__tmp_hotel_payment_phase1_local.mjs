import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Invoice from "../models/Invoice.js";
import Bill from "../models/Bill.js";
import HotelPaymentSettings from "../models/HotelPaymentSettings.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import { createHotelPaymentQr, getHotelPaymentSettings, rejectHotelPayment, saveHotelPaymentSettings, verifyHotelPayment } from "../controllers/hotelPaymentController.js";
import { buildPaymentReceipt } from "../services/paymentService.js";
import { dashboardStats } from "../controllers/adminController.js";
import { createConsolidatedBill, buildBillReceiptBuffer } from "../services/billService.js";
import { deriveBillReconciliation } from "../services/reconciliationService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const invoke = (handler, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ statusCode: this.statusCode, body }); },
  };
  handler(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});
const id = () => new mongoose.Types.ObjectId();
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], outlets: [], categories: [], foods: [], orders: [], payments: [], settings: [], invoices: [], bills: [] };

try {
  await mongoose.connect(uri);
  await Payment.syncIndexes();
  const hotelA = id();
  const hotelB = id();
  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Hotel A ${suffix}`, slug: `hotel-a-${suffix}`, branchCode: `HA${suffix}`, address: "Local test", hotelId: hotelA }),
    Restaurant.create({ name: `Hotel B ${suffix}`, slug: `hotel-b-${suffix}`, branchCode: `HB${suffix}`, address: "Local test", hotelId: hotelB }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);
  const [outletA, outletB] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "Main A", code: `A${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantB._id, name: "Main B", code: `B${suffix}`, isDefault: true }),
  ]);
  created.outlets.push(outletA._id, outletB._id);
  const [categoryA, categoryB] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: `Cat A ${suffix}`, slug: `cat-a-${suffix}` }),
    Category.create({ restaurant: restaurantB._id, name: `Cat B ${suffix}`, slug: `cat-b-${suffix}` }),
  ]);
  created.categories.push(categoryA._id, categoryB._id);
  const [foodA, foodB] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: categoryA._id, name: `Food A ${suffix}`, price: 100 }),
    Food.create({ restaurant: restaurantB._id, category: categoryB._id, name: `Food B ${suffix}`, price: 200 }),
  ]);
  created.foods.push(foodA._id, foodB._id);

  const staffA = { _id: id(), hotelId: hotelA, restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true, fullName: "Hotel A Cashier" };
  const staffAVerifier = { _id: id(), hotelId: hotelA, restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true, fullName: "Hotel A Verifier" };
  const hotelWideVerifier = { _id: id(), hotelId: hotelA, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true, fullName: "Hotel A Wide Verifier" };
  const staffB = { _id: id(), hotelId: hotelB, restaurant: restaurantB._id, activeOutlet: outletB._id, defaultOutlet: outletB._id, allOutletsAccess: true, fullName: "Hotel B Cashier" };
  const orderRequest = (user, body = {}, query = {}) => ({ user, body, query });

  for (const [hotelId, restaurant, outlet, payeeName, upiId, user] of [
    [hotelA, restaurantA, outletA, "Hotel A Payee", "hotel-a@upi", staffA],
    [hotelB, restaurantB, outletB, "Hotel B Payee", "hotel-b@upi", staffB],
  ]) {
    const result = await invoke(saveHotelPaymentSettings, orderRequest(user, { payeeName, upiId, isEnabled: true }));
    assert.equal(result.statusCode, 200);
    created.settings.push(result.body.data.settings._id);
    assert.equal(String(result.body.data.settings.hotelId), String(hotelId));
    assert.equal(String(result.body.data.settings.restaurant), String(restaurant._id));
    assert.equal(String(result.body.data.settings.outlet), String(outlet._id));
  }
  assert.equal(await HotelPaymentSettings.countDocuments({ hotelId: hotelA }), 1);
  assert.equal(await HotelPaymentSettings.countDocuments({ hotelId: hotelB }), 1);
  const settingsRead = await invoke(getHotelPaymentSettings, orderRequest(staffA));
  assert.equal(settingsRead.statusCode, 200, "Authorized hotel staff can read its own payment settings");
  const forgedSettingsRead = await invoke(getHotelPaymentSettings, orderRequest(staffA, {}, { restaurantId: restaurantB._id, outletId: outletB._id }));
  assert.equal(forgedSettingsRead.statusCode, 403, "A hotel user cannot read another restaurant or outlet through settings IDs");

  const makeOrder = async ({ restaurant, outlet, number, total, paymentStatus = "PENDING" }) => {
    const order = await Order.create({ orderNumber: `${number}-${suffix}`, restaurant: restaurant._id, outlet: outlet._id, orderType: "TAKEAWAY", items: [{ menuItem: restaurant._id === restaurantA._id ? foodA._id : foodB._id, name: "Test item", price: total, quantity: 1, subtotal: total }], subtotal: total, total, paymentStatus });
    created.orders.push(order._id);
    return order;
  };

  const partialOrder = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "PARTIAL", total: 100 });
  const partialPayment = await Payment.create({ paymentId: `PARTIAL-${suffix}`, orderId: partialOrder._id, restaurant: restaurantA._id, outlet: outletA._id, amount: 40, totalAmount: 40, paymentMethod: "CASH", paymentStatus: "PAID", provider: "CASH", gateway: "CASH", transactionId: `CASH-${suffix}`, paidAt: new Date() });
  created.payments.push(partialPayment._id);
  const qr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: partialOrder._id }));
  assert.equal(qr.statusCode, 201);
  assert.equal(qr.body.data.amount, 60);
  assert.match(qr.body.data.upiLink, /hotel-a%40upi/);
  assert.match(qr.body.data.upiLink, /Hotel\+A\+Payee/);
  assert.doesNotMatch(qr.body.data.upiLink, /hotel-b%40upi/);
  assert.equal(qr.body.data.paymentStatus, "AWAITING_VERIFICATION");
  const awaiting = await Order.findById(partialOrder._id).lean();
  assert.equal(awaiting.paymentStatus, "AWAITING_VERIFICATION", "QR display must not mark an order paid");

  const crossHotel = await invoke(createHotelPaymentQr, orderRequest(staffB, { orderId: partialOrder._id }));
  assert.equal(crossHotel.statusCode, 404, "Hotel B cannot create a QR for Hotel A order");
  const paymentId = qr.body.data.payment.paymentId;
  const crossVerify = await invoke(verifyHotelPayment, orderRequest(staffB, { paymentId, amount: 60, transactionId: `FORGED-${suffix}` }));
  assert.ok([403, 404].includes(crossVerify.statusCode), "Hotel B cannot verify Hotel A payment");
  const outletA2 = await Outlet.create({ restaurant: restaurantA._id, name: "Side A", code: `A2${suffix}`, isDefault: false });
  created.outlets.push(outletA2._id);
  const staffAOtherOutlet = { ...staffA, activeOutlet: outletA2._id, defaultOutlet: outletA2._id, allOutletsAccess: false, outletAccess: [] };
  const crossOutletVerify = await invoke(verifyHotelPayment, orderRequest(staffAOtherOutlet, { paymentId, amount: 60, transactionId: `WRONG-OUTLET-${suffix}` }));
  assert.ok([403, 404].includes(crossOutletVerify.statusCode), "A staff member cannot verify a payment from another outlet");

  const forgedSettings = await invoke(saveHotelPaymentSettings, orderRequest(staffA, { restaurantId: restaurantB._id, outletId: outletB._id, payeeName: "Forged", upiId: "forged@upi", isEnabled: true }));
  assert.equal(forgedSettings.statusCode, 403, "A hotel user cannot target another restaurant or outlet through settings IDs");

  const sameHotelUnauthorizedQr = await invoke(createHotelPaymentQr, orderRequest(staffAOtherOutlet, { orderId: partialOrder._id }));
  assert.ok([403, 404].includes(sameHotelUnauthorizedQr.statusCode), "Same-hotel staff without outlet access cannot create a QR");

  const selfVerification = await invoke(verifyHotelPayment, orderRequest(staffA, { paymentId, amount: 60, transactionId: `BANK-A-SELF-${suffix}` }));
  assert.equal(selfVerification.statusCode, 403, "A QR generator cannot approve its own hotel UPI payment");
  const verify = await invoke(verifyHotelPayment, orderRequest(staffAVerifier, { paymentId, amount: 60, transactionId: `BANK-A-${suffix}` }));
  assert.equal(verify.statusCode, 200);
  const paidOrder = await Order.findById(partialOrder._id).lean();
  const paidPayment = await Payment.findOne({ paymentId }).lean();
  assert.equal(paidOrder.paymentStatus, "PAID");
  assert.equal(paidPayment.paymentStatus, "PAID");
  assert.equal(paidPayment.transactionId, `BANK-A-${suffix}`);
  const invoice = await Invoice.findOne({ order: partialOrder._id }).lean();
  assert.ok(invoice, "Canonical approval must generate one invoice");
  created.invoices.push(invoice._id);
  assert.equal(invoice.totalPaid, 100);
  assert.equal(await Payment.countDocuments({ orderId: partialOrder._id, paymentStatus: "PAID" }), 2);
  assert.ok((await buildPaymentReceipt(await Payment.findById(paidPayment._id))).length > 0, "Paid hotel payment must have a receipt");
  const dashboard = await invoke(dashboardStats, orderRequest({ _id: new mongoose.Types.ObjectId(), role: "admin", hotelId: hotelA, restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true }));
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.body.data.totalRevenue.value, 100, "Dashboard revenue must count the invoice once");

  const splitOrderA = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "BILL-A", total: 30 });
  const splitOrderB = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "BILL-B", total: 20 });
  const consolidated = await createConsolidatedBill({ orderIds: [splitOrderA._id, splitOrderB._id], restaurantId: restaurantA._id, user: staffA, idempotencyKey: `BILL-${suffix}` });
  created.bills.push(consolidated.bill._id);
  const billQr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: splitOrderA._id }));
  assert.equal(billQr.statusCode, 201);
  assert.equal(billQr.body.data.amount, 50, "Consolidated bill QR must use bill balance");
  assert.equal(String(billQr.body.data.payment.bill), String(consolidated.bill._id));
  const billVerify = await invoke(verifyHotelPayment, orderRequest(staffAVerifier, { paymentId: billQr.body.data.payment.paymentId, amount: 50, transactionId: `BANK-BILL-${suffix}` }));
  assert.equal(billVerify.statusCode, 200);
  const settledBill = await Bill.findById(consolidated.bill._id).lean();
  assert.equal(settledBill.status, "PAID");
  assert.equal(settledBill.paidAmount, 50);
  assert.deepEqual(await deriveBillReconciliation(settledBill), { expectedAmount: 50, receivedAmount: 50, difference: 0, reconciliationStatus: "MATCHED" });
  assert.deepEqual((await Order.find({ _id: { $in: [splitOrderA._id, splitOrderB._id] } }).select("paymentStatus").sort({ orderNumber: 1 }).lean()).map((row) => row.paymentStatus), ["PAID", "PAID"]);
  assert.ok((await buildBillReceiptBuffer(settledBill)).length > 0, "Settled bill must have a receipt");
  const dashboardAfterBill = await invoke(dashboardStats, orderRequest({ _id: new mongoose.Types.ObjectId(), role: "admin", hotelId: hotelA, restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true }));
  assert.equal(dashboardAfterBill.body.data.totalRevenue.value, 150, "Dashboard revenue must count invoice and settled bill exactly once");
  const hotelWideOrder = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "HOTEL-WIDE", total: 40 });
  const hotelWideQr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: hotelWideOrder._id }));
  assert.equal(hotelWideQr.statusCode, 201);
  const hotelWideVerify = await invoke(verifyHotelPayment, orderRequest(hotelWideVerifier, { paymentId: hotelWideQr.body.data.payment.paymentId, amount: 40, transactionId: `BANK-HOTEL-WIDE-${suffix}` }));
  assert.equal(hotelWideVerify.statusCode, 200, "Hotel-wide verifier with an authorized active outlet can verify that outlet payment");
  const duplicate = await invoke(verifyHotelPayment, orderRequest(staffAVerifier, { paymentId, amount: 60, transactionId: `BANK-A-DUP-${suffix}` }));
  assert.equal(duplicate.statusCode, 409, "Duplicate approval must be rejected");

  const paidAlready = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "PAID", total: 50, paymentStatus: "PAID" });
  const paidQr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: paidAlready._id }));
  assert.equal(paidQr.statusCode, 409, "Already-paid order cannot receive a QR");

  const expiredOrder = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "EXPIRE", total: 75 });
  const expiredQr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: expiredOrder._id }));
  assert.equal(expiredQr.statusCode, 201);
  const expiredPaymentId = expiredQr.body.data.payment.paymentId;
  await Payment.collection.updateOne({ paymentId: expiredPaymentId }, { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } });
  const regenerated = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: expiredOrder._id }));
  assert.equal(regenerated.statusCode, 201, "Expired QR can be regenerated");
  assert.notEqual(regenerated.body.data.payment.paymentId, expiredPaymentId);
  assert.equal((await Payment.findOne({ paymentId: expiredPaymentId }).lean()).paymentStatus, "FAILED");

  const rejectedOrder = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "REJECT", total: 80 });
  const rejectedQr = await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: rejectedOrder._id }));
  const rejection = await invoke(rejectHotelPayment, orderRequest(staffA, { paymentId: rejectedQr.body.data.payment.paymentId, note: "No matching bank transaction" }));
  assert.equal(rejection.statusCode, 200);
  const rejectedPayment = await Payment.findOne({ paymentId: rejectedQr.body.data.payment.paymentId }).lean();
  assert.equal(rejectedPayment.paymentStatus, "PENDING");
  assert.equal(rejectedPayment.metadata.rejectionNote, "No matching bank transaction");
  assert.equal((await invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: rejectedOrder._id }))).statusCode, 201, "Rejected payment can be retried with a new QR");

  const concurrentOrder = await makeOrder({ restaurant: restaurantA, outlet: outletA, number: "RACE", total: 90 });
  const concurrentQrResults = await Promise.all([
    invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: concurrentOrder._id })),
    invoke(createHotelPaymentQr, orderRequest(staffA, { orderId: concurrentOrder._id })),
  ]);
  assert.deepEqual(concurrentQrResults.map((result) => result.statusCode).sort((a, b) => a - b), [200, 201], "Concurrent QR generation must reuse one active attempt");
  assert.equal(await Payment.countDocuments({ orderId: concurrentOrder._id, provider: "HOTEL_UPI", paymentStatus: "AWAITING_VERIFICATION" }), 1, "Only one active QR attempt may exist");
  const concurrentQr = concurrentQrResults.find((result) => result.body?.data?.payment)?.body?.data;
  const concurrentPaymentId = concurrentQr.payment.paymentId;
  const concurrentResults = await Promise.all([
    invoke(verifyHotelPayment, orderRequest(staffAVerifier, { paymentId: concurrentPaymentId, amount: 90, transactionId: `RACE-1-${suffix}` })),
    invoke(verifyHotelPayment, orderRequest(staffAVerifier, { paymentId: concurrentPaymentId, amount: 90, transactionId: `RACE-2-${suffix}` })),
  ]);
  assert.deepEqual(concurrentResults.map((result) => result.statusCode).sort((a, b) => a - b), [200, 409], "Concurrent approval must settle exactly once");

  console.log("hotelPaymentPhase1.local.test.mjs passed: hotel scoping, independent cashier verification, exact outstanding amounts, QR expiry/regeneration, manual approval/rejection, duplicate/concurrent guards, and unpaid boundary");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Payment.deleteMany({ _id: { $in: created.payments } }),
      Invoice.deleteMany({ _id: { $in: created.invoices } }),
      Bill.deleteMany({ _id: { $in: created.bills } }),
      Order.deleteMany({ _id: { $in: created.orders } }),
      HotelPaymentSettings.deleteMany({ _id: { $in: created.settings } }),
      Food.deleteMany({ _id: { $in: created.foods } }),
      Category.deleteMany({ _id: { $in: created.categories } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
