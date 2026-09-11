import assert from "node:assert/strict";
import { ensureIndexesNonDestructively, planIndexes } from "../utils/nonDestructiveIndexes.js";

const definitions = [[{ orderId: 1 }, { name: "orderId_1" }]];
const indexes = [{ name: "_id_", key: { _id: 1 } }, { name: "manual_index", key: { preserve: 1 } }];
let creates = 0;
const collection = {
  indexes: async () => structuredClone(indexes),
  createIndex: async (key, options) => { creates++; indexes.push({ key, ...options }); },
  dropIndex: () => assert.fail("Never drop an index"),
  drop: () => assert.fail("Never drop data"),
};
assert.equal((await ensureIndexesNonDestructively(collection, definitions, { verifyOnly: true })).missing.length, 1);
assert.equal(creates, 0);
await ensureIndexesNonDestructively(collection, definitions);
await ensureIndexesNonDestructively(collection, definitions);
assert.equal(creates, 1);
assert.ok(indexes.some((index) => index.name === "manual_index"));
indexes.push({ key: { orderId: 1 }, name: "legacy_unique_order", unique: true });
const before = structuredClone(indexes);
await assert.rejects(() => ensureIndexesNonDestructively(collection, definitions), { code: "MANUAL_INDEX_MIGRATION_REQUIRED" });
assert.deepEqual(indexes, before);
assert.equal(creates, 1);
assert.equal(planIndexes([{ key: { other: 1 }, name: "orderId_1" }], definitions).conflicts.length, 1);
assert.equal(planIndexes([{ key: { orderId: 1 }, name: "orderId_1", sparse: true }], definitions).conflicts.length, 1);
assert.equal(planIndexes([{ key: { orderId: 1 }, name: "orderId_1", partialFilterExpression: { active: true } }], definitions).conflicts.length, 1);
console.log("indexMigrationSafety.test.js passed: additive, repeatable, verify-only, unique/name/options conflicts preserved.");
