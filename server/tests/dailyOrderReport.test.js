import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildDailyOrderReportPdf, summarizeDailyOrders } from "../controllers/dailyOrderReportController.js";
import { resolveBusinessRange } from "../services/businessIntelligenceService.js";

test("daily report uses hotel-local day boundaries", () => {
  const range = resolveBusinessRange({ range: "custom", startDate: "2026-10-10", endDate: "2026-10-10", timeZone: "Asia/Kolkata" });
  assert.equal(range.start.toISOString(), "2026-10-09T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-10T18:30:00.000Z");
});

test("daily report excludes cancelled collections and handles paid and partial orders once", () => {
  const orders = [
    { _id: "paid", status: "COMPLETED", total: 100 },
    { _id: "partial", status: "PENDING", total: 200 },
    { _id: "cancelled", status: "CANCELLED", total: 300 },
    { _id: "split", status: "SERVED", total: 80 },
  ];
  const { summary, rows } = summarizeDailyOrders(orders, new Map([["paid", 100], ["partial", 50], ["cancelled", 300], ["split", 80]]));
  assert.deepEqual(summary, { totalOrders: 4, completedOrders: 2, pendingOrders: 1, cancelledOrders: 1, paidOrders: 2, unpaidOrders: 1, totalSales: 230, outstandingPaymentAmount: 150 });
  assert.equal(rows.find((row) => row._id === "partial").reportPaymentStatus, "PARTIALLY_PAID");
  assert.equal(rows.find((row) => row._id === "cancelled").collectedAmount, 0);
});

test("daily report PDF is generated and controller keeps queries within the active outlet scope", async () => {
  const pdf = await buildDailyOrderReportPdf({ hotelName: "RestoSphere", timeZone: "Asia/Kolkata", date: "2026-10-10", summary: { totalOrders: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, paidOrders: 0, unpaidOrders: 0, totalSales: 0, outstandingPaymentAmount: 0 }, rows: [] });
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  const source = await readFile(new URL("../controllers/dailyOrderReportController.js", import.meta.url), "utf8");
  assert.match(source, /buildOutletQuery\(\{\}, user\)/);
  assert.match(source, /orderId: \{ \$in: orderIds \}/);
  assert.match(source, /bill: \{ \$in: billIds \}/);
});
