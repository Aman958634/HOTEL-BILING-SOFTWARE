import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import "../models/Table.js";
import Food from "../models/Food.js";
import Category from "../models/Category.js";
import Profile from "../models/RestaurantSettlementProfile.js";
import Commission from "../models/RestaurantCommissionConfig.js";
import Settlement from "../models/SettlementTransaction.js";
import { prepareCashfreePaymentOrder } from "../services/cashfreeOrderCreationService.js";
import { verifyPaymentForRecord, createCashfreeCheckoutOrder } from "../controllers/cashfreeController.js";
import { processCashfreeEasySplitAllocation, processCashfreeSettlementWebhook } from "../services/easySplitSettlementService.js";
import { getSettlementSplitSummary } from "../controllers/settlementController.js";
import { safeCashfreeError } from "../utils/cashfreeDiagnostics.js";
import { requirePaymentAdminAccess } from "../middleware/paymentAuth.js";
import { requireSuperAdmin } from "../middleware/tenantMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const { uri } = requireSafeTestDatabase();
assert.equal(uri, "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest");
Object.assign(process.env, { CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "mock-app", CASHFREE_SECRET_KEY: "mock-secret", CASHFREE_EASY_SPLIT_ENABLED: "true", CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "true", CASHFREE_RETURN_URL: "http://127.0.0.1:5173/payment/cashfree/return" });
const originalFetch = global.fetch;
const restaurantId = new mongoose.Types.ObjectId();
const suffix = crypto.randomBytes(6).toString("hex");
const vendorId = `MOCK_${suffix}`;
const mockPaymentId = `9${Date.now()}${crypto.randomInt(10000, 99999)}`;
const remote = new Map();
let creates = 0;
let oldSplitCalls = 0;
let detailMode = "pending";
let vendorStatus = "ACTIVE";
let rejectCreation = false;
let loseResponse = false;
const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
  handler(req, res, reject);
});
global.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path.endsWith("/split")) { oldSplitCalls++; throw new Error("Post-payment split must never be called"); }
  if (path.endsWith(`/vendors/${vendorId}`)) return Response.json({ vendor_id: vendorId, status: vendorStatus });
  if (path === "/pg/orders" && options.method === "POST") {
    creates++;
    const body = JSON.parse(options.body);
    assert.deepEqual(body.order_splits, [{ vendor_id: vendorId, amount: 98 }]);
    assert.equal(body.order_amount, 100);
    assert.equal(options.headers["x-api-version"], "2026-01-01");
    assert.match(options.headers["x-idempotency-key"], /^[0-9a-f-]{36}$/);
    if (rejectCreation) return Response.json({ code: "split_config", type: "invalid_request_error", message: "Easy Split configuration not enabled" }, { status: 400 });
    const data = { ...body, order_status: "ACTIVE", payment_session_id: "mock-session" };
    remote.set(body.order_id, data);
    if (loseResponse) { loseResponse = false; throw new Error("Lost response"); }
    return Response.json(data);
  }
  const orderId = path.split("/").filter(Boolean).at(-1);
  if (path.endsWith("/payments")) {
    const id = path.split("/").at(-2);
    return Response.json([{ order_id: id, cf_payment_id: mockPaymentId, payment_status: "SUCCESS", payment_amount: 100 }]);
  }
  if (path === "/pg/split/order/vendor/recon") {
    const request = JSON.parse(options.body);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-api-version"], "2023-08-01");
    const reportOrder = request.filters.order_ids[0];
    const mismatch = detailMode === "wrong-vendor";
    return Response.json({ cursor: null, data: [
      { merchant_order_id: reportOrder, entity_type: "transaction", entity_id: mockPaymentId, amount: 100, currency: "INR", sale_type: "CREDIT", merchant_vendor_commission: "98.00", eligible_split_balance: "0.00", settled: "YES" },
      ...(detailMode === "missing" ? [] : [{ merchant_order_id: reportOrder, merchant_vendor_id: mismatch ? "WRONG" : vendorId,
        entity_type: "vendor_commission", entity_id: `allocation_${reportOrder}`, amount: 98, currency: "INR", sale_type: "CREDIT",
        settled: detailMode === "settled" ? "YES" : "NO", vendor_settlement_id: detailMode === "settled" ? "mock-bank-settlement" : undefined,
      }]),
    ] });
  }
  if (path.startsWith("/pg/orders/") && remote.has(orderId)) return Response.json(remote.get(orderId));
  throw new Error(`Unexpected mocked request ${path}`);
};

try {
  await mongoose.connect(uri);
  await Payment.init(); await Settlement.init();
  await Restaurant.create({ _id: restaurantId, name: `Order split ${suffix}`, slug: `split-${suffix}`, branchCode: suffix, address: "Isolated test", isActive: true });
  const outlet = await Outlet.create({ restaurant: restaurantId, name: "Test", code: suffix, isActive: true });
  const user = await User.create({ email: `${suffix}@test.invalid`, fullName: "Test", password: "TestOnly123!", phone: "9999999999", role: "restaurant_admin", restaurant: restaurantId, defaultOutlet: outlet._id });
  await Profile.create({ restaurant: restaurantId, providerVendorId: vendorId, payoutMethod: "BANK", vendorStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE" });
  await Commission.create({ restaurant: restaurantId, commissionType: "PERCENTAGE", commissionBps: 200, effectiveFrom: new Date(Date.now() - 1000) });
  const category = await Category.create({ restaurant: restaurantId, name: "Test", slug: suffix });
  const food = await Food.create({ restaurant: restaurantId, category: category._id, name: "Test", price: 100 });
  const newOrder = async (label) => {
    const o = await Order.create({ orderNumber: `OS-${suffix}-${label}`, restaurant: restaurantId, outlet: outlet._id, customer: user._id, orderType: "TAKEAWAY", items: [{ menuItem: food._id, name: "Test", price: 100, quantity: 1, subtotal: 100 }], subtotal: 100, total: 100, paymentMethod: "CASHFREE", paymentStatus: "PENDING" });
    return Order.findById(o._id).populate("customer");
  };
  const order = await newOrder("main");
  const results = await Promise.allSettled([1, 2, 3].map(() => prepareCashfreePaymentOrder({ order, userId: user._id })));
  for (const result of results) if (result.status === "rejected" && result.reason.code !== "CASHFREE_ORDER_IN_PROGRESS") throw result.reason;
  const { payment } = await prepareCashfreePaymentOrder({ order, userId: user._id });
  assert.equal(creates, 1);
  assert.equal(await Payment.countDocuments({ orderId: order._id }), 1);
  let transaction = await Settlement.findOne({ payment: payment._id });
  assert.equal(await Settlement.countDocuments({ payment: payment._id }), 1);
  assert.equal(transaction.splitStatus, "PENDING");
  assert.equal(transaction.settlementStatus, "NOT_SCHEDULED");
  assert.equal(transaction.platformSharePaise, 200);
  assert.equal(transaction.vendorSharePaise, 9800);
  assert.equal(transaction.platformSharePaise + transaction.vendorSharePaise, 10000);
  // An edit after creation must not change this payment's commercial terms.
  await Commission.updateOne({ restaurant: restaurantId }, { $set: { commissionBps: 900 } });
  detailMode = "missing";
  await verifyPaymentForRecord({ payment, fromWebhook: true });
  transaction = await Settlement.findById(transaction._id);
  assert.equal(transaction.splitStatus, "PENDING", "payment SUCCESS is not allocation success");
  detailMode = "pending";
  await Promise.all([verifyPaymentForRecord({ payment, fromWebhook: true }), verifyPaymentForRecord({ payment })]);
  transaction = await Settlement.findById(transaction._id);
  assert.equal(transaction.splitStatus, "ALLOCATED");
  assert.equal(transaction.settlementStatus, "PENDING", "merchant SUCCESS cannot settle vendor");
  assert.equal(transaction.cashfreePaymentId, mockPaymentId, "int64 payment ID must match losslessly");
  assert.equal(transaction.providerSettlementId, "", "bank reference is not required for allocation");
  assert.equal(transaction.providerSplitReference, `allocation_${payment.cashfreeOrderId}`);
  assert.equal((await Payment.findById(payment._id)).metadata.easySplitCommission.commissionBps, 200);
  await processCashfreeEasySplitAllocation({ paymentId: payment._id });
  assert.equal(oldSplitCalls, 0);
  assert.equal(await Settlement.countDocuments({ payment: payment._id }), 1);
  const reference = transaction.providerSplitReference;
  detailMode = "wrong-vendor";
  await assert.rejects(() => processCashfreeEasySplitAllocation({ paymentId: payment._id }), { code: "CASHFREE_VENDOR_ALLOCATION_UNCONFIRMED" });
  assert.equal((await Settlement.findById(transaction._id)).providerSplitReference, reference);
  detailMode = "settled";
  const event = { type: "VENDOR_SETTLEMENT_SUCCESS", data: { order_id: payment.cashfreeOrderId, vendor_id: vendorId } };
  await Promise.all([1, 2].map(() => processCashfreeSettlementWebhook({ event, rawBody: JSON.stringify(event) })));
  assert.equal((await Settlement.findById(transaction._id)).settlementStatus, "SETTLED");
  assert.equal(oldSplitCalls, 0);
  // Cross-tenant and cross-outlet history cannot expose this allocation.
  const ownUser = { ...user.toObject(), activeOutlet: outlet._id };
  const own = await invoke(getSettlementSplitSummary, { user: ownUser });
  assert.equal(own.body.data.transactions.length, 1);
  assert.equal(own.body.data.transactions[0].orderNumber, order.orderNumber);
  const middlewareError = (handler, userValue) => new Promise((resolve) => handler({ user: userValue }, {}, resolve));
  assert.equal((await middlewareError(requirePaymentAdminAccess, null)).statusCode, 401);
  assert.equal((await middlewareError(requirePaymentAdminAccess, { role: "chef", permissions: [] })).statusCode, 403);
  assert.equal(await middlewareError(requirePaymentAdminAccess, { role: "restaurant_admin", permissions: ["payments.collect"] }), undefined);
  assert.equal((await middlewareError(requireSuperAdmin, ownUser)).statusCode, 403);
  assert.equal(await middlewareError(requireSuperAdmin, { role: "super_admin" }), undefined);
  assert.equal((await middlewareError(requireRole("admin", "restaurant_admin"), { role: "manager" })).statusCode, 403);
  const foreign = await invoke(getSettlementSplitSummary, { user: { ...ownUser, restaurant: new mongoose.Types.ObjectId() } });
  assert.equal(foreign.body.data.transactions.length, 0);
  const otherOutlet = await invoke(getSettlementSplitSummary, { user: { ...ownUser, activeOutlet: new mongoose.Types.ObjectId() } });
  assert.equal(otherOutlet.body.data.transactions.length, 0);
  await assert.rejects(() => invoke(createCashfreeCheckoutOrder, { body: { orderId: order._id }, user: { ...ownUser, restaurant: new mongoose.Types.ObjectId() } }), { statusCode: 404 });
  await Commission.updateOne({ restaurant: restaurantId }, { $set: { commissionBps: 200 } });
  const forgedBodyOrder = await newOrder("forged-body");
  const forgedBodyResult = await invoke(createCashfreeCheckoutOrder, { user: ownUser, get: () => "", body: {
    orderId: forgedBodyOrder._id, vendor_id: "ATTACKER", commissionBps: 0, vendorShare: 100, platformShare: 0, amount: 1,
  } });
  assert.equal(forgedBodyResult.status, 201);
  assert.equal((await Settlement.findOne({ order: forgedBodyOrder._id })).vendorSharePaise, 9800);
  const recoveryOrder = await newOrder("recovery");
  loseResponse = true;
  await assert.rejects(() => prepareCashfreePaymentOrder({ order: recoveryOrder, userId: user._id }));
  const createsBeforeRecovery = creates;
  await prepareCashfreePaymentOrder({ order: recoveryOrder, userId: user._id });
  assert.equal(creates, createsBeforeRecovery, "lost response recovered through GET");
  const rejectedOrder = await newOrder("rejected");
  rejectCreation = true;
  await assert.rejects(() => prepareCashfreePaymentOrder({ order: rejectedOrder, userId: user._id }));
  const failed = await Settlement.findOne({ order: rejectedOrder._id });
  assert.equal(failed.providerHttpStatus, 400);
  assert.equal(failed.providerErrorCode, "split_config");
  assert.equal(failed.providerErrorType, "invalid_request_error");
  assert.equal(failed.providerErrorMessage, "Easy Split configuration not enabled");
  const before = creates;
  await assert.rejects(() => prepareCashfreePaymentOrder({ order: rejectedOrder, userId: user._id }), { code: "CASHFREE_ORDER_PREVIOUSLY_REJECTED" });
  assert.equal(creates, before);
  vendorStatus = "BLOCKED";
  const blockedOrder = await newOrder("blocked");
  await assert.rejects(() => prepareCashfreePaymentOrder({ order: blockedOrder, userId: user._id }), { code: "SETTLEMENT_ACCOUNT_NOT_READY" });
  assert.equal(await Payment.countDocuments({ orderId: blockedOrder._id }), 0);
  const diagnostic = safeCashfreeError(400, { message: "mock-secret account_number: 123456789012 PAN ABCDE1234F user@upi" });
  assert.ok(!JSON.stringify(diagnostic).includes("mock-secret"));
  assert.ok(!JSON.stringify(diagnostic).includes("123456789012"));
  assert.ok(!JSON.stringify(diagnostic).includes("user@upi"));
  console.log("Order creation split tests passed: 10000=200+9800, one provider order/payment/allocation, zero post-payment splits, provider-confirmed reconciliation, separate settlement, immutable snapshot, lost response, safe errors, tenant/outlet scope.");
} finally {
  global.fetch = originalFetch;
  if (mongoose.connection.readyState === 1) {
    for (const model of [Settlement, Payment, Order, User, Profile, Commission, Outlet, Food, Category]) await model.deleteMany({ restaurant: restaurantId });
    await mongoose.connection.collection("invoices").deleteMany({ restaurant: restaurantId });
    await Restaurant.deleteOne({ _id: restaurantId });
    await mongoose.disconnect();
  }
}
