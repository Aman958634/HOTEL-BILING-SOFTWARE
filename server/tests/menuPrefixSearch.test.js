import assert from "node:assert/strict";
import test from "node:test";
import { buildPrefixMenuSearchFilter } from "../controllers/menuController.js";

test("menu API search uses a case-insensitive, escaped name prefix", () => {
  const filter = buildPrefixMenuSearchFilter("  PIZ.  ");
  assert.equal(filter.name.$regex, "^PIZ\\.");
  assert.equal(filter.name.$options, "i");
  const matcher = new RegExp(filter.name.$regex, filter.name.$options);
  assert.equal(matcher.test("PIZ.za"), true);
  assert.equal(matcher.test("Mini PIZ.za"), false);
  assert.deepEqual(buildPrefixMenuSearchFilter("   "), {});
});
