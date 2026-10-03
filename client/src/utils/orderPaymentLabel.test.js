import assert from "node:assert/strict";
import test from "node:test";
import { orderPaymentLabel } from "./paymentUtils.js";

test("paid cash is presented as a confirmed success", () => {
  assert.equal(orderPaymentLabel("PAID", "CASH"), "SUCCESS · Cash");
});

test("paid hotel UPI is presented as UPI", () => {
  assert.equal(orderPaymentLabel("PAID", "UPI", "HOTEL_UPI"), "SUCCESS · UPI");
  assert.equal(orderPaymentLabel("PAID", "HOTEL_UPI"), "SUCCESS · UPI");
});

test("unsettled and failed payment states never show success", () => {
  assert.equal(orderPaymentLabel("PENDING", "CASH"), "Pending");
  assert.equal(orderPaymentLabel("PROCESSING", "UPI"), "Processing");
  assert.equal(orderPaymentLabel("AWAITING_VERIFICATION", "UPI"), "Awaiting Verification");
  assert.equal(orderPaymentLabel("FAILED", "UPI"), "Failed");
  assert.equal(orderPaymentLabel("REFUNDED", "CASH"), "Refunded");
  assert.equal(orderPaymentLabel("PARTIALLY_REFUNDED", "CASH"), "Partially Refunded");
});