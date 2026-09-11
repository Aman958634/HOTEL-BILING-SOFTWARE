import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import CashReconciliation from "../models/CashReconciliation.js";
import { ensureIndexesNonDestructively } from "../utils/nonDestructiveIndexes.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
try {
  const models = [Payment, Refund, CashReconciliation];
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
