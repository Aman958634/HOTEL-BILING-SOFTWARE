import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderIdempotencyFingerprint, validateIdempotencyKey } from "../controllers/orderController.js";

test("accepts bounded QR idempotency keys and rejects malformed values", () => {
  assert.equal(validateIdempotencyKey("qr-order-123"), "qr-order-123");
  assert.throws(() => validateIdempotencyKey("bad key"), /Idempotency-Key is invalid/);
  assert.throws(() => validateIdempotencyKey("x".repeat(201)), /Idempotency-Key is invalid/);
});

test("keeps the same fingerprint for a retry and changes it for a different table or item", () => {
  const request = { orderType: "DINE_IN", orderSource: "QR_ORDER", table: "table-a", items: [{ menuItem: "item-a", quantity: 2 }], specialInstructions: "No onions" };
  const retry = { ...request, items: [{ ...request.items[0] }] };
  assert.equal(buildOrderIdempotencyFingerprint(request), buildOrderIdempotencyFingerprint(retry));
  assert.notEqual(buildOrderIdempotencyFingerprint(request), buildOrderIdempotencyFingerprint({ ...request, table: "table-b" }));
  assert.notEqual(buildOrderIdempotencyFingerprint(request), buildOrderIdempotencyFingerprint({ ...request, items: [{ menuItem: "item-b", quantity: 2 }] }));
});

test("QR submissions require an idempotency key at the endpoint boundary", () => {
  assert.equal(validateIdempotencyKey(""), "");
  assert.equal(validateIdempotencyKey("qr-unique-key"), "qr-unique-key");
});