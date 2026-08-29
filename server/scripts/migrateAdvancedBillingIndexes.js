import dotenv from "dotenv";
import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
await mongoose.connect(uri);
try {
  await Promise.all([Bill.syncIndexes(), Order.syncIndexes(), Payment.syncIndexes()]);
  console.log("Advanced Billing indexes migrated successfully.");
} finally { await mongoose.disconnect(); }
