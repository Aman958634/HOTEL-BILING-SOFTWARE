import mongoose from "mongoose";
import logger from "../utils/logger.js";
import User from "../models/User.js";
import { ensureDefaultPlans } from "../services/planService.js";
import { ensureRestaurantSubscriptions } from "../services/subscriptionBootstrapService.js";
import { ensureSuperAdmin, shouldSeedSuperAdmin } from "../services/superAdminSeedService.js";
import { safeErrorContext } from "../utils/safeLog.js";

/** Fail fast on queries when disconnected — avoids 10s buffering timeouts. */
mongoose.set("bufferCommands", false);
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected", { event: "DB_DISCONNECTED" }));
mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected", { event: "DB_RECONNECTED" }));
mongoose.connection.on("error", (error) => logger.error("MongoDB connection error", { event: "DB_ERROR", error: { name: error.name, message: error.message } }));

export const getMongoUri = () => {
  const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
  const uri = loadTestMode ? process.env.TEST_MONGO_URI : (process.env.MONGO_URI || process.env.MONGODB_URI);
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
  const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
  if (!mongoUri) {
    throw new Error(String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true"
      ? "TEST_MONGO_URI is missing in load-test mode"
      : "MONGO_URI (or MONGODB_URI) is missing in environment variables");
  }

  logger.info(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);

  const conn = await mongoose.connect(mongoUri, {
    // Index creation belongs to explicit migrations in production; doing it
    // on every process start can block a busy database.
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(`MongoDB connected successfully: ${conn.connection.host}`);

  const allowStartupDataBootstrap = !loadTestMode && process.env.NODE_ENV !== "production"
    || process.env.RUN_STARTUP_DATA_BOOTSTRAP === "true";
  if (allowStartupDataBootstrap) {
    try {
      await ensureDefaultPlans();
      await ensureRestaurantSubscriptions();
    } catch (error) {
      logger.error("Subscription bootstrap failed", { event: "CONFIG_ERROR", error: safeErrorContext(error) });
    }
  } else {
    logger.info(loadTestMode
      ? "Load-test startup data bootstrap skipped; fixtures are owned by the load-test harness."
      : "Production startup data bootstrap skipped; run only through a planned, explicit maintenance operation.");
  }

  if (!loadTestMode && shouldSeedSuperAdmin()) {
    try {
      await ensureSuperAdmin(logger);
    } catch (error) {
      logger.error("Super admin seed failed", { event: "CONFIG_ERROR", error: safeErrorContext(error) });
    }
  }
};

export default connectDB;
