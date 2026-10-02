import assert from "node:assert/strict";
import { canSelfConfirmHotelUpiPayment } from "../controllers/hotelPaymentController.js";

for (const role of ["admin", "hotel_admin", "restaurant_admin"]) {
  assert.equal(canSelfConfirmHotelUpiPayment({ role }), true, `${role} may self-confirm within the existing scoped verify route`);
}

for (const role of ["cashier", "staff", "manager", "super_admin", "chef", ""]) {
  assert.equal(canSelfConfirmHotelUpiPayment({ role }), false, `${role || "anonymous"} must not receive Hotel UPI self-confirmation authority`);
}

console.log("hotelUpiVerificationPolicy.test.js passed: only canonical restaurant/hotel administrator roles may self-confirm.");
