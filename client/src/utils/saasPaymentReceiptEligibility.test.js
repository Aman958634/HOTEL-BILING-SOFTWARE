import test from "node:test";
import assert from "node:assert/strict";
import { canDownloadSaasPaymentReceipt } from "./saasPaymentReceiptEligibility.js";

test("canonical paid maps to SUCCESS and exposes the receipt action", () => {
  const payment = { statusRaw: "paid", status: "SUCCESS" };
  assert.equal(payment.status, "SUCCESS");
  assert.equal(canDownloadSaasPaymentReceipt(payment), true);
});

test("pending, cancelled, and failed SaaS payments never expose a receipt", () => {
  for (const statusRaw of ["pending", "cancelled", "failed"]) {
    assert.equal(canDownloadSaasPaymentReceipt({ statusRaw, status: statusRaw.toUpperCase() }), false);
  }
});

test("unknown, null, malformed, and display-only statuses fail closed", () => {
  for (const payment of [
    { statusRaw: "PAID", status: "SUCCESS" },
    { statusRaw: "processing", status: "PROCESSING" },
    { statusRaw: "expired", status: "EXPIRED" },
    { statusRaw: "unknown", status: "SUCCESS" },
    { status: "SUCCESS" },
    null,
  ]) {
    assert.equal(canDownloadSaasPaymentReceipt(payment), false);
  }
});