import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { requireCashfreeFixtureEnvironment } from "../utils/cashfreeFixtureGuard.js";

const safe = { NODE_ENV: "test", CASHFREE_ENV: "sandbox", TEST_MONGO_URI: "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest" };
assert.equal(requireCashfreeFixtureEnvironment(safe), safe.TEST_MONGO_URI);
for (const mode of ["production", " PRODUCTION "]) assert.throws(() => requireCashfreeFixtureEnvironment({ ...safe, NODE_ENV: mode }), /refuse NODE_ENV=production/);
for (const mode of ["production", "prod", "live"]) assert.throws(() => requireCashfreeFixtureEnvironment({ ...safe, CASHFREE_ENV: mode }), /sandbox/);
for (const uri of ["", safe.TEST_MONGO_URI.replace("127.0.0.1", "remote.example"), safe.TEST_MONGO_URI.replace("27027", "27017"), safe.TEST_MONGO_URI.replace("restosphere_cashfree_test", "restosphere_prod"), safe.TEST_MONGO_URI.replace("rsCashfreeTest", "rsOther")]) {
  assert.throws(() => requireCashfreeFixtureEnvironment({ ...safe, TEST_MONGO_URI: uri }), /isolated local/);
}
// Execute the actual entry points in production mode. They must terminate at
// the guard, before importing fixture models or opening any database socket.
for (const script of ["seedCashfreeTestFixture.js", "prepareCashfreePartialFixture.js", "prepareCashfreeEasySplitTestOrder.js"]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { env: { ...process.env, ...safe, NODE_ENV: "production" }, encoding: "utf8", timeout: 60000 });
  assert.equal(result.status, 1, `${script} must refuse production`);
  assert.match(result.stderr, /Cashfree fixtures refuse NODE_ENV=production/);
  assert.doesNotMatch(result.stderr, /MongoServer|ECONNREFUSED|ServerSelection/);
}
console.log("fixtureGuard.test.js passed: all three entry points block production before connection; local sandbox target enforced.");
