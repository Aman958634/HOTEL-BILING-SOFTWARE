import assert from "node:assert/strict";
import express from "express";
import { settlementRefreshLimiter } from "../middleware/rateLimiter.js";
import restaurantRoutes from "../routes/settlementRoutes.js";
import superRoutes from "../routes/superAdminRoutes.js";
import app from "../app.js";

const route = (router, path) => router.stack.find((layer) => layer.route?.path === path).route.stack;
for (const [router, path] of [[restaurantRoutes, "/cashfree/splits/:id/refresh"], [restaurantRoutes, "/cashfree/vendor/refresh"], [superRoutes, "/settlements/transactions/:id/refresh"]]) {
  assert.ok(route(router, path).some((layer) => layer.handle === settlementRefreshLimiter), path);
}
const webhookLayers = app._router.stack.filter((layer) => layer.route?.path?.includes("cashfree") && layer.route?.path?.includes("webhook"));
assert.ok(webhookLayers.length > 0);
for (const layer of webhookLayers) assert.ok(layer.route.stack.every((item) => item.handle !== settlementRefreshLimiter));

const testApp = express();
testApp.use((req, _res, next) => { req.user = { _id: req.get("x-test-user") || "admin-one" }; next(); });
testApp.post("/refresh/:id", settlementRefreshLimiter, (_req, res) => res.sendStatus(200));
testApp.post("/webhook", (_req, res) => res.sendStatus(200));
const server = await new Promise((resolve) => { const instance = testApp.listen(0, "127.0.0.1", () => resolve(instance)); });
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (let i = 0; i < 10; i++) assert.equal((await fetch(`${base}/refresh/${i}`, { method: "POST" })).status, 200);
  const limited = await fetch(`${base}/refresh/another`, { method: "POST" });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.has("retry-after"));
  assert.equal((await fetch(`${base}/refresh/another`, { method: "POST", headers: { "x-test-user": "admin-two" } })).status, 200);
  assert.equal((await fetch(`${base}/webhook`, { method: "POST" })).status, 200);
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log("settlementRateLimit.test.js passed: both admin refresh routes covered, per-user 429, webhook unaffected.");
