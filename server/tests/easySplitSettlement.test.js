import assert from "node:assert/strict";
import { calculateCommissionSplit, mapCashfreeSettlementStatus } from "../services/easySplitSettlementService.js";
assert.equal(mapCashfreeSettlementStatus("PENDING"), "PENDING");
assert.equal(mapCashfreeSettlementStatus("PROCESSING"), "PROCESSING");
assert.equal(mapCashfreeSettlementStatus("SUCCESS"), "SETTLED");
assert.equal(mapCashfreeSettlementStatus("REVERSED"), "REVERSED");
assert.equal(mapCashfreeSettlementStatus("UNKNOWN_PROVIDER_STATE", "PROCESSING"), "PROCESSING");
import { createEasySplitAfterPayment } from "../services/cashfreeEasySplitService.js";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
try {
  assert.deepEqual(calculateCommissionSplit({ grossAmountPaise: 100000, commissionType: "NONE" }), {
    commissionType: "NONE", commissionBps: 0, fixedAmountPaise: 0, grossAmountPaise: 100000, vendorSharePaise: 100000, platformSharePaise: 0,
  });
  const percentage = calculateCommissionSplit({ grossAmountPaise: 100000, commissionType: "PERCENTAGE", commissionBps: 275 });
  assert.equal(percentage.platformSharePaise, 2750);
  assert.equal(percentage.vendorSharePaise, 97250);
  assert.equal(percentage.vendorSharePaise + percentage.platformSharePaise, percentage.grossAmountPaise);
  const roundedHalfPaise = calculateCommissionSplit({ grossAmountPaise: 1, commissionType: "PERCENTAGE", commissionBps: 5000 });
  assert.equal(roundedHalfPaise.platformSharePaise, 1, "percentage allocation rounds a half paise up");
  const fixed = calculateCommissionSplit({ grossAmountPaise: 100000, commissionType: "FIXED", fixedAmountPaise: 117 });
  assert.equal(fixed.platformSharePaise, 117);
  assert.throws(() => calculateCommissionSplit({ grossAmountPaise: 100, commissionType: "FIXED", fixedAmountPaise: 101 }), (error) => error?.code === "COMMISSION_EXCEEDS_PAYMENT");

  Object.assign(process.env, {
    CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "sandbox-id", CASHFREE_SECRET_KEY: "sandbox-secret",
    CASHFREE_EASY_SPLIT_ENABLED: "true", CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "true",
  });
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ status: "OK", message: "Order split created" }), { status: 200, headers: { "x-request-id": "safe-request-id" } });
  };
  await createEasySplitAfterPayment({ cashfreeOrderId: "order_123", vendorId: "RESTO_VENDOR", vendorSharePaise: 97250, idempotencyKey: "f0d42b34-dcfe-4e12-91a7-12457171e20b" });
  assert.equal(request.url, "https://sandbox.cashfree.com/pg/easy-split/orders/order_123/split");
  assert.equal(request.options.headers["x-api-version"], "2022-09-01");
  assert.deepEqual(JSON.parse(request.options.body), { split: [{ vendor_id: "RESTO_VENDOR", amount: 972.5 }], disable_split: true });
  process.env.CASHFREE_ENV = "production";
  await createEasySplitAfterPayment({ cashfreeOrderId: "order_123", vendorId: "RESTO_VENDOR", vendorSharePaise: 100, idempotencyKey: "f0d42b34-dcfe-4e12-91a7-12457171e20b" });
  assert.equal(request.url, "https://api.cashfree.com/pg/easy-split/orders/order_123/split");
  console.log("easySplitSettlement.test.js passed: paise invariants, commission boundaries, provider payload, and explicit production endpoint mapping");
} finally {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
}
