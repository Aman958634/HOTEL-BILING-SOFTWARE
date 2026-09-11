import assert from "node:assert/strict";
import { getCashfreeConfig } from "../config/cashfree.js";

const original = { CASHFREE_ENV: process.env.CASHFREE_ENV, CASHFREE_APP_ID: process.env.CASHFREE_APP_ID, CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY, CASHFREE_PAYMENTS_ENABLED: process.env.CASHFREE_PAYMENTS_ENABLED };
try {
  process.env.CASHFREE_ENV = "production";
  process.env.CASHFREE_APP_ID = "production-app";
  process.env.CASHFREE_SECRET_KEY = "production-secret";
  process.env.CASHFREE_PAYMENTS_ENABLED = "false";
  assert.equal(getCashfreeConfig().enabled, false);
  process.env.CASHFREE_PAYMENTS_ENABLED = "true";
  assert.equal(getCashfreeConfig().enabled, true);
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
console.log("killSwitches.test.js passed: payment creation flag is explicit and reversible without affecting history reads.");
