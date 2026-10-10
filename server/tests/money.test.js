import assert from "node:assert/strict";
import test from "node:test";
import { fromPaise, multiplyPaise, percentageOfPaise, toPaise } from "../utils/money.js";
import { calculateOrderAmounts } from "../services/orderCalculationService.js";

test("paise arithmetic settles Rs. 127.50 exactly", () => {
  assert.equal(toPaise("127.50"), 12750);
  assert.equal(fromPaise(toPaise(127.5)), 127.5);
  assert.equal(toPaise("127.50") - toPaise("127.50"), 0);
});

test("line items, discounts, taxes and service charges retain paise precision", () => {
  const total = calculateOrderAmounts({
    items: [{ price: "42.50", quantity: 3 }], discount: "12.75", gstRate: "5", serviceChargePercent: "2.5",
  });
  assert.deepEqual([total.subtotal, total.discount, total.tax, total.serviceCharge, total.total], [127.5, 12.75, 5.74, 2.87, 123.36]);
  assert.equal(multiplyPaise(toPaise("42.50"), 3), 12750);
  assert.equal(percentageOfPaise(11475, "5"), 574);
});

test("split and partial payments reconcile without float residue", () => {
  const total = toPaise("127.50");
  const collected = toPaise("42.50") + toPaise("85.00");
  assert.equal(total - collected, 0);
  assert.equal(total - toPaise("42.50"), 8500);
});

test("refunds are deducted once and cannot create a negative balance", () => {
  const paid = toPaise("127.50");
  const refund = toPaise("27.50");
  assert.equal(fromPaise(Math.max(paid - refund, 0)), 100);
  assert.equal(Math.max(paid - toPaise("999.00"), 0), 0);
});
