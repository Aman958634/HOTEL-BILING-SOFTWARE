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
import Table from "../models/Table.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
process.env.JWT_ACCESS_SECRET ||= "table-http-test-secret";
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
const suffix = `http-${Date.now()}`;
const restaurantA = await Restaurant.create({ name: `Table HTTP A ${suffix}`, slug: `table-http-a-${suffix}`, branchCode: `THA-${suffix.slice(-8)}`, address: "Test" });
const restaurantB = await Restaurant.create({ name: `Table HTTP B ${suffix}`, slug: `table-http-b-${suffix}`, branchCode: `THB-${suffix.slice(-8)}`, address: "Test" });
const outletA = await Outlet.create({ restaurant: restaurantA._id, name: "A", code: `A-${suffix}`, isDefault: true });
const outletB = await Outlet.create({ restaurant: restaurantA._id, name: "B", code: `B-${suffix}` });
const outletOther = await Outlet.create({ restaurant: restaurantB._id, name: "Other", code: `O-${suffix}`, isDefault: true });
const user = await User.create({ fullName: "Table HTTP User", email: `${suffix}@test.invalid`, password: "release-test-password", role: "admin", restaurant: restaurantA._id, defaultOutlet: outletA._id, outletAccess: [{ outlet: outletA._id, isActive: true }] });
await Subscription.create({ restaurant: restaurantA._id, planName: "test", status: "active", price: 0 });
const tableB = await Table.create({ restaurant: restaurantA._id, outlet: outletB._id, tableNumber: `B-${suffix}`, capacity: 4, floor: "1", section: "B" });
const tableOther = await Table.create({ restaurant: restaurantB._id, outlet: outletOther._id, tableNumber: `O-${suffix}`, capacity: 4, floor: "1", section: "O" });
const token = jwt.sign({ id: String(user._id), role: "admin", restaurant: String(restaurantA._id) }, process.env.JWT_ACCESS_SECRET, { algorithm: "HS256" });

try {
  const wrongOutlet = await fetch(`${base}/tables/${tableB._id}`, { headers: { Authorization: `Bearer ${token}`, "X-Outlet-Id": String(outletA._id) } });
  assert.equal(wrongOutlet.status, 404);
  assert.equal((await Table.findById(tableB._id)).status, "AVAILABLE");

  const wrongTenant = await fetch(`${base}/tables/${tableOther._id}`, { headers: { Authorization: `Bearer ${token}`, "X-Outlet-Id": String(outletA._id) } });
  assert.equal(wrongTenant.status, 404);
  assert.equal((await Table.findById(tableOther._id)).status, "AVAILABLE");
  console.log("Authenticated table outlet/tenant HTTP security tests passed.");
} finally {
  await server.close();
  await Table.deleteMany({ _id: { $in: [tableB._id, tableOther._id] } });
  await Subscription.deleteMany({ restaurant: { $in: [restaurantA._id, restaurantB._id] } });
  await User.deleteOne({ _id: user._id });
  await Outlet.deleteMany({ _id: { $in: [outletA._id, outletB._id, outletOther._id] } });
  await Restaurant.deleteMany({ _id: { $in: [restaurantA._id, restaurantB._id] } });
  await mongoose.disconnect();
}
