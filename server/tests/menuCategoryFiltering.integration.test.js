import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import { createMenuItem, listMenuItems, updateMenuItem } from "../controllers/menuController.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], outlets: [], categories: [], foods: [] };

const invoke = (handler, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ statusCode: this.statusCode, body }); },
  };
  handler(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});

const request = (user, { query = {}, body = {}, params = {} } = {}) => ({ user, query, body, params });
const ids = (result) => result.body.data.map((item) => String(item._id));

try {
  await mongoose.connect(uri);

  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Menu A ${suffix}`, slug: `menu-a-${suffix}`, branchCode: `MA${suffix}`, address: "Local test" }),
    Restaurant.create({ name: `Menu B ${suffix}`, slug: `menu-b-${suffix}`, branchCode: `MB${suffix}`, address: "Local test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [outletA, outletB] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "Main", code: `MA${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantB._id, name: "Main", code: `MB${suffix}`, isDefault: true }),
  ]);
  created.outlets.push(outletA._id, outletB._id);

  const [tandur, chinese, empty, paged, otherTenantCategory] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: "TANDUR STARTER", slug: `tandur-${suffix}` }),
    Category.create({ restaurant: restaurantA._id, name: "CHINESE STARTER", slug: `chinese-${suffix}` }),
    Category.create({ restaurant: restaurantA._id, name: "EMPTY", slug: `empty-${suffix}` }),
    Category.create({ restaurant: restaurantA._id, name: "PAGED", slug: `paged-${suffix}` }),
    Category.create({ restaurant: restaurantB._id, name: "TANDUR STARTER", slug: `tandur-b-${suffix}` }),
  ]);
  created.categories.push(tandur._id, chinese._id, empty._id, paged._id, otherTenantCategory._id);

  const [paneer, unavailableTandur, chineseItem, otherTenantFood] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: tandur._id, name: "Paneer Tikka", description: "Tandur paneer", price: 350, isAvailable: true, available: true }),
    Food.create({ restaurant: restaurantA._id, category: tandur._id, name: "Tandur Mushroom", description: "Tandur mushroom", price: 250, isAvailable: false, available: false }),
    Food.create({ restaurant: restaurantA._id, category: chinese._id, name: "Chilli Paneer", description: "Chinese paneer", price: 300, isAvailable: true, available: true }),
    Food.create({ restaurant: restaurantB._id, category: otherTenantCategory._id, name: "Other restaurant item", description: "Must remain private", price: 900, isAvailable: true, available: true }),
  ]);
  created.foods.push(paneer._id, unavailableTandur._id, chineseItem._id, otherTenantFood._id);

  const pagedFoods = await Food.insertMany(Array.from({ length: 101 }, (_, index) => ({
    restaurant: restaurantA._id,
    category: paged._id,
    name: `Paged menu item ${index + 1}`,
    description: "Pagination coverage",
    price: index + 1,
    isAvailable: true,
    available: true,
  })));
  created.foods.push(...pagedFoods.map((food) => food._id));

  const adminA = { _id: new mongoose.Types.ObjectId(), role: "admin", restaurant: restaurantA._id, activeOutlet: outletA._id, defaultOutlet: outletA._id, allOutletsAccess: true };

  const all = await invoke(listMenuItems, request(adminA, { query: { page: 1, limit: 100, sortBy: "price", order: "asc" } }));
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.meta.total, 104, "all categories includes every restaurant-scoped item");
  assert.ok(!ids(all).includes(String(otherTenantFood._id)), "another restaurant's item is never exposed");
  assert.equal(all.body.meta.totalPages, 2, "the API exposes all pages for the client to load");

  const secondPage = await invoke(listMenuItems, request(adminA, { query: { page: 2, limit: 100, sortBy: "price", order: "asc" } }));
  assert.equal(secondPage.statusCode, 200);
  assert.equal(secondPage.body.data.length, 4, "items beyond the first page remain retrievable");

  const tandurItems = await invoke(listMenuItems, request(adminA, { query: { category: String(tandur._id), limit: 100, sortBy: "price", order: "desc" } }));
  assert.equal(tandurItems.statusCode, 200);
  assert.deepEqual(ids(tandurItems), [String(paneer._id), String(unavailableTandur._id)], "category id returns its assigned foods in server order");

  const searchAndCategory = await invoke(listMenuItems, request(adminA, { query: { category: String(tandur._id), search: "paneer", limit: 100 } }));
  assert.deepEqual(ids(searchAndCategory), [String(paneer._id)], "search intersects category filtering");

  const availabilityAndCategory = await invoke(listMenuItems, request(adminA, { query: { category: String(tandur._id), available: "true", limit: 100 } }));
  assert.deepEqual(ids(availabilityAndCategory), [String(paneer._id)], "availability intersects category filtering");

  const emptyItems = await invoke(listMenuItems, request(adminA, { query: { category: String(empty._id), limit: 100 } }));
  assert.equal(emptyItems.body.data.length, 0, "a genuinely empty category returns no items");

  const createdItem = await invoke(createMenuItem, request(adminA, { body: { name: "New Paneer Tikka", category: String(tandur._id), description: "New tandur paneer", price: 425, available: true } }));
  assert.equal(createdItem.statusCode, 201);
  created.foods.push(createdItem.body.data._id);

  const afterCreate = await invoke(listMenuItems, request(adminA, { query: { category: String(tandur._id), limit: 100, sortBy: "price", order: "desc" } }));
  assert.ok(ids(afterCreate).includes(String(createdItem.body.data._id)), "a new food is visible under its selected category");

  const movedItem = await invoke(updateMenuItem, request(adminA, { params: { id: String(createdItem.body.data._id) }, body: { category: String(chinese._id) } }));
  assert.equal(movedItem.statusCode, 200);
  const afterEdit = await invoke(listMenuItems, request(adminA, { query: { category: String(tandur._id), limit: 100 } }));
  assert.ok(!ids(afterEdit).includes(String(createdItem.body.data._id)), "editing a category removes the item from its previous result");
  const chineseAfterEdit = await invoke(listMenuItems, request(adminA, { query: { category: String(chinese._id), limit: 100 } }));
  assert.ok(ids(chineseAfterEdit).includes(String(createdItem.body.data._id)), "editing a category adds the item to its new result");

  const invalidCategory = await invoke(listMenuItems, request(adminA, { query: { category: "TANDUR STARTER", limit: 100 } }));
  assert.equal(invalidCategory.statusCode, 400, "the API rejects display text instead of silently misfiltering");

  console.log("Menu category filtering integration checks passed.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Food.deleteMany({ _id: { $in: created.foods } }),
      Category.deleteMany({ _id: { $in: created.categories } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
