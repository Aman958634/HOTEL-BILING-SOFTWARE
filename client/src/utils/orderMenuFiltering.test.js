import assert from "node:assert/strict";
import test from "node:test";
import { filterOrderMenuItems } from "./orderMenuFiltering.js";

const menu = [
  { _id: "1", name: "Paneer Paratha", category: "flatbread", isAvailable: true },
  { _id: "2", name: "Mix Paratha", category: "flatbread", isAvailable: true },
  { _id: "3", name: "Gobi Paratha", category: "flatbread", isAvailable: true },
  { _id: "4", name: "Dal Tadka", category: "curry", isAvailable: true },
  { _id: "5", name: "Unavailable Aloo", category: "flatbread", isAvailable: false },
];

test("menu search returns every authorized case-insensitive name match", () => {
  assert.deepEqual(filterOrderMenuItems(menu, " a ").map((item) => item._id), ["1", "2", "3", "4"]);
});

test("menu search and category filtering apply together", () => {
  assert.deepEqual(filterOrderMenuItems(menu, "a", "flatbread").map((item) => item._id), ["1", "2", "3"]);
});

test("single-letter search keeps every authorized match from a complete paginated menu", () => {
  const allAuthorizedPages = Array.from({ length: 250 }, (_, index) => ({
    _id: String(index),
    name: index % 2 ? `Menu ${index} Aloo` : `Menu ${index} Soup`,
    category: index % 3 ? "main" : "special",
    isAvailable: true,
  }));
  allAuthorizedPages.push({ _id: "hidden", name: "Unavailable Aloo", category: "main", isAvailable: false });

  const matches = filterOrderMenuItems(allAuthorizedPages, " a ");
  assert.equal(matches.length, 125);
  assert.equal(matches.at(-1)?._id, "249");
  assert.equal(filterOrderMenuItems(allAuthorizedPages, "a", "special").length, 42);
});
