import dotenv from "dotenv";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);
try {
  // Existing explicit null values participate in the sparse unique index.
  // Remove only that legacy representation; real non-empty dedupe keys stay.
  await Notification.updateMany({ dedupeKey: null }, { $unset: { dedupeKey: "" } });
  await Notification.syncIndexes();
  console.log("Notification indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
