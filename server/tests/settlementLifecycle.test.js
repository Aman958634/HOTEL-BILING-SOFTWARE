import assert from 'node:assert/strict';
import Payment from '../models/Payment.js';
import Log from '../models/Log.js';
import { refreshCashfreeSettlementTransaction } from '../services/easySplitSettlementService.js';
const originalFetch = global.fetch;
const originalCreate = Log.create;
const originalPaymentUpdate = Payment.updateOne;
Object.assign(process.env, { CASHFREE_ENV: 'sandbox', CASHFREE_APP_ID: 'lifecycle-mock-app', CASHFREE_SECRET_KEY: 'lifecycle-mock-secret', CASHFREE_EASY_SPLIT_ENABLED: 'true', CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: 'true' });
let status = 'PENDING';
let reads = 0;
Log.create = async () => ({});
Payment.updateOne = () => assert.fail('Settlement lifecycle must not refund or change the customer payment');
global.fetch = async (url, options = {}) => {
  assert.equal(String(url), 'https://sandbox.cashfree.com/pg/orders/lifecycle_mock/settlements');
  assert.equal(options.method || 'GET', 'GET'); reads++;
  return Response.json({ status, settlement_id: 'mock-settlement', settlement_amount: 98 });
};
const transaction = { _id: 'mock-transaction', restaurant: 'mock-restaurant', cashfreeOrderId: 'lifecycle_mock', allocationStrategy: 'POST_PAYMENT_SPLIT', splitStatus: 'ALLOCATED', settlementStatus: 'PENDING', providerSplitReference: 'mock-allocation', grossAmountPaise: 10000, platformSharePaise: 200, vendorSharePaise: 9800, save: async () => {} };
try {
  assert.equal(transaction.settledAt, undefined);
  for (const [provider, expected] of [['PENDING', 'PENDING'], ['PROCESSING', 'PROCESSING'], ['SUCCESS', 'SETTLED'], ['ON_HOLD', 'ON_HOLD'], ['FAILED', 'FAILED'], ['REVERSED', 'REVERSED'], ['UNKNOWN_EVENT', 'REVERSED']]) {
    status = provider;
    const result = await refreshCashfreeSettlementTransaction(transaction);
    assert.equal(result.settlementStatus, expected);
    assert.equal(result.splitStatus, 'ALLOCATED');
    assert.equal(result.providerAllocationReference, 'mock-allocation');
    assert.equal(result.platformSharePaise + result.vendorSharePaise, result.grossAmountPaise);
  }
  assert.equal(reads, 7);
  assert.ok(transaction.settledAt instanceof Date);
  assert.equal(transaction.providerSettlementReference, 'mock-settlement');
  console.log('settlementLifecycle.test.js passed: provider-reported lifecycle and reversal, allocation independence, no refund or provider writes.');
} finally { global.fetch = originalFetch; Log.create = originalCreate; Payment.updateOne = originalPaymentUpdate; }
