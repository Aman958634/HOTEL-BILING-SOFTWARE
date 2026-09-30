import assert from "node:assert/strict";
import { isPaymentReceiptAvailable } from "../utils/paymentUtils.js";

assert.equal(isPaymentReceiptAvailable({ provider: "HOTEL_UPI", paymentStatus: "AWAITING_VERIFICATION" }), false);
assert.equal(isPaymentReceiptAvailable({ provider: "HOTEL_UPI", paymentStatus: "PAID" }), true);

for (const paymentStatus of ["PENDING", "FAILED", "REJECTED", "CANCELLED", "UNKNOWN", "paid"]) {
  assert.equal(isPaymentReceiptAvailable({ paymentStatus }), false, `${paymentStatus} must not expose a receipt`);
}

console.log("paymentReceiptEligibility.test.js passed: only canonical PAID payments are receipt-eligible.");
