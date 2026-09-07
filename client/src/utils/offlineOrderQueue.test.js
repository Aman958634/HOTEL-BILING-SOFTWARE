import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const queue = await import("./offlineOrderQueue.js");

const user = { id: "user-1", restaurant: "restaurant-1" };
const payload = { orderType: "DINE_IN", table: "table-1", items: [{ menuItem: "food-1", quantity: 2 }], notes: "offline" };

test("offline queue scopes intents and preserves stable idempotency key", () => {
  const scope = queue.getOfflineOrderScope({ user, outletId: "outlet-1" });
  const record = queue.savePendingOfflineOrder({ scope, outletId: "outlet-1", userId: "user-1", restaurantId: "restaurant-1", payload, idempotencyKey: "offline-key-1" });
  assert.equal(queue.listPendingOfflineOrders(scope).length, 1);
  assert.equal(queue.savePendingOfflineOrder({ scope, outletId: "outlet-1", userId: "user-1", restaurantId: "restaurant-1", payload, idempotencyKey: "offline-key-1" }).localOperationId, record.localOperationId);
  assert.equal(queue.listPendingOfflineOrders(queue.getOfflineOrderScope({ user, outletId: "outlet-2" })).length, 0);
  assert.equal(record.payload.items[0].price, undefined);
});

test("offline queue rejects records beyond its bounded cap", () => {
  const scope = queue.getOfflineOrderScope({ user, outletId: "outlet-cap" });
  for (let index = 0; index < 50; index += 1) queue.savePendingOfflineOrder({ scope, outletId: "outlet-cap", userId: "user-1", restaurantId: "restaurant-1", payload, idempotencyKey: `offline-cap-${index}` });
  assert.throws(() => queue.savePendingOfflineOrder({ scope, outletId: "outlet-cap", userId: "user-1", restaurantId: "restaurant-1", payload, idempotencyKey: "offline-cap-overflow" }), /queue is full/i);
});
