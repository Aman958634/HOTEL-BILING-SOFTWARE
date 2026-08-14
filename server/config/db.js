import mongoose from "mongoose";
import logger from "../utils/logger.js";
import User from "../models/User.js";
import { ensureDefaultPlans } from "../services/planService.js";
import { ensureRestaurantSubscriptions } from "../services/subscriptionBootstrapService.js";

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

const shouldSeedSuperAdmin = () => {
  if (process.env.SUPER_ADMIN_SEED === "false") return false;

  if (process.env.NODE_ENV === "production") {
    return Boolean(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD);
  }

  return true;
};

const seedSuperAdmin = async () => {
  const existing = await User.findOne({ role: "super_admin" });
  if (existing) return;

  const isProduction = process.env.NODE_ENV === "production";
  const email = (process.env.SUPER_ADMIN_EMAIL || (isProduction ? "" : "superadmin@restosphere.com"))
    .trim()
    .toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || (isProduction ? "" : "SuperAdmin@12345");
  const fullName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  if (!email || !password) {
    if (isProduction) {
      logger.warn(
        "Super admin seed skipped: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in Render environment variables, then redeploy."
      );
    }
    return;
  }

  await User.create({ fullName, email, password, role: "super_admin" });
  logger.info(`Created super admin account: ${email}`);
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

  logger.info(`MongoDB connected successfully: ${conn.connection.host}`);

  try {
    await ensureDefaultPlans();
    await ensureRestaurantSubscriptions();
  } catch (error) {
    logger.error(`Subscription bootstrap failed: ${error.message}`);
  }

  if (shouldSeedSuperAdmin()) {
    await seedSuperAdmin();
  }
};

export default connectDB;
