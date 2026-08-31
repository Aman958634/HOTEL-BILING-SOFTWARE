import assert from "node:assert/strict";
import { deriveOrderPaymentStatus } from "../services/paymentService.js";
import { normalizePaymentStatus } from "../services/orderService.js";

assert.equal(deriveOrderPaymentStatus({ total: 1000, paid: 0 }), "PENDING");
assert.equal(deriveOrderPaymentStatus({ total: 1000, paid: 400 }), "PARTIAL");
assert.equal(deriveOrderPaymentStatus({ total: 1000, paid: 999.995 }), "PAID");
assert.equal(deriveOrderPaymentStatus({ total: 1000, paid: 400 + 600 }), "PAID");
assert.equal(normalizePaymentStatus("partial"), "PARTIAL");
assert.equal(normalizePaymentStatus("partially_paid"), "PARTIAL");

console.log("paymentStateMachine.test.js passed");
