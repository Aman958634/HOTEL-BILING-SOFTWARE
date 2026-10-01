import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../app.js";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
process.env.JWT_ACCESS_SECRET ||= "order-creation-payment-integrity-test-secret";

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
const created = { restaurant: null, outlet: null, user: null, category: null, food: null, subscription: null, orders: [] };

const request = (path, { method = "GET", body, idempotencyKey } = {}) => {
  const token = jwt.sign(
    { id: String(created.user._id), role: created.user.role, restaurant: String(created.restaurant._id) },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: "HS256" }
  );
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Outlet-Id": String(created.outlet._id),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
};

const createOrder = async ({ paymentMethod, paymentStatus }) => {
  const response = await request("/orders/", {
    method: "POST",
    idempotencyKey: `new-order-${paymentMethod}-${paymentStatus}-${suffix}`,
    body: {
      orderType: "TAKEAWAY",
      items: [{ menuItem: String(created.food._id), quantity: 1 }],
      paymentMethod,
      paymentStatus,
    },
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  const order = payload.data;
  created.orders.push(order._id);
  assert.equal(order.paymentStatus, "PENDING", `create must ignore client ${paymentStatus}`);
  assert.equal(order.paymentMethod, paymentMethod);
  const persisted = await Order.findById(order._id).lean();
  assert.equal(persisted.paymentStatus, "PENDING");
  assert.equal(await Payment.countDocuments({ orderId: order._id }), 0, "creation must not write a settlement record");
  return order;
};

try {
  created.restaurant = await Restaurant.create({ name: `Order payment integrity ${suffix}`, slug: `order-payment-integrity-${suffix}`, branchCode: `OPI${suffix}`, address: "Local test" });
  created.outlet = await Outlet.create({ restaurant: created.restaurant._id, name: "Main", code: `OPI${suffix}`, isDefault: true });
  created.user = await User.create({
    fullName: "Payment Integrity Cashier",
    email: `order-payment-integrity-${suffix}@test.invalid`,
    password: "OrderPaymentIntegrity!23",
    role: "cashier",
    restaurant: created.restaurant._id,
    defaultOutlet: created.outlet._id,
    allOutletsAccess: true,
  });
  created.subscription = await Subscription.create({ restaurant: created.restaurant._id, planName: "test", status: "active", price: 0 });
  created.category = await Category.create({ restaurant: created.restaurant._id, name: `Category ${suffix}`, slug: `category-${suffix}` });
  created.food = await Food.create({ restaurant: created.restaurant._id, category: created.category._id, name: `Item ${suffix}`, price: 125, isAvailable: true, available: true });

  await createOrder({ paymentMethod: "CASH", paymentStatus: "PAID" });
  await createOrder({ paymentMethod: "CREDIT_CARD", paymentStatus: "PAID" });
  await createOrder({ paymentMethod: "UPI", paymentStatus: "PAID" });
  await createOrder({ paymentMethod: "CASH", paymentStatus: "SUCCESS" });
  const cashOrder = await createOrder({ paymentMethod: "CASH", paymentStatus: "FAILED" });

  const settled = await request(`/orders/${cashOrder._id}/pay`, {
    method: "POST",
    idempotencyKey: `cash-settlement-${suffix}`,
    body: {
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      transactionId: `CASH-${suffix}`,
    },
  });
  assert.equal(settled.status, 200, "the existing authorized cash settlement path remains available");
  const settledPayload = await settled.json();
  assert.equal(settledPayload.data.paymentStatus, "PAID");
  assert.equal(await Payment.countDocuments({ orderId: cashOrder._id, paymentStatus: "PAID" }), 1);

  console.log("orderCreationPaymentIntegrity.integration.test.js passed: creation is pending-only and authorized cash settlement remains available.");
} finally {
  await server.close();
  if (mongoose.connection.readyState === 1) {
    await Payment.deleteMany({ orderId: { $in: created.orders } });
    await Order.deleteMany({ _id: { $in: created.orders } });
    if (created.food) await Food.deleteOne({ _id: created.food._id });
    if (created.category) await Category.deleteOne({ _id: created.category._id });
    if (created.subscription) await Subscription.deleteOne({ _id: created.subscription._id });
    if (created.user) await User.deleteOne({ _id: created.user._id });
    if (created.outlet) await Outlet.deleteOne({ _id: created.outlet._id });
    if (created.restaurant) await Restaurant.deleteOne({ _id: created.restaurant._id });
    await mongoose.disconnect();
  }
}
