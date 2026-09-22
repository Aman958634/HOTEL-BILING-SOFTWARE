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
import KotTicket from "../models/KotTicket.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
process.env.JWT_ACCESS_SECRET ||= "kds-lifecycle-test-secret";
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const suffix = `kds-${Date.now()}`;
const createdRestaurantIds = [];

const createTenant = async ({ name, outletCode }) => {
  const restaurant = await Restaurant.create({ name, slug: `${outletCode.toLowerCase()}-${suffix}`, branchCode: `${outletCode}-${suffix.slice(-8)}`, address: "Test" });
  const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main", code: `${outletCode}-${suffix}`, isDefault: true });
  const user = await User.create({
    fullName: `${name} Admin`, email: `${outletCode}-${suffix}@test.invalid`, password: "release-test-password", role: "admin",
    restaurant: restaurant._id, defaultOutlet: outlet._id, allOutletsAccess: false, outletAccess: [{ outlet: outlet._id, isActive: true }],
  });
  await Subscription.create({ restaurant: restaurant._id, planName: "test", status: "active", price: 0 });
  createdRestaurantIds.push(restaurant._id);
  return { restaurant, outlet, user };
};

const primary = await createTenant({ name: "KDS Primary", outletCode: "KDSP" });
const secondOutlet = await Outlet.create({ restaurant: primary.restaurant._id, name: "Other", code: `KDSO-${suffix}` });
const otherOutletUser = await User.create({
  fullName: "KDS Other Outlet Admin", email: `kdso-${suffix}@test.invalid`, password: "release-test-password", role: "admin",
  restaurant: primary.restaurant._id, defaultOutlet: secondOutlet._id, allOutletsAccess: false, outletAccess: [{ outlet: secondOutlet._id, isActive: true }],
});
const otherTenant = await createTenant({ name: "KDS Other Tenant", outletCode: "KDSX" });
const category = await Category.create({ restaurant: primary.restaurant._id, name: `KDS Category ${suffix}`, slug: `kds-category-${suffix}` });
const food = await Food.create({ restaurant: primary.restaurant._id, category: category._id, name: `KDS Item ${suffix}`, price: 100, isAvailable: true, available: true });
const table = await Table.create({ restaurant: primary.restaurant._id, outlet: primary.outlet._id, tableNumber: `K-${suffix}`, capacity: 4, floor: "1", section: "Main" });

const tokenFor = (user) => jwt.sign({ id: String(user._id), role: user.role, restaurant: String(user.restaurant) }, process.env.JWT_ACCESS_SECRET, { algorithm: "HS256" });
const request = async (path, { method = "GET", user = primary.user, outlet = primary.outlet, body, idempotencyKey } = {}) => {
  const headers = { Authorization: `Bearer ${tokenFor(user)}`, "X-Outlet-Id": String(outlet._id) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
};
const transactionCount = async () => Number((await mongoose.connection.db.admin().serverStatus()).transactions?.totalCommitted || 0);
const assertPersisted = async (orderId, { itemStatus, kitchenStatus, orderStatus, kotStatus }) => {
  const [order, kot] = await Promise.all([Order.findById(orderId).lean(), KotTicket.findOne({ orderId }).lean()]);
  assert.ok(order);
  assert.ok(kot);
  assert.equal(String(order.restaurant), String(primary.restaurant._id));
  assert.equal(String(order.outlet), String(primary.outlet._id));
  assert.equal(order.items[0].kitchenStatus, itemStatus);
  assert.equal(order.kitchenStatus, kitchenStatus);
  assert.equal(order.status, orderStatus);
  assert.equal(String(kot.restaurant), String(primary.restaurant._id));
  assert.equal(String(kot.outlet), String(primary.outlet._id));
  assert.equal(kot.status, kotStatus);
};

try {
  const created = await request("/orders/", {
    method: "POST",
    idempotencyKey: `kds-order-${suffix}`,
    body: { orderType: "DINE_IN", orderSource: "DINE_IN", table: String(table._id), items: [{ menuItem: String(food._id), quantity: 1 }], notes: suffix, paymentMethod: "CASH" },
  });
  assert.equal(created.status, 201);
  const orderId = (await created.json()).data._id;

  const tickets = await request("/kitchen/tickets");
  assert.equal(tickets.status, 200);
  const initialTicket = (await tickets.json()).data.find((ticket) => String(ticket.orderId) === String(orderId));
  assert.ok(initialTicket);
  assert.equal(initialTicket.kotStatus, "NEW");
  assert.equal(initialTicket.kitchenPhase, "NEW");
  assert.equal(String(initialTicket.restaurant), String(primary.restaurant._id));
  await assertPersisted(orderId, { itemStatus: "NEW", kitchenStatus: "PENDING", orderStatus: "PENDING", kotStatus: "NEW" });

  const invalid = await request(`/kitchen/tickets/${orderId}/items/0`, { method: "PATCH", body: { kitchenStatus: "READY" } });
  assert.equal(invalid.status, 409);

  const beforeTransactions = await transactionCount();
  const started = await request(`/kitchen/tickets/${orderId}/start`, { method: "PATCH" });
  assert.equal(started.status, 200);
  const startTicket = (await started.json()).data;
  assert.equal(startTicket.kotStatus, "PREPARING");
  assert.equal(startTicket.kitchenStatus, "PREPARING");
  assert.ok(await transactionCount() > beforeTransactions, "KDS start must commit a MongoDB transaction");
  await assertPersisted(orderId, { itemStatus: "PREPARING", kitchenStatus: "PREPARING", orderStatus: "PREPARING", kotStatus: "PREPARING" });

  const duplicateStart = await request(`/kitchen/tickets/${orderId}/start`, { method: "PATCH" });
  assert.equal(duplicateStart.status, 409);
  assert.equal(await KotTicket.countDocuments({ orderId }), 1);

  const ready = await request(`/kitchen/tickets/${orderId}/ready`, { method: "PATCH" });
  assert.equal(ready.status, 200);
  const readyTicket = (await ready.json()).data;
  assert.equal(readyTicket.kotStatus, "READY");
  assert.equal(readyTicket.kitchenStatus, "READY");
  await assertPersisted(orderId, { itemStatus: "READY", kitchenStatus: "READY", orderStatus: "READY", kotStatus: "READY" });

  const crossTenant = await request(`/kitchen/tickets/${orderId}/serve`, { method: "PATCH", user: otherTenant.user, outlet: otherTenant.outlet });
  assert.equal(crossTenant.status, 404);
  const crossOutlet = await request(`/kitchen/tickets/${orderId}/serve`, { method: "PATCH", user: otherOutletUser, outlet: secondOutlet });
  assert.equal(crossOutlet.status, 404);

  const served = await request(`/kitchen/tickets/${orderId}/serve`, { method: "PATCH" });
  assert.equal(served.status, 200);
  const servedTicket = (await served.json()).data;
  assert.equal(servedTicket.kotStatus, "SERVED");
  assert.equal(servedTicket.kitchenPhase, "COMPLETED");
  assert.equal(servedTicket.kitchenStatus, "COMPLETED");
  await assertPersisted(orderId, { itemStatus: "SERVED", kitchenStatus: "COMPLETED", orderStatus: "SERVED", kotStatus: "SERVED" });

  const duplicateServe = await request(`/kitchen/tickets/${orderId}/serve`, { method: "PATCH" });
  assert.equal(duplicateServe.status, 409);
  assert.equal(await KotTicket.countDocuments({ orderId }), 1);
  const terminalInvalid = await request(`/kitchen/tickets/${orderId}/items/0`, { method: "PATCH", body: { kitchenStatus: "READY" } });
  assert.equal(terminalInvalid.status, 409);
  console.log("KDS lifecycle integration test passed (NEW → PREPARING → READY → COMPLETED aggregate state).");
} finally {
  await server.close();
  await KotTicket.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await Order.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await Table.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await Food.deleteOne({ _id: food._id });
  await Category.deleteOne({ _id: category._id });
  await Subscription.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await User.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await Outlet.deleteMany({ restaurant: { $in: createdRestaurantIds } });
  await Restaurant.deleteMany({ _id: { $in: createdRestaurantIds } });
  await mongoose.disconnect();
}
