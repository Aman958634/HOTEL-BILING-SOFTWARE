import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import { ensureIndexesNonDestructively } from "../utils/nonDestructiveIndexes.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false });

try {
  const result = await ensureIndexesNonDestructively(Payment.collection, Payment.schema.indexes(), { verifyOnly: process.argv.includes("--verify") });
  console.log(JSON.stringify({ collection: "payments", ...result }));
  if (process.argv.includes("--verify") && result.missing.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ code: error.code || "INDEX_VERIFICATION_FAILED", conflicts: error.conflicts || [], message: "Index verification failed; existing indexes and data preserved. Review manually." }));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
