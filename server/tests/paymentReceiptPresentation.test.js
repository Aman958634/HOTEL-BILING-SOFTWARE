import assert from "node:assert/strict";
import { buildPaymentReceiptData, buildReceiptBuffer } from "../utils/paymentUtils.js";

const payment = {
  paymentId: "PAY-2026-00042",
  paymentStatus: "PAID",
  paymentMethod: "UPI",
  provider: "HOTEL_UPI",
  transactionId: "BANK-VERIFIED-7842",
  paidAt: new Date("2026-10-01T09:30:00.000Z"),
  subtotal: 650,
  discount: 35,
  tax: 48.75,
  serviceCharge: 0,
  totalAmount: 663.75,
};
const order = {
  orderNumber: "ORD-REAL-42",
  customer: { fullName: "Asha Patel", phone: "9000000000" },
  table: { tableNumber: "T-7" },
  items: [
    { name: "Long Signature RestoSphere Vegetable Biryani", quantity: 2, price: 250, subtotal: 500 },
    { name: "Fresh Lime Soda", quantity: 1, price: 150, subtotal: 150 },
  ],
  subtotal: 650,
  discount: 35,
  tax: 48.75,
  serviceCharge: 0,
  total: 663.75,
};
const restaurant = { name: "RestoSphere Lakeside", address: "Local test address" };

const data = buildPaymentReceiptData({ payment, order, restaurant });

assert.equal(data.status, "SUCCESS", "A canonical PAID receipt is presented as SUCCESS");
assert.equal(data.restaurantName, "RestoSphere Lakeside", "Receipt uses the real restaurant name, never Hotel UPI");
assert.equal(data.paymentMethod, "Hotel UPI", "Hotel UPI is payment method information only");
assert.equal(data.transactionReference, "BANK-VERIFIED-7842");
assert.equal(data.orderNumber, "ORD-REAL-42");
assert.equal(data.customerName, "Asha Patel");
assert.equal(data.tableNumber, "T-7");
assert.deepEqual(data.items.map((item) => [item.name, item.quantity, item.price, item.total]), [
  ["Long Signature RestoSphere Vegetable Biryani", 2, 250, 500],
  ["Fresh Lime Soda", 1, 150, 150],
]);
assert.deepEqual(data.totals, {
  subtotal: 650,
  discount: 35,
  tax: 48.75,
  serviceCharge: 0,
  grandTotal: 663.75,
});
assert.notEqual(data.totals.tax, 18, "Receipt preserves the stored GST amount and never hardcodes 18%");
assert.ok((await buildReceiptBuffer({ payment, order, restaurant })).length > 0, "Receipt PDF is generated from the stored presentation data");

console.log("paymentReceiptPresentation.test.js passed: successful receipts preserve stored restaurant, item, GST, and payment data.");