import assert from "node:assert/strict";
import { assertDirectCashSettlement } from "../utils/paymentSecurity.js";

assert.doesNotThrow(() => assertDirectCashSettlement("CASH"));
for (const method of ["RAZORPAY", "UPI", "CREDIT_CARD", "OTHER", ""]) {
  assert.throws(
    () => assertDirectCashSettlement(method),
    (error) => error?.statusCode === 422 && /verified by the payment provider/i.test(error.message)
  );
}

console.log("paymentSecurity.test.js passed");
