import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import KotTicket from "../models/KotTicket.js";

dotenv.config();

const ignoreMissingIndex = (error) => {
  if (error?.codeName === "IndexNotFound" || error?.code === 27) return;
  throw error;
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);

  // Legacy schema enforced exactly one payment per order. Keep all documents;
  // only the obsolete index is removed before new tenant indexes are created.
  await Payment.collection.dropIndex("orderId_1").catch(ignoreMissingIndex);
  await Promise.all([Payment.syncIndexes(), Order.syncIndexes(), Table.syncIndexes(), KotTicket.syncIndexes()]);
  console.log("POS indexes migrated successfully");
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
