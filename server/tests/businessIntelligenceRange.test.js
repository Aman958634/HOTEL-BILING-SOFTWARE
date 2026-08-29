import assert from "node:assert/strict";
import { BI_METRIC_DEFINITIONS, resolveBusinessRange } from "../services/businessIntelligenceService.js";

const range = resolveBusinessRange({ range: "last_7_days", timeZone: "Asia/Kolkata" });
assert.equal(range.days, 7);
assert.ok(range.start < range.end);
assert.ok(range.previousStart < range.previousEnd);
assert.equal(BI_METRIC_DEFINITIONS.netCollected.source[0], "Payment.amount");

const custom = resolveBusinessRange({ range: "custom", startDate: "2026-08-01", endDate: "2026-08-03", timeZone: "Asia/Kolkata" });
assert.equal(custom.days, 3);
assert.throws(() => resolveBusinessRange({ range: "custom", startDate: "2026-08-03", endDate: "2026-08-01", timeZone: "Asia/Kolkata" }));

console.log("Business intelligence range tests passed.");
