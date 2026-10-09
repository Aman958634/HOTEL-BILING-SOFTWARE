import assert from "node:assert/strict";
import test from "node:test";
import { filterOrderMenuItems } from "./orderMenuFiltering.js";

const menu = [
  { _id: "1", name: "Paneer Paratha", category: "flatbread", isAvailable: true },
  { _id: "2", name: "Pizza", category: "fast-food", isAvailable: true },
  { _id: "3", name: "Chilli Paneer", category: "curry", isAvailable: true },
  { _id: "4", name: "Masala Dal", category: "curry", isAvailable: true },
  { _id: "5", name: "Unavailable Aloo", category: "flatbread", isAvailable: false },
];

test("menu search is case-insensitive prefix matching and ignores surrounding spaces", () => {
  assert.deepEqual(filterOrderMenuItems(menu, " pan ").map((item) => item._id), ["1"]);
  assert.deepEqual(filterOrderMenuItems(menu, "PIZ").map((item) => item._id), ["2"]);
  assert.deepEqual(filterOrderMenuItems(menu, "ch").map((item) => item._id), ["3"]);
  assert.deepEqual(filterOrderMenuItems(menu, "ABC"), []);
  assert.deepEqual(filterOrderMenuItems(menu, "dal"), []);
});

test("menu search and category filtering apply together", () => {
  assert.deepEqual(filterOrderMenuItems(menu, "p", "flatbread").map((item) => item._id), ["1"]);
  assert.deepEqual(filterOrderMenuItems(menu, "", "curry").map((item) => item._id), ["3", "4"]);
});
