import assert from "node:assert/strict";
import { detectSignals } from "../services/intelligenceSignalService.js";

const metric = (current, previous) => ({ current, previous, growth: previous === 0 ? { value: null, label: "New" } : { value: Number((((current - previous) / previous) * 100).toFixed(1)), label: "" } });
const base = {
  period: { range: "last_7_days", start: new Date("2026-08-01"), end: new Date("2026-08-08") },
  overview: { netSales: metric(40000, 50000), orders: metric(10, 12), netCollected: metric(40000, 50000), refunds: metric(0, 0) },
  payments: { reconciliation: { unreconciledPayments: 1, cashMismatchCount: 0, cashVariance: 0 } },
  operations: { inventory: { lowStockCount: 0 }, kitchen: { preparationTimeAvailable: false } }, menu: { topItems: [] },
};
const signals = detectSignals(base);
assert.ok(signals.some((row) => row.signalKey === "net-sales-decline"));
assert.equal(signals.find((row) => row.signalKey === "net-sales-decline").evidence[0].change, -20);
assert.ok(!JSON.stringify(signals).includes("Infinity"));

const small = detectSignals({ ...base, overview: { ...base.overview, orders: metric(1, 0) } });
assert.ok(small.some((row) => row.signalKey === "insufficient-history"));
console.log("Intelligence signal tests passed.");
