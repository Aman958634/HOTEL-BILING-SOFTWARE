import test from "node:test";
import assert from "node:assert/strict";
import { secureFilter, getOutletContext } from "../utils/secureQuery.js";

test("outlet scope is injected into request queries", () => {
  const req = { outletId: "outlet-1", user: { restaurant: "restaurant-1", outletId: "outlet-1", role: "cashier" } };
  assert.deepEqual(secureFilter(req, { status: "OPEN" }), {
    status: "OPEN", restaurant: "restaurant-1", outlet: "outlet-1",
  });
});

test("mismatched outlet header is rejected by middleware boundary", () => {
  assert.throws(() => getOutletContext({ user: { role: "cashier" } }), { statusCode: 403 });
});

test("super admin may omit outlet scope", () => {
  assert.deepEqual(secureFilter({ user: { role: "super_admin" } }, { status: "OPEN" }), { status: "OPEN" });
});
