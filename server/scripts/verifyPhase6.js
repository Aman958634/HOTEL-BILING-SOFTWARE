import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProductionEnvironment } from "../config/envValidation.js";
import { assertCashfreeConfiguration, getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";
import { assertProductionMongoUri } from "../config/db.js";
import { isOriginAllowed } from "../utils/allowedOrigins.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(serverRoot, "..");
const isolatedTestMongoUri = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
const productionFrontend = "https://hotel-biling-software.vercel.app";
const productionBackend = "https://hotel-biling-software.onrender.com";

const originalEnv = { ...process.env };
const restoreEnv = () => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
};

const assertProductionContract = () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "phase6-verification-access",
    JWT_REFRESH_SECRET: "phase6-verification-refresh",
    PUBLIC_MENU_CONTEXT_SECRET: "phase6-verification-menu",
    MONGO_URI: "mongodb+srv://verification:placeholder@cluster.example.mongodb.net/restosphere_prod",
    CLIENT_URL: productionFrontend,
    ALLOWED_ORIGINS: productionFrontend,
    CASHFREE_ENV: "production",
    CASHFREE_APP_ID: "phase6-verification-app",
    CASHFREE_SECRET_KEY: "phase6-verification-secret",
    CASHFREE_API_VERSION: "2026-01-01",
    CASHFREE_PAYMENTS_ENABLED: "false",
    CASHFREE_EASY_SPLIT_ENABLED: "true",
    CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "true",
    CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED: "false",
    CASHFREE_RETURN_URL: `${productionFrontend}/payment/cashfree/return`,
  });

  validateProductionEnvironment();
  assert.equal(assertCashfreeConfiguration().environment, "production");
  assert.equal(getCashfreeConfig().baseUrl, "https://api.cashfree.com/pg");
  assert.equal(getCashfreeReturnUrl(), `${productionFrontend}/payment/cashfree/return?order_id={order_id}`);
  assert.doesNotThrow(() => assertProductionMongoUri(process.env.MONGO_URI));
  assert.throws(() => assertProductionMongoUri("mongodb://127.0.0.1:27017/restosphere_cashfree_test"), /localhost|test database URI/i);

  process.env.CASHFREE_ENV = "sandbox";
  assert.throws(() => validateProductionEnvironment(), /CASHFREE_ENV=production/i);
  process.env.CASHFREE_ENV = "production";

  assert.equal(isOriginAllowed(productionFrontend), true);
  assert.equal(isOriginAllowed("https://example.invalid"), false);
};

const assertClientContract = () => {
  const clientSource = path.join(repoRoot, "client", "src");
  const sourceFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) sourceFiles.push(entryPath);
    }
  };
  visit(clientSource);
  const source = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.match(source, /import\.meta\.env\.VITE_API_URL/);
  assert.match(source, /import\.meta\.env\.VITE_SOCKET_URL/);
  assert.doesNotMatch(source, /VITE_[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|MONGO|SMTP|CASHFREE)/i);
  assert.doesNotMatch(source, /CASHFREE_SECRET_KEY|JWT_(ACCESS|REFRESH)_SECRET|MONGO_URI|SMTP_PASS/i);
};

const assertDeploymentConfig = () => {
  const clientPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "client", "package.json"), "utf8"));
  assert.equal(clientPackage.scripts.build, "vite build");
  const vercel = JSON.parse(fs.readFileSync(path.join(repoRoot, "client", "vercel.json"), "utf8"));
  assert.ok(vercel.rewrites?.some((rewrite) => rewrite.destination === "/index.html"));
  assert.ok(fs.existsSync(path.join(repoRoot, "Dockerfile.server")));
  assert.match(fs.readFileSync(path.join(repoRoot, "Dockerfile.server"), "utf8"), /CMD \["node", "server\.js"\]/);
  const render = fs.readFileSync(path.join(repoRoot, "render.yaml"), "utf8");
  assert.match(render, /name:\s*hotel-biling-software/);
  assert.match(render, /rootDir:\s*server/);
  assert.match(render, /healthCheckPath:\s*\/api\/v1\/health/);
};

const assertRouteContracts = () => {
  const app = fs.readFileSync(path.join(serverRoot, "app.js"), "utf8");
  const cashfreeController = fs.readFileSync(path.join(serverRoot, "controllers", "cashfreeController.js"), "utf8");
  const worker = fs.readFileSync(path.join(serverRoot, "services", "settlementReconciliationWorker.js"), "utf8");
  assert.match(app, /app\.post\("\/api\/webhooks\/cashfree", express\.raw/);
  assert.match(app, /app\.get\("\/api\/v1\/health"/);
  assert.match(app, /app\.get\("\/api\/v1\/ready"/);
  assert.match(cashfreeController, /verifyCashfreeWebhook/);
  assert.match(cashfreeController, /processCashfreeSettlementWebhook/);
  assert.match(worker, /limit\(batchSize\)/);
  assert.match(worker, /already_running/);
  assert.match(worker, /settlementReconciliationEnabled/);
  assert.equal(`${productionBackend}/api/webhooks/cashfree`, "https://hotel-biling-software.onrender.com/api/webhooks/cashfree");
};

const runHealthProbe = async () => {
  process.env.NODE_ENV = "test";
  const { default: app } = await import("../app.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const ready = await fetch(`http://127.0.0.1:${port}/api/v1/ready`);
    assert.equal(health.status, 200);
    assert.ok([200, 503].includes(ready.status));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const runSuite = (name) => {
  const result = spawnSync(process.execPath, ["--import", "./tests/phase4NetworkGuard.js", `tests/${name}.test.js`], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: "test", TEST_MONGO_URI: isolatedTestMongoUri },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Phase 6 delegated suite failed: ${name}`);
  }
};

try {
  assertProductionContract();
  assertClientContract();
  assertDeploymentConfig();
  assertRouteContracts();
  await runHealthProbe();
  restoreEnv();

  const phase5 = spawnSync(process.execPath, ["scripts/verifyPhase5.js"], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: "test", TEST_MONGO_URI: isolatedTestMongoUri },
    encoding: "utf8",
  });
  if (phase5.status !== 0) {
    process.stderr.write(phase5.stdout || "");
    process.stderr.write(phase5.stderr || "");
    throw new Error("Phase 5 regression verification failed");
  }
  runSuite("killSwitches");
  console.log("Phase 6 software readiness passed: production contracts, route safety, health/readiness, deployment config, Phase 5 regression, and kill switches.");
} finally {
  restoreEnv();
}