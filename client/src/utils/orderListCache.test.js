import assert from "node:assert/strict";
import test from "node:test";
import {
  cacheOrderList,
  clearOrderListCache,
  createOrderListCacheKey,
  createOrderListScope,
  getCachedOrderList,
  getSharedOrderListRequest,
} from "./orderListCache.js";

const user = { _id: "user-a", restaurant: "restaurant-a", role: "manager", customPermissions: ["orders.read"] };
const authorizedOutlets = [{ _id: "outlet-a" }, { _id: "outlet-b" }];
const filters = { page: 1, search: "", status: "", orderType: "", paymentStatus: "", date: "", sortBy: "newest" };

test("order cache is isolated by tenant, authorized outlet, and query", () => {
  const scope = createOrderListScope({ user, activeOutletId: "outlet-a", authorizedOutlets });
  const key = createOrderListCacheKey(scope, filters);
  cacheOrderList(key, [{ _id: "order-a" }], { page: 1, total: 1 });

  assert.equal(getCachedOrderList(createOrderListCacheKey(scope, { ...filters, status: "PENDING" })), null);
  assert.equal(getCachedOrderList(createOrderListCacheKey(createOrderListScope({ user, activeOutletId: "outlet-b", authorizedOutlets }), filters)), null);
  assert.equal(getCachedOrderList(createOrderListCacheKey(createOrderListScope({ user: { ...user, restaurant: "restaurant-b" }, activeOutletId: "outlet-a", authorizedOutlets }), filters)), null);
});

test("an unauthorized or incomplete outlet scope cannot read a cached order list", () => {
  assert.equal(createOrderListScope({ user, activeOutletId: "outlet-c", authorizedOutlets }), "");
  assert.equal(createOrderListCacheKey("", filters), "");
});

test("duplicate page effects share a single in-flight order request", async () => {
  let calls = 0;
  const request = async () => { calls += 1; return { orders: [] }; };
  const [first, second] = await Promise.all([
    getSharedOrderListRequest("request-key", request),
    getSharedOrderListRequest("request-key", request),
  ]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
});

test("clearing the cache prevents a later account session from receiving prior data", () => {
  const scope = createOrderListScope({ user, activeOutletId: "outlet-a", authorizedOutlets });
  const key = createOrderListCacheKey(scope, filters);
  cacheOrderList(key, [{ _id: "order-a" }], { page: 1, total: 1 });
  clearOrderListCache();
  assert.equal(getCachedOrderList(key), null);
});
