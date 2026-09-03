import assert from "node:assert/strict";
import { getPaymentSocketRoom } from "../socket/paymentSocket.js";
import { getTableSocketRoom } from "../services/tableStateService.js";

assert.equal(getTableSocketRoom({ outlet: "outlet-a", restaurant: "restaurant-a" }), "outlet:outlet-a");
assert.equal(getTableSocketRoom({ restaurant: "restaurant-a" }), null);

assert.equal(getPaymentSocketRoom({ outlet: "outlet-a", restaurant: "restaurant-a" }), "outlet:outlet-a");
assert.equal(getPaymentSocketRoom({ orderId: { outlet: "outlet-b" }, restaurant: "restaurant-a" }), "outlet:outlet-b");
assert.equal(getPaymentSocketRoom({ restaurant: "restaurant-a" }), null);

console.log("Realtime outlet scope tests passed.");
