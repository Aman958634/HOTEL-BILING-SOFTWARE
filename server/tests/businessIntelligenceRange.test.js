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

const utcRollover = "2026-09-04T20:00:00.000Z";
const today = resolveBusinessRange({ range: "today", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(today.start.toISOString(), "2026-09-04T18:30:00.000Z");
assert.equal(today.end.toISOString(), "2026-09-05T18:30:00.000Z");

const yesterday = resolveBusinessRange({ range: "yesterday", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(yesterday.start.toISOString(), "2026-09-03T18:30:00.000Z");
assert.equal(yesterday.end.toISOString(), today.start.toISOString());

const thisMonth = resolveBusinessRange({ range: "this_month", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(thisMonth.start.toISOString(), "2026-08-31T18:30:00.000Z");
assert.equal(thisMonth.end.toISOString(), today.end.toISOString());

const lastMonth = resolveBusinessRange({ range: "last_month", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(lastMonth.start.toISOString(), "2026-07-31T18:30:00.000Z");
assert.equal(lastMonth.end.toISOString(), thisMonth.start.toISOString());

const lastSeven = resolveBusinessRange({ range: "last_7_days", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(lastSeven.start.toISOString(), "2026-08-29T18:30:00.000Z");
assert.equal(lastSeven.end.toISOString(), today.end.toISOString());

const customIndia = resolveBusinessRange({ range: "custom", startDate: "2026-09-05", endDate: "2026-09-05", timeZone: "Asia/Kolkata", now: utcRollover });
assert.equal(customIndia.start.toISOString(), "2026-09-04T18:30:00.000Z");
assert.equal(customIndia.end.toISOString(), "2026-09-05T18:30:00.000Z");
assert.equal(today.start.getTime() - today.previousStart.getTime(), today.end.getTime() - today.start.getTime());

console.log("Business intelligence range tests passed.");
