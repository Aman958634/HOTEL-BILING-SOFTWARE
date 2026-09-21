import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.RAZORPAY_KEY_SECRET = "checkout-secret-for-test";
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-for-test";

const {
  assertCapturedSubscriptionPayment,
  toPaise,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} = await import("../services/razorpaySubscriptionService.js");

const orderId = "order_subscription_test";
const paymentId = "pay_subscription_test";
const checkoutSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

assert.equal(toPaise(7500), 750000);
assert.equal(toPaise(15000), 1500000);
assert.equal(toPaise(30000), 3000000);
assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: checkoutSignature }), true);
assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: `${checkoutSignature.slice(0, -1)}0` }), false);

const raw = Buffer.from('{"event":"payment.captured","payload":{}}');
const webhookSignature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
assert.equal(verifyWebhookSignature(raw, webhookSignature), true);
assert.equal(verifyWebhookSignature(raw, "invalid"), false);

const captured = { id: paymentId, order_id: orderId, amount: 750000, currency: "INR", status: "captured" };
assert.equal(assertCapturedSubscriptionPayment({ providerPayment: captured, orderId, amount: 7500, currency: "INR" }), captured);
assert.throws(
  () => assertCapturedSubscriptionPayment({ providerPayment: { ...captured, amount: 1 }, orderId, amount: 7500, currency: "INR" }),
  /Payment verification failed/
);
assert.throws(
  () => assertCapturedSubscriptionPayment({ providerPayment: { ...captured, order_id: "order_other" }, orderId, amount: 7500, currency: "INR" }),
  /Payment verification failed/
);

console.log("razorpaySubscriptionSecurity.test.js passed: paise conversion, signatures, captured amount/order checks.");
