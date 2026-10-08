import assert from "node:assert/strict";
import test from "node:test";
import { findSpatialTarget, isEditableOrderControl } from "./orderModalNavigation.js";

const control = (left, top, width = 80, height = 40) => ({
  getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
});

test("spatial order navigation follows nearby controls in the requested direction", () => {
  const dineIn = control(0, 0);
  const takeaway = control(100, 0);
  const delivery = control(200, 0);
  const table = control(0, 80, 280, 40);

  assert.equal(findSpatialTarget(dineIn, [dineIn, takeaway, delivery, table], "ArrowRight"), takeaway);
  assert.equal(findSpatialTarget(delivery, [dineIn, takeaway, delivery, table], "ArrowLeft"), takeaway);
  assert.equal(findSpatialTarget(takeaway, [dineIn, takeaway, delivery, table], "ArrowDown"), table);
});

test("native editable controls retain their own arrow-key behavior", () => {
  assert.equal(isEditableOrderControl({ tagName: "INPUT", dataset: {} }), true);
  assert.equal(isEditableOrderControl({ tagName: "SELECT", dataset: {} }), true);
  assert.equal(isEditableOrderControl({ tagName: "TEXTAREA", dataset: {} }), true);
  assert.equal(isEditableOrderControl({ tagName: "INPUT", dataset: { orderArrowNav: "true" } }), false);
  assert.equal(isEditableOrderControl({ tagName: "BUTTON", dataset: {} }), false);
});
