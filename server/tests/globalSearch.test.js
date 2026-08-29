import assert from "node:assert/strict";
import { globalSearch, normalizeSearchQuery, permittedSearchTypes } from "../services/globalSearchService.js";

assert.equal(normalizeSearchQuery("  ORD-1025  "), "ORD-1025");
assert.equal(normalizeSearchQuery("Aman   Khan"), "Aman Khan");
assert.throws(() => normalizeSearchQuery("order\u0000number"), /invalid characters/);
assert.throws(() => normalizeSearchQuery("x".repeat(101)), /must not exceed/);
assert.ok(permittedSearchTypes({ role: "cashier" }).includes("payments"));
assert.ok(!permittedSearchTypes({ role: "waiter" }).includes("payments"));
assert.ok(permittedSearchTypes({ role: "inventory_manager" }).includes("inventory"));
assert.deepEqual((await globalSearch({ user: { role: "waiter" }, query: "a" })).results.payments, undefined);
await assert.rejects(() => globalSearch({ user: { role: "admin" }, query: "ok", type: "payments,unknown" }), /Invalid search type/);
console.log("Global Search validation tests passed.");
