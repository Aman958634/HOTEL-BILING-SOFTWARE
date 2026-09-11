import dotenv from "dotenv";
import mongoose from "mongoose";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import SettlementWebhookEvent from "../models/SettlementWebhookEvent.js";
import { ensureIndexesNonDestructively } from "../utils/nonDestructiveIndexes.js";

dotenv.config();

// This is deliberately an explicit maintenance action. Production does not
// build indexes at server startup, and this script never runs automatically.
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is required for the planned Easy Split Phase 2 index migration");

await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false });
try {
  const models = [RestaurantCommissionConfig, SettlementTransaction, SettlementWebhookEvent];
  for (const model of models) {
    const result = await ensureIndexesNonDestructively(model.collection, model.schema.indexes(), { verifyOnly: true });
    console.log(JSON.stringify({ collection: model.collection.name, ...result }));
    if (process.argv.includes("--verify") && result.missing.length) process.exitCode = 1;
  }
  if (!process.argv.includes("--verify")) for (const model of models) await ensureIndexesNonDestructively(model.collection, model.schema.indexes());
} catch (error) {
  console.error(JSON.stringify({ code: error.code || "INDEX_VERIFICATION_FAILED", conflicts: error.conflicts || [], message: "Index verification failed; existing indexes and data preserved. Review manually." }));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
