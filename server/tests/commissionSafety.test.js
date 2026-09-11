import assert from "node:assert/strict";
import { calculateCommissionSplit, toPaise } from "../services/easySplitSettlementService.js";

assert.equal(toPaise("10.25"), 1025);
for (const config of [
  { commissionType: "NONE" },
  { commissionType: "PERCENTAGE", commissionBps: 250 },
  { commissionType: "FIXED", fixedAmountPaise: 125 },
]) {
  const split = calculateCommissionSplit({ grossAmountPaise: 10000, ...config });
  assert.equal(split.platformSharePaise + split.vendorSharePaise, split.grossAmountPaise);
}
assert.throws(() => calculateCommissionSplit({ grossAmountPaise: 10000, commissionType: "PERCENTAGE", commissionBps: 10001 }));
assert.throws(() => calculateCommissionSplit({ grossAmountPaise: 10000, commissionType: "FIXED", fixedAmountPaise: 10001 }), /exceeds/i);
assert.throws(() => toPaise("10.256"));
console.log("commissionSafety.test.js passed: integer paise invariant and invalid commission guards.");
