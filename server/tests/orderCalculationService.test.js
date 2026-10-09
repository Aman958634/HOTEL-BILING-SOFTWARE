import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderAmounts } from "../services/orderCalculationService.js";

const calculate = (discount) => calculateOrderAmounts({
  items: [{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }],
  discount,
  gstRate: 18,
  serviceChargePercent: 10,
});

test("saved order amounts keep discount bounded and totals non-negative", () => {
  assert.deepEqual(
    [calculate(-1).discount, calculate(0).discount, calculate(62.5).discount, calculate(999).discount],
    [0, 0, 62.5, 250]
  );
  const fullyDiscounted = calculate(250);
  assert.deepEqual([fullyDiscounted.tax, fullyDiscounted.serviceCharge, fullyDiscounted.total], [0, 0, 0]);
});

test("saved order GST and service charge are recalculated after quantity changes", () => {
  const one = calculateOrderAmounts({
    items: [{ price: 100, quantity: 1 }], discount: 10, gstRate: 18, serviceChargePercent: 5,
  });
  const two = calculateOrderAmounts({
    items: [{ price: 100, quantity: 2 }], discount: 20, gstRate: 18, serviceChargePercent: 5,
  });

  assert.deepEqual([one.discount, one.tax, one.serviceCharge, one.total], [10, 16.2, 4.5, 110.7]);
  assert.deepEqual([two.discount, two.tax, two.serviceCharge, two.total], [20, 32.4, 9, 221.4]);
});
