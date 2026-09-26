import assert from "node:assert/strict";
import { canManageHotelPaymentSettings, requireHotelPaymentSettingsAdmin } from "../middleware/hotelPaymentAuth.js";

const invoke = (user) => new Promise((resolve) => {
  requireHotelPaymentSettingsAdmin({ user }, {}, (error) => resolve(error || null));
});

assert.equal(canManageHotelPaymentSettings({ role: "hotel_admin" }), true);
assert.equal(canManageHotelPaymentSettings({ role: "restaurant_admin" }), true);
assert.equal(canManageHotelPaymentSettings({ role: "cashier", accessLevel: "ROLE_DEFAULT" }), false);
assert.equal(canManageHotelPaymentSettings({ role: "cashier", accessLevel: "FULL_ACCESS" }), false);
assert.equal((await invoke({ role: "cashier", accessLevel: "ROLE_DEFAULT" }))?.statusCode, 403);
assert.equal((await invoke({ role: "cashier", accessLevel: "FULL_ACCESS" }))?.statusCode, 403);
assert.equal(await invoke({ role: "hotel_admin" }), null);

console.log("hotelPaymentSettingsAccess.test.js passed: Hotel UPI destination settings require authorized administrator access.");
