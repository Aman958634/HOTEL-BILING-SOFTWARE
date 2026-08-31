import "dotenv/config";
import mongoose from "mongoose";

// Release tests use a freshly isolated database and exercise application
// queries, not schema migration. Avoid concurrent automatic index builds from
// every imported model, which otherwise keep the Node process alive long after
// a test has completed. Production index creation remains migration-managed.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const SAFE_DATABASE_NAME = /(?:^|[-_])(test|tests|testing|stage|staging|ci|verification|verify)(?:[-_]|$)/i;
const UNSAFE_DATABASE_NAME = /(?:production|prod|live)/i;

const redactHost = (uri) => {
  try {
    const parsed = new URL(uri);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"
      ? "local"
      : "remote";
  } catch (_) {
    return "unknown";
  }
};

const databaseNameFromUri = (uri) => {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, "");
    return decodeURIComponent(pathname.split("/")[0] || "");
  } catch (_) {
    return "";
  }
};

const normalizedUri = (uri) => String(uri || "").trim().replace(/\/$/, "");

/**
 * Refuses to run database tests unless an explicitly named isolated database
 * was supplied.  It never returns or logs credentials.
 */
export const requireSafeTestDatabase = () => {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    throw new Error("Database tests refuse to run with NODE_ENV=production.");
  }

  const testUri = normalizedUri(process.env.TEST_MONGO_URI);
  const primaryUri = normalizedUri(process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!testUri) throw new Error("Database tests require TEST_MONGO_URI.");
  if (primaryUri && testUri === primaryUri) {
    throw new Error("TEST_MONGO_URI must not match the application MongoDB URI.");
  }

  const databaseName = databaseNameFromUri(testUri);
  const primaryDatabaseName = databaseNameFromUri(primaryUri);
  if (!databaseName || UNSAFE_DATABASE_NAME.test(databaseName) || !SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error("TEST_MONGO_URI must use an explicitly named test or staging database.");
  }
  if (primaryDatabaseName && databaseName === primaryDatabaseName) {
    throw new Error("TEST_MONGO_URI must not use the application database name.");
  }

  return {
    uri: testUri,
    databaseName,
    hostClass: redactHost(testUri),
  };
};
