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

const isLocalMongoHostname = (uri) => {
  try {
    const parsed = new URL(String(uri).replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return ["localhost", "127.0.0.1", "::1"].includes(String(parsed.hostname || "").toLowerCase());
  } catch {
    return false;
  }
};

export const getMongoUri = () => {
  const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
  const isolatedTestMode = process.env.NODE_ENV === "test";
  const uri = (loadTestMode || isolatedTestMode) ? process.env.TEST_MONGO_URI : (process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!uri) return null;
  return String(uri).trim();
};

const assertIsolatedTestDatabase = (uri) => {
  try {
    const databaseName = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "").split("/")[0];
    if (databaseName !== "restosphere_cashfree_test") throw new Error("NODE_ENV=test requires TEST_MONGO_URI database restosphere_cashfree_test");
  } catch (error) {
    if (String(error?.message || "").includes("restosphere_cashfree_test")) throw error;
    throw new Error("NODE_ENV=test requires a valid TEST_MONGO_URI for restosphere_cashfree_test");
  }
};

export const assertProductionMongoUri = (uri) => {
  if (process.env.NODE_ENV !== "production") return;
  if (!uri) throw new Error("Production requires MONGO_URI or MONGODB_URI");
  if (isLocalMongoHostname(uri) || String(uri).includes("TEST_MONGO_URI") || String(uri).includes("127.0.0.1") || String(uri).includes("localhost")) {
    throw new Error("Production MongoDB URL must not use localhost or a test database URI");
  }
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
  const isolatedTestMode = process.env.NODE_ENV === "test";
  if (!mongoUri) {
    throw new Error(String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true"
      ? "TEST_MONGO_URI is missing in load-test mode"
      : "MONGO_URI (or MONGODB_URI) is missing in environment variables");
  }
  if (isolatedTestMode) assertIsolatedTestDatabase(mongoUri);
  assertProductionMongoUri(mongoUri);

  logger.info(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);

  const conn = await mongoose.connect(mongoUri, {
    // Index creation belongs to explicit migrations in production; doing it
    // on every process start can block a busy database.
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(`MongoDB connected successfully: ${conn.connection.host}`);

  const allowStartupDataBootstrap = !loadTestMode && !isolatedTestMode && process.env.NODE_ENV !== "production"
    || process.env.RUN_STARTUP_DATA_BOOTSTRAP === "true";
  if (allowStartupDataBootstrap) {
    try {
      await ensureDefaultPlans();
      await ensureRestaurantSubscriptions();
    } catch (error) {
      logger.error("Subscription bootstrap failed", { event: "CONFIG_ERROR", error: safeErrorContext(error) });
    }
  } else {
    logger.info((loadTestMode || isolatedTestMode)
      ? "Test startup data bootstrap skipped; fixtures are owned by the test harness."
      : "Production startup data bootstrap skipped; run only through a planned, explicit maintenance operation.");
  }

  if (!loadTestMode && !isolatedTestMode && shouldSeedSuperAdmin()) {
    try {
      await ensureSuperAdmin(logger);
    } catch (error) {
      logger.error("Super admin seed failed", { event: "CONFIG_ERROR", error: safeErrorContext(error) });
    }
  }
};

export default connectDB;
