import "dotenv/config";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Settlement from "../models/SettlementTransaction.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import { getCashfreeOrder, getCashfreePayments } from "../services/cashfreeService.js";
import { getEasySplitAllocationDetails, getEasySplitOrderReconciliation } from "../services/cashfreeEasySplitService.js";
import { reconcileOrderCreationSplit } from "../services/cashfreeOrderSplitService.js";
import { diagnosticsFromError } from "../utils/cashfreeDiagnostics.js";

const uri = String(process.env.RELEASE_VERIFICATION_MONGO_URI || "").trim();
if (!uri) {
  console.log("Release verification: skipped database phase; RELEASE_VERIFICATION_MONGO_URI was not supplied.");
  process.exit(0);
}
const orderId = "RS_CF_bbab64a71f97471faf6f6ee1b28b6413";
const config = getCashfreeConfig();
assert.equal(process.env.TEST_MONGO_URI, uri);
assert.equal(process.env.NODE_ENV, "test");
assert.equal(config.environment, "sandbox");
assert.equal(config.baseUrl, "https://sandbox.cashfree.com/pg");
const originalFetch = global.fetch;
const calls = [];
const allowed = new Set([`/pg/orders/${orderId}`, `/pg/orders/${orderId}/payments`, `/pg/easy-split/orders/${orderId}`]);
global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://sandbox.cashfree.com");
  if (parsed.pathname === "/pg/split/order/vendor/recon") {
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body).filters, { order_ids: [orderId] });
  } else {
    assert.equal(options.method || "GET", "GET", "All provider mutations are prohibited during verification");
    assert.ok(allowed.has(parsed.pathname), "Only the named provider order may be queried");
  }
  const response = await originalFetch(url, options);
  calls.push({ method: options.method || "GET", path: parsed.pathname, http: response.status });
  return response;
};
const safeTransaction = (t) => t && ({ id: String(t._id), payment: String(t.payment), order: String(t.order), restaurant: String(t.restaurant), outlet: String(t.outlet),
  strategy: t.allocationStrategy, grossPaise: t.grossAmountPaise, platformPaise: t.platformSharePaise, vendorPaise: t.vendorSharePaise,
  commissionType: t.commissionType, commissionBps: t.commissionBps, allocationStatus: t.splitStatus, settlementStatus: t.settlementStatus,
  providerStatus: t.providerStatus, providerVendorId: t.providerVendorId, providerReference: t.providerSplitReference,
  providerHttpStatus: t.providerHttpStatus, providerErrorCode: t.providerErrorCode, providerErrorType: t.providerErrorType, providerErrorMessage: t.providerErrorMessage,
  failureCode: t.failureCode, createdAt: t.createdAt,
});
await mongoose.connect(uri, { autoIndex: false });
try {
  const order = await Order.findOne({ orderNumber: "CF-ORDER-SPLIT-100-V1" });
  assert.ok(order);
  const payments = await Payment.find({ orderId: order._id, provider: "cashfree" });
  assert.equal(payments.length, 1);
  const payment = payments[0];
  assert.equal(payment.cashfreeOrderId, orderId);
  assert.equal(payment.allocationStrategy, "ORDER_CREATION_SPLIT");
  const transactions = await Settlement.find({ payment: payment._id }).lean();
  assert.equal(transactions.length, 1);
  const providerOrder = await getCashfreeOrder(orderId);
  const providerPayments = await getCashfreePayments(orderId);
  let details;
  try {
    const { payload, providerHttpStatus } = await getEasySplitAllocationDetails(orderId);
    const s = payload?.settlement;
    details = { http: providerHttpStatus, topLevelFields: Object.keys(payload || {}),
      settlement: s && { orderId: s.order_id, paymentId: String(s.cf_payment_id || ""), orderAmount: s.order_amount, currency: s.order_currency, settlementAmount: s.settlement_amount },
      vendors: (Array.isArray(payload?.vendors) ? payload.vendors : []).map(v => ({ vendorId: v.vendor_id, reference: String(v.settlement_id || ""), amount: v.settlement_amount, status: v.status || v.settlement_status || null, eligibilityDate: v.settlement_eligibility_date })),
    };
  } catch (error) { details = { error: error.code, ...diagnosticsFromError(error) }; }
  const report = await getEasySplitOrderReconciliation(orderId);
  const reportRows = report.payload.data.map(row => ({ orderId: row.merchant_order_id, vendorId: row.merchant_vendor_id,
    entityType: row.entity_type, reference: row.entity_id, amount: row.amount, currency: row.currency,
    saleType: row.sale_type, settled: row.settled, merchantVendorCommission: row.merchant_vendor_commission, eligibleSplitBalance: row.eligible_split_balance,
  }));
  const reconciliation = [];
  if (process.argv.includes("--reconcile")) {
    assert.equal(payment.paymentStatus, "PAID");
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await reconcileOrderCreationSplit(payment._id);
        reconciliation.push({ attempt, idempotent: !!result.idempotent, transaction: safeTransaction(result.transaction) });
      } catch (error) { reconciliation.push({ attempt, error: error.code, ...diagnosticsFromError(error) }); }
    }
  }
  const after = await Settlement.find({ payment: payment._id }).lean();
  console.log(JSON.stringify({ local: { order: order.orderNumber, orderId: String(order._id), paymentId: payment.paymentId, cashfreePaymentId: payment.cashfreePaymentId, status: payment.paymentStatus, amount: payment.amount, strategy: payment.allocationStrategy, snapshot: payment.metadata?.easySplitCommission },
    providerOrder: { orderId: providerOrder.order_id, status: providerOrder.order_status, amount: providerOrder.order_amount, currency: providerOrder.order_currency, splits: providerOrder.order_splits?.map(v => ({ vendorId: v.vendor_id, amount: v.amount, percentage: v.percentage })) },
    providerPayments: providerPayments.map(p => ({ id: String(p.cf_payment_id), status: p.payment_status, amount: p.payment_amount })),
    providerSplitDetails: details, providerReconciliation: { http: report.providerHttpStatus, rows: reportRows }, before: transactions.map(safeTransaction), reconciliation, after: after.map(safeTransaction),
    paymentCountAfter: await Payment.countDocuments({ orderId: order._id, provider: "cashfree" }), transactionCountAfter: after.length, calls,
  }, null, 2));
} finally { global.fetch = originalFetch; await mongoose.disconnect(); }
