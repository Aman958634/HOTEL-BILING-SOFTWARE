import assert from "node:assert/strict";
import { NOTIFICATION_EVENTS } from "../services/notificationService.js";

const mandatoryEvents = [
  "ORDER_CREATED", "ONLINE_ORDER_RECEIVED", "KOT_CREATED", "KOT_READY", "CUSTOMER_CREATED", "STAFF_CREATED",
  "BILL_GENERATED", "PAYMENT_RECEIVED", "PARTIAL_PAYMENT_RECEIVED", "BILL_FULLY_PAID", "REFUND_CREATED",
  "REFUND_COMPLETED", "LOYALTY_MEMBER_ENROLLED", "INVENTORY_LOW", "INVENTORY_OUT_OF_STOCK",
  "RECONCILIATION_MISMATCH", "INTELLIGENCE_ALERT_CREATED",
];

for (const eventType of mandatoryEvents) assert.equal(NOTIFICATION_EVENTS[eventType], eventType);
assert.equal(new Set(Object.values(NOTIFICATION_EVENTS)).size, mandatoryEvents.length);
console.log("Notification event contract tests passed.");
