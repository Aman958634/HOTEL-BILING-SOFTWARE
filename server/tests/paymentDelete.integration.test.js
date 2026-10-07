import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../app.js";
import Bill from "../models/Bill.js";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Log from "../models/Log.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Refund from "../models/Refund.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
process.env.JWT_ACCESS_SECRET ||= "payment-delete-test-secret";
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const suffix = `payment-delete-${Date.now()}`;
const ids = { restaurants: [], outlets: [], users: [], orders: [], payments: [], bills: [], categories: [], foods: [], refunds: [], settlements: [] };

const createTenant = async (label, role = "admin") => {
  const restaurant = await Restaurant.create({ name: `${label} ${suffix}`, slug: `${label.toLowerCase()}-${suffix}`, branchCode: `${label.slice(0, 3).toUpperCase()}-${suffix.slice(-8)}`, address: "Local test" });
  const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main", code: `${label.slice(0, 5)}-${suffix.slice(-8)}`, isDefault: true });
  const user = await User.create({ fullName: `${label} ${role}`, email: `${label}-${role}-${suffix}@test.invalid`, password: "local-test-password", role, restaurant: restaurant._id, defaultOutlet: outlet._id, allOutletsAccess: false, outletAccess: [{ outlet: outlet._id, isActive: true }] });
  const category = await Category.create({ restaurant: restaurant._id, name: "Local", slug: `local-${suffix}` });
  const food = await Food.create({ restaurant: restaurant._id, category: category._id, name: "Local item", price: 500 });
  await Subscription.create({ restaurant: restaurant._id, planName: "test", status: "active", price: 0 });
  ids.restaurants.push(restaurant._id); ids.outlets.push(outlet._id); ids.users.push(user._id); ids.categories.push(category._id); ids.foods.push(food._id);
  return { restaurant, outlet, user, food };
};

const primary = await createTenant("Payment Primary");
const waiter = await createTenant("Payment Waiter", "waiter");
const other = await createTenant("Payment Other");
const token = (user) => jwt.sign({ id: String(user._id), role: user.role, restaurant: String(user.restaurant) }, process.env.JWT_ACCESS_SECRET, { algorithm: "HS256" });
const request = (path, { method = "GET", user = primary.user, outlet = primary.outlet } = {}) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token(user)}`, "X-Outlet-Id": String(outlet._id) } });
const createOrder = async ({ total = 500, tenant = primary, status = "COMPLETED" } = {}) => {
  const order = await Order.create({ restaurant: tenant.restaurant._id, outlet: tenant.outlet._id, orderNumber: `ORD-${suffix}-${ids.orders.length + 1}`, orderType: "TAKEAWAY", status, paymentMethod: "CASH", paymentStatus: "PAID", items: [{ menuItem: tenant.food._id, name: "Local item", price: total, quantity: 1, subtotal: total }], subtotal: total, total });
  ids.orders.push(order._id);
  return order;
};
const createPayment = async ({ order = null, bill = null, tenant = primary, amount = 500, paymentMethod = "CASH", paymentStatus = "PAID", reconciliationStatus = "UNRECONCILED", refundAmount = 0, refundStatus = null, gateway = "Cash", provider = "" } = {}) => {
  const payment = await Payment.create({ paymentId: `PAY-${suffix}-${ids.payments.length + 1}`, orderId: order?._id || null, bill: bill?._id || null, restaurant: tenant.restaurant._id, outlet: tenant.outlet._id, amount, totalAmount: amount, paymentMethod, paymentStatus, reconciliationStatus, refundAmount, refundStatus, gateway, provider, transactionId: `LOCAL-${suffix}-${ids.payments.length + 1}`, paidAt: paymentStatus === "PAID" ? new Date() : null });
  ids.payments.push(payment._id);
  return payment;
};

try {
  const committedBefore = Number((await mongoose.connection.db.admin().serverStatus()).transactions?.totalCommitted || 0);
  const fullOrder = await createOrder();
  const fullCash = await createPayment({ order: fullOrder });
  const deleted = await request(`/payments/${fullCash._id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200, "authorized cash deletion must succeed");
  assert.equal(await Payment.exists({ _id: fullCash._id }), null);
  const reverted = await Order.findById(fullOrder._id).lean();
  assert.equal(reverted.paymentStatus, "PENDING");
  assert.equal(reverted.status, "PENDING");
  assert.equal(reverted.paymentId, "", "deleted payment references must not remain on the order");
  assert.equal(reverted.transactionId, "", "deleted transaction references must not remain on the order");
  assert.ok(Number((await mongoose.connection.db.admin().serverStatus()).transactions?.totalCommitted || 0) > committedBefore, "delete must commit a transaction");
  assert.equal(await Log.countDocuments({ message: "PAYMENT_DELETED", "context.paymentId": fullCash.paymentId }), 1);
  assert.equal((await request(`/payments/${fullCash._id}`, { method: "DELETE" })).status, 404, "double delete must not succeed");

  const partialOrder = await createOrder();
  await createPayment({ order: partialOrder, amount: 200 });
  const finalCash = await createPayment({ order: partialOrder, amount: 300 });
  assert.equal((await request(`/payments/${finalCash._id}`, { method: "DELETE" })).status, 200);
  const partial = await Order.findById(partialOrder._id).lean();
  assert.equal(partial.paymentStatus, "PENDING", "partial collection maps to the existing compatible pending status");

  const billOrder = await createOrder({ status: "PENDING" });
  const bill = await Bill.create({ billNumber: `BILL-${suffix}`, restaurant: primary.restaurant._id, outlet: primary.outlet._id, allocations: [{ order: billOrder._id, orderNumber: billOrder.orderNumber, subtotal: 500, total: 500 }], subtotal: 500, total: 500, paidAmount: 500, balanceDue: 0, status: "PAID", createdBy: primary.user._id, settledBy: primary.user._id, settledAt: new Date() });
  ids.bills.push(bill._id);
  await Order.updateOne({ _id: billOrder._id }, { $set: { billingBill: bill._id, billingState: "SETTLED", paymentStatus: "PAID" } });
  const billCash = await createPayment({ bill, amount: 500 });
  assert.equal((await request(`/payments/${billCash._id}`, { method: "DELETE" })).status, 200);
  const reopenedBill = await Bill.findById(bill._id).lean();
  assert.deepEqual({ status: reopenedBill.status, paidAmount: reopenedBill.paidAmount, balanceDue: reopenedBill.balanceDue }, { status: "OPEN", paidAmount: 0, balanceDue: 500 });
  assert.equal((await Order.findById(billOrder._id).lean()).billingState, "BILLED");

  const digital = await createPayment({ order: await createOrder(), paymentMethod: "UPI", gateway: "Razorpay", provider: "razorpay" });
  assert.equal((await request(`/payments/${digital._id}`, { method: "DELETE" })).status, 409, "external digital settlement must be retained");
  const refunded = await createPayment({ order: await createOrder(), refundAmount: 100, refundStatus: "PARTIALLY_REFUNDED", paymentStatus: "PARTIALLY_REFUNDED" });
  assert.equal((await request(`/payments/${refunded._id}`, { method: "DELETE" })).status, 409, "refund history must be retained");
  const reconciled = await createPayment({ order: await createOrder(), reconciliationStatus: "RECONCILED" });
  assert.equal((await request(`/payments/${reconciled._id}`, { method: "DELETE" })).status, 409, "reconciled records must be retained");
  const refundedByRecord = await createPayment({ order: await createOrder() });
  ids.refunds.push((await Refund.create({ payment: refundedByRecord._id, restaurant: primary.restaurant._id, amount: 1, reason: "Local refund record", method: "CASH", initiatedBy: primary.user._id }))._id);
  assert.equal((await request(`/payments/${refundedByRecord._id}`, { method: "DELETE" })).status, 409, "refund records must be retained even if summary fields are stale");
  const splitOrder = await createOrder();
  const splitPayment = await createPayment({ order: splitOrder });
  ids.settlements.push((await SettlementTransaction.create({ restaurant: primary.restaurant._id, outlet: primary.outlet._id, order: splitOrder._id, payment: splitPayment._id, providerVendorId: "local-vendor", cashfreeOrderId: `CF-${suffix}`, grossAmountPaise: 50000, vendorSharePaise: 50000, platformSharePaise: 0, commissionType: "NONE", providerIdempotencyKey: `split-${suffix}` }))._id);
  assert.equal((await request(`/payments/${splitPayment._id}`, { method: "DELETE" })).status, 409, "provider split records must be retained");
  const otherPayment = await createPayment({ order: await createOrder({ tenant: other }), tenant: other });
  assert.equal((await request(`/payments/${otherPayment._id}`, { method: "DELETE" })).status, 404, "cross-tenant deletion must be blocked");
  const forbiddenPayment = await createPayment({ order: await createOrder() });
  assert.equal((await request(`/payments/${forbiddenPayment._id}`, { method: "DELETE", user: waiter.user, outlet: waiter.outlet })).status, 403, "users without payment authority must be blocked");
  const rollbackOrder = await createOrder();
  const rollbackPayment = await createPayment({ order: rollbackOrder });
  await Food.deleteOne({ _id: primary.food._id });
  assert.equal((await request(`/payments/${rollbackPayment._id}`, { method: "DELETE" })).status, 422, "a dependent write failure must abort the delete");
  assert.notEqual(await Payment.exists({ _id: rollbackPayment._id }), null, "a failed transaction must retain its payment record");
  console.log("Payment delete integration checks passed.");
} finally {
  await server.close();
  await Log.deleteMany({ message: "PAYMENT_DELETED", "context.paymentId": { $regex: suffix } });
  await Payment.deleteMany({ _id: { $in: ids.payments } });
  await Refund.deleteMany({ _id: { $in: ids.refunds } });
  await SettlementTransaction.deleteMany({ _id: { $in: ids.settlements } });
  await Bill.deleteMany({ _id: { $in: ids.bills } });
  await Order.deleteMany({ _id: { $in: ids.orders } });
  await Food.deleteMany({ _id: { $in: ids.foods } });
  await Category.deleteMany({ _id: { $in: ids.categories } });
  await Subscription.deleteMany({ restaurant: { $in: ids.restaurants } });
  await User.deleteMany({ _id: { $in: ids.users } });
  await Outlet.deleteMany({ _id: { $in: ids.outlets } });
  await Restaurant.deleteMany({ _id: { $in: ids.restaurants } });
  await mongoose.disconnect();
}
