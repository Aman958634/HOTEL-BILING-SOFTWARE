import assert from "node:assert/strict";
import test from "node:test";
import { calculatePurchaseTotals, normalizePurchaseLines, supplierFilter } from "../services/procurementService.js";

const item = { _id: "507f1f77bcf86cd799439011", itemName: "Rice", sku: "RICE-1", unit: "kg", baseUnit: "kg" };

test("normalizes compatible quantities into the inventory base unit", () => {
  const lines = normalizePurchaseLines([{ inventoryItem: item._id, quantity: 2, unit: "kg", costPerUnit: 40 }], [item]);
  assert.equal(lines[0].baseQuantity, 2);
  assert.equal(lines[0].lineTotal, 80);
  assert.equal(lines[0].baseUnit, "kg");
});

test("rejects duplicate inventory lines before persistence", () => {
  assert.throws(
    () => normalizePurchaseLines([
      { inventoryItem: item._id, quantity: 1, unit: "kg", costPerUnit: 40 },
      { inventoryItem: item._id, quantity: 2, unit: "kg", costPerUnit: 40 },
    ], [item]),
    /duplicate inventory items/
  );
});

test("calculates totals from normalized authoritative line totals", () => {
  assert.deepEqual(calculatePurchaseTotals([
    { lineTotal: 80 },
    { lineTotal: 19.995 },
  ]), { subtotal: 100 });
});

test("rejects malformed supplier identifiers before querying Mongo", () => {
  assert.throws(() => supplierFilter("507f1f77bcf86cd799439012", "not-an-id"), /supplier is invalid/);
});