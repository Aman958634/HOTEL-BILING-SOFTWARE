import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProductionEnvironment } from "../config/envValidation.js";
import { assertCashfreeConfiguration, getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";
import { isOriginAllowed } from "../utils/allowedOrigins.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(serverRoot, "..");
const frontend = "https://hotel-biling-software.vercel.app";
const backend = "https://hotel-biling-software.onrender.com";
const webhookUrl = `${backend}/api/webhooks/cashfree`;
const returnUrl = `${frontend}/payment/cashfree/return?order_id={order_id}`;
const testMongoUri = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
const originalEnv = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
};

const read = (...parts) => fs.readFileSync(path.join(serverRoot, ...parts), "utf8");
const visit = (directory, files = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file, files);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(file);
  }
  return files;
};

const assertProductionContracts = () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "phase7-access",
    JWT_REFRESH_SECRET: "phase7-refresh",
    PUBLIC_MENU_CONTEXT_SECRET: "phase7-public-menu",
    MONGO_URI: "mongodb+srv://verification:placeholder@cluster.example.mongodb.net/restosphere_prod",
    CLIENT_URL: frontend,
    ALLOWED_ORIGINS: frontend,
    CASHFREE_ENV: "production",
    CASHFREE_APP_ID: "phase7-production-app",
    CASHFREE_SECRET_KEY: "phase7-production-secret",
    CASHFREE_API_VERSION: "2026-01-01",
    CASHFREE_PAYMENTS_ENABLED: "false",
    CASHFREE_EASY_SPLIT_ENABLED: "true",
    CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "false",
    CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED: "false",
    CASHFREE_RETURN_URL: `${frontend}/payment/cashfree/return`,
  });
  validateProductionEnvironment();
  const config = assertCashfreeConfiguration();
  assert.equal(config.environment, "production");
  assert.equal(config.baseUrl, "https://api.cashfree.com/pg");
  assert.equal(config.enabled, false);
  assert.equal(config.easySplitPaymentsEnabled, false);
  assert.equal(config.settlementReconciliationEnabled, false);
  assert.equal(getCashfreeReturnUrl(), returnUrl);
  assert.equal(isOriginAllowed(frontend), true);
  assert.equal(isOriginAllowed("https://example.invalid"), false);
  process.env.CASHFREE_ENV = "sandbox";
  assert.throws(validateProductionEnvironment, /CASHFREE_ENV=production/);
  process.env.CASHFREE_ENV = "production";
  delete process.env.CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED;
  assert.throws(validateProductionEnvironment, /CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED/);
};

const assertStaticContracts = () => {
  const app = read("app.js");
  const config = read("config", "cashfree.js");
  const orderCreation = read("services", "cashfreeOrderCreationService.js");
  const split = read("services", "cashfreeOrderSplitService.js");
  const settlement = read("services", "easySplitSettlementService.js");
  const worker = read("services", "settlementReconciliationWorker.js");
  const webhook = read("controllers", "cashfreeController.js");
  const payment = read("models", "Payment.js");
  const profile = read("models", "RestaurantSettlementProfile.js");
  const transaction = read("models", "SettlementTransaction.js");
  const safeLog = read("utils", "safeLog.js");
  const errorHandler = read("middleware", "errorHandler.js");
  const rateLimiter = read("middleware", "rateLimiter.js");
  const fixtureGuard = read("utils", "cashfreeFixtureGuard.js");

  assert.match(config, /production:\s*"https:\/\/api\.cashfree\.com\/pg"/);
  assert.doesNotMatch(config, /production:\s*"https:\/\/(?:sandbox|localhost|mock)/i);
  assert.match(orderCreation, /NODE_ENV === "production" && !config\.enabled/);
  assert.match(orderCreation, /!config\.easySplitEnabled \|\| !config\.easySplitPaymentsEnabled/);
  assert.match(orderCreation, /Idempotency-Key|idempotencyKey|providerOrderIdempotencyKey/);
  assert.match(orderCreation, /ensureOrderSplitTransaction/);
  assert.match(split, /ORDER_CREATION_SPLIT/);
  assert.match(split, /getEasySplitVendor\(profile\.providerVendorId\)/);
  assert.match(split, /RestaurantSettlementProfile\.findOne\(\{ restaurant: order\.restaurant, provider: "CASHFREE" \}\)/);
  assert.match(split, /providerVendorId: profile\.providerVendorId/);
  assert.match(split, /calculateCommissionSplit/);
  assert.match(settlement, /payment\.allocationStrategy === ORDER_CREATION_SPLIT\) return reconcileOrderCreationSplit/);
  assert.match(split, /providerStatus: "ALLOCATED"/);
  assert.match(split, /settlementStatus = vendor\.settled === "YES" \? "SETTLED" : "PENDING"/);
  assert.match(worker, /settlementReconciliationEnabled/);
  assert.match(worker, /limit\(batchSize\)/);
  assert.match(worker, /already_running/);
  assert.match(app, /app\.post\("\/api\/webhooks\/cashfree", express\.raw/);
  assert.match(webhook, /verifyCashfreeWebhook/);
  assert.match(webhook, /PAYMENT_SUCCESS_WEBHOOK/);
  assert.match(profile, /settlement_profile_restaurant_provider_unique/);
  assert.match(profile, /providerVendorId:.*unique: true/);
  assert.match(transaction, /allocationStrategy:.*ORDER_CREATION_SPLIT/);
  assert.match(transaction, /settlement_payment_provider_unique/);
  assert.match(payment, /providerOrderIdempotencyKey/);
  assert.match(safeLog, /CASHFREE_SECRET_KEY/);
  assert.match(errorHandler, /statusCode >= 500.*Internal server error/);
  assert.match(rateLimiter, /paymentLimiter/);
  assert.match(fixtureGuard, /refuse NODE_ENV=production/);
};

const assertClientContracts = () => {
  const clientSource = visit(path.join(repoRoot, "client", "src"));
  const all = clientSource.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const constants = fs.readFileSync(path.join(repoRoot, "client", "src", "utils", "constants.js"), "utf8");
  const checkout = fs.readFileSync(path.join(repoRoot, "client", "src", "utils", "cashfreeCheckout.js"), "utf8");
  assert.match(constants, /VITE_API_URL/);
  assert.match(constants, /VITE_SOCKET_URL/);
  assert.match(constants, /Production frontend configuration requires/);
  assert.match(checkout, /\["sandbox", "production"\]/);
  assert.doesNotMatch(all, /CASHFREE_SECRET_KEY|JWT_(ACCESS|REFRESH)_SECRET|MONGO_URI|MONGODB_URI/);
  assert.doesNotMatch(all, /VITE_[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|MONGO|CASHFREE)/i);
};

const runSuite = (name) => {
  const result = spawnSync(process.execPath, ["--import", "./tests/phase4NetworkGuard.js", `tests/${name}.test.js`], {
    cwd: serverRoot,
    env: { ...originalEnv, NODE_ENV: "test", TEST_MONGO_URI: testMongoUri },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Phase 7 delegated suite failed: ${name}`);
  }
};

const verifyLiveReadOnlyEndpoints = async () => {
  if (String(process.env.PHASE7_SKIP_LIVE_PROBE || "").toLowerCase() === "true") return "SKIPPED";
  const [health, ready, ui] = await Promise.all([
    fetch(`${backend}/api/v1/health`),
    fetch(`${backend}/api/v1/ready`),
    fetch(frontend, { redirect: "error" }),
  ]);
  assert.equal(health.status, 200);
  assert.equal(ready.status, 200);
  assert.equal(ui.status, 200);
  const healthBody = await health.json();
  const readyBody = await ready.json();
  assert.equal(healthBody?.status, "ok");
  assert.equal(readyBody?.status, "ready");
  return "PASS";
};

try {
  assertProductionContracts();
  assertStaticContracts();
  assertClientContracts();
  restoreEnv();
  if (String(process.env.PHASE7_RUN_ISOLATED_SUITES || "").toLowerCase() === "true") for (const suite of ["productionConfigSafety", "killSwitches", "paymentSecurity", "paymentState", "paymentIdempotency", "commissionSafety", "backgroundReconciliation", "settlementLifecycle", "tenantIsolation", "tenantOutletSecurity", "rolePermissions", "webhookSecurity", "cashfreeOrderCreationSplitDb"]) runSuite(suite);
  const liveProbe = await verifyLiveReadOnlyEndpoints();
  console.log(`Phase 7 verifier passed: static production contracts and read-only production probes (${liveProbe}). Set PHASE7_RUN_ISOLATED_SUITES=true to include isolated payment-security suites.`);
  console.log(`Webhook dashboard URL: ${webhookUrl}`);
  console.log(`Cashfree return URL: ${returnUrl}`);
} finally {
  restoreEnv();
}
