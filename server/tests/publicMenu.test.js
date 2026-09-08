import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import { createPublicMenuContext, resolvePublicMenuContext } from "../utils/publicMenuContext.js";
import { listPublicMenu, resolvePublicRestaurantContext } from "../services/publicMenuService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
process.env.PUBLIC_MENU_CONTEXT_SECRET ||= crypto.randomBytes(32).toString("hex");
delete process.env.PUBLIC_MENU_DEFAULT_RESTAURANT_SLUG;

const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], outlets: [], tables: [], categories: [], foods: [] };

try {
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Public A ${suffix}`, slug: `public-a-${suffix}`, branchCode: `PA${suffix}`, address: "Test" }),
    Restaurant.create({ name: `Public B ${suffix}`, slug: `public-b-${suffix}`, branchCode: `PB${suffix}`, address: "Test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [outletA, outletB] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "A Main", code: "A-MAIN", isDefault: true }),
    Outlet.create({ restaurant: restaurantB._id, name: "B Main", code: "B-MAIN", isDefault: true }),
  ]);
  created.outlets.push(outletA._id, outletB._id);

  const tableA = await Table.create({ restaurant: restaurantA._id, outlet: outletA._id, tableNumber: "1", capacity: 2, floor: "G", section: "Main" });
  created.tables.push(tableA._id);

  const [activeA, inactiveA, activeB, emptyA] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: "Visible", slug: `visible-${suffix}` }),
    Category.create({ restaurant: restaurantA._id, name: "Hidden", slug: `hidden-${suffix}`, active: false, isActive: false }),
    Category.create({ restaurant: restaurantB._id, name: "Other", slug: `other-${suffix}` }),
    Category.create({ restaurant: restaurantA._id, name: "Empty", slug: `empty-${suffix}` }),
  ]);
  created.categories.push(activeA._id, inactiveA._id, activeB._id, emptyA._id);

  const [visibleA, unavailableA, inactiveCategoryItem, visibleB] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: activeA._id, name: "Visible A", price: 100 }),
    Food.create({ restaurant: restaurantA._id, category: activeA._id, name: "Unavailable A", price: 100, isAvailable: false, available: false }),
    Food.create({ restaurant: restaurantA._id, category: inactiveA._id, name: "Inactive category item", price: 100 }),
    Food.create({ restaurant: restaurantB._id, category: activeB._id, name: "Visible B", price: 200 }),
  ]);
  created.foods.push(visibleA._id, unavailableA._id, inactiveCategoryItem._id, visibleB._id);

  const browseA = await resolvePublicRestaurantContext(restaurantA.slug);
  const menuA = await listPublicMenu({ context: browseA, query: { limit: 100 } });
  assert.equal(String(menuA.restaurant._id), String(restaurantA._id));
  assert.equal(String(menuA.outlet._id), String(outletA._id));
  assert.deepEqual(menuA.items.map((item) => String(item._id)), [String(visibleA._id)]);
  assert.deepEqual(menuA.categories.map((category) => String(category._id)).sort(), [String(activeA._id), String(emptyA._id)].sort());

  const browseB = await resolvePublicRestaurantContext(restaurantB.slug);
  const menuB = await listPublicMenu({ context: browseB, query: { limit: 100 } });
  assert.deepEqual(menuB.items.map((item) => String(item._id)), [String(visibleB._id)]);

  const emptyMenu = await listPublicMenu({ context: browseA, query: { category: String(emptyA._id) } });
  assert.equal(emptyMenu.items.length, 0);
  assert.equal(emptyMenu.meta.total, 0);

  const qrContext = await resolvePublicMenuContext(createPublicMenuContext(tableA));
  const qrMenu = await listPublicMenu({ context: qrContext, query: { limit: 100 } });
  assert.equal(String(qrMenu.table._id), String(tableA._id));
  assert.deepEqual(qrMenu.items.map((item) => String(item._id)), [String(visibleA._id)]);

  await assert.rejects(
    () => resolvePublicRestaurantContext("missing-restaurant"),
    (error) => error?.statusCode === 404 && error?.code === "PUBLIC_MENU_RESTAURANT_NOT_FOUND"
  );
  await assert.rejects(
    () => resolvePublicRestaurantContext(restaurantA.slug, outletB.code),
    (error) => error?.statusCode === 404 && error?.code === "PUBLIC_MENU_OUTLET_NOT_FOUND"
  );
  await assert.rejects(
    () => resolvePublicRestaurantContext(),
    (error) => error?.statusCode === 400 && error?.code === "PUBLIC_MENU_RESTAURANT_REQUIRED"
  );

  console.log("Public menu tests passed without staff authentication.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Food.deleteMany({ _id: { $in: created.foods } }),
      Category.deleteMany({ _id: { $in: created.categories } }),
      Table.deleteMany({ _id: { $in: created.tables } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
