import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import "../models/Table.js";
import { getPaymentReceipt } from "../controllers/paymentController.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurant: null, outlet: null, payments: [] };

const invokeReceipt = (req) => new Promise((resolve) => {
  const headers = {};
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers[name] = value; },
    send(body) { resolve({ statusCode: this.statusCode, headers, body }); },
  };
  getPaymentReceipt(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});

try {
  await mongoose.connect(uri);

  const restaurant = await Restaurant.create({
    name: `Receipt Test ${suffix}`,
    slug: `receipt-test-${suffix}`,
    branchCode: `RT${suffix}`,
    address: "Local test",
  });
  created.restaurant = restaurant._id;
  const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Receipt Test", code: `RT${suffix}`, isDefault: true });
  created.outlet = outlet._id;
  const user = { _id: new mongoose.Types.ObjectId(), restaurant: restaurant._id, activeOutlet: outlet._id, defaultOutlet: outlet._id, allOutletsAccess: true };

  const createPayment = async (paymentStatus) => {
    const payment = await Payment.create({
      paymentId: `RECEIPT-${paymentStatus}-${suffix}-${created.payments.length}`,
      restaurant: restaurant._id,
      outlet: outlet._id,
      amount: 10,
      totalAmount: 10,
      paymentMethod: "UPI",
      provider: "HOTEL_UPI",
      gateway: "HOTEL_UPI",
      paymentStatus,
      transactionId: `TXN-${paymentStatus}-${suffix}-${created.payments.length}`,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
    });
    created.payments.push(payment._id);
    return payment;
  };

  for (const paymentStatus of ["AWAITING_VERIFICATION", "PENDING", "FAILED"]) {
    const payment = await createPayment(paymentStatus);
    const result = await invokeReceipt({ user, params: { id: payment._id } });
    assert.equal(result.statusCode, 409, `${paymentStatus} receipt request must be rejected`);
    assert.match(result.error?.message || "", /only after.*PAID/i);
  }

  const paidPayment = await createPayment("PAID");
  const paidResult = await invokeReceipt({ user, params: { id: paidPayment._id } });
  assert.equal(paidResult.statusCode, 200, "A canonical PAID payment can retrieve a receipt");
  assert.equal(paidResult.headers["Content-Type"], "application/pdf");
  assert.ok(paidResult.body.length > 0, "A PAID receipt has PDF content");

  console.log("paymentReceiptAccess.test.js passed: receipt access is limited to canonical PAID payments.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Payment.deleteMany({ _id: { $in: created.payments } }),
      Outlet.deleteOne({ _id: created.outlet }),
      Restaurant.deleteOne({ _id: created.restaurant }),
    ]);
    await mongoose.disconnect();
  }
}
