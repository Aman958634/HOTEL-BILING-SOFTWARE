import assert from "node:assert/strict";
import Payment from "../models/Payment.js";

const indexes = Payment.schema.indexes();
assert.ok(indexes.some(([key, options]) => key.orderId && key.idempotencyKey && options.unique), "payment order/idempotency uniqueness is required");
assert.ok(indexes.some(([key, options]) => key.bill && key.idempotencyKey && options.unique), "bill/idempotency uniqueness is required");
assert.ok(Payment.schema.path("providerOrderIdempotencyKey"), "provider order idempotency snapshot is required");
console.log("paymentIdempotency.test.js passed: logical payment and provider-order idempotency constraints present.");
