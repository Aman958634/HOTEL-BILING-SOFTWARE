import assert from "node:assert/strict";
import { getHotelPaymentCapability, isValidHotelUpiId } from "../services/hotelPaymentCapability.js";

const ready = {
  settings: { payeeName: "Hotel Demo", upiId: "demo@upi", isEnabled: true },
  environment: "production",
  liveDigitalPayments: "true",
  topologyType: "ReplicaSetWithPrimary",
};

assert.deepEqual(getHotelPaymentCapability(ready), {
  deploymentAllowed: true,
  transactionSupport: true,
  configured: true,
  canEnable: true,
  canCollect: true,
  reason: "",
});

for (const environment of ["staging", "test"]) {
  const capability = getHotelPaymentCapability({ ...ready, environment });
  assert.equal(capability.canEnable, false);
  assert.equal(capability.canCollect, false);
  assert.match(capability.reason, /disabled in staging and test/);
}

assert.equal(getHotelPaymentCapability({ ...ready, liveDigitalPayments: "false" }).canCollect, false);
assert.equal(getHotelPaymentCapability({ ...ready, environment: "development" }).canCollect, false);
assert.equal(getHotelPaymentCapability({ ...ready, topologyType: "Standalone" }).canEnable, false);
assert.equal(getHotelPaymentCapability({ ...ready, settings: { ...ready.settings, isEnabled: false } }).canCollect, false);
assert.equal(isValidHotelUpiId("hotel.demo-1@upi"), true);
assert.equal(isValidHotelUpiId("not-a-vpa"), false);
assert.equal(isValidHotelUpiId("bad @upi"), false);

const unconfigured = getHotelPaymentCapability({ ...ready, settings: { isEnabled: false } });
assert.equal(unconfigured.configured, false);
assert.equal(unconfigured.canEnable, false);
assert.equal(unconfigured.canCollect, false);
assert.match(unconfigured.reason, /Configure Hotel UPI in Settings/);

console.log("hotelPaymentCapability.test.js passed: explicit operator gate, staging/test lockout, transaction topology, and hotel configuration.");