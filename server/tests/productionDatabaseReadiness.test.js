import assert from "node:assert/strict";
import { hasTransactionSupport } from "../config/db.js";

assert.equal(hasTransactionSupport({ setName: "atlas-rs", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(hasTransactionSupport({ msg: "isdbgrid", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(hasTransactionSupport({ logicalSessionTimeoutMinutes: 30 }), false);
assert.equal(hasTransactionSupport({ setName: "atlas-rs", logicalSessionTimeoutMinutes: null }), false);

console.log("Production MongoDB readiness checks passed.");
