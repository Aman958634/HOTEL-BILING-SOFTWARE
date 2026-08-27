import mongoose from "mongoose";
import logger from "../utils/logger.js";
import User from "../models/User.js";
import { ensureDefaultPlans } from "../services/planService.js";
import { ensureRestaurantSubscriptions } from "../services/subscriptionBootstrapService.js";
import { ensureSuperAdmin, shouldSeedSuperAdmin } from "../services/superAdminSeedService.js";
import { getTenantContext, runWithTenantContext } from "../utils/tenantContext.js";

/** Fail fast on queries when disconnected — avoids 10s buffering timeouts. */
mongoose.set("bufferCommands", false);

export const getMongoUri = () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) return null;
  return String(uri).trim();
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

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
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
  });

  const nativeCollection = conn.connection.db.collection.bind(conn.connection.db);
  conn.connection.db.collection = (...args) => {
    const context = getTenantContext();
    if (!context || !["system", "super_admin"].includes(context.role)) {
      throw new Error("Raw MongoDB collection access requires system or super_admin context");
    }
    return nativeCollection(...args);
  };

  logger.info(`MongoDB connected successfully: ${conn.connection.host}`);

  try {
    await runWithTenantContext({ role: "system", restaurantId: null, outletId: null }, async () => {
      await ensureDefaultPlans();
      await ensureRestaurantSubscriptions();
    });
  } catch (error) {
    logger.error(`Subscription bootstrap failed: ${error.message}`);
  }

  if (shouldSeedSuperAdmin()) {
    try {
      await runWithTenantContext({ role: "system", restaurantId: null, outletId: null }, () => ensureSuperAdmin(logger));
    } catch (error) {
      logger.error(`Super admin seed failed: ${error.message}`);
    }
  }
};

export default connectDB;
