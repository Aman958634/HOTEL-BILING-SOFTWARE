import assert from "node:assert/strict";
import { requireSafeTestDatabase } from "./testDatabase.js";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  TEST_MONGO_URI: process.env.TEST_MONGO_URI,
  MONGO_URI: process.env.MONGO_URI,
  MONGODB_URI: process.env.MONGODB_URI,
};
const safeUri = "mongodb://127.0.0.1:27027/restosphere_release_verification_test";

try {
  process.env.NODE_ENV = "test";
  delete process.env.TEST_MONGO_URI;
  assert.throws(() => requireSafeTestDatabase(), /require TEST_MONGO_URI/i);

  process.env.TEST_MONGO_URI = safeUri;
  process.env.MONGO_URI = safeUri;
  assert.throws(() => requireSafeTestDatabase(), /must not match/i);

  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/application_dev";
  process.env.TEST_MONGO_URI = "mongodb://127.0.0.1:27027/production";
  assert.throws(() => requireSafeTestDatabase(), /test or staging database/i);

  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/restosphere_verification";
  process.env.TEST_MONGO_URI = "mongodb://127.0.0.1:27027/restosphere_verification";
  assert.throws(() => requireSafeTestDatabase(), /must not use the application database name/i);

  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/application_dev";
  process.env.TEST_MONGO_URI = "mongodb://127.0.0.1:27027/restosphere_verification";
  assert.doesNotThrow(() => requireSafeTestDatabase());

  process.env.TEST_MONGO_URI = safeUri;
  process.env.NODE_ENV = "production";
  assert.throws(() => requireSafeTestDatabase(), /NODE_ENV=production/i);

  process.env.NODE_ENV = "test";
  const config = requireSafeTestDatabase();
  assert.equal(config.databaseName, "restosphere_release_verification_test");
  assert.equal(config.hostClass, "local");
  console.log("Test database safety guard tests passed.");
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
