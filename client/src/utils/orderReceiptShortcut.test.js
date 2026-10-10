import assert from "node:assert/strict";
import test from "node:test";
import { resolveReceiptShortcutOrder } from "./orderReceiptShortcut.js";

test("F9 opens only the selected order, with a focused row as a fallback", () => {
  const selected = { _id: "selected", paymentStatus: "PAID" };
  const focused = { _id: "focused", paymentStatus: "PAID" };
  assert.equal(resolveReceiptShortcutOrder(selected, focused), selected);
  assert.equal(resolveReceiptShortcutOrder(null, focused), focused);
  assert.equal(resolveReceiptShortcutOrder(null, null), null);
});
