import assert from "node:assert/strict";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import SettlementWebhookEvent from "../models/SettlementWebhookEvent.js";
import RestaurantSettlementProfile from "../models/RestaurantSettlementProfile.js";
import Payment from "../models/Payment.js";
import { ensureCashfreeSplitAllocation, processCashfreeSettlementWebhook } from "../services/easySplitSettlementService.js";

const REQUIRED_URI = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
assert.equal(String(process.env.TEST_MONGO_URI || "").trim(), REQUIRED_URI, "Easy Split database test must use the isolated Cashfree test database");
const { uri } = requireSafeTestDatabase();
const restaurantA = new mongoose.Types.ObjectId();
const restaurantB = new mongoose.Types.ObjectId();
const paymentA = new mongoose.Types.ObjectId();
const paymentB = new mongoose.Types.ObjectId();
const orderA = new mongoose.Types.ObjectId();
const orderB = new mongoose.Types.ObjectId();
const allocationRestaurant = new mongoose.Types.ObjectId();
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

try {
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  await SettlementTransaction.init();
  await SettlementWebhookEvent.init();
  await SettlementTransaction.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
  await RestaurantCommissionConfig.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
  await RestaurantSettlementProfile.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
  await Payment.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] }, paymentId: { $in: ["EASY-SPLIT-PAYMENT-A"] } });
  await RestaurantCommissionConfig.create({ restaurant: restaurantA, commissionType: "PERCENTAGE", commissionBps: 250, fixedAmountPaise: 0 });
  await SettlementTransaction.create([
    { restaurant: restaurantA, order: orderA, payment: paymentA, providerVendorId: "RESTO_TEST_A", cashfreeOrderId: "order_test_a", grossAmountPaise: 10000, vendorSharePaise: 9750, platformSharePaise: 250, commissionType: "PERCENTAGE", commissionBps: 250, splitStatus: "ALLOCATED", settlementStatus: "PENDING", providerStatus: "OK", providerIdempotencyKey: "5d95193c-4363-42e0-8200-8a08e05a0ab1" },
    { restaurant: restaurantB, order: orderB, payment: paymentB, providerVendorId: "RESTO_TEST_B", cashfreeOrderId: "order_test_b", grossAmountPaise: 20000, vendorSharePaise: 20000, platformSharePaise: 0, commissionType: "NONE", splitStatus: "ALLOCATED", settlementStatus: "PENDING", providerStatus: "OK", providerIdempotencyKey: "89e5c849-fa79-42e3-925d-4da8fc7de9f1" },
  ]);
  const aRows = await SettlementTransaction.find({ restaurant: restaurantA }).lean();
  assert.equal(aRows.length, 1);
  assert.equal(aRows[0].vendorSharePaise + aRows[0].platformSharePaise, aRows[0].grossAmountPaise);
  assert.equal(await SettlementTransaction.countDocuments({ restaurant: restaurantB, payment: paymentA }), 0, "payment allocation cannot cross tenants");
  await assert.rejects(() => SettlementTransaction.create({ restaurant: restaurantA, order: orderA, payment: paymentA, providerVendorId: "RESTO_TEST_A", cashfreeOrderId: "order_test_a_retry", grossAmountPaise: 10000, vendorSharePaise: 9750, platformSharePaise: 250, commissionType: "PERCENTAGE", commissionBps: 250, providerIdempotencyKey: "16fa2ce1-30bf-4054-88db-437bd4b8a37a" }), (error) => error?.code === 11000);

  const allocationPayment = await Payment.create({ paymentId: "EASY-SPLIT-PAYMENT-A", orderId: new mongoose.Types.ObjectId(), restaurant: allocationRestaurant, amount: 1000, totalAmount: 1000, paymentMethod: "CASHFREE", paymentStatus: "PAID", provider: "cashfree", cashfreeOrderId: "order_split_mock_a", cashfreePaymentId: "cf_split_mock_a", idempotencyKey: "easy-split-payment-a", transactionId: "CF-cf_split_mock_a" });
  await RestaurantSettlementProfile.create({ restaurant: allocationRestaurant, providerVendorId: "RESTO_TEST_ALLOCATION_A", payoutMethod: "BANK", vendorStatus: "ACTIVE", providerStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE", maskedAccountNumber: "••••1191" });
  await RestaurantCommissionConfig.create({ restaurant: allocationRestaurant, commissionType: "PERCENTAGE", commissionBps: 250, fixedAmountPaise: 0 });
  Object.assign(process.env, { CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "sandbox-id", CASHFREE_SECRET_KEY: "sandbox-secret", CASHFREE_EASY_SPLIT_ENABLED: "true", CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: "true" });
  let providerCalls = 0;
  global.fetch = async () => { providerCalls += 1; return new Response(JSON.stringify({ status: "OK", message: "Order split created" }), { status: 200 }); };
  const allocated = await ensureCashfreeSplitAllocation({ payment: allocationPayment });
  const repeated = await ensureCashfreeSplitAllocation({ payment: allocationPayment });
  assert.equal(allocated.transaction.splitStatus, "ALLOCATED");
  assert.equal(repeated.idempotent, true);
  assert.equal(providerCalls, 1, "duplicate payment verification cannot create another provider allocation");
  assert.equal(await SettlementTransaction.countDocuments({ payment: allocationPayment._id }), 1);
  const webhook = { type: "VENDOR_SETTLEMENT_SUCCESS", data: { order_id: "order_split_mock_a", vendor_id: "RESTO_TEST_ALLOCATION_A", settlement_id: "vendor-settlement-mock-a", status: "SUCCESS" } };
  const webhookFirst = await processCashfreeSettlementWebhook({ event: webhook, rawBody: JSON.stringify(webhook) });
  const webhookRepeat = await processCashfreeSettlementWebhook({ event: webhook, rawBody: JSON.stringify(webhook) });
  assert.equal(webhookFirst.transaction.settlementStatus, "SETTLED");
  assert.equal(webhookRepeat.idempotent, true, "duplicate vendor settlement webhook must be a no-op");
  assert.equal(await SettlementWebhookEvent.countDocuments({ settlementTransaction: allocated.transaction._id }), 1);
  await SettlementWebhookEvent.deleteMany({ settlementTransaction: allocated.transaction._id });
  await SettlementTransaction.deleteMany({ payment: allocationPayment._id });
  await Payment.deleteOne({ _id: allocationPayment._id });
  await RestaurantSettlementProfile.deleteOne({ restaurant: allocationRestaurant });
  await RestaurantCommissionConfig.deleteOne({ restaurant: allocationRestaurant });
  console.log("easySplitSettlementDb.test.js passed: isolated DB, exact-share invariant, tenant scope, and one allocation per payment");
} finally {
  if (mongoose.connection.readyState === 1) {
    await SettlementTransaction.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
    await RestaurantCommissionConfig.deleteMany({ restaurant: { $in: [restaurantA, restaurantB] } });
    await RestaurantSettlementProfile.deleteMany({ restaurant: { $in: [restaurantA, restaurantB, allocationRestaurant] } });
    const allocationTransactions = await SettlementTransaction.find({ restaurant: allocationRestaurant }).select("_id").lean();
    await SettlementWebhookEvent.deleteMany({ settlementTransaction: { $in: allocationTransactions.map((item) => item._id) } });
    await SettlementTransaction.deleteMany({ restaurant: allocationRestaurant });
    await RestaurantCommissionConfig.deleteMany({ restaurant: allocationRestaurant });
    await Payment.deleteMany({ restaurant: allocationRestaurant });
    await mongoose.disconnect();
  }
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
}
