import test from "node:test";
import assert from "node:assert/strict";
import { canViewPaymentReceipt, paymentStatusLabel } from "./paymentUtils.js";

test("Hotel UPI awaiting verification displays its waiting label and has no receipt", () => {
  const payment = { provider: "HOTEL_UPI", paymentStatus: "AWAITING_VERIFICATION" };

  assert.equal(paymentStatusLabel(payment.paymentStatus), "Awaiting Verification");
  assert.equal(canViewPaymentReceipt(payment), false);
});

test("canonical PAID displays SUCCESS and enables a receipt", () => {
  const payment = { provider: "HOTEL_UPI", paymentStatus: "PAID" };

  assert.equal(paymentStatusLabel(payment.paymentStatus), "SUCCESS");
  assert.equal(canViewPaymentReceipt(payment), true);
});

test("pending, failed, rejected, and unknown states never enable a receipt", () => {
  for (const paymentStatus of ["PENDING", "FAILED", "REJECTED", "CANCELLED", "UNRECOGNIZED", "paid"]) {
    assert.equal(canViewPaymentReceipt({ paymentStatus }), false, `${paymentStatus} must not expose a receipt`);
  }
});
