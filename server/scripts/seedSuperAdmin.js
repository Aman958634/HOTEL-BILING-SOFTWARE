import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const run = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  const email = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  if (!email || !password) {
    console.error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const existing = await User.findOne({ role: "super_admin" });
  if (existing) {
    console.log(`Super admin already exists: ${existing.email}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const duplicate = await User.findOne({ email });
  if (duplicate) {
    console.error(`A user with email ${email} already exists (role: ${duplicate.role})`);
    await mongoose.disconnect();
    process.exit(1);
  }

  await User.create({ fullName, email, password, role: "super_admin" });
  console.log(`Super admin created: ${email}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
