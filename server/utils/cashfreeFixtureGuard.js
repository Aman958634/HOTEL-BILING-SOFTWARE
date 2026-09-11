// Validate the invocation before a fixture changes any runtime flags.
export const requireCashfreeFixtureEnvironment = (env = process.env) => {
  if (String(env.NODE_ENV || "").trim().toLowerCase() === "production") {
    throw new Error("Cashfree fixtures refuse NODE_ENV=production.");
  }
  if (String(env.CASHFREE_ENV || "sandbox").trim().toLowerCase() !== "sandbox") {
    throw new Error("Cashfree fixtures require CASHFREE_ENV=sandbox.");
  }
  const uri = String(env.TEST_MONGO_URI || "").trim();
  const expected = "mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest";
  if (uri !== expected) throw new Error("Cashfree fixtures require the isolated local restosphere_cashfree_test replica set.");
  return uri;
};
