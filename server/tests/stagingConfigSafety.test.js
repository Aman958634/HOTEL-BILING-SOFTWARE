import assert from "node:assert/strict";
import { isApprovedStagingMongoTarget, validateStagingEnvironment } from "../config/envValidation.js";
import { getAllowedOrigins } from "../utils/allowedOrigins.js";

const original = { ...process.env };
const reset = () => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, original);
};
const staging = () => {
  process.env.NODE_ENV = "staging";
  process.env.MONGO_URI = "mongodb+srv://staging-user:placeholder@staging.example.mongodb.net/restosphere_staging";
  delete process.env.MONGODB_URI;
  process.env.STAGING_MONGODB_HOSTS = "staging.example.mongodb.net";
  process.env.STAGING_PRODUCTION_MONGODB_HOSTS = "production.example.mongodb.net";
  process.env.STAGING_MONGODB_DATABASE = "restosphere_staging";
  process.env.JWT_ACCESS_SECRET = "staging-access-secret";
  process.env.JWT_REFRESH_SECRET = "staging-refresh-secret";
  process.env.PUBLIC_MENU_ENABLED = "true";
  process.env.PUBLIC_MENU_CONTEXT_SECRET = "staging-public-menu-context-secret";
  process.env.CLIENT_URL = "https://staging-ui.example.invalid";
  process.env.ALLOWED_ORIGINS = "https://staging-ui.example.invalid";
  process.env.BILLING_TEST_MODE = "true";
  process.env.CASHFREE_ENV = "sandbox";
  process.env.LIVE_DIGITAL_PAYMENTS = "false";
  process.env.CASHFREE_PAYMENTS_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "false";
  process.env.CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED = "false";
  process.env.BACKUP_ENABLED = "false";
  process.env.ENABLE_BACKUP_RESTORE = "false";
  process.env.BACKUP_RESTORE_MAINTENANCE_MODE = "false";
  process.env.RUN_STARTUP_DATA_BOOTSTRAP = "false";
  process.env.SUPER_ADMIN_SEED = "false";
  delete process.env.RAZORPAY_KEY_ID;
};

try {
  staging();
  assert.doesNotThrow(() => validateStagingEnvironment());
  assert.equal(isApprovedStagingMongoTarget(process.env.MONGO_URI), true);
  assert.deepEqual(getAllowedOrigins(), ["https://staging-ui.example.invalid"]);

  staging();
  process.env.MONGO_URI = "mongodb+srv://staging-user:placeholder@production.example.mongodb.net/restosphere_staging";
  assert.throws(() => validateStagingEnvironment(), /production|allowlist|hostname/i);
  assert.equal(isApprovedStagingMongoTarget(process.env.MONGO_URI), false);

  staging();
  process.env.MONGO_URI = "mongodb+srv://staging-user:placeholder@unknown.example.mongodb.net/restosphere_staging";
  assert.throws(() => validateStagingEnvironment(), /allowlist|hostname/i);

  staging();
  process.env.MONGO_URI = "mongodb+srv://staging-user:placeholder@staging.example.mongodb.net/restosphere_prod";
  assert.throws(() => validateStagingEnvironment(), /database/i);

  staging();
  process.env.MONGO_URI = "mongodb://staging.example.mongodb.net/restosphere_staging?tls=false";
  assert.throws(() => validateStagingEnvironment(), /TLS|mongodb\+srv/i);
  assert.equal(isApprovedStagingMongoTarget(process.env.MONGO_URI), false);

  staging();
  process.env.ALLOWED_ORIGINS = "http://localhost:5173";
  assert.throws(() => validateStagingEnvironment(), /HTTPS|localhost/i);

  staging();
  process.env.RAZORPAY_KEY_ID = "rzp_live_not_allowed";
  assert.throws(() => validateStagingEnvironment(), /Razorpay test key/i);

  staging();
  delete process.env.PUBLIC_MENU_CONTEXT_SECRET;
  assert.throws(() => validateStagingEnvironment(), /PUBLIC_MENU_CONTEXT_SECRET/);

  staging();
  process.env.PUBLIC_MENU_ENABLED = "false";
  delete process.env.PUBLIC_MENU_CONTEXT_SECRET;
  assert.doesNotThrow(() => validateStagingEnvironment());

  for (const name of [
    "CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED",
    "BACKUP_ENABLED",
    "ENABLE_BACKUP_RESTORE",
    "BACKUP_RESTORE_MAINTENANCE_MODE",
    "RUN_STARTUP_DATA_BOOTSTRAP",
    "SUPER_ADMIN_SEED",
  ]) {
    staging();
    process.env[name] = "true";
    assert.throws(() => validateStagingEnvironment(), new RegExp(`${name}=false`));
    staging();
    delete process.env[name];
    assert.throws(() => validateStagingEnvironment(), new RegExp(`${name}=false`));
  }

  console.log("stagingConfigSafety.test.js passed: exact staging MongoDB binding, CORS, sandbox payment flags, and Razorpay test-key guard.");
} finally {
  reset();
}
