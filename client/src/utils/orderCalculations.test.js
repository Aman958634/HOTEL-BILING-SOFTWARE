import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderTotals } from "./orderCalculations.js";

const order = (discountPercent) => calculateOrderTotals({
  items: [{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }],
  discountPercent,
  taxPercent: 18,
  serviceChargePercent: 10,
});

test("discount percentages are bounded from zero through one hundred", () => {
  assert.deepEqual(
    [order(-5).discount, order(0).discount, order(25).discount, order(100).discount, order(101).discount],
    [0, 0, 62.5, 250, 250]
  );
  assert.equal(order(100).total, 0);
});

test("discount, GST and service charge recalculate from changed quantities", () => {
  const one = calculateOrderTotals({
    items: [{ price: 100, quantity: 1 }], discountPercent: 10, taxPercent: 18, serviceChargePercent: 5,
  });
  const two = calculateOrderTotals({
    items: [{ price: 100, quantity: 2 }], discountPercent: 10, taxPercent: 18, serviceChargePercent: 5,
  });

  assert.deepEqual([one.discount, one.tax, one.serviceCharge, one.total], [10, 16.2, 4.5, 110.7]);
  assert.deepEqual([two.discount, two.tax, two.serviceCharge, two.total], [20, 32.4, 9, 221.4]);
});
