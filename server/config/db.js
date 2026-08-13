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

const seedSuperAdmin = async () => {
  const existing = await User.findOne({ role: "super_admin" });
  if (existing) return;

  const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@restosphere.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@12345";
  const fullName = process.env.SUPER_ADMIN_NAME || "Super Admin";

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

  if (process.env.NODE_ENV !== "production" && process.env.SUPER_ADMIN_SEED !== "false") {
    await seedSuperAdmin();
  }
};

export default connectDB;
