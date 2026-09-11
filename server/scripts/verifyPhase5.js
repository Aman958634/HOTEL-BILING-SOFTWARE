import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";
import { validateProductionEnvironment } from "../config/envValidation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredDocs = [
  path.resolve(root, "../docs/PHASE5_PRODUCTION_ACTIVATION_PREPARATION.md"),
  path.resolve(root, "../docs/PRODUCTION_PAYMENT_READINESS.md"),
];
for (const file of requiredDocs) assert.ok(fs.existsSync(file), `Missing Phase 5 artifact: ${file}`);

const original = { ...process.env };
try {
  process.env.NODE_ENV = "production";
  process.env.JWT_ACCESS_SECRET = "phase5-access-secret";
  process.env.JWT_REFRESH_SECRET = "phase5-refresh-secret";
  process.env.PUBLIC_MENU_CONTEXT_SECRET = "phase5-menu-secret";
  process.env.MONGO_URI = "mongodb+srv://user:password@cluster.example.mongodb.net/restosphere_prod";
  process.env.CLIENT_URL = "https://app.example.com";
  process.env.ALLOWED_ORIGINS = "https://app.example.com";
  process.env.CASHFREE_ENV = "production";
  process.env.CASHFREE_APP_ID = "production-app-id";
  process.env.CASHFREE_SECRET_KEY = "production-secret-key";
  process.env.CASHFREE_API_VERSION = "2026-01-01";
  process.env.CASHFREE_PAYMENTS_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_ENABLED = "false";
  process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "false";
  process.env.CASHFREE_RETURN_URL = "https://app.example.com/payment/cashfree/return";
  validateProductionEnvironment();
  assert.equal(getCashfreeConfig().baseUrl, "https://api.cashfree.com/pg");
  assert.equal(getCashfreeReturnUrl(), "https://app.example.com/payment/cashfree/return?order_id={order_id}");

  for (const key of ["CASHFREE_ENV", "CASHFREE_APP_ID", "CASHFREE_SECRET_KEY", "CASHFREE_PAYMENTS_ENABLED", "CASHFREE_EASY_SPLIT_ENABLED", "CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED"]) {
    delete process.env[key];
    assert.throws(() => validateProductionEnvironment(), /missing|CASHFREE_ENV/i, `missing ${key} must fail`);
    process.env[key] = original[key] || ({ CASHFREE_ENV: "production", CASHFREE_APP_ID: "production-app-id", CASHFREE_SECRET_KEY: "production-secret-key", CASHFREE_PAYMENTS_ENABLED: "false", CASHFREE_EASY_SPLIT_ENABLED: "false", CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "false" }[key]);
  }
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  for (const [key, value] of Object.entries(original)) process.env[key] = value;
}

const suites = [
  "productionConfigSafety", "cashfreePayment", "paymentSecurity", "paymentState", "paymentIdempotency",
  "webhookSecurity", "easySplitVendor", "easySplitSettlement", "settlementLifecycle", "commissionSafety",
  "tenantIsolation", "tenantOutletSecurity", "rolePermissions", "fixtureGuard", "settlementRateLimit",
  "operationalSafety", "errorHandling", "indexMigrationSafety", "backgroundReconciliation", "killSwitches",
  "releaseVerification",
];
const missing = suites.filter((name) => !fs.existsSync(path.join(root, "tests", `${name}.test.js`)));
if (missing.length) throw new Error(`Phase 5 verifier requires these focused suites: ${missing.join(", ")}`);
for (const name of suites) {
  const result = spawnSync(process.execPath, ["--import", "./tests/phase4NetworkGuard.js", `tests/${name}.test.js`], { cwd: root, env: { ...process.env, NODE_ENV: "test" }, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Phase 5 suite failed: ${name}`);
  }
}
console.log(`Phase 5 safe verification passed: ${suites.length} focused suites; no provider writes or production database access performed.`);
