import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
await mongoose.connect(uri);
try {
  await Promise.all([Order.syncIndexes(), Payment.syncIndexes()]);
  console.log("Business Intelligence indexes migrated successfully.");
} finally { await mongoose.disconnect(); }
