import assert from "node:assert/strict";
import { validateProductionEnvironment } from "../config/envValidation.js";
import { assertCashfreeConfiguration, getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";
import { assertProductionMongoUri } from "../config/db.js";
import { assertEasySplitAvailable, assertEasySplitPaymentsAvailable } from "../services/cashfreeEasySplitService.js";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  CASHFREE_ENV: process.env.CASHFREE_ENV,
  CASHFREE_PAYMENTS_ENABLED: process.env.CASHFREE_PAYMENTS_ENABLED,
  CASHFREE_ENABLED: process.env.CASHFREE_ENABLED,
  CASHFREE_APP_ID: process.env.CASHFREE_APP_ID,
  CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
  CASHFREE_API_VERSION: process.env.CASHFREE_API_VERSION,
  CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED,
  CASHFREE_EASY_SPLIT_ENABLED: process.env.CASHFREE_EASY_SPLIT_ENABLED,
  MONGO_URI: process.env.MONGO_URI,
  MONGODB_URI: process.env.MONGODB_URI,
  CLIENT_URL: process.env.CLIENT_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  CASHFREE_RETURN_URL: process.env.CASHFREE_RETURN_URL,
  RELEASE_VERIFICATION_MONGO_URI: process.env.RELEASE_VERIFICATION_MONGO_URI,
};

try {
  process.env.NODE_ENV = "production";
  process.env.JWT_ACCESS_SECRET = "prod-access-secret";
  process.env.JWT_REFRESH_SECRET = "prod-refresh-secret";
  process.env.PUBLIC_MENU_CONTEXT_SECRET = "prod-public-menu-secret";
  process.env.CASHFREE_ENV = "sandbox";
  process.env.CASHFREE_PAYMENTS_ENABLED = "true";
  process.env.CASHFREE_APP_ID = "prod-app-id";
  process.env.CASHFREE_SECRET_KEY = "prod-secret";
  process.env.CASHFREE_API_VERSION = "2026-01-01";
  process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_ENABLED = "false";
  process.env.MONGO_URI = "mongodb+srv://user:pass@cluster.example.mongodb.net/restosphere_prod";
  process.env.CLIENT_URL = "https://app.example.com";
  process.env.ALLOWED_ORIGINS = "https://app.example.com";
  process.env.CASHFREE_RETURN_URL = "https://app.example.com/payment/cashfree/return";

  assert.throws(() => validateProductionEnvironment(), /CASHFREE_ENV=production/i);

  process.env.CASHFREE_ENV = "production";
  delete process.env.CASHFREE_APP_ID;
  assert.throws(() => validateProductionEnvironment(), /missing/i);

  process.env.CASHFREE_APP_ID = "prod-app-id";
  process.env.CASHFREE_SECRET_KEY = "prod-secret";
  process.env.CASHFREE_RETURN_URL = "http://localhost:5173/payment/cashfree/return";
  assert.throws(() => validateProductionEnvironment(), /HTTPS|localhost/i);

  process.env.CASHFREE_RETURN_URL = "http://app.example.com/payment/cashfree/return";
  assert.throws(() => validateProductionEnvironment(), /HTTPS/i);

  process.env.CASHFREE_RETURN_URL = "https://app.example.com/payment/cashfree/return";
  assert.doesNotThrow(() => validateProductionEnvironment());
  assert.doesNotThrow(() => assertCashfreeConfiguration());
  assert.equal(getCashfreeConfig().environment, "production");
  assert.equal(getCashfreeReturnUrl(), "https://app.example.com/payment/cashfree/return?order_id={order_id}");
  process.env.CASHFREE_EASY_SPLIT_ENABLED = "true";
  process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "true";
  assert.equal(assertEasySplitAvailable().environment, "production");
  assert.equal(assertEasySplitPaymentsAvailable().environment, "production");
  process.env.CASHFREE_EASY_SPLIT_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "false";

  assert.throws(() => assertProductionMongoUri("mongodb://localhost:27017/restosphere"), /localhost|test database URI/i);
  assert.throws(() => assertProductionMongoUri("mongodb://127.0.0.1:27017/restosphere"), /localhost|test database URI/i);
  assert.doesNotThrow(() => assertProductionMongoUri("mongodb+srv://user:pass@cluster.example.mongodb.net/restosphere_prod"));

  delete process.env.RELEASE_VERIFICATION_MONGO_URI;

  console.log("productionConfigSafety.test.js passed");
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
