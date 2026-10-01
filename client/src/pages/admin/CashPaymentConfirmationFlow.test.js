import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "OrderManagement.jsx");

test("cash confirmation is one-shot, authoritative, and background-refreshes only after closing", async () => {
  const source = await fs.readFile(sourcePath, "utf8");
  const cashHandler = source.slice(source.indexOf("const payCashNow"), source.indexOf("const processGatewayPayment"));

  assert.match(cashHandler, /cashConfirmSubmittingRef\.current\) return/);
  assert.match(cashHandler, /payOrder\(createdOrder\._id,[\s\S]*?\}, idempotencyKey\)/);
  assert.match(cashHandler, /data\?\.data/);
  assert.match(cashHandler, /applyAuthoritativeCashPayment/);
  assert.match(cashHandler, /closePaymentPrompt\(\);\s*void Promise\.all\(\[loadOrders\(\), loadStats\(\)\]\)/);
  assert.doesNotMatch(cashHandler, /await Promise\.all\(\[loadOrders\(\), loadStats\(\)\]\)/);
});
