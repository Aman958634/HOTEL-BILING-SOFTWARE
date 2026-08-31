import assert from "node:assert/strict";
import { hasTransactionSupport } from "../config/db.js";
import { hasRequiredPaymentUniqueIndexes, paymentUniqueIndexDefinitions } from "../utils/paymentIndexDefinitions.js";

assert.equal(hasTransactionSupport({ setName: "atlas-rs", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(hasTransactionSupport({ msg: "isdbgrid", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(hasTransactionSupport({ logicalSessionTimeoutMinutes: 30 }), false);
assert.equal(hasTransactionSupport({ setName: "atlas-rs", logicalSessionTimeoutMinutes: null }), false);

const requiredIndexes = paymentUniqueIndexDefinitions.map((definition) => ({
  name: definition.name,
  key: definition.key,
  unique: true,
  ...(definition.options.partialFilterExpression ? { partialFilterExpression: definition.options.partialFilterExpression } : {}),
}));
assert.equal(hasRequiredPaymentUniqueIndexes(requiredIndexes), true);
assert.equal(hasRequiredPaymentUniqueIndexes(requiredIndexes.map((index) => ({ ...index, sparse: index.name === "payment_transaction_id_unique" }))), false);

console.log("Production MongoDB readiness checks passed.");
