import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { getMongoUri } from "../config/db.js";

const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
if (!loadTestMode && process.env.NODE_ENV !== "production") throw new Error("Set LOAD_TEST_MODE=true for isolated migration or NODE_ENV=production for an approved production migration.");
const uri = getMongoUri();
if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");

await mongoose.connect(uri);
try {
  await Order.collection.dropIndex("restaurant_1_outlet_1_idempotencyKey_1").catch((error) => {
    if (error.codeName !== "IndexNotFound") throw error;
  });
  await Order.collection.createIndex(
    { restaurant: 1, outlet: 1, idempotencyKey: 1 },
    { name: "restaurant_1_outlet_1_idempotencyKey_1", unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
  );
  console.log("Order idempotency uniqueness index migrated to a string-only partial unique index.");
} finally {
  await mongoose.disconnect();
}