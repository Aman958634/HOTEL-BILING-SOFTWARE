import assert from "node:assert/strict";
import test from "node:test";
import { requestContext } from "../middleware/requestContext.js";

test("preserves a bounded incoming request ID and returns it", () => {
  const headers = {};
  const req = { method: "GET", get: (name) => name === "X-Request-Id" ? "support-trace-123" : undefined, originalUrl: "/health" };
  const res = { setHeader: (name, value) => { headers[name] = value; }, on: () => {} };
  requestContext(req, res, () => {});
  assert.equal(req.requestId, "support-trace-123");
  assert.equal(headers["X-Request-Id"], "support-trace-123");
});

test("replaces an unsafe incoming request ID", () => {
  const headers = {};
  const req = { method: "GET", get: () => "bad id with spaces", originalUrl: "/health" };
  const res = { setHeader: (name, value) => { headers[name] = value; }, on: () => {} };
  requestContext(req, res, () => {});
  assert.notEqual(req.requestId, "bad id with spaces");
  assert.equal(headers["X-Request-Id"], req.requestId);
});
