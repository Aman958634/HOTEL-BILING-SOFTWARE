import assert from "node:assert/strict";
import test from "node:test";
import { isRealtimeNotificationVisible, prependRealtimeNotification } from "./realtimeNotifications.js";

const user = { _id: "user-a", restaurant: "restaurant-a" };
const activeOutletId = "outlet-a";
const notification = { id: "notification-a", restaurantId: "restaurant-a", outlet: "outlet-a", isRead: false };

test("authorized realtime notifications are visible only in the active tenant and outlet", () => {
  assert.equal(isRealtimeNotificationVisible({ notification, user, activeOutletId }), true);
  assert.equal(isRealtimeNotificationVisible({ notification: { ...notification, restaurantId: "restaurant-b" }, user, activeOutletId }), false);
  assert.equal(isRealtimeNotificationVisible({ notification: { ...notification, outlet: "outlet-b" }, user, activeOutletId }), false);
  assert.equal(isRealtimeNotificationVisible({ notification: { ...notification, restaurantId: "" }, user, activeOutletId }), false);
});

test("a socket retry cannot duplicate a notification in the bell list", () => {
  const once = prependRealtimeNotification([], notification);
  assert.equal(once.length, 1);
  assert.strictEqual(prependRealtimeNotification(once, notification), once);
});
