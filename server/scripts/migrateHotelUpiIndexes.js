import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import HotelPaymentSettings from "../models/HotelPaymentSettings.js";
import { ensureIndexesNonDestructively } from "../utils/nonDestructiveIndexes.js";
import { isApprovedStagingMongoTarget } from "../config/envValidation.js";

dotenv.config();

const mode = process.argv.includes("--verify") ? "verify" : process.argv.includes("--apply") ? "apply" : "";
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const isLoopbackIsolatedUri = (uri) => {
  try {
    const parsed = new URL(uri);
    const local = ["127.0.0.1", "localhost", "::1"].includes(String(parsed.hostname || "").replace(/^\[|\]$/g, "").toLowerCase());
    const database = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    return parsed.protocol === "mongodb:" && local && /(?:^|[-_])(test|tests|testing|stage|staging|ci)(?:[-_]|$)/i.test(database);
  } catch {
    return false;
  }
};

const assertApprovedTarget = () => {
  const environment = String(process.env.NODE_ENV || "").toLowerCase();
  if (environment === "production") {
    if (String(process.env.MIGRATION_APPROVED || "").toLowerCase() !== "true") {
      throw new Error("Production index migration requires MIGRATION_APPROVED=true during an approved maintenance window");
    }
    return;
  }
  if (environment === "staging") {
    if (String(process.env.MIGRATION_APPROVED || "").toLowerCase() !== "true" || !isApprovedStagingMongoTarget(mongoUri)) {
      throw new Error("Staging index migration requires MIGRATION_APPROVED=true and the exact approved staging MongoDB host/database");
    }
    return;
  }
  if (String(process.env.LOAD_TEST_MODE || "").toLowerCase() !== "true" || !isLoopbackIsolatedUri(mongoUri)) {
    throw new Error("Non-production index migration requires LOAD_TEST_MODE=true and a loopback test/staging database");
  }
};

const required = [
  { model: Payment, names: ["hotel_upi_active_order_attempt_unique", "hotel_upi_active_bill_attempt_unique"] },
  { model: HotelPaymentSettings, names: ["hotel_upi_settings_scope_unique"] },
];
const summary = { migration: "hotel-upi-indexes", mode: mode || "invalid", status: "FAILED", collections: [] };

try {
  if (!mode || process.argv.filter((argument) => argument === "--verify" || argument === "--apply").length !== 1) {
    throw new Error("Usage: node scripts/migrateHotelUpiIndexes.js --verify|--apply");
  }
  if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is required");
  assertApprovedTarget();
  await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  const plans = [];
  for (const { model, names } of required) {
    const definitions = model.schema.indexes().filter(([, options]) => names.includes(options.name));
    if (definitions.length !== names.length) throw new Error(`Required index definitions are missing from ${model.collection.name}`);
    const result = await ensureIndexesNonDestructively(model.collection, definitions, { verifyOnly: true });
    plans.push({ model, definitions, names, missing: result.missing });
  }

  if (mode === "apply") {
    for (const { model, definitions } of plans) await ensureIndexesNonDestructively(model.collection, definitions);
  }

  for (const { model, definitions, names, missing } of plans) {
    const verification = await ensureIndexesNonDestructively(model.collection, definitions, { verifyOnly: true });
    summary.collections.push({ collection: model.collection.name, required: names, missingBefore: missing, missingAfter: verification.missing });
  }
  const missingAfter = summary.collections.flatMap((entry) => entry.missingAfter);
  summary.status = missingAfter.length ? "INCOMPLETE" : "COMPLETE";
  if (missingAfter.length) process.exitCode = 1;
} catch (error) {
  summary.error = { code: error.code || "INDEX_MIGRATION_FAILED", message: "Hotel UPI index migration failed; no destructive action was performed." };
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
  console.log(JSON.stringify(summary));
}
