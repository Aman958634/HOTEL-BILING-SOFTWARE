import assert from "node:assert/strict";
import test from "node:test";
import { filterOrderMenuItems } from "./orderMenuFiltering.js";

test("all A-Z prefixes return only authorized items starting with the entered spelling", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const paginatedMenu = Array.from({ length: 260 }, (_, index) => ({
    _id: String(index),
    name: `${alphabet[index % alphabet.length]} Menu ${index}`,
    category: index % 3 ? "main" : "special",
    isAvailable: true,
  }));
  paginatedMenu.push({ _id: "hidden", name: "A Hidden", category: "special", isAvailable: false });

  for (const letter of alphabet) {
    const matches = filterOrderMenuItems(paginatedMenu, letter.toLowerCase());
    assert.ok(matches.length >= 10);
    assert.ok(matches.every((item) => item.name.startsWith(letter)));
  }
  const categoryMatches = filterOrderMenuItems(paginatedMenu, "a", "special");
  assert.ok(categoryMatches.every((item) => item.name.startsWith("A") && item.category === "special"));
  assert.equal(filterOrderMenuItems(paginatedMenu, "").length, 260);
  assert.equal(filterOrderMenuItems(paginatedMenu, "a").some((item) => item._id === "hidden"), false);
});
