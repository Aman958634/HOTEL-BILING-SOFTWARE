import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import CashReconciliation from "../models/CashReconciliation.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);
try {
  await Promise.all([Payment.syncIndexes(), Refund.syncIndexes(), CashReconciliation.syncIndexes()]);
  console.log("Payment reconciliation indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
