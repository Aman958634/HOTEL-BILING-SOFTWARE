import dotenv from "dotenv";
import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import KotTicket from "../models/KotTicket.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
await mongoose.connect(uri);
try {
  await Promise.all([Order.syncIndexes(), Bill.syncIndexes(), Payment.syncIndexes(), Staff.syncIndexes(), Food.syncIndexes(), KotTicket.syncIndexes(), Inventory.syncIndexes(), User.syncIndexes()]);
  console.log("Global Search indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
