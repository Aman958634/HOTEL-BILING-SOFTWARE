import "dotenv/config";
import assert from "node:assert/strict";
import { getCashfreeConfig } from "../config/cashfree.js";
import { safeCashfreeError } from "../utils/cashfreeDiagnostics.js";
const config = getCashfreeConfig();
assert.equal(config.environment, "sandbox");
assert.equal(config.baseUrl, "https://sandbox.cashfree.com/pg");
const orderId = "RS_CF_bbab64a71f97471faf6f6ee1b28b6413";
const headers = { "content-type": "application/json", "x-api-version": config.easySplitApiVersion, "x-client-id": config.appId, "x-client-secret": config.secretKey };
// This POST is the documented read-only report query; it does not split or
// settle anything. Only the exact named order is in the request filter.
for (const query of [
  { path: `/easy-split/orders/${orderId}`, options: { method: "GET", headers } },
  { path: "/split/order/vendor/recon", options: { method: "POST", headers, body: JSON.stringify({ filters: { order_ids: [orderId] }, pagination: { limit: 100 } }) } },
]) {
  const r = await fetch(config.baseUrl + query.path, { ...query.options, signal: AbortSignal.timeout(15000) });
  const raw = await r.text();
  // Read exact ID tokens before normal JSON parsing can round int64 values.
  const originalId = raw.match(/"cf_payment_id"\s*:\s*"?(\d+)/)?.[1] || "";
  const p = JSON.parse(raw);
  if (!r.ok) { console.log(JSON.stringify({ path: query.path, ...safeCashfreeError(r.status, p) })); continue; }
  const report = query.path.includes("/recon") ? {
    hasMorePages: !!p.cursor,
    rows: (Array.isArray(p.data) ? p.data : []).map(x => ({
      orderId: x.merchant_order_id, vendorId: x.merchant_vendor_id, entityType: x.entity_type,
      entityId: String(x.entity_id || ""), amount: x.amount, currency: x.currency, saleType: x.sale_type,
      settled: x.settled, vendorCommission: x.vendor_commission, merchantVendorCommission: x.merchant_vendor_commission,
      eligibleSplitBalance: x.eligible_split_balance, vendorSettlementId: x.vendor_settlement_id,
      vendorSettlementEligibility: x.vendor_settlement_eligibility_time,
      splitEntries: x.order_splits?.map(group => ({ createdAt: group.created_at, split: group.split?.map(s => ({ vendorId: s.merchant_vendor_id, amount: s.amount, percentage: s.percentage })) })),
    })),
  } : {
    exactPaymentId: originalId, parsedPaymentId: String(p.settlement?.cf_payment_id || ""),
    vendors: p.vendors?.map(v => ({ fields: Object.keys(v), vendorId: v.vendor_id, reference: v.settlement_id, amount: v.settlement_amount, status: v.status || v.settlement_status || null })),
  };
  console.log(JSON.stringify({ path: query.path, http: r.status, ...report }, null, 2));
}
