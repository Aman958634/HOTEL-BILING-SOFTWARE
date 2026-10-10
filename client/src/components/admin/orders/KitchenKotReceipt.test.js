import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Kitchen KOT uses live ticket data and excludes financial receipt content", async () => {
  const source = await readFile(new URL("./KitchenKotReceipt.jsx", import.meta.url), "utf8");

  assert.match(source, /kot\.restaurant\?\.name/);
  assert.match(source, /kot\.table\?\.tableNumber/);
  assert.match(source, /kot\.kotNumber/);
  assert.match(source, /kot\.orderNumber/);
  assert.match(source, /dateTime\(kot\.createdAt\)/);
  assert.match(source, /item\.quantity/);
  assert.match(source, /KITCHEN COPY/);
  assert.match(source, /kitchen-kot-ticket/);
  assert.match(source, /text-\[14px\] leading-\[1\.35\]/);
  assert.match(source, /<td className="py-0 pr-2 font-bold leading-snug">/);
  assert.match(source, /<td className="w-10 py-0 text-right font-bold">/);
  assert.doesNotMatch(source, /paymentMethod|Grand Total|Subtotal|currency\(/);
});
