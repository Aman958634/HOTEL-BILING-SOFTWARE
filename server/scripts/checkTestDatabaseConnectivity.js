import "dotenv/config";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "../tests/testDatabase.js";

const classifyConnectionFailure = (error) => {
  const message = String(error?.message || "");
  if (/ENOTFOUND|querySrv/i.test(message)) return "DNS";
  if (/authentication failed|auth failed|Unauthorized/i.test(message)) return "AUTHENTICATION";
  if (/certificate|TLS|SSL|self-signed/i.test(message)) return "TLS";
  if (/ECONNREFUSED/i.test(message)) return "NETWORK_ACCESS_REFUSED";
  if (/timed out|ETIMEDOUT|server selection/i.test(message)) return "TIMEOUT_OR_NETWORK_ACCESS";
  return error?.name || "UNKNOWN";
};

const { uri, databaseName } = requireSafeTestDatabase();

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  console.log(`TEST DATABASE CONNECTION: PASS (${databaseName})`);
} catch (error) {
  console.error(`TEST DATABASE CONNECTION: FAIL (${classifyConnectionFailure(error)})`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
