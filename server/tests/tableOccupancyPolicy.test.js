import assert from "node:assert/strict";
import { buildActiveTableOrderQuery, isOrderActiveForTable } from "../services/tableStateService.js";

for (const status of ["PENDING", "CONFIRMED", "PREPARING", "READY"]) {
  assert.equal(isOrderActiveForTable({ status }), true, `${status} must occupy a dine-in table`);
}
for (const status of ["SERVED", "COMPLETED", "CANCELLED", "REJECTED"]) {
  assert.equal(isOrderActiveForTable({ status, paymentStatus: "PENDING" }), false, `${status} must not remain active because payment is unpaid`);
}
assert.equal(isOrderActiveForTable({ status: "PREPARING", isArchived: true }), false, "Archived orders must not occupy a table");

const query = buildActiveTableOrderQuery({
  restaurantId: "507f1f77bcf86cd799439011",
  outletId: "507f1f77bcf86cd799439012",
  tableId: "507f1f77bcf86cd799439013",
});
assert.equal(String(query.restaurant), "507f1f77bcf86cd799439011");
assert.equal(String(query.outlet), "507f1f77bcf86cd799439012");
assert.equal(String(query.table), "507f1f77bcf86cd799439013");
assert.deepEqual(query.status.$in, ["PENDING", "CONFIRMED", "PREPARING", "READY"]);
assert.equal(query.isArchived.$ne, true);
assert.equal(query.orderType, "DINE_IN");

console.log("tableOccupancyPolicy.test.js passed: table occupancy is operational, scoped, and payment-independent.");