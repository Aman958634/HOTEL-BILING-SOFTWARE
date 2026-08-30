import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import { createPublicMenuContext, resolvePublicMenuContext } from "../utils/publicMenuContext.js";
import { prepareOrderItems } from "../services/orderService.js";

const uri = process.env.TEST_MONGO_URI;
await assert.rejects(() => resolvePublicMenuContext(""), (error) => error?.code === "PUBLIC_MENU_CONTEXT_REQUIRED");
if (!uri) {
  console.log("Public menu context-required check passed; tenant integration skipped: TEST_MONGO_URI is not configured.");
  process.exit(0);
}

process.env.PUBLIC_MENU_CONTEXT_SECRET ||= crypto.randomBytes(32).toString("hex");
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], outlets: [], tables: [], categories: [], foods: [] };

try {
  await mongoose.connect(uri);
  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Isolation A ${suffix}`, slug: `isolation-a-${suffix}`, branchCode: `IA${suffix}`, address: "Test" }),
    Restaurant.create({ name: `Isolation B ${suffix}`, slug: `isolation-b-${suffix}`, branchCode: `IB${suffix}`, address: "Test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);
  const [outletA, outletB] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "Main", code: "MAIN", isDefault: true }),
    Outlet.create({ restaurant: restaurantB._id, name: "Main", code: "MAIN", isDefault: true }),
  ]);
  created.outlets.push(outletA._id, outletB._id);
  const [tableA, tableB] = await Promise.all([
    Table.create({ restaurant: restaurantA._id, outlet: outletA._id, tableNumber: "1", capacity: 2, floor: "G", section: "Main" }),
    Table.create({ restaurant: restaurantB._id, outlet: outletB._id, tableNumber: "1", capacity: 2, floor: "G", section: "Main" }),
  ]);
  created.tables.push(tableA._id, tableB._id);
  const [categoryA, categoryB] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: "Starters", slug: "starters" }),
    Category.create({ restaurant: restaurantB._id, name: "Starters", slug: "starters" }),
  ]);
  created.categories.push(categoryA._id, categoryB._id);
  const [foodA, foodB] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: categoryA._id, name: "A dish", price: 100 }),
    Food.create({ restaurant: restaurantB._id, category: categoryB._id, name: "B dish", price: 200 }),
  ]);
  created.foods.push(foodA._id, foodB._id);

  const contextA = await resolvePublicMenuContext(createPublicMenuContext(tableA));
  assert.equal(String(contextA.restaurant._id), String(restaurantA._id));
  assert.equal(String(contextA.outlet._id), String(outletA._id));
  assert.equal(String(contextA.table._id), String(tableA._id));

  const visibleToA = await Food.find({ restaurant: contextA.restaurant._id, isAvailable: true }).select("_id").lean();
  assert.deepEqual(visibleToA.map((food) => String(food._id)), [String(foodA._id)]);
  await assert.rejects(
    () => prepareOrderItems([{ menuItem: foodB._id, quantity: 1 }], { restaurantId: restaurantA._id }),
    (error) => error?.statusCode === 404
  );

  const forged = jwt.sign({ type: "public_menu_table", tableId: String(tableA._id), restaurantId: String(restaurantB._id), outletId: String(outletB._id) }, process.env.PUBLIC_MENU_CONTEXT_SECRET);
  await assert.rejects(() => resolvePublicMenuContext(forged), (error) => error?.code === "PUBLIC_MENU_CONTEXT_INVALID");
  console.log("Tenant isolation integration checks passed.");
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
