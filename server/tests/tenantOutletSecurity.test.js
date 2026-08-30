import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import Staff from "../models/Staff.js";
import { dashboardStats } from "../controllers/analyticsController.js";
import {
  deleteStaff,
  getActiveStaff,
  getStaffById,
  getStaffByRole,
  getStaffStats,
  listStaff,
  updateStaff,
  updateStaffStatus,
} from "../controllers/staffController.js";

const uri = process.env.TEST_MONGO_URI;
if (!uri) {
  console.log("Tenant/outlet controller security checks skipped: TEST_MONGO_URI is not configured.");
  process.exit(0);
}

const invoke = (handler, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ statusCode: this.statusCode, body }); },
  };
  handler(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});

const suffix = crypto.randomBytes(6).toString("hex");
const created = {
  restaurants: [], outlets: [], categories: [], foods: [], inventory: [], orders: [], staff: [],
};

const makeRequest = (user, { params = {}, query = {}, body = {} } = {}) => ({ user, params, query, body });

try {
  await mongoose.connect(uri);
  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Security A ${suffix}`, slug: `security-a-${suffix}`, branchCode: `SA${suffix}`, address: "Test" }),
    Restaurant.create({ name: `Security B ${suffix}`, slug: `security-b-${suffix}`, branchCode: `SB${suffix}`, address: "Test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [outletA, outletB] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "Main", code: "MAIN", isDefault: true }),
    Outlet.create({ restaurant: restaurantB._id, name: "Main", code: "MAIN", isDefault: true }),
  ]);
  created.outlets.push(outletA._id, outletB._id);

  const [categoryA, categoryB] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: "Security", slug: `security-a-${suffix}` }),
    Category.create({ restaurant: restaurantB._id, name: "Security", slug: `security-b-${suffix}` }),
  ]);
  created.categories.push(categoryA._id, categoryB._id);

  const [foodA, foodB] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: categoryA._id, name: `Food A ${suffix}`, price: 100 }),
    Food.create({ restaurant: restaurantB._id, category: categoryB._id, name: `Food B ${suffix}`, price: 900 }),
  ]);
  created.foods.push(foodA._id, foodB._id);

  const [inventoryA, inventoryB] = await Promise.all([
    Inventory.create({ restaurant: restaurantA._id, outlet: outletA._id, itemName: "A stock", sku: `A-${suffix}`, quantity: 10 }),
    Inventory.create({ restaurant: restaurantB._id, outlet: outletB._id, itemName: "B stock", sku: `B-${suffix}`, quantity: 10 }),
  ]);
  created.inventory.push(inventoryA._id, inventoryB._id);

  const [orderA, orderB] = await Promise.all([
    Order.create({ orderNumber: `SEC-A-${suffix}`, restaurant: restaurantA._id, outlet: outletA._id, orderType: "TAKEAWAY", items: [{ menuItem: foodA._id, name: foodA.name, price: 100, quantity: 1, subtotal: 100 }], subtotal: 100, total: 100, paymentStatus: "PAID" }),
    Order.create({ orderNumber: `SEC-B-${suffix}`, restaurant: restaurantB._id, outlet: outletB._id, orderType: "TAKEAWAY", items: [{ menuItem: foodB._id, name: foodB.name, price: 900, quantity: 1, subtotal: 900 }], subtotal: 900, total: 900, paymentStatus: "PAID" }),
  ]);
  created.orders.push(orderA._id, orderB._id);

  const [staffA, staffB] = await Promise.all([
    Staff.create({ employeeId: `SEC-A-${suffix}`, firstName: "Staff", lastName: "A", phone: `91${suffix.slice(0, 8)}`, role: "WAITER", department: "Service", joiningDate: new Date(), restaurant: restaurantA._id, outlet: outletA._id }),
    Staff.create({ employeeId: `SEC-B-${suffix}`, firstName: "Staff", lastName: "B", phone: `92${suffix.slice(0, 8)}`, role: "WAITER", department: "Service", joiningDate: new Date(), restaurant: restaurantB._id, outlet: outletB._id }),
  ]);
  created.staff.push(staffA._id, staffB._id);

  const adminA = {
    _id: new mongoose.Types.ObjectId(),
    role: "admin",
    restaurant: restaurantA._id,
    activeOutlet: outletA._id,
    defaultOutlet: outletA._id,
    allOutletsAccess: true,
    outletAccess: [],
  };

  const analytics = await invoke(dashboardStats, makeRequest(adminA));
  assert.equal(analytics.statusCode, 200);
  assert.equal(analytics.body.data.cards.orders, 1);
  assert.equal(analytics.body.data.cards.revenue, 100);
  assert.equal(analytics.body.data.cards.foods, 1);
  assert.equal(analytics.body.data.cards.inventory, 1);

  const list = await invoke(listStaff, makeRequest(adminA, { query: { page: 1, limit: 20, restaurantId: String(restaurantB._id) } }));
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.body.data.map((staff) => String(staff._id)), [String(staffA._id)]);

  const stats = await invoke(getStaffStats, makeRequest(adminA));
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.body.data.totalStaff, 1);
  assert.equal(stats.body.data.waiters, 1);

  const active = await invoke(getActiveStaff, makeRequest(adminA));
  assert.equal(active.statusCode, 200);
  assert.deepEqual(active.body.data.map((staff) => String(staff._id)), [String(staffA._id)]);

  const roleLookup = await invoke(getStaffByRole, makeRequest(adminA, { params: { role: "WAITER" } }));
  assert.equal(roleLookup.statusCode, 200);
  assert.deepEqual(roleLookup.body.data.map((staff) => String(staff._id)), [String(staffA._id)]);

  const ownStaff = await invoke(getStaffById, makeRequest(adminA, { params: { id: String(staffA._id) } }));
  assert.equal(ownStaff.statusCode, 200);

  for (const handler of [getStaffById, updateStaff, updateStaffStatus, deleteStaff]) {
    const result = await invoke(handler, makeRequest(adminA, {
      params: { id: String(staffB._id) },
      body: { firstName: "Forged", status: "INACTIVE", restaurant: restaurantB._id, outlet: outletB._id },
    }));
    assert.equal(result.statusCode, 404);
  }

  const staffBAfterAttacks = await Staff.findById(staffB._id).lean();
  assert.equal(staffBAfterAttacks.firstName, "Staff");
  assert.equal(staffBAfterAttacks.status, "ACTIVE");

  const forgedOutlet = { ...adminA, activeOutlet: outletB._id };
  const forgedOutletList = await invoke(listStaff, makeRequest(forgedOutlet, { query: { page: 1, limit: 20 } }));
  assert.equal(forgedOutletList.statusCode, 200);
  assert.equal(forgedOutletList.body.data.length, 0);

  console.log("Tenant/outlet analytics and staff controller isolation checks passed.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Staff.deleteMany({ _id: { $in: created.staff } }),
      Order.deleteMany({ _id: { $in: created.orders } }),
      Inventory.deleteMany({ _id: { $in: created.inventory } }),
      Food.deleteMany({ _id: { $in: created.foods } }),
      Category.deleteMany({ _id: { $in: created.categories } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
