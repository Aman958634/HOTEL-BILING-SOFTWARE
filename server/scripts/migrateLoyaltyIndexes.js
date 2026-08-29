import dotenv from "dotenv";
import mongoose from "mongoose";
import LoyaltyAccount from "../models/LoyaltyAccount.js";
import LoyaltyReward from "../models/LoyaltyReward.js";
import LoyaltySettings from "../models/LoyaltySettings.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);
try {
  await Promise.all([LoyaltyAccount.syncIndexes(), LoyaltyTransaction.syncIndexes(), LoyaltySettings.syncIndexes(), LoyaltyReward.syncIndexes()]);
  console.log("Loyalty indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
