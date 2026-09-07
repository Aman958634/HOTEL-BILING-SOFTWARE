import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive, safeErrorContext } from "../utils/safeLog.js";
import { isReadyState, markShuttingDown, markStartupComplete, resetForTests } from "../utils/shutdownState.js";

test("redacts nested credentials and tokens", () => {
  const output = redactSensitive({ Authorization: "Bearer secret", nested: { password: "pw", value: "ok" }, list: [{ refreshToken: "refresh" }] });
  assert.deepEqual(output, { Authorization: "[REDACTED]", nested: { password: "[REDACTED]", value: "ok" }, list: [{ refreshToken: "[REDACTED]" }] });
});

test("safe error context excludes stack and preserves bounded diagnostics", () => {
  const output = safeErrorContext(Object.assign(new Error("database failed"), { code: "DB_ERROR" }));
  assert.deepEqual(output, { name: "Error", message: "database failed", code: "DB_ERROR" });
  assert.equal("stack" in output, false);
});

test("readiness becomes true only after startup and false during shutdown", () => {
  resetForTests();
  assert.equal(isReadyState(true), false);
  markStartupComplete();
  assert.equal(isReadyState(true), true);
  markShuttingDown();
  assert.equal(isReadyState(true), false);
  resetForTests();
});
