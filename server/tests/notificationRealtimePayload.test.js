import assert from "node:assert/strict";
import { buildNotificationRealtimePayload } from "../socket/notificationSocket.js";

const payload = buildNotificationRealtimePayload({
  _id: "notification-a",
  user: "user-a",
  restaurantId: "restaurant-a",
  outlet: "outlet-a",
  eventType: "ORDER_CREATED",
  type: "ORDER_CREATED",
  title: "New order",
  message: "Order created",
  createdAt: new Date("2026-10-01T00:00:00Z"),
});

assert.equal(payload.id, "notification-a");
assert.equal(payload.restaurantId, "restaurant-a");
assert.equal(payload.outlet, "outlet-a");
assert.equal(payload.type, "ORDER_CREATED");
console.log("Notification realtime payload tests passed.");
