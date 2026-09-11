import assert from "node:assert/strict";
import Payment from "../models/Payment.js";
import { deriveOrderPaymentState } from "../services/paymentService.js";
const originalFind = Payment.find;
let rows = [];
Payment.find = (filter) => {
  assert.equal(filter.orderId, "order-test");
  return { select() { return this; }, lean: async () => rows };
};
try {
  const derive = () => deriveOrderPaymentState({ _id: "order-test", total: 100 });
  assert.deepEqual(await derive(), { paymentStatus: "PENDING", collectedAmount: 0, remainingAmount: 100, fullyPaid: false });
  rows = [{ amount: 100, paymentStatus: "FAILED" }];
  assert.equal((await derive()).paymentStatus, "FAILED");
  rows.push({ amount: 100, paymentStatus: "PROCESSING" });
  assert.equal((await derive()).paymentStatus, "PENDING");
  rows = [{ amount: 33.33, paymentStatus: "PAID" }];
  assert.deepEqual(await derive(), { paymentStatus: "PENDING", collectedAmount: 33.33, remainingAmount: 66.67, fullyPaid: false });
  rows.push({ amount: 66.67, paymentStatus: "PAID" });
  assert.equal((await derive()).paymentStatus, "PAID");
  rows.push({ amount: 100, paymentStatus: "FAILED" });
  assert.equal((await derive()).paymentStatus, "PAID", "a failed attempt cannot regress paid ledger");
  rows = [{ amount: 100, refundAmount: 25, paymentStatus: "PARTIALLY_REFUNDED" }];
  assert.deepEqual(await derive(), { paymentStatus: "PARTIALLY_REFUNDED", collectedAmount: 75, remainingAmount: 25, fullyPaid: false });
  rows = [{ amount: 100, refundAmount: 100, paymentStatus: "REFUNDED" }];
  assert.equal((await derive()).paymentStatus, "REFUNDED");
  console.log("paymentState.test.js passed: ledger authority, failed/pending/partial/paid/refund states and paise boundary.");
} finally { Payment.find = originalFind; }
