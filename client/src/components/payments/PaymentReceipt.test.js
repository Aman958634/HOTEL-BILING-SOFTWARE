import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Payment receipt places the live table or order type under the hotel name", async () => {
  const source = await readFile(new URL("./PaymentReceipt.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../index.css", import.meta.url), "utf8");

  assert.match(source, /const tableOrType/);
  assert.match(source, /payment\.restaurant\?\.name \? payment\.restaurant : order\.restaurant/);
  assert.match(source, /restaurantName}<\/p>\s*<p className="mt-1 text-sm font-bold text-slate-800">\{tableOrType\(order, payment\)\}<\/p>\s*<div className="payment-receipt-success/);
  assert.doesNotMatch(source, /ReceiptField label="Table \/ Type"/);
  assert.match(source, /window\.addEventListener\("beforeprint", enableReceiptPrint\)/);
  assert.match(source, /document\.body\.classList\.add\("payment-receipt-printing"\)/);
  assert.match(source, /document\.body\.classList\.remove\("kitchen-kot-printing"\)/);
  assert.match(css, /body\.payment-receipt-printing #root/);
  assert.match(css, /body\.payment-receipt-printing \.kitchen-kot-modal/);
  assert.match(css, /payment-receipt-scroll > :not\(#payment-receipt-print\)/);
});
