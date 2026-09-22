import "dotenv/config";
import mongoose from "mongoose";

// Release tests use a freshly isolated database and exercise application
// queries, not schema migration. Avoid concurrent automatic index builds from
// every imported model, which otherwise keep the Node process alive long after
// a test has completed. Production index creation remains migration-managed.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const SAFE_DATABASE_NAME = /(?:^|[-_])(test|tests|testing|stage|staging|ci)(?:[-_]|$)/i;
const UNSAFE_DATABASE_NAME = /(?:production|prod|live)/i;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const normalizeHostname = (hostname) => String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();

const parseLocalTestUri = (uri) => {
  if (/^mongodb\+srv:/i.test(uri)) {
    throw new Error("TEST_MONGO_URI must use a local mongodb:// loopback host.");
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch (_) {
    throw new Error("TEST_MONGO_URI must be a valid local mongodb:// URI.");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (parsed.protocol !== "mongodb:" || !LOOPBACK_HOSTS.has(hostname)) {
    throw new Error("TEST_MONGO_URI must use an explicit loopback host.");
  }
  return parsed;
};

const redactHost = (uri) => {
  try {
    const parsed = new URL(uri);
    return LOOPBACK_HOSTS.has(normalizeHostname(parsed.hostname))
      ? "local"
      : "remote";
  } catch (_) {
    return "unknown";
  }
};

const databaseNameFromUri = (uri) => {
  try {
    const pathname = parseLocalTestUri(uri).pathname.replace(/^\/+/, "");
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

  // Validate the transport and host before a caller receives a URI that could
  // be passed to mongoose.connect(). Browser and integration tests are local
  // only; a test-looking database name on a remote host is never sufficient.
  parseLocalTestUri(testUri);

  const databaseName = databaseNameFromUri(testUri);
  if (!databaseName || UNSAFE_DATABASE_NAME.test(databaseName) || !SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error("TEST_MONGO_URI must use an explicitly named test or staging database.");
  }

  return {
    uri: testUri,
    databaseName,
    hostClass: redactHost(testUri),
  };
};
