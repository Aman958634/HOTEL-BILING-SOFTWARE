import assert from "node:assert/strict";
import test from "node:test";
import { clearOrderDraft, getOrderDraftScope, readOrderDraft, writeOrderDraft } from "./orderDraft.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

const draftForm = (menuItem) => ({
  idempotencyKey: `key-${menuItem}`,
  orderType: "TAKEAWAY",
  items: [{ menuItem, quantity: 2 }],
});

test("order drafts are isolated by user, restaurant, and outlet", () => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();
  try {
    const user = { _id: "user-a", restaurant: "restaurant-a" };
    const ownScope = getOrderDraftScope({ user, outletId: "outlet-a" });
    const otherUserScope = getOrderDraftScope({ user: { ...user, _id: "user-b" }, outletId: "outlet-a" });
    const otherRestaurantScope = getOrderDraftScope({ user: { ...user, restaurant: "restaurant-b" }, outletId: "outlet-a" });
    const otherOutletScope = getOrderDraftScope({ user, outletId: "outlet-b" });

    writeOrderDraft(ownScope, draftForm("menu-own"));
    writeOrderDraft(otherUserScope, draftForm("menu-other-user"));
    writeOrderDraft(otherRestaurantScope, draftForm("menu-other-restaurant"));
    writeOrderDraft(otherOutletScope, draftForm("menu-other-outlet"));

    assert.equal(readOrderDraft(ownScope)?.items[0].menuItem, "menu-own");
    assert.equal(readOrderDraft(otherUserScope)?.items[0].menuItem, "menu-other-user");
    assert.equal(readOrderDraft(otherRestaurantScope)?.items[0].menuItem, "menu-other-restaurant");
    assert.equal(readOrderDraft(otherOutletScope)?.items[0].menuItem, "menu-other-outlet");
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

test("starting a new order clears only its scoped unsent draft", () => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();
  try {
    const currentScope = getOrderDraftScope({ user: { _id: "user-a", restaurant: "restaurant-a" }, outletId: "outlet-a" });
    const otherScope = getOrderDraftScope({ user: { _id: "user-a", restaurant: "restaurant-a" }, outletId: "outlet-b" });
    writeOrderDraft(currentScope, draftForm("menu-current"));
    writeOrderDraft(otherScope, draftForm("menu-other"));

    clearOrderDraft(currentScope);

    assert.equal(readOrderDraft(currentScope), null);
    assert.equal(readOrderDraft(otherScope)?.items[0].menuItem, "menu-other");
  } finally {
    globalThis.localStorage = originalStorage;
  }
});