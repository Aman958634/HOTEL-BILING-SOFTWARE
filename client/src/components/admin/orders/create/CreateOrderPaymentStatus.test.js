import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("Create New Order exposes a read-only pending payment status", async () => {
  const source = await readSource("./OrderDetailsSection.jsx");

  assert.match(source, /<output[\s\S]*aria-label="Payment status"/);
  assert.match(source, /: "PENDING"}/);
  assert.match(source, /Payment status updates after payment is collected\./);
  assert.doesNotMatch(source, /id="payment-status"/);
  assert.doesNotMatch(source, /onPatch\(\{ paymentStatus:/);
});

test("order creation never sends a payment status or auto-settles cash", async () => {
  const [modalSource, managementSource] = await Promise.all([
    readSource("../CreateOrderModal.jsx"),
    readSource("../../../../pages/admin/OrderManagement.jsx"),
  ]);

  assert.doesNotMatch(modalSource, /paymentStatus:\s*(?:String\(|form\.)/);
  assert.doesNotMatch(managementSource, /isCashSettlement/);
  assert.match(managementSource, /setPaymentPromptOpen\(true\)/);
});
