import assert from "node:assert/strict";
import test from "node:test";
import { FULL_ACCESS_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, hasPermission, resolvePermissions } from "../config/rolePermissions.js";

test("role defaults match the operational access matrix", () => {
  assert.deepEqual(ROLE_DEFAULT_PERMISSIONS.chef, ["kds.view", "kds.update_status", "orders.view_kitchen"]);
  assert.ok(ROLE_DEFAULT_PERMISSIONS.kitchen_manager.includes("kds.update_status"));
  assert.ok(!ROLE_DEFAULT_PERMISSIONS.kitchen_manager.includes("billing.view"));
  assert.ok(ROLE_DEFAULT_PERMISSIONS.cashier.includes("billing.generate"));
  assert.ok(ROLE_DEFAULT_PERMISSIONS.cashier.includes("reports.view_basic"));
  assert.ok(!ROLE_DEFAULT_PERMISSIONS.cashier.includes("reports.view_full"));
  assert.ok(ROLE_DEFAULT_PERMISSIONS.manager.includes("staff.manage"));
  assert.ok(ROLE_DEFAULT_PERMISSIONS.manager.includes("reports.view_full"));
});

test("full and custom access are explicit and sanitized", () => {
  assert.deepEqual(resolvePermissions({ role: "chef", accessLevel: "FULL_ACCESS" }), [...FULL_ACCESS_PERMISSIONS]);
  assert.deepEqual(resolvePermissions({ role: "cashier", accessLevel: "CUSTOM_ACCESS", customPermissions: ["billing.view", "not-real"] }), ["billing.view"]);
  assert.equal(hasPermission({ role: "chef", accessLevel: "ROLE_DEFAULT" }, "billing.view"), false);
  assert.equal(hasPermission({ role: "chef", accessLevel: "ROLE_DEFAULT" }, "kds.view"), true);
});