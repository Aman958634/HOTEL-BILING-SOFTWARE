import assert from "node:assert/strict";
import Restaurant from "../models/Restaurant.js";
import { buildKitchenTicketFromKot } from "../services/kotService.js";

const restaurant = new Restaurant({
  name: "Kitchen feature test",
  slug: "kitchen-feature-test",
  branchCode: "KOTTEST",
  address: "Local test",
});
assert.equal(restaurant.kitchenDisplayEnabled, true, "KDS remains enabled by default for existing SaaS tenants");

const ticket = buildKitchenTicketFromKot({
  _id: "kot-id",
  orderId: { _id: "order-id", status: "PENDING" },
  orderNumber: "ORD-1001",
  orderType: "TAKEAWAY",
  tableId: null,
  restaurant: "restaurant-id",
  status: "NEW",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  items: [{ orderItemIndex: 0, name: "Paneer Tikka", quantity: 2, specialInstructions: "Less spicy", price: 999, subtotal: 1998 }],
});

assert.equal(ticket.orderNumber, "ORD-1001");
assert.deepEqual(ticket.items, [{ index: 0, name: "Paneer Tikka", quantity: 2, specialInstructions: "Less spicy", kitchenStatus: undefined, menuItem: undefined }]);
assert.equal(JSON.stringify(ticket).includes("999"), false, "KOT output must not expose pricing");
assert.equal(JSON.stringify(ticket).includes("payment"), false, "KOT output must not expose payment data");

console.log("Kitchen KOT projection regression checks passed.");
