import test from "node:test";
import assert from "node:assert/strict";
import { assertRawDriverContext, getTenantContext, runWithTenantContext } from "../utils/tenantContext.js";
import { scopedFilter } from "../repositories/baseRepository.js";

test("missing context is not silently converted into a tenant", () => {
  assert.equal(getTenantContext(), null);
});

test("system jobs carry explicit trusted context", async () => {
  await runWithTenantContext({ role: "system", restaurantId: null, outletId: null }, async () => {
    assert.deepEqual(getTenantContext(), { role: "system", restaurantId: null, outletId: null });
  });
});

test("ordinary requests require both restaurant and outlet", async () => {
  await runWithTenantContext({ role: "cashier", restaurantId: "r1", outletId: null }, async () => {
    assert.deepEqual(getTenantContext(), { role: "cashier", restaurantId: "r1", outletId: null });
  });
});

test("raw driver access requires a trusted context", () => {
  assert.throws(() => assertRawDriverContext(), { statusCode: 403 });
  runWithTenantContext({ role: "system", restaurantId: null, outletId: null }, () => {
  assert.equal(assertRawDriverContext().role, "system");
  });
});

test("repository scope overrides client filters", () => {
  assert.deepEqual(scopedFilter({ restaurantId: "r1", outletId: "o1", role: "cashier" }, { outlet: "o2" }), {
    outlet: "o1", restaurant: "r1",
  });
});
