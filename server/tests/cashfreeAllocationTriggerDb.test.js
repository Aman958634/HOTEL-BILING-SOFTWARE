import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";

process.env.CASHFREE_ENV = "sandbox";
process.env.CASHFREE_APP_ID = "sandbox-test-app";
process.env.CASHFREE_SECRET_KEY = "sandbox-test-secret";
process.env.CASHFREE_EASY_SPLIT_ENABLED = "true";
process.env.CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED = "true";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
const originalFetch = global.fetch;

const [
  { default: Restaurant },
  { default: Outlet },
  // Registered because payment settlement populates these order references.
  { default: Table },
  { default: Category },
  { default: Food },
  { default: User },
  { default: Order },
  { default: Payment },
  { default: RestaurantSettlementProfile },
  { default: RestaurantCommissionConfig },
  { default: SettlementTransaction },
  { verifyPaymentForRecord },
  { processCashfreeEasySplitAllocation },
] = await Promise.all([
  import("../models/Restaurant.js"),
  import("../models/Outlet.js"),
  import("../models/Table.js"),
  import("../models/Category.js"),
  import("../models/Food.js"),
  import("../models/User.js"),
  import("../models/Order.js"),
  import("../models/Payment.js"),
  import("../models/RestaurantSettlementProfile.js"),
  import("../models/RestaurantCommissionConfig.js"),
  import("../models/SettlementTransaction.js"),
  import("../controllers/cashfreeController.js"),
  import("../services/easySplitSettlementService.js"),
]);

const ids = { restaurant: null, outlet: null, category: null, food: null, order: null, payment: null, oldPayment: null };

try {
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  await SettlementTransaction.init();

  const restaurant = await Restaurant.create({ name: `Cashfree trigger ${suffix}`, slug: `cashfree-trigger-${suffix}`, branchCode: `CT${suffix.slice(0, 4)}`, address: "Test" });
  ids.restaurant = restaurant._id;
  const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main", code: "MAIN", isDefault: true });
  ids.outlet = outlet._id;
  const category = await Category.create({ restaurant: restaurant._id, name: "Cashfree", slug: `cashfree-${suffix}` });
  ids.category = category._id;
  const food = await Food.create({ restaurant: restaurant._id, category: category._id, name: "Test item", price: 100 });
  ids.food = food._id;
  const order = await Order.create({
    orderNumber: `CF-TRIGGER-${suffix}`,
    restaurant: restaurant._id,
    outlet: outlet._id,
    orderType: "TAKEAWAY",
    items: [{ menuItem: food._id, name: "Test item", price: 100, quantity: 1, subtotal: 100 }],
    subtotal: 100,
    total: 100,
    paymentMethod: "CASHFREE",
    paymentStatus: "PENDING",
  });
  ids.order = order._id;
  await RestaurantSettlementProfile.create({
    restaurant: restaurant._id,
    providerVendorId: `RESTO_${suffix.toUpperCase()}`,
    payoutMethod: "BANK",
    vendorStatus: "ACTIVE",
    providerStatus: "ACTIVE",
    bankVerificationStatus: "VERIFIED",
    settlementStatus: "ACTIVE",
  });
  await RestaurantCommissionConfig.create({
    restaurant: restaurant._id,
    commissionType: "PERCENTAGE",
    commissionBps: 200,
    fixedAmountPaise: 0,
    effectiveFrom: new Date(Date.now() - 1000),
  });
  const payment = await Payment.create({
    paymentId: `CF-TRIGGER-${suffix}`,
    orderId: order._id,
    restaurant: restaurant._id,
    outlet: outlet._id,
    amount: 100,
    totalAmount: 100,
    paymentMethod: "CASHFREE",
    paymentStatus: "PROCESSING",
    provider: "cashfree",
    providerStatus: "ACTIVE",
    cashfreeOrderId: `order_trigger_${suffix}`,
    transactionId: `CF-ORDER-${suffix}`,
    idempotencyKey: `cashfree-trigger:${suffix}`,
  });
  ids.payment = payment._id;

  let splitCalls = 0;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith(`/orders/order_trigger_${suffix}/payments`)) {
      return new Response(JSON.stringify([{ payment_status: "SUCCESS", cf_payment_id: `cf_payment_${suffix}`, payment_amount: 100, payment_time: new Date().toISOString() }]), { status: 200 });
    }
    if (target.endsWith(`/easy-split/orders/order_trigger_${suffix}/split`)) {
      splitCalls += 1;
      const body = JSON.parse(options.body);
      assert.deepEqual(body, { split: [{ vendor_id: `RESTO_${suffix.toUpperCase()}`, amount: 98 }], disable_split: true });
      return new Response(JSON.stringify({ status: "PENDING", split_id: `split_${suffix}` }), { status: 200 });
    }
    throw new Error(`Unexpected Cashfree request: ${target}`);
  };

  // Cashfree webhook and browser return verification can race. Both paths use
  // the same server verification and allocation entry point.
  await Promise.all([
    verifyPaymentForRecord({ payment, fromWebhook: true, requestId: "webhook-test" }),
    verifyPaymentForRecord({ payment, fromWebhook: false, requestId: "return-test" }),
  ]);

  const savedPayment = await Payment.findById(payment._id).lean();
  const allocations = await SettlementTransaction.find({ payment: payment._id }).lean();
  assert.equal(savedPayment.paymentStatus, "PAID");
  assert.equal(savedPayment.metadata?.easySplitCommission?.commissionBps, 200, "commission must be snapshotted at verification");
  assert.equal(allocations.length, 1, "webhook plus return must record one allocation");
  assert.equal(splitCalls, 1, "webhook plus return must create one provider split");
  assert.equal(allocations[0].grossAmountPaise, 10000);
  assert.equal(allocations[0].platformSharePaise, 200);
  assert.equal(allocations[0].vendorSharePaise, 9800);
  assert.equal(allocations[0].providerSplitReference, `split_${suffix}`);
  assert.equal(allocations[0].splitStatus, "ALLOCATED");
  assert.equal(allocations[0].settlementStatus, "PENDING", "allocation must not be reported as settled");

  // Historic provider-rejected payments stay audit-only and never issue a
  // second automatic split request.
  const oldPayment = await Payment.create({
    paymentId: `CF-OLD-${suffix}`,
    orderId: order._id,
    restaurant: restaurant._id,
    outlet: outlet._id,
    amount: 100,
    totalAmount: 100,
    paymentMethod: "CASHFREE",
    paymentStatus: "PAID",
    provider: "cashfree",
    providerStatus: "SUCCESS",
    cashfreeOrderId: `order_old_${suffix}`,
    cashfreePaymentId: `cf_old_${suffix}`,
    transactionId: `CF-cf_old_${suffix}`,
    idempotencyKey: `cashfree-old:${suffix}`,
    verifiedAt: new Date(),
  });
  ids.oldPayment = oldPayment._id;
  await SettlementTransaction.create({
    restaurant: restaurant._id,
    outlet: outlet._id,
    order: order._id,
    payment: oldPayment._id,
    providerVendorId: `RESTO_${suffix.toUpperCase()}`,
    cashfreeOrderId: oldPayment.cashfreeOrderId,
    cashfreePaymentId: oldPayment.cashfreePaymentId,
    grossAmountPaise: 10000,
    platformSharePaise: 200,
    vendorSharePaise: 9800,
    commissionType: "PERCENTAGE",
    commissionBps: 200,
    splitStatus: "FAILED",
    settlementStatus: "NOT_SCHEDULED",
    providerStatus: "FAILED",
    providerIdempotencyKey: crypto.randomUUID(),
    failureCode: "EASY_SPLIT_PROVIDER_REJECTED",
  });
  const oldResult = await processCashfreeEasySplitAllocation({
    paymentId: oldPayment._id,
    providerPayment: { payment_status: "SUCCESS", cf_payment_id: oldPayment.cashfreePaymentId },
  });
  assert.equal(oldResult.reason, "ALLOCATION_PREVIOUSLY_FAILED");
  assert.equal(splitCalls, 1, "historic failed payment must not send another split");
  assert.equal(await SettlementTransaction.countDocuments({ payment: oldPayment._id }), 1);

  console.log("cashfreeAllocationTriggerDb.test.js passed: immediate webhook/return allocation, commission snapshot, and terminal historic failure");
} finally {
  global.fetch = originalFetch;
  if (mongoose.connection.readyState === 1) {
    await SettlementTransaction.deleteMany({ payment: { $in: [ids.payment, ids.oldPayment].filter(Boolean) } });
    await Payment.deleteMany({ _id: { $in: [ids.payment, ids.oldPayment].filter(Boolean) } });
    if (ids.order) await Order.deleteOne({ _id: ids.order });
    if (ids.restaurant) {
      await Promise.all([
        RestaurantSettlementProfile.deleteMany({ restaurant: ids.restaurant }),
        RestaurantCommissionConfig.deleteMany({ restaurant: ids.restaurant }),
        Food.deleteMany({ restaurant: ids.restaurant }),
        Category.deleteMany({ restaurant: ids.restaurant }),
        Outlet.deleteMany({ restaurant: ids.restaurant }),
        Restaurant.deleteOne({ _id: ids.restaurant }),
      ]);
    }
    await mongoose.disconnect();
  }
}
