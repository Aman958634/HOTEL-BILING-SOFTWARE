import "dotenv/config";
import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import { assertProductionMongoUri, getMongoUri } from "../config/db.js";
import { extendEligibleTrialExpiries } from "../services/trialSevenDayMigrationService.js";

const apply = process.argv.includes("--apply");
const backupReference = String(process.env.TRIAL_7_DAY_BACKUP_REFERENCE || "").trim();
const confirmed = process.env.CONFIRM_TRIAL_7_DAY_EXTENSION === "YES";
const uri = getMongoUri();
if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");
assertProductionMongoUri(uri);
if (apply && !backupReference) throw new Error("Refusing to modify data without TRIAL_7_DAY_BACKUP_REFERENCE (record the verified snapshot/dump identifier).");
if (apply && !confirmed) throw new Error("Refusing to modify data without CONFIRM_TRIAL_7_DAY_EXTENSION=YES.");

await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
try {
  const summary = await extendEligibleTrialExpiries({ SubscriptionModel: Subscription, apply });
  console.log(JSON.stringify({ ...summary, backupReference: apply ? backupReference : null }, null, 2));
  if (apply && summary.skippedDuringApply > 0) process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
