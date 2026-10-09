import assert from "node:assert/strict";
import test from "node:test";
import Restaurant from "../models/Restaurant.js";
import { normalizeDefaultDiscountPercent } from "../controllers/restaurantController.js";

test("restaurant default discount is constrained to a percentage", () => {
  const field = Restaurant.schema.path("defaultDiscountPercent");
  assert.equal(field.options.default, 0);
  assert.equal(field.options.min, 0);
  assert.equal(field.options.max, 100);
  assert.deepEqual([normalizeDefaultDiscountPercent(0), normalizeDefaultDiscountPercent("12.5"), normalizeDefaultDiscountPercent(100)], [0, 12.5, 100]);
  assert.throws(() => normalizeDefaultDiscountPercent(-1));
  assert.throws(() => normalizeDefaultDiscountPercent(101));
});
