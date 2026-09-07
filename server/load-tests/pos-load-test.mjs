import "dotenv/config";
import autocannon from "autocannon";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import KotTicket from "../models/KotTicket.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LOAD_TEST_PORT || 5018);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;
const password = "LoadTest-Only-Password-2026!";
const maxOrders = Number(process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] || 100);
const runId = `load-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;

const databaseName = (uri) => {
  try { return decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, "").split("/")[0] || ""); } catch { return ""; }
};

const verifySafeDatabase = () => {
  const uri = String(process.env.TEST_MONGO_URI || "").trim();
  const name = databaseName(uri);
  let host = "";
  try { host = new URL(uri).hostname.toLowerCase(); } catch { /* invalid URI is rejected below */ }
  if (!uri || !name || !/(?:test|load_test)/i.test(name) || !["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("LOAD TEST ABORTED — SAFE TEST DATABASE NOT VERIFIED");
  }
  return { uri, name };
};

const json = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

const provision = async ({ name }) => {
  await mongoose.connect(process.env.TEST_MONGO_URI, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  const restaurant = await Restaurant.create({ name: `RestoSphere Load ${runId}`, slug: runId, branchCode: runId.slice(-8).toUpperCase(), address: "Local load test", city: "Test City", state: "Test State" });
  const outlet = await Outlet.create({ restaurant: restaurant._id, name: `Load Outlet ${runId}`, code: runId.slice(-8), address: "Local load test", isDefault: true });
  const user = await User.create({ fullName: `Load Operator ${runId}`, email: `${runId}@load.test`, password, role: "admin", restaurant: restaurant._id, defaultOutlet: outlet._id, allOutletsAccess: true, outletAccess: [{ outlet: outlet._id, role: "admin", isActive: true }] });
  await Subscription.create({ restaurant: restaurant._id, planName: "load-test", status: "active", price: 0, billingCycle: "monthly", startDate: new Date(), subscriptionStartAt: new Date() });
  const category = await Category.create({ restaurant: restaurant._id, name: `Load Category ${runId}`, slug: runId, active: true, isActive: true });
  const food = await Food.create({ restaurant: restaurant._id, category: category._id, name: `Load Item ${runId}`, price: 100, preparationTime: 1, prepTimeMins: 1, isAvailable: true, available: true, foodType: "vegetarian" });
  const tables = await Table.insertMany(Array.from({ length: Math.max(100, maxOrders + 1) }, (_, index) => ({ tableNumber: `${runId.slice(-6)}-${index + 1}`, restaurant: restaurant._id, outlet: outlet._id, capacity: 4, floor: "Load Test", section: "Load Test", status: "AVAILABLE" })));
  const login = await json(`${BASE_URL}/auth/login`, { method: "POST", body: JSON.stringify({ email: user.email, password }) });
  if (!login.response.ok || !login.body?.data?.accessToken) throw new Error(`Test login failed with HTTP ${login.response.status}`);
  return { name, restaurant, outlet, food, tables, token: login.body.data.accessToken };
};

const requestOrder = async ({ fixture, index, key, quantity = 1 }) => {
  const payload = { orderType: "DINE_IN", orderSource: "DINE_IN", table: fixture.tables[index]._id, items: [{ menuItem: fixture.food._id, quantity }], paymentMethod: "CASH", notes: runId, externalOrderId: `${runId}:${index}` };
  const result = await new Promise((resolve, reject) => {
    autocannon({ url: `http://127.0.0.1:${PORT}`, connections: 1, amount: 1, headers: { authorization: `Bearer ${fixture.token}`, "x-outlet-id": String(fixture.outlet._id), "idempotency-key": key }, requests: [{ method: "POST", path: "/api/v1/orders/", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }] }, (error, data) => error ? reject(error) : resolve(data));
  });
  const statusCounts = {};
  for (const [status, count] of Object.entries(result.statusCodeStats || {})) statusCounts[status] = count;
  const status = Number(Object.keys(statusCounts)[0] || 0);
  return { status, latency: Number(result.latency?.average || 0), ok: status >= 200 && status < 300, payload };
};

const quantile = (values, percentile) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)];
};

const runBatch = async (fixture, count, startIndex, expectedTotal) => {
  const results = [];
  let cursor = 0;
  const worker = async () => { while (cursor < count) { const index = cursor++; results.push(await requestOrder({ fixture, index: startIndex + index, key: `${runId}:${startIndex + index}` })); } };
  await Promise.all(Array.from({ length: Math.min(20, count) }, worker));
  const statusCounts = {};
  results.forEach((item) => { statusCounts[item.status] = (statusCounts[item.status] || 0) + 1; });
  const latencies = results.map((item) => item.latency);
  const orders = await Order.find({ restaurant: fixture.restaurant._id, notes: runId }).select("_id").lean();
  const actualKots = await KotTicket.countDocuments({ restaurant: fixture.restaurant._id, orderId: { $in: orders.map((order) => order._id) } });
  return { scenario: expectedTotal, requests: count, success: results.filter((item) => item.ok).length, failures: results.filter((item) => !item.ok).length, p50: quantile(latencies, 0.5), p95: quantile(latencies, 0.95), p99: quantile(latencies, 0.99), rps: count / (Math.max(...latencies, 1) / 1000), statusCounts, expectedOrders: expectedTotal, actualOrders: orders.length, expectedKots: expectedTotal, actualKots, duplicateOrders: Math.max(0, orders.length - expectedTotal), duplicateKots: Math.max(0, actualKots - expectedTotal) };
};

const waitForReady = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const health = await json(`${BASE_URL}/health`);
      const ready = await json(`${BASE_URL}/ready`);
      if (health.response.ok && ready.response.ok) return { health: health.body, ready: ready.body };
    } catch { /* server is still starting */ }
    await delay(250);
  }
  throw new Error("Local load-test server did not become ready");
};
const startServer = () => {
  const server = spawn(process.execPath, [path.join(ROOT, "..", "server.js")], { cwd: path.join(ROOT, ".."), env: { ...process.env, LOAD_TEST_MODE: "true", TEST_MONGO_URI: process.env.TEST_MONGO_URI, PORT: String(PORT), NODE_ENV: "test", LIVE_DIGITAL_PAYMENTS: "false", SUPER_ADMIN_SEED: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  server.startupErrors = [];
  server.stdout.on("data", (chunk) => { server.startupErrors.push(String(chunk).slice(-2000)); });
  server.stderr.on("data", (chunk) => { server.startupErrors.push(String(chunk).slice(-2000)); });
  server.on("exit", (code, signal) => { server.startupErrors.push(`child exited code=${code} signal=${signal || "none"}`); });
  return server;
};

const main = async () => {
  const safe = verifySafeDatabase();
  const server = startServer();
  try {
    const probes = await waitForReady();
    const fixture = await provision(safe);
    const smoke = await requestOrder({ fixture, index: 0, key: `${runId}:smoke` });
    if (!smoke.ok) throw new Error(`One-order smoke failed with HTTP ${smoke.status}`);
    const smokeOrders = await Order.countDocuments({ restaurant: fixture.restaurant._id, notes: runId });
    const smokeKots = await KotTicket.countDocuments({ restaurant: fixture.restaurant._id, orderId: { $in: await Order.find({ restaurant: fixture.restaurant._id, notes: runId }).distinct("_id") } });
    if (smokeOrders !== 1 || smokeKots !== 1) throw new Error(`One-order correctness failed: orders=${smokeOrders}, kots=${smokeKots}`);
    const retry = await requestOrder({ fixture, index: 0, key: `${runId}:smoke` });
    if (!retry.ok) throw new Error(`Idempotency retry failed with HTTP ${retry.status}`);
    const conflict = await json(`${BASE_URL}/orders/`, { method: "POST", headers: { authorization: `Bearer ${fixture.token}`, "x-outlet-id": String(fixture.outlet._id), "idempotency-key": `${runId}:smoke` }, body: JSON.stringify({ ...smoke.payload, items: [{ menuItem: fixture.food._id, quantity: 2 }] }) });
    if (conflict.response.status !== 409) throw new Error(`Idempotency conflict expected HTTP 409, got ${conflict.response.status}`);
    const batches = [];
    let completed = 1;
    for (const target of [5, 10, 20, 50, 100]) {
      if (target > maxOrders) break;
      const additional = target - completed;
      const batch = await runBatch(fixture, additional, completed, target);
      batches.push(batch);
      if (batch.failures || batch.duplicateOrders || batch.duplicateKots || batch.actualOrders !== target || batch.actualKots !== target) throw new Error(`Correctness failure at ${target} orders`);
      completed = target;
    }
    const result = { runId, environment: "local-test", database: safe.name, scenario: "POS order to KOT", smoke: { orders: smokeOrders, kots: smokeKots }, idempotency: { samePayload: true, differentPayloadConflict: true }, batches, health: probes.health, readiness: probes.ready };
    await mkdir(path.join(ROOT, "results"), { recursive: true });
    await writeFile(path.join(ROOT, "results", "latest.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const startupError = server.startupErrors?.join("\n").trim();
    throw new Error(startupError ? `${error.message}\n${startupError}` : error.message);
  } finally {
    server.kill("SIGTERM");
    await mongoose.disconnect();
  }
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; });