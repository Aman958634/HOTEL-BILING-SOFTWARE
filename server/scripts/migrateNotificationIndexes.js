import dotenv from "dotenv";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);
const counts = { scanned: 0, updated: 0, unchanged: 0, failed: 0 };
try {
  // Existing explicit null values participate in the sparse unique index.
  // Remove only that legacy representation; real non-empty dedupe keys stay.
  counts.scanned = await Notification.countDocuments({ dedupeKey: null });
  const result = await Notification.updateMany({ dedupeKey: null }, { $unset: { dedupeKey: "" } });
  counts.updated = result.modifiedCount;
  counts.unchanged = counts.scanned - counts.updated;
  await Notification.syncIndexes();
  console.log(JSON.stringify({ migration: "notifications", counts }, null, 2));
} catch (error) {
  counts.failed = 1;
  console.error(JSON.stringify({
    migration: "notifications",
    counts,
    error: { name: error.name, message: error.message },
  }, null, 2));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
