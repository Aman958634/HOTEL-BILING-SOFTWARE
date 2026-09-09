import dotenv from "dotenv";
import mongoose from "mongoose";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import SettlementWebhookEvent from "../models/SettlementWebhookEvent.js";

dotenv.config();

// This is deliberately an explicit maintenance action. Production does not
// build indexes at server startup, and this script never runs automatically.
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is required for the planned Easy Split Phase 2 index migration");

await mongoose.connect(mongoUri);
try {
  await Promise.all([
    RestaurantCommissionConfig.syncIndexes(),
    SettlementTransaction.syncIndexes(),
    SettlementWebhookEvent.syncIndexes(),
  ]);
  console.log("Easy Split Phase 2 indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
