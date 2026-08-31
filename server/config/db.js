import mongoose from "mongoose";
import logger from "../utils/logger.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import { ensureDefaultPlans } from "../services/planService.js";
import { ensureRestaurantSubscriptions } from "../services/subscriptionBootstrapService.js";
import { ensureSuperAdmin, shouldSeedSuperAdmin } from "../services/superAdminSeedService.js";

/** Fail fast on queries when disconnected — avoids 10s buffering timeouts. */
mongoose.set("bufferCommands", false);

export const getMongoUri = () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) return null;
  return String(uri).trim();
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

export const hasTransactionSupport = (hello = {}) =>
  Boolean(hello?.setName || hello?.msg === "isdbgrid") && hello?.logicalSessionTimeoutMinutes !== null && hello?.logicalSessionTimeoutMinutes !== undefined;

const hasUniqueIndex = (indexes, expectedKey) =>
  indexes.some((index) =>
    index.unique === true &&
    Object.entries(expectedKey).every(([field, direction]) => index.key?.[field] === direction)
  );

/**
 * Production-only, read-only startup checks. They verify that the configured
 * Mongo deployment can honour transactional payment settlement and that the
 * unique ledger guards already exist; no customer documents are changed.
 */
export const assertProductionDatabaseReadiness = async () => {
  if (process.env.NODE_ENV !== "production") return;
  if (!mongoose.connection.db) throw new Error("Production MongoDB connection is unavailable");

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hasTransactionSupport(hello)) {
    throw new Error("Production MongoDB must be a replica set or sharded deployment with session support");
  }

  const indexes = await Payment.collection.indexes();
  const requiredIndexes = [
    { paymentId: 1 },
    { transactionId: 1 },
    { razorpayPaymentId: 1 },
    { orderId: 1, idempotencyKey: 1 },
  ];
  if (!requiredIndexes.every((key) => hasUniqueIndex(indexes, key))) {
    throw new Error("Required payment uniqueness indexes are missing; run the payment index migration before production startup");
  }
};

export const maskMongoUri = (uri) => {
  if (!uri) return "(not set)";
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    const host = parsed.hostname || "unknown-host";
    const dbName = uri.split("/").pop()?.split("?")[0] || "";
    const scheme = uri.startsWith("mongodb+srv") ? "mongodb+srv" : "mongodb";
    return `${scheme}://***@${host}/${dbName}`;
  } catch {
    return "mongodb://*** (configured)";
  }
};

const connectDB = async () => {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error("MONGO_URI (or MONGODB_URI) is missing in environment variables");
  }

  logger.info(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);

  const conn = await mongoose.connect(mongoUri, {
    // Index creation belongs to explicit migrations in production; doing it
    // on every process start can block a busy database.
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(`MongoDB connected successfully: ${conn.connection.host}`);

  try {
    await ensureDefaultPlans();
    await ensureRestaurantSubscriptions();
  } catch (error) {
    logger.error(`Subscription bootstrap failed: ${error.message}`);
  }

  if (shouldSeedSuperAdmin()) {
    try {
      await ensureSuperAdmin(logger);
    } catch (error) {
      logger.error(`Super admin seed failed: ${error.message}`);
    }
  }
};

export default connectDB;
