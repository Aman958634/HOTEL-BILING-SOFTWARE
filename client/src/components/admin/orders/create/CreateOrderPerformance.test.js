import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateOrderTotals } from "../../../../utils/orderCalculations.js";

const readSource = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("discount-percent totals preserve the existing order-entry calculation", () => {
  const items = [
    { menuItem: "a", price: 100, quantity: 2 },
    { menuItem: "b", price: 50.5, quantity: 3 },
  ];
  const explicitDiscount = calculateOrderTotals({
    items,
    discount: 35.15,
    taxPercent: 18,
    serviceChargePercent: 5,
    orderType: "DINE_IN",
  });
  const percentDiscount = calculateOrderTotals({
    items,
    discountPercent: 10,
    taxPercent: 18,
    serviceChargePercent: 5,
    orderType: "DINE_IN",
  });

  assert.equal(percentDiscount.itemCount, 5);
  assert.deepEqual(percentDiscount, explicitDiscount);
});

test("cart updates isolate unchanged rows and keep menu results memoized", async () => {
  const [modalSource, itemsSource] = await Promise.all([
    readSource("../CreateOrderModal.jsx"),
    readSource("./ItemsSection.jsx"),
  ]);

  assert.match(modalSource, /prev\.items\.map\([\s\S]*?: entry/);
  assert.match(modalSource, /prev\.items \? \{ \.\.\.prev, items: "" \} : prev/);
  assert.match(itemsSource, /const SelectedOrderRow = memo/);
  assert.match(itemsSource, /const MenuResults = memo/);
  assert.match(itemsSource, /<SelectedOrderRow key=\{item\.menuItem\}/);
});