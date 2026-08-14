import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ensureSuperAdmin, getSuperAdminConfig } from "../services/superAdminSeedService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const run = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  const { email } = getSuperAdminConfig();
  if (!email) {
    console.error("SUPER_ADMIN_EMAIL is required");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const result = await ensureSuperAdmin(console);
  console.log(`Super admin seed complete (${result.action}): ${result.email}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
