import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../app.js";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import KotTicket from "../models/KotTicket.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
process.env.JWT_ACCESS_SECRET ||= "order-update-persistence-test-secret";
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const suffix = `order-update-${Date.now()}`;
const restaurant = await Restaurant.create({ name: `Order Update ${suffix}`, slug: `order-update-${suffix}`, branchCode: `OU-${suffix.slice(-8)}`, address: "Test", gstRate: 5 });
const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main", code: `OU-${suffix}`, isDefault: true });
const user = await User.create({ fullName: "Order Update Admin", email: `${suffix}@test.invalid`, password: "release-test-password", role: "admin", restaurant: restaurant._id, defaultOutlet: outlet._id, allOutletsAccess: true, outletAccess: [{ outlet: outlet._id, isActive: true }] });
await Subscription.create({ restaurant: restaurant._id, planName: "test", status: "active", price: 0 });
const category = await Category.create({ restaurant: restaurant._id, name: `Order Update Category ${suffix}`, slug: `order-update-category-${suffix}` });
const [pizza, pasta] = await Food.create([
  { restaurant: restaurant._id, category: category._id, name: `Pizza ${suffix}`, price: 100, isAvailable: true, available: true },
  { restaurant: restaurant._id, category: category._id, name: `Pasta ${suffix}`, price: 120, isAvailable: true, available: true },
]);
const [tableOne, tableTwo] = await Table.create([
  { restaurant: restaurant._id, outlet: outlet._id, tableNumber: `O1-${suffix}`, capacity: 4, floor: "1", section: "Main" },
  { restaurant: restaurant._id, outlet: outlet._id, tableNumber: `O2-${suffix}`, capacity: 4, floor: "1", section: "Main" },
]);
const token = jwt.sign({ id: String(user._id), role: user.role, restaurant: String(restaurant._id) }, process.env.JWT_ACCESS_SECRET, { algorithm: "HS256" });
const request = (path, { method = "GET", body } = {}) => fetch(`${base}${path}`, {
  method,
  headers: { Authorization: `Bearer ${token}`, "X-Outlet-Id": String(outlet._id), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

try {
  const created = await request("/orders/", {
    method: "POST",
    body: { orderType: "DINE_IN", table: String(tableOne._id), items: [{ menuItem: String(pizza._id), quantity: 1 }], notes: "No onion", paymentMethod: "CASH" },
  });
  assert.equal(created.status, 201);
  const orderId = (await created.json()).data._id;
  const kotBeforeUpdate = JSON.parse(JSON.stringify(await KotTicket.findOne({ orderId }).lean()));
  assert.ok(kotBeforeUpdate, "Normal order creation must create its KOT");
  assert.equal(kotBeforeUpdate.status, "NEW");
  assert.equal(kotBeforeUpdate.items.length, 1);
  assert.equal(kotBeforeUpdate.items[0].status, "NEW");

  const updated = await request(`/orders/${orderId}`, {
    method: "PUT",
    body: {
      orderType: "DINE_IN",
      table: String(tableTwo._id),
      // A manipulated client price must be ignored in favor of the menu price.
      items: [{ menuItem: String(pasta._id), quantity: 3, price: 0 }],
      notes: "Extra cheese",
      discount: 0,
      serviceChargePercent: 5,
    },
  });
  assert.equal(updated.status, 200);
  const canonical = (await updated.json()).data;
  assert.equal(String(canonical.table._id), String(tableTwo._id));
  assert.equal(canonical.notes, "Extra cheese");
  assert.equal(canonical.items.length, 1);
  assert.equal(String(canonical.items[0].menuItem._id), String(pasta._id));
  assert.equal(canonical.items[0].quantity, 3);
  assert.equal(canonical.items[0].price, 120);
  assert.equal(canonical.subtotal, 360);
  assert.equal(canonical.tax, 18);
  assert.equal(canonical.serviceCharge, 18);
  assert.equal(canonical.total, 396);

  const reloaded = await request(`/orders/${orderId}`);
  assert.equal(reloaded.status, 200);
  const persisted = (await reloaded.json()).data;
  assert.equal(String(persisted.table._id), String(tableTwo._id));
  assert.equal(persisted.notes, "Extra cheese");
  assert.equal(persisted.items[0].quantity, 3);
  assert.equal(persisted.subtotal, 360);
  assert.equal(persisted.total, 396);

  assert.equal(await Order.countDocuments({ restaurant: restaurant._id }), 1);
  assert.equal(await Payment.countDocuments({ orderId }), 0);
  assert.equal(await KotTicket.countDocuments({ orderId }), 1);
  const persistedDocument = await Order.findById(orderId).lean();
  const persistedKot = await KotTicket.findOne({ orderId }).lean();
  assert.equal(persistedDocument.paymentStatus, "PENDING");
  assert.equal(persistedDocument.kitchenStatus, "PENDING");
  assert.equal(persistedKot.status, "NEW");
  assert.equal(persistedKot.items.length, 1);
  assert.equal(persistedKot.items[0].status, "NEW");
  assert.deepEqual(
    JSON.parse(JSON.stringify(persistedKot)),
    kotBeforeUpdate,
    "Updating an order must leave the existing KOT byte-for-byte unchanged"
  );

  await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: "PAID" } });
  const blocked = await request(`/orders/${orderId}`, { method: "PUT", body: { items: [{ menuItem: String(pasta._id), quantity: 4 }] } });
  assert.equal(blocked.status, 409);
  assert.equal((await Order.findById(orderId).lean()).items[0].quantity, 3);
  console.log("Order update persistence integration test passed.");
} finally {
  await server.close();
  await KotTicket.deleteMany({ restaurant: restaurant._id });
  await Payment.deleteMany({ restaurant: restaurant._id });
  await Order.deleteMany({ restaurant: restaurant._id });
  await Table.deleteMany({ restaurant: restaurant._id });
  await Food.deleteMany({ restaurant: restaurant._id });
  await Category.deleteOne({ _id: category._id });
  await Subscription.deleteMany({ restaurant: restaurant._id });
  await User.deleteOne({ _id: user._id });
  await Outlet.deleteOne({ _id: outlet._id });
  await Restaurant.deleteOne({ _id: restaurant._id });
  await mongoose.disconnect();
}