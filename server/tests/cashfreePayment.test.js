import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.CASHFREE_ENV = "sandbox";
process.env.CASHFREE_APP_ID = "test-app";
process.env.CASHFREE_SECRET_KEY = "cashfree-test-secret";
process.env.CLIENT_URL = "http://localhost:5173";

const { cashfreePaymentState, verifyCashfreeWebhook } = await import("../services/cashfreeService.js");
const { getCashfreeReturnUrl } = await import("../config/cashfree.js");
const { PAYMENT_METHODS, normalizePaymentMethod } = await import("../services/orderService.js");

assert.equal(normalizePaymentMethod("cashfree"), PAYMENT_METHODS.CASHFREE);
assert.equal(normalizePaymentMethod("CASHFREE"), PAYMENT_METHODS.CASHFREE);

assert.equal(getCashfreeReturnUrl(), "http://localhost:5173/payment/cashfree/return?order_id={order_id}");
assert.deepEqual(cashfreePaymentState([
  { payment_status: "FAILED", cf_payment_id: "failed" },
  { payment_status: "SUCCESS", cf_payment_id: "success" },
]), { status: "SUCCESS", payment: { payment_status: "SUCCESS", cf_payment_id: "success" } });
assert.equal(cashfreePaymentState([{ payment_status: "USER_DROPPED" }]).status, "PENDING");
assert.equal(cashfreePaymentState([{ payment_status: "FAILED" }]).status, "FAILED");

const rawBody = '{"data":{"order":{"order_id":"RS_CF_test"}}}';
const timestamp = "1746427759733";
const signature = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(`${timestamp}${rawBody}`).digest("base64");
assert.equal(verifyCashfreeWebhook({ signature, timestamp, rawBody }), true);
assert.equal(verifyCashfreeWebhook({ signature: "invalid", timestamp, rawBody }), false);

console.log("cashfreePayment.test.js passed");
