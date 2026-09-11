import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive, safeErrorContext } from "../utils/safeLog.js";
import { isReadyState, markShuttingDown, markStartupComplete, resetForTests } from "../utils/shutdownState.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { safeCashfreeError } from "../utils/cashfreeDiagnostics.js";

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

test("redacts payment identity fields, provider credentials and sensitive error text", () => {
  const privateValues = ["123456789012", "ABCDE1234F", "person@upi", "session-sensitive", "app-sensitive", "key-sensitive"];
  const safe = redactSensitive({ account_number: privateValues[0], pan: privateValues[1], upiVpa: privateValues[2], paymentSessionId: privateValues[3], "x-client-id": privateValues[4], "x-client-secret": privateValues[5] });
  for (const value of privateValues) assert.ok(!JSON.stringify(safe).includes(value));
  const error = new Error("bank account_number=123456789012 PAN=ABCDE1234F UPI=person@upi Bearer bearer-sensitive mongodb://user:password@host/database");
  const text = JSON.stringify(safeErrorContext(error));
  for (const value of [...privateValues, "bearer-sensitive", "user:password"]) assert.ok(!text.includes(value));
  const diagnostic = safeCashfreeError(422, { message: error.message, secret: "key-sensitive", bank: { account_number: privateValues[0] } });
  assert.deepEqual(Object.keys(diagnostic), ["providerHttpStatus", "providerErrorCode", "providerErrorType", "providerErrorMessage"]);
  for (const value of privateValues) assert.ok(!JSON.stringify(diagnostic).includes(value));
  const circular = []; circular.push(circular);
  assert.deepEqual(redactSensitive(circular), ["[Circular]"]);
});

test("HTTP errors never expose internal details and redact public request diagnostics", () => {
  const invoke = (error) => {
    let output;
    errorHandler(error, { method: "POST", originalUrl: "/test", requestId: "safe-error-test" }, { status(code) { this.statusCode = code; return this; }, json(body) { output = { status: this.statusCode, body }; } }, () => {});
    return output;
  };
  const failure = invoke(Object.assign(new Error("internal-sensitive"), { details: { stack: "stack-sensitive", query: "private query" } }));
  assert.equal(failure.status, 500);
  assert.equal(failure.body.message, "Internal server error");
  assert.equal(failure.body.details, undefined);
  const badRequest = invoke(Object.assign(new Error("Invalid PAN=ABCDE1234F"), { statusCode: 422, details: { pan: "ABCDE1234F", accountNumber: "123456789012" } }));
  assert.equal(badRequest.status, 422);
  assert.doesNotMatch(JSON.stringify(badRequest), /ABCDE1234F|123456789012/);
});
