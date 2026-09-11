import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import app from "../app.js";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Settlement from "../models/SettlementTransaction.js";
import WebhookEvent from "../models/SettlementWebhookEvent.js";
import Refund from "../models/Refund.js";
import { ensureOrderSplitTransaction } from "../services/cashfreeOrderSplitService.js";
import { refundRecordedPayment } from "../services/reconciliationService.js";

const { uri } = requireSafeTestDatabase();
assert.equal(uri, "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest");
Object.assign(process.env, { CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "webhook-test-app", CASHFREE_SECRET_KEY: "webhook-test-secret", CASHFREE_EASY_SPLIT_ENABLED: "true", CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "true" });
const restaurant = new mongoose.Types.ObjectId();
const suffix = crypto.randomBytes(8).toString("hex");
const cashfreeOrderId = `webhook_order_${suffix}`;
const vendorId = `MOCK_${suffix}`;
const paymentId = `webhook_payment_${suffix}`;
const reference = `allocation_${suffix}`;
const originalFetch = global.fetch;
let providerReads = 0;
let providerWrites = 0;
let server;
let transaction;
global.fetch = async (url, options = {}) => {
  const target = new URL(url);
  if (target.hostname === "127.0.0.1") return originalFetch(url, options);
  assert.equal(target.hostname, "sandbox.cashfree.com");
  const method = options.method || "GET";
  if (method !== "GET" && target.pathname !== "/pg/split/order/vendor/recon") { providerWrites++; assert.fail("No provider writes allowed"); }
  providerReads++;
  if (target.pathname === `/pg/orders/${cashfreeOrderId}/payments`) return Response.json([{ cf_payment_id: paymentId, payment_status: "SUCCESS", payment_amount: 100 }]);
  if (target.pathname === `/pg/orders/${cashfreeOrderId}`) return Response.json({ order_id: cashfreeOrderId, order_status: "PAID", order_amount: 100, order_currency: "INR", order_splits: [{ vendor_id: vendorId, amount: 98 }] });
  if (target.pathname === "/pg/split/order/vendor/recon") return Response.json({ data: [
    { merchant_order_id: cashfreeOrderId, entity_type: "transaction", entity_id: paymentId, amount: 100, currency: "INR", sale_type: "CREDIT", merchant_vendor_commission: "98.00", eligible_split_balance: "0.00", settled: "YES" },
    { merchant_order_id: cashfreeOrderId, merchant_vendor_id: vendorId, entity_type: "vendor_commission", entity_id: reference, amount: 98, currency: "INR", sale_type: "CREDIT", settled: "NO" },
  ] });
  assert.fail(`Unexpected mock path ${target.pathname}`);
};
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await WebhookEvent.createIndexes();
  await Restaurant.create({ _id: restaurant, name: `Webhook ${suffix}`, slug: `webhook-${suffix}`, branchCode: suffix, address: "Isolated test" });
  const outlet = await Outlet.create({ restaurant, name: "Webhook test", code: suffix });
  const category = await Category.create({ restaurant, name: "Webhook", slug: suffix });
  const food = await Food.create({ restaurant, category: category._id, name: "Test", price: 100 });
  const order = await Order.create({ restaurant, outlet: outlet._id, orderNumber: `WH-${suffix}`, orderType: "TAKEAWAY", items: [{ menuItem: food._id, name: "Test", price: 100, quantity: 1, subtotal: 100 }], subtotal: 100, total: 100, paymentMethod: "CASHFREE", paymentStatus: "PENDING" });
  const payment = await Payment.create({ restaurant, outlet: outlet._id, orderId: order._id, paymentId: `WH-${suffix}`, amount: 100, totalAmount: 100, paymentMethod: "CASHFREE", provider: "cashfree", paymentStatus: "PENDING", cashfreeOrderId, transactionId: `WH-${suffix}`, idempotencyKey: suffix, allocationStrategy: "ORDER_CREATION_SPLIT", metadata: { easySplitCommission: { providerVendorId: vendorId, commissionType: "PERCENTAGE", commissionBps: 200, fixedAmountPaise: 0, grossAmountPaise: 10000, platformSharePaise: 200, vendorSharePaise: 9800 } } });
  transaction = await ensureOrderSplitTransaction(payment);
  server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  const endpoint = `http://127.0.0.1:${server.address().port}/api/webhooks/cashfree`;
  const sign = (body, timestamp) => crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(`${timestamp}${body}`).digest("base64");
  const send = (body, { timestamp = String(Date.now()), signature } = {}) => fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-webhook-timestamp": timestamp, "x-webhook-signature": signature ?? sign(body, timestamp) }, body });
  const event = { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: cashfreeOrderId }, payment: { cf_payment_id: paymentId, payment_status: "SUCCESS", payment_amount: 100 } } };
  const raw = JSON.stringify(event).replace('"payment_amount":100', '"payment_amount":100.00');
  assert.equal((await send(raw, { signature: "invalid" })).status, 401);
  const timestamp = String(Date.now());
  assert.equal((await send(raw.replace("100.00", "1.00"), { timestamp, signature: sign(raw, timestamp) })).status, 401);
  assert.equal(providerReads, 0);
  assert.equal((await Payment.findById(payment._id)).paymentStatus, "PENDING");
  assert.equal((await send(raw)).status, 200, "valid exact-byte signature accepted through real Express raw parser");
  // A captured old, valid signature can be delivered again; ledger invariants
  // must survive without relying on timestamp freshness to prevent duplicates.
  const oldTimestamp = "1746427759733";
  for (let i = 0; i < 3; i++) assert.equal((await send(raw, { timestamp: oldTimestamp })).status, 200);
  assert.equal(await Payment.countDocuments({ restaurant }), 1);
  assert.equal(await Settlement.countDocuments({ restaurant }), 1);
  const saved = await Settlement.findById(transaction._id);
  assert.equal(saved.providerAllocationReference, reference);
  assert.equal(saved.splitStatus, "ALLOCATED");
  assert.equal(saved.settlementStatus, "PENDING", "merchant YES cannot settle vendor NO");
  assert.equal((await Payment.findById(payment._id)).paymentStatus, "PAID");
  const vendorEvent = JSON.stringify({ type: "VENDOR_SETTLEMENT_SUCCESS", data: { order_id: cashfreeOrderId, vendor_id: vendorId, settlement_id: `mock_settlement_${suffix}`, status: "SUCCESS" } });
  assert.equal((await send(vendorEvent)).status, 200);
  const readsBeforeDuplicate = providerReads;
  assert.equal((await send(vendorEvent)).status, 200);
  assert.equal(providerReads, readsBeforeDuplicate, "duplicate settlement event deduplicated before provider read");
  assert.equal(await WebhookEvent.countDocuments({ settlementTransaction: transaction._id }), 1);
  assert.equal((await send(JSON.stringify({ type: "FUTURE_UNKNOWN_EVENT", data: { order: { order_id: cashfreeOrderId } } }))).status, 200);
  assert.equal((await send(JSON.stringify({ type: "FUTURE_UNKNOWN_EVENT" }))).status, 200);
  assert.equal(providerReads, readsBeforeDuplicate, "unknown events have no side effects");
  assert.equal((await send(JSON.stringify({ ...event, data: { order: { order_id: `unknown_${suffix}` } } }))).status, 200);
  assert.equal((await send("{broken")).status, 400);
  await assert.rejects(() => refundRecordedPayment({ paymentId: payment._id, restaurantId: restaurant, amount: 100, reason: "Guard test", idempotencyKey: `refund_${suffix}` }), /Digital refunds must be completed through the verified payment provider/);
  assert.equal(await Refund.countDocuments({ payment: payment._id }), 0);
  assert.equal(await Payment.countDocuments({ restaurant }), 1);
  assert.equal(await Settlement.countDocuments({ restaurant }), 1);
  assert.equal(providerWrites, 0);
  console.log("webhookSecurity.test.js passed: valid/invalid/tampered raw signatures, old replay, duplicate event, unknown event, one Payment/SettlementTransaction, refund guard, zero provider writes.");
} finally {
  global.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    if (transaction) await WebhookEvent.deleteMany({ settlementTransaction: transaction._id });
    for (const model of [Settlement, Payment, Order, Outlet, Food, Category]) await model.deleteMany({ restaurant });
    for (const name of ["invoices", "activitylogs", "notifications"]) await mongoose.connection.collection(name).deleteMany({ restaurant });
    await Restaurant.deleteOne({ _id: restaurant });
    await mongoose.disconnect();
  }
}
