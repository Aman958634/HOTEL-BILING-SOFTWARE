import assert from "node:assert/strict";
import test from "node:test";
import { applyAuthoritativeCashPayment } from "./cashPaymentConfirmation.js";

test("cash confirmation updates only the confirmed PAID order returned by the backend", () => {
  const orders = [{ _id: "one", paymentStatus: "PENDING" }, { _id: "two", paymentStatus: "PENDING" }];
  const updated = applyAuthoritativeCashPayment(orders, { _id: "two", paymentStatus: "PAID", paymentMethod: "CASH" });

  assert.equal(updated[0].paymentStatus, "PENDING");
  assert.equal(updated[1].paymentStatus, "PAID");
  assert.equal(updated[1].paymentMethod, "CASH");
});

test("a failed or malformed response cannot optimistically mark an order paid", () => {
  const orders = [{ _id: "one", paymentStatus: "PENDING" }];
  assert.strictEqual(applyAuthoritativeCashPayment(orders, { _id: "one", paymentStatus: "FAILED" }), orders);
  assert.strictEqual(applyAuthoritativeCashPayment(orders, null), orders);
});
