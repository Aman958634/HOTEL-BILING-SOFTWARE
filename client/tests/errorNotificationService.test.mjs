import assert from "node:assert/strict";
import { createErrorNotifier } from "../src/utils/errorNotifications.js";

const calls = [];
const timers = [];
const notifier = createErrorNotifier({
  showError: (message, options) => calls.push({ message, id: options.id }),
  schedule: (callback) => {
    timers.push(callback);
    return timers.length;
  },
  cancel: () => {},
});

const apiError = ({ code, status = 403, url = "/admin/stats", message = "Request failed" }) => ({
  code,
  userMessage: message,
  response: { status, data: { code, message } },
  config: { method: "get", url },
});

// Three concurrent subscription failures produce a modal condition and no red toast.
const expired = apiError({ code: "SUBSCRIPTION_EXPIRED", message: "Your free trial has ended." });
notifier.activateGlobalCondition(expired);
notifier.activateGlobalCondition({ ...expired, config: { method: "get", url: "/admin/sales" } });
notifier.activateGlobalCondition({ ...expired, config: { method: "get", url: "/admin/orders" } });
assert.equal(notifier.globalConditionCount(), 1);
assert.equal(notifier.notifyError(expired), null);
assert.equal(calls.length, 0);

// Resolving the condition permits a later, genuinely new occurrence.
notifier.resolveGlobalCondition("SUBSCRIPTION_EXPIRED");
const ordinary = apiError({ code: "DASHBOARD_UNAVAILABLE", status: 503, message: "Dashboard is temporarily unavailable." });
const first = notifier.notifyError(ordinary, { context: "dashboard" });
const second = notifier.notifyError(ordinary, { context: "dashboard" });
assert.equal(first, second);
assert.equal(calls.length, 1);
notifier.dismissError(first);
const later = notifier.notifyError(ordinary, { context: "dashboard" });
assert.notEqual(later, null);
assert.equal(calls.length, 2);

// Different normalized code/request identities stay distinct.
notifier.notifyError(apiError({ code: "ORDERS_UNAVAILABLE", status: 503, url: "/orders", message: "Orders are temporarily unavailable." }), { context: "orders" });
assert.equal(calls.length, 3);

// Similar text from distinct request identities must remain visible separately.
notifier.notifyError(apiError({ code: "INVENTORY_UNAVAILABLE", status: 503, url: "/inventory", message: "Service is temporarily unavailable." }), { context: "inventory" });
notifier.notifyError(apiError({ code: "REPORTS_UNAVAILABLE", status: 503, url: "/reports", message: "Service is temporarily unavailable." }), { context: "reports" });
assert.equal(calls.length, 5);

// A global network condition gets one toast across retries/routes, then can notify again after recovery.
const offline = { code: "NETWORK_UNAVAILABLE", userMessage: "Unable to connect. Check your connection and try again.", config: { method: "get", url: "/admin/stats" } };
notifier.activateGlobalCondition(offline, { global: true, context: "network" });
notifier.notifyError(offline, { global: true, allowGlobalIdentity: true, context: "network" });
notifier.notifyError({ ...offline, config: { method: "get", url: "/admin/orders" } }, { global: true, allowGlobalIdentity: true, context: "network" });
assert.equal(calls.length, 6);
notifier.resolveGlobalCondition("NETWORK_UNAVAILABLE");
notifier.notifyError(offline, { context: "network" });
assert.equal(calls.length, 7);

console.log("Global error notification deduplication tests passed.");
