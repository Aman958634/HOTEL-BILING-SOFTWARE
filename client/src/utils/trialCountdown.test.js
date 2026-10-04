import test from "node:test";
import assert from "node:assert/strict";
import { getServerClockOffset, getTrialCountdown } from "./trialCountdown.js";

const start = Date.parse("2026-10-03T11:59:59.000Z");
const end = start + 5 * 24 * 60 * 60 * 1000;
const at = (elapsed) => getTrialCountdown(new Date(end).toISOString(), 0, start + elapsed);

test("countdown derives every part from trial end minus current time", () => {
  assert.deepEqual(at(1), { remainingMs: 5 * 86400000 - 1, days: 4, hours: 23, minutes: 59, seconds: 59 });
  assert.equal(at(24 * 3600000 + 1).days, 3);
  assert.equal(at(48 * 3600000 + 1).days, 2);
  assert.equal(at(72 * 3600000 + 1).days, 1);
  assert.equal(at(96 * 3600000 + 1).days, 0);
  assert.deepEqual(at(120 * 3600000), { remainingMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("server offset keeps display based on entitlement server time", () => {
  const clientNow = Date.parse("2026-10-03T11:50:00.000Z");
  const serverNow = Date.parse("2026-10-03T12:00:00.000Z");
  const offset = getServerClockOffset(new Date(serverNow).toISOString(), clientNow);
  assert.equal(offset, 10 * 60 * 1000);
  assert.equal(getTrialCountdown(new Date(end).toISOString(), offset, clientNow).remainingMs, end - serverNow);
});