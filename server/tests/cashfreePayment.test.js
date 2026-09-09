import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.CASHFREE_ENV = "sandbox";
process.env.CASHFREE_APP_ID = "test-app";
process.env.CASHFREE_SECRET_KEY = "cashfree-test-secret";
process.env.CLIENT_URL = "http://localhost:5173";

const { cashfreeAmount, cashfreePaymentState, verifyCashfreeWebhook } = await import("../services/cashfreeService.js");
const { getCashfreeConfig, getCashfreeEasySplitStatus, getCashfreeReturnUrl, normalizeCashfreeEnvironment } = await import("../config/cashfree.js");
const { roundCurrency } = await import("../services/orderCalculationService.js");
const { PAYMENT_METHODS, normalizePaymentMethod } = await import("../services/orderService.js");

assert.equal(normalizePaymentMethod("cashfree"), PAYMENT_METHODS.CASHFREE);
assert.equal(normalizePaymentMethod("CASHFREE"), PAYMENT_METHODS.CASHFREE);
assert.equal(roundCurrency(116.82), 116.82);
assert.equal(roundCurrency(116.825), 116.83);
assert.equal(cashfreeAmount(116.82), "116.82");
assert.equal(cashfreeAmount(600), "600.00");
assert.throws(() => cashfreeAmount(0), /greater than zero/);
assert.equal(normalizeCashfreeEnvironment("sandbox"), "sandbox");
assert.equal(normalizeCashfreeEnvironment("test"), "sandbox");
assert.equal(normalizeCashfreeEnvironment("prod"), "production");
assert.equal(normalizeCashfreeEnvironment("live"), "production");
assert.throws(() => normalizeCashfreeEnvironment("staging"), /CASHFREE_ENV/);
assert.equal(getCashfreeConfig().environment, "sandbox");
assert.equal(getCashfreeConfig().baseUrl, "https://sandbox.cashfree.com/pg");
assert.equal(getCashfreeConfig().easySplitEnabled, false);
assert.deepEqual(getCashfreeEasySplitStatus(), { enabled: false, available: false, sandboxOnly: true, status: "ACTIVATION_REQUIRED", message: "Cashfree Easy Split sandbox activation and backend credentials are required before settlement onboarding can be used." });
process.env.CASHFREE_ENV = "production";
assert.equal(getCashfreeConfig().baseUrl, "https://api.cashfree.com/pg");
process.env.CASHFREE_ENV = "sandbox";
const originalSecret = process.env.CASHFREE_SECRET_KEY;
delete process.env.CASHFREE_SECRET_KEY;
assert.equal(getCashfreeConfig().configured, false);
process.env.CASHFREE_SECRET_KEY = originalSecret;

assert.equal(getCashfreeReturnUrl(), "http://localhost:5173/payment/cashfree/return?order_id={order_id}");
assert.deepEqual(cashfreePaymentState([
  { payment_status: "FAILED", cf_payment_id: "failed" },
  { payment_status: "SUCCESS", cf_payment_id: "success" },
]), { status: "SUCCESS", payment: { payment_status: "SUCCESS", cf_payment_id: "success" } });
assert.equal(cashfreePaymentState([{ payment_status: "USER_DROPPED" }]).status, "PENDING");
assert.equal(cashfreePaymentState([{ payment_status: "FAILED" }]).status, "FAILED");
assert.equal(cashfreePaymentState([{ payment_status: "CANCELLED" }]).status, "CANCELLED");

const rawBody = '{"data":{"order":{"order_id":"RS_CF_test"}}}';
const timestamp = "1746427759733";
const signature = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(`${timestamp}${rawBody}`).digest("base64");
assert.equal(verifyCashfreeWebhook({ signature, timestamp, rawBody }), true);
assert.equal(verifyCashfreeWebhook({ signature: "invalid", timestamp, rawBody }), false);

console.log("cashfreePayment.test.js passed");
