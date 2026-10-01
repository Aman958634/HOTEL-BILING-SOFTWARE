import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import SaasPayment from "../models/SaasPayment.js";
import Subscription from "../models/Subscription.js";
import { downloadMyBillingPaymentPdf, listMyBillingPayments } from "../controllers/publicSubscriptionController.js";
import { isSaasPaymentReceiptAvailable } from "../utils/saasPaymentReceipt.js";
import { buildSaasPaymentReceiptData } from "../utils/saasPaymentPdf.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const created = { restaurants: [], subscriptions: [], payments: [] };

const invoke = (handler, req) => new Promise((resolve) => {
  const headers = {};
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers[name] = value; },
    json(body) { resolve({ statusCode: this.statusCode, headers, body }); },
    send(body) { resolve({ statusCode: this.statusCode, headers, body }); },
  };
  handler(req, res, (error) => resolve({ statusCode: error?.statusCode || 500, error }));
});

try {
  await mongoose.connect(uri);

  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: "Subscription Receipt A " + suffix, slug: "subscription-receipt-a-" + suffix, branchCode: "SRA" + suffix, address: "Local test" }),
    Restaurant.create({ name: "Subscription Receipt B " + suffix, slug: "subscription-receipt-b-" + suffix, branchCode: "SRB" + suffix, address: "Local test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [subscriptionA, subscriptionB] = await Promise.all([
    Subscription.create({ restaurant: restaurantA._id, planName: "professional", status: "active", subscriptionStartAt: new Date("2026-10-01T00:00:00Z"), subscriptionEndAt: new Date("2027-10-01T00:00:00Z") }),
    Subscription.create({ restaurant: restaurantB._id, planName: "professional", status: "active" }),
  ]);
  created.subscriptions.push(subscriptionA._id, subscriptionB._id);

  const createPayment = async (status, restaurant = restaurantA, subscription = subscriptionA) => {
    const payment = await SaasPayment.create({
      restaurant: restaurant._id,
      subscription: subscription._id,
      planName: "professional",
      amount: 1188,
      currency: "INR",
      billingCycle: "yearly",
      durationMonths: 12,
      durationLabel: "12 months",
      status,
      gateway: "razorpay",
      provider: "RAZORPAY",
      gatewayOrderId: "order_receipt_" + status + "_" + suffix + "_" + created.payments.length,
      gatewayPaymentId: status === "paid" ? "pay_receipt_" + suffix + "_" + created.payments.length : null,
      providerPaymentId: status === "paid" ? "pay_receipt_" + suffix + "_" + created.payments.length : null,
      paymentMethod: "upi",
      paidAt: status === "paid" ? new Date("2026-10-01T09:30:00Z") : null,
    });
    created.payments.push(payment._id);
    return payment;
  };

  const pending = await createPayment("pending");
  const failed = await createPayment("failed");
  const cancelled = await createPayment("cancelled");
  const paid = await createPayment("paid");
  const otherTenantPaid = await createPayment("paid", restaurantB, subscriptionB);
  const userA = { _id: new mongoose.Types.ObjectId(), restaurant: restaurantA._id, fullName: "Asha Patel", email: "asha@example.test" };
  const userB = { _id: new mongoose.Types.ObjectId(), restaurant: restaurantB._id, fullName: "Bharat Patel", email: "bharat@example.test" };

  for (const payment of [pending, failed, cancelled]) {
    const result = await invoke(downloadMyBillingPaymentPdf, { user: userA, params: { id: String(payment._id) } });
    assert.equal(result.statusCode, 409, payment.status + " subscription payment must not have a receipt");
  }
  assert.equal(isSaasPaymentReceiptAvailable({ status: "expired" }), false, "Unknown/non-success statuses never receive a receipt");
  assert.equal(isSaasPaymentReceiptAvailable({ status: "paid" }), true);

  const crossTenant = await invoke(downloadMyBillingPaymentPdf, { user: userA, params: { id: String(otherTenantPaid._id) } });
  assert.equal(crossTenant.statusCode, 404, "A tenant cannot retrieve another tenant's subscription receipt");

  const paidResult = await invoke(downloadMyBillingPaymentPdf, { user: userA, params: { id: String(paid._id) } });
  assert.equal(paidResult.statusCode, 200, "Verified paid subscription payment can retrieve a receipt");
  assert.equal(paidResult.headers["Content-Type"], "application/pdf");
  assert.ok(paidResult.body.length > 0);

  const history = await invoke(listMyBillingPayments, { user: userA });
  assert.equal(history.statusCode, 200);
  const paidHistory = history.body.data.find((row) => String(row.id) === String(paid._id));
  const pendingHistory = history.body.data.find((row) => String(row.id) === String(pending._id));
  assert.equal(paidHistory.status, "SUCCESS");
  assert.equal(paidHistory.receiptAvailable, true);
  assert.equal(pendingHistory.receiptAvailable, false);
  assert.equal(paidHistory.receiptNumber, paid.internalReference, "Receipt number remains the payment's immutable internal reference");

  const receiptData = buildSaasPaymentReceiptData({
    ...paid.toObject(),
    customerName: userA.fullName,
    customer: { email: userA.email },
    restaurantName: restaurantA.name,
    receiptNumber: paid.internalReference,
  }, subscriptionA);
  assert.equal(receiptData.status, "SUCCESS");
  assert.equal(receiptData.restaurantName, restaurantA.name);
  assert.equal(receiptData.customerName, userA.fullName);
  assert.equal(receiptData.planName, "professional");
  assert.equal(receiptData.amount, 1188);
  assert.equal(receiptData.tax, null, "No GST is fabricated when the SaaS payment has no authoritative tax field");
  assert.equal(receiptData.receiptNumber, paid.internalReference);
  assert.equal(receiptData.paymentId, paid.providerPaymentId);
  assert.equal(receiptData.orderId, paid.gatewayOrderId);

  const ownTenant = await invoke(downloadMyBillingPaymentPdf, { user: userB, params: { id: String(otherTenantPaid._id) } });
  assert.equal(ownTenant.statusCode, 200);

  console.log("subscriptionReceiptAccess.integration.test.js passed: canonical paid-only, tenant-scoped SaaS receipts use stable stored receipt data.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      SaasPayment.deleteMany({ _id: { $in: created.payments } }),
      Subscription.deleteMany({ _id: { $in: created.subscriptions } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}