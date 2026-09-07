import assert from "node:assert/strict";
import test from "node:test";
import { requireAnyPermission, requirePermission } from "../middleware/auth.js";
import { resolvePermissions } from "../config/rolePermissions.js";

const run = (middleware, user) => new Promise((resolve) => {
  middleware({ user }, {}, (error) => resolve(error || null));
});

test("permission middleware grants and denies server actions", async () => {
  const chef = { role: "chef", permissions: resolvePermissions({ role: "chef" }) };
  const cashier = { role: "cashier", permissions: resolvePermissions({ role: "cashier" }) };

  assert.equal((await run(requirePermission("kds.view"), chef)), null);
  assert.equal((await run(requirePermission("billing.view"), chef))?.statusCode, 403);
  assert.equal((await run(requirePermission("orders.create"), chef))?.statusCode, 403);
  assert.equal((await run(requirePermission("billing.generate"), cashier)), null);
  assert.equal((await run(requireAnyPermission("orders.view", "orders.view_kitchen"), chef)), null);
});

test("full and custom access never grant super-admin or tenant permissions", async () => {
  const fullChef = { role: "chef", accessLevel: "FULL_ACCESS", permissions: resolvePermissions({ role: "chef", accessLevel: "FULL_ACCESS" }) };
  const customChef = { role: "chef", accessLevel: "CUSTOM_ACCESS", customPermissions: ["kds.view"], permissions: resolvePermissions({ role: "chef", accessLevel: "CUSTOM_ACCESS", customPermissions: ["kds.view"] }) };

  assert.equal((await run(requirePermission("payments.collect"), fullChef)), null);
  assert.equal((await run(requirePermission("staff.manage"), customChef))?.statusCode, 403);
  assert.equal((await run(requirePermission("reports.view_full"), customChef))?.statusCode, 403);
});

test("super admin bypass remains explicit and does not alter role defaults", async () => {
  const superAdmin = { role: "super_admin", permissions: [] };
  assert.equal((await run(requirePermission("staff.manage"), superAdmin)), null);
  assert.deepEqual(resolvePermissions({ role: "chef" }), ["kds.view", "kds.update_status", "orders.view_kitchen"]);
});
