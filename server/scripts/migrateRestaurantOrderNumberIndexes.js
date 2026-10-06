import "dotenv/config";
import mongoose from "mongoose";
import Counter from "../models/Counter.js";
import Order from "../models/Order.js";
import { getMongoUri } from "../config/db.js";

const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
if (!loadTestMode && process.env.NODE_ENV !== "production") {
  throw new Error("Set LOAD_TEST_MODE=true for an isolated migration or NODE_ENV=production for an approved production migration.");
}

const uri = getMongoUri();
if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");

const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sameValue = (left, right) => JSON.stringify(left || null) === JSON.stringify(right || null);
const indexByKey = (indexes, key) => indexes.find((index) => sameKey(index.key, key));
const restaurantOrderPartial = { restaurant: { $type: "objectId" } };

await mongoose.connect(uri);
try {
  const duplicateOrderNumbers = await Order.aggregate([
    { $match: { restaurant: { $type: "objectId" } } },
    { $group: { _id: { restaurant: "$restaurant", orderNumber: "$orderNumber" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
  if (duplicateOrderNumbers.length) {
    throw new Error("Cannot create the restaurant-scoped order-number index: duplicate order numbers already exist within one restaurant.");
  }

  const orderIndexes = await Order.collection.indexes();
  const globalOrderNumberIndex = indexByKey(orderIndexes, { orderNumber: 1 });
  if (globalOrderNumberIndex?.unique) await Order.collection.dropIndex(globalOrderNumberIndex.name);

  const scopedOrderIndex = indexByKey(await Order.collection.indexes(), { restaurant: 1, orderNumber: 1 });
  const hasExpectedScopedOrderIndex = scopedOrderIndex?.unique && sameValue(scopedOrderIndex.partialFilterExpression, restaurantOrderPartial);
  if (scopedOrderIndex && !hasExpectedScopedOrderIndex) await Order.collection.dropIndex(scopedOrderIndex.name);
  if (!hasExpectedScopedOrderIndex) {
    await Order.collection.createIndex(
      { restaurant: 1, orderNumber: 1 },
      {
        name: "restaurant_1_orderNumber_1",
        unique: true,
        partialFilterExpression: restaurantOrderPartial,
      }
    );
  }

  const counterIndexes = await Counter.collection.indexes();
  const globalCounterKeyIndex = indexByKey(counterIndexes, { key: 1 });
  if (globalCounterKeyIndex?.unique) await Counter.collection.dropIndex(globalCounterKeyIndex.name);
  const scopedCounterIndex = indexByKey(await Counter.collection.indexes(), { key: 1, restaurant: 1 });
  if (scopedCounterIndex && !scopedCounterIndex.unique) await Counter.collection.dropIndex(scopedCounterIndex.name);
  if (!scopedCounterIndex || !scopedCounterIndex.unique) {
    await Counter.collection.createIndex({ key: 1, restaurant: 1 }, { name: "key_1_restaurant_1", unique: true });
  }

  console.log("Order number and counter indexes migrated to restaurant-scoped uniqueness. Historical order documents were not modified.");
} finally {
  await mongoose.disconnect();
}
