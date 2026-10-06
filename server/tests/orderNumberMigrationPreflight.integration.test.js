import assert from "node:assert/strict";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import {
  isOrderNumberPreflightEnabled,
  runOrderNumberMigrationPreflightIfEnabled,
} from "../services/orderNumberMigrationPreflightService.js";

const { uri } = requireSafeTestDatabase();
const forbiddenWriteMethods = new Set([
  "insertOne", "insertMany", "updateOne", "updateMany", "findOneAndUpdate",
  "replaceOne", "deleteOne", "deleteMany", "bulkWrite", "createIndex", "dropIndex",
]);

assert.equal(isOrderNumberPreflightEnabled(), false);
assert.equal(isOrderNumberPreflightEnabled(" true "), true);
assert.equal(isOrderNumberPreflightEnabled("TRUE"), true);
assert.equal(isOrderNumberPreflightEnabled("1"), false);
assert.equal(isOrderNumberPreflightEnabled("false"), false);

let collectionRequestedWhileDisabled = false;
const disabledResult = await runOrderNumberMigrationPreflightIfEnabled({
  enabled: false,
  connection: { db: { collection: () => { collectionRequestedWhileDisabled = true; throw new Error("must not query"); } } },
  log: { info: () => {} },
});
assert.deepEqual(disabledResult, { executed: false });
assert.equal(collectionRequestedWhileDisabled, false);

const logs = [];
try {
  await mongoose.connect(uri);
  const orders = mongoose.connection.db.collection("orders");
  const beforeOrderCount = await orders.countDocuments({});
  const guardedConnection = {
    db: {
      collection: (name) => new Proxy(mongoose.connection.db.collection(name), {
        get(target, property, receiver) {
          if (forbiddenWriteMethods.has(property)) {
            return () => { throw new Error(`Forbidden write method reached: ${String(property)}`); };
          }
          return Reflect.get(target, property, receiver);
        },
      }),
    },
  };

  const result = await runOrderNumberMigrationPreflightIfEnabled({
    enabled: true,
    connection: guardedConnection,
    log: { info: (message) => logs.push(message) },
  });
  const afterOrderCount = await orders.countDocuments({});

  assert.equal(result.executed, true);
  assert.equal(typeof result.pass, "boolean");
  assert.equal(beforeOrderCount, afterOrderCount);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /ORDER NUMBER MIGRATION READ-ONLY PREFLIGHT/);
  assert.match(logs[0], /MODE: READ ONLY/);
  assert.match(logs[0], /PRODUCTION DATA MODIFIED: NO/);
  assert.match(logs[0], /INDEX MODIFIED: NO/);
  assert.match(logs[0], /COUNTER MODIFIED: NO/);
  assert.match(logs[0], /MIGRATION EXECUTED: NO/);
  const repeated = await runOrderNumberMigrationPreflightIfEnabled({
    enabled: true,
    connection: { db: { collection: () => { throw new Error("must run once only"); } } },
    log: { info: () => { throw new Error("must log once only"); } },
  });
  assert.deepEqual(repeated, { executed: false, alreadyStarted: true });
  console.log("Order-number migration preflight local integration checks passed: default-off, read-only queries, and no write method reachable.");
} finally {
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
}
