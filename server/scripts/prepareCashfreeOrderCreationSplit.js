// Prepares one recoverable, uncharged sandbox order. Never invokes the
// checkout SDK, /orders/pay, a split mutation, transfer or settlement action.
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Food from "../models/Food.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Settlement from "../models/SettlementTransaction.js";
import Profile from "../models/RestaurantSettlementProfile.js";
import Commission from "../models/RestaurantCommissionConfig.js";
import { getCashfreeConfig, getCashfreeReturnUrl } from "../config/cashfree.js";
import { getEasySplitVendor } from "../services/cashfreeEasySplitService.js";
import { getCashfreeOrder, getCashfreePayments } from "../services/cashfreeService.js";
import { assertProviderOrderSplit } from "../services/cashfreeOrderSplitService.js";

const uri = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
assert.equal(process.env.TEST_MONGO_URI, uri);
assert.equal(process.env.NODE_ENV, "test");
assert.equal(getCashfreeConfig().environment, "sandbox");
assert.equal(getCashfreeConfig().easySplitPaymentsEnabled, true);
assert.equal(getCashfreeReturnUrl(), "http://127.0.0.1:5173/payment/cashfree/return?order_id={order_id}");
const orderNumber = "CF-ORDER-SPLIT-100-V1";
const vendorId = "RESTO_8AE322B37E0877AE95A9";
const base = "http://127.0.0.1:5003/api/v1";
const fingerprint = (docs) => crypto.createHash("sha256").update(JSON.stringify(docs)).digest("hex");
await mongoose.connect(uri, { autoIndex: false });
try {
  const restaurant = await Restaurant.findOne({ _id: "6aa22a129a32de80771f76de", name: "Cashfree Sandbox Test Restaurant", isActive: true });
  assert.ok(restaurant);
  const outlet = await Outlet.findOne({ _id: "6aa22a1d9a32de80771f76f0", restaurant: restaurant._id, name: "Cashfree Test Outlet", isActive: true });
  assert.ok(outlet);
  const profile = await Profile.findOne({ restaurant: restaurant._id, providerVendorId: vendorId, vendorStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE" });
  assert.ok(profile);
  const commission = await Commission.findOne({ restaurant: restaurant._id, commissionType: "PERCENTAGE", commissionBps: 200 });
  assert.ok(commission);
  const protectedQuery = { restaurant: restaurant._id, allocationStrategy: { $ne: "ORDER_CREATION_SPLIT" } };
  const before = fingerprint(await Settlement.find(protectedQuery).sort({ _id: 1 }).lean());
  const profileBefore = fingerprint(profile.toObject());
  const commissionBefore = fingerprint(commission.toObject());
  const remoteVendor = (await getEasySplitVendor(vendorId)).payload;
  assert.equal(remoteVendor.vendor_id, vendorId);
  assert.equal(remoteVendor.status, "ACTIVE");
  const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "cashfree.admin@test.invalid", password: "CashfreeSandboxTestOnly!1" }) });
  const session = await login.json();
  assert.equal(login.status, 200);
  assert.equal(session.data.user.role, "restaurant_admin");
  assert.equal(String(session.data.user.restaurant), String(restaurant._id));
  const admin = await User.findById(session.data.user._id);
  assert.equal(String(admin.defaultOutlet), String(outlet._id));
  let order = await Order.findOne({ orderNumber });
  if (!order) {
    const food = await Food.findOne({ restaurant: restaurant._id, name: "Cashfree Test Item", isAvailable: true });
    const table = await Table.findOne({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "CF-1" });
    assert.ok(food); assert.ok(table);
    order = await Order.create({ orderNumber, customer: admin._id, restaurant: restaurant._id, outlet: outlet._id, table: table._id,
      orderType: "DINE_IN", items: [{ menuItem: food._id, name: food.name, price: 100, quantity: 1, subtotal: 100 }],
      subtotal: 100, total: 100, tax: 0, discount: 0, serviceCharge: 0, paymentMethod: "CASHFREE", paymentStatus: "PENDING", status: "PENDING",
    });
  }
  assert.equal(order.paymentStatus, "PENDING"); assert.equal(order.total, 100);
  assert.equal(String(order.restaurant), String(restaurant._id)); assert.equal(String(order.outlet), String(outlet._id));
  const response = await fetch(`${base}/payments/cashfree/create-order`, { method: "POST", headers: {
    authorization: `Bearer ${session.data.accessToken}`, "content-type": "application/json", "Idempotency-Key": "cashfree-order-creation-split-validation-v1",
    "x-outlet-id": String(outlet._id),
  }, body: JSON.stringify({ orderId: order._id }) });
  // Do not print the API response: it includes a sensitive checkout session.
  await response.json();
  const payment = await Payment.findOne({ orderId: order._id, provider: "cashfree" });
  const tx = payment ? await Settlement.findOne({ payment: payment._id }) : null;
  let confirmed = false;
  let providerStatus = "UNCONFIRMED";
  if (response.ok && payment) {
    const remoteOrder = await getCashfreeOrder(payment.cashfreeOrderId);
    assertProviderOrderSplit(payment, remoteOrder);
    const payments = await getCashfreePayments(payment.cashfreeOrderId);
    assert.equal(payments.length, 0, "No customer payment may have been initiated");
    providerStatus = remoteOrder.order_status;
    confirmed = providerStatus === "ACTIVE";
  }
  assert.equal(fingerprint(await Settlement.find(protectedQuery).sort({ _id: 1 }).lean()), before, "Historical allocations changed");
  assert.equal(fingerprint((await Profile.findById(profile._id)).toObject()), profileBefore);
  assert.equal(fingerprint((await Commission.findById(commission._id)).toObject()), commissionBefore);
  console.log(JSON.stringify({ orderNumber, localOrderId: String(order._id), cashfreeOrderId: payment?.cashfreeOrderId || "", apiHttpStatus: response.status,
    providerOrderStatus: providerStatus, splitConfirmed: confirmed, allocationStrategy: payment?.allocationStrategy,
    grossPaise: tx?.grossAmountPaise, platformPaise: tx?.platformSharePaise, vendorPaise: tx?.vendorSharePaise, vendorId: tx?.providerVendorId,
    paymentStatus: payment?.paymentStatus, allocationStatus: tx?.splitStatus, settlementStatus: tx?.settlementStatus,
    paymentCount: await Payment.countDocuments({ orderId: order._id }), transactionCount: await Settlement.countDocuments({ order: order._id }),
    providerHttpStatus: tx?.providerHttpStatus, providerErrorCode: tx?.providerErrorCode, providerErrorType: tx?.providerErrorType, providerErrorMessage: tx?.providerErrorMessage,
    historicalRecordsPreserved: true, ready: confirmed && !!tx && payment.paymentStatus === "PENDING",
  }, null, 2));
} finally { await mongoose.disconnect(); }
