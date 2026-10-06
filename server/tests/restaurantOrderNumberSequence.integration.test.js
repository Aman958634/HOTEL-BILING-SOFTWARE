import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Counter from "../models/Counter.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import { generateOrderNumber } from "../services/orderService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], outlets: [], orders: [] };

const ensureScopedIndexes = async () => {
  await Promise.all([Counter.createCollection(), Order.createCollection()].map((promise) => promise.catch((error) => {
    if (error?.codeName !== "NamespaceExists") throw error;
  })));
  const counterIndexes = await Counter.collection.indexes();
  const globalCounterIndex = counterIndexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ key: 1 }));
  if (globalCounterIndex?.unique) await Counter.collection.dropIndex(globalCounterIndex.name);
  const counterScope = (await Counter.collection.indexes()).find((index) => JSON.stringify(index.key) === JSON.stringify({ key: 1, restaurant: 1 }));
  if (!counterScope) await Counter.collection.createIndex({ key: 1, restaurant: 1 }, { unique: true });

  const orderIndexes = await Order.collection.indexes();
  const globalOrderIndex = orderIndexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ orderNumber: 1 }));
  if (globalOrderIndex?.unique) await Order.collection.dropIndex(globalOrderIndex.name);
  const orderScope = (await Order.collection.indexes()).find((index) => JSON.stringify(index.key) === JSON.stringify({ restaurant: 1, orderNumber: 1 }));
  if (!orderScope?.unique) {
    if (orderScope) await Order.collection.dropIndex(orderScope.name);
    await Order.collection.createIndex(
      { restaurant: 1, orderNumber: 1 },
      { unique: true, partialFilterExpression: { restaurant: { $type: "objectId" } } }
    );
  }
};

const createOrder = async ({ restaurant, outlet, orderNumber, status = "PENDING" }) => {
  const order = await Order.create({
    restaurant,
    outlet,
    orderNumber,
    orderType: "TAKEAWAY",
    status,
    items: [{ menuItem: new mongoose.Types.ObjectId(), name: "Sequence test item", price: 100, quantity: 1, subtotal: 100 }],
    subtotal: 100,
    total: 100,
  });
  created.orders.push(order._id);
  return order;
};

try {
  await mongoose.connect(uri);
  await ensureScopedIndexes();

  const [restaurantA, restaurantB, restaurantC, restaurantD, restaurantE] = await Promise.all(
    ["A", "B", "C", "D", "E"].map(async (label) => {
      const restaurant = await Restaurant.create({ name: `Sequence ${label} ${suffix}`, slug: `sequence-${label.toLowerCase()}-${suffix}`, branchCode: `SQ${label}${suffix}`, address: "Test" });
      created.restaurants.push(restaurant._id);
      return restaurant;
    })
  );
  const [outletA1, outletA2, outletB1, outletC1, outletC2, outletD1, outletE1] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "A Main", code: `A1${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantA._id, name: "A Outlet 2", code: `A2${suffix}` }),
    Outlet.create({ restaurant: restaurantB._id, name: "B Main", code: `B1${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantC._id, name: "C Main", code: `C1${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantC._id, name: "C Outlet 2", code: `C2${suffix}` }),
    Outlet.create({ restaurant: restaurantD._id, name: "D Main", code: `D1${suffix}`, isDefault: true }),
    Outlet.create({ restaurant: restaurantE._id, name: "E Main", code: `E1${suffix}`, isDefault: true }),
  ]);
  created.outlets.push(outletA1._id, outletA2._id, outletB1._id, outletC1._id, outletC2._id, outletD1._id, outletE1._id);

  const a = [];
  for (let index = 0; index < 3; index += 1) {
    const orderNumber = await generateOrderNumber(restaurantA._id);
    a.push(orderNumber);
    await createOrder({ restaurant: restaurantA._id, outlet: outletA1._id, orderNumber });
  }
  assert.deepEqual(a, ["ORD-1001", "ORD-1002", "ORD-1003"]);

  const b = await Promise.all([generateOrderNumber(restaurantB._id), generateOrderNumber(restaurantB._id)]);
  assert.deepEqual(b.sort(), ["ORD-1001", "ORD-1002"]);
  assert.equal(await generateOrderNumber(restaurantA._id), "ORD-1004");
  assert.equal(await generateOrderNumber(restaurantB._id), "ORD-1003");

  const c1 = await generateOrderNumber(restaurantC._id);
  const c2 = await generateOrderNumber(restaurantC._id);
  const c3 = await generateOrderNumber(restaurantC._id);
  await Promise.all([
    createOrder({ restaurant: restaurantC._id, outlet: outletC1._id, orderNumber: c1 }),
    createOrder({ restaurant: restaurantC._id, outlet: outletC2._id, orderNumber: c2 }),
    createOrder({ restaurant: restaurantC._id, outlet: outletC1._id, orderNumber: c3 }),
  ]);
  assert.deepEqual([c1, c2, c3], ["ORD-1001", "ORD-1002", "ORD-1003"]);

  const concurrent = await Promise.all(Array.from({ length: 20 }, () => generateOrderNumber(restaurantD._id)));
  assert.deepEqual(concurrent.map((value) => Number(value.slice(4))).sort((left, right) => left - right), Array.from({ length: 20 }, (_, index) => 1001 + index));

  const deletableOrderNumbers = [];
  for (let index = 0; index < 3; index += 1) {
    const orderNumber = await generateOrderNumber(restaurantE._id);
    deletableOrderNumbers.push(orderNumber);
    await createOrder({ restaurant: restaurantE._id, outlet: outletE1._id, orderNumber });
  }
  assert.deepEqual(deletableOrderNumbers, ["ORD-1001", "ORD-1002", "ORD-1003"]);
  await Order.deleteOne({ restaurant: restaurantE._id, orderNumber: deletableOrderNumbers[2] });
  assert.equal(await generateOrderNumber(restaurantE._id), "ORD-1004");

  const historical = await createOrder({ restaurant: restaurantB._id, outlet: outletB1._id, orderNumber: "ORD-8123" });
  await Counter.deleteOne({ key: "orderNumber", restaurant: restaurantB._id });
  assert.equal(await generateOrderNumber(restaurantB._id), "ORD-8124");
  assert.equal((await Order.findById(historical._id).lean()).orderNumber, "ORD-8123");

  await mongoose.disconnect();
  await mongoose.connect(uri);
  assert.equal(await generateOrderNumber(restaurantA._id), "ORD-1005");

  console.log("Restaurant-scoped order sequence integration checks passed.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Counter.deleteMany({ key: "orderNumber", restaurant: { $in: created.restaurants } }),
      Order.deleteMany({ _id: { $in: created.orders } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
