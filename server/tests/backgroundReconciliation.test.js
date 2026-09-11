import assert from "node:assert/strict";
import { createSettlementReconciliationWorker } from "../services/settlementReconciliationWorker.js";

let query, limit, calls = [];
let enabled = true;
let environment = "sandbox";
let gate = null;
const model = { find(filter) {
  query = filter;
  return { sort() { return this; }, limit(n) { limit = n; return this; }, select() { return this; }, async lean() { return [{ _id: "a" }, { _id: "b" }]; } };
} };
const errors = [];
const worker = createSettlementReconciliationWorker({ model, enabled: () => enabled,
  config: () => ({ environment, configured: true, easySplitEnabled: true, easySplitPaymentsEnabled: true }),
  reconcile: async (id, options) => { calls.push([id, options.source]); if (gate) await gate; if (id === "a") throw new Error("mock unavailable"); },
  onError: (error) => errors.push(error.message),
});
enabled = false;
assert.equal((await worker.runOnce()).skipped, "disabled");
enabled = true; environment = "invalid";
assert.equal((await worker.runOnce()).skipped, "preflight");
assert.equal(calls.length, 0);
environment = "sandbox";
let release;
gate = new Promise((resolve) => { release = resolve; });
const first = worker.runOnce();
assert.equal((await worker.runOnce()).skipped, "already_running");
release();
assert.deepEqual(await first, { attempted: 2, succeeded: 1, failed: 1 });
assert.equal(limit, 20);
assert.equal(query.provider, "CASHFREE");
assert.ok(!query.settlementStatus.$in.includes("SETTLED"));
assert.ok(!query.settlementStatus.$in.includes("REVERSED"));
assert.deepEqual(query.$and[0].$or, [{ splitStatus: "ALLOCATED" }, { allocationStrategy: "ORDER_CREATION_SPLIT", splitStatus: { $in: ["PENDING", "PROCESSING"] } }]);
assert.ok(query.$and[1].$or[1].lastReconciledAt.$lt instanceof Date);
assert.deepEqual(calls, [["a", "background_reconciliation"], ["b", "background_reconciliation"]]);
assert.equal(errors.length, 1);
gate = null;
assert.deepEqual(await worker.runOnce(), { attempted: 2, succeeded: 1, failed: 1 });
await worker.stop();
assert.equal((await worker.runOnce()).skipped, "disabled");
console.log("backgroundReconciliation.test.js passed: opt-in sandbox gate, bounded eligible selection, overlap guard, retry, per-record failure, shutdown.");
