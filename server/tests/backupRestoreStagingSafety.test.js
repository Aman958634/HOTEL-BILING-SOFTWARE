import assert from "node:assert/strict";
import {
  assertEmptyDatabase,
  buildRestoreArguments,
  assertMongoVersion,
  sanitizeErrorCode,
  validateConfiguration,
} from "../scripts/validateBackupRestore.mjs";

const sourceDatabase = "restosphere_backup_source_staging_test_20260926_a1";
const restoreDatabase = "restosphere_backup_restore_staging_test_20260926_b2";
const stagingHost = "staging-atlas.example.mongodb.net";
const uri = (host, database, password = "secret-value") => `mongodb+srv://backup_user:${password}@${host}/${database}?retryWrites=true`;
const baseEnv = () => ({
  RESTORE_VALIDATION_MODE: "staging",
  RESTORE_VALIDATION_APPROVED: "true",
  RESTORE_VALIDATION_STAGING_HOSTS: stagingHost,
  RESTORE_VALIDATION_PRODUCTION_HOSTS: "production-atlas.example.mongodb.net",
  RESTORE_VALIDATION_APPLICATION_DATABASES: "restosphere_staging,restosphere_production",
  RESTORE_VALIDATION_DISPOSABLE_DATABASE_PATTERNS: "^restosphere_backup_(source|restore)_staging_test_[0-9]{8}_[a-z0-9]+$",
  RESTORE_VALIDATION_STAGING_CLUSTER_ID: "staging-rs",
  TEST_MONGO_URI: uri(stagingHost, sourceDatabase),
  RESTORE_VALIDATION_MONGO_URI: uri(stagingHost, restoreDatabase),
});
const stagingArgs = ["--run", "--staging", "--approve-restore", "--seed-synthetic-fixture"];
const mustReject = (mutate, code) => {
  const env = baseEnv();
  const args = [...stagingArgs];
  mutate(env, args);
  assert.throws(() => validateConfiguration({ env, args }), { code });
};

const accepted = validateConfiguration({ env: baseEnv(), args: stagingArgs });
assert.equal(accepted.mode, "staging");
assert.equal(accepted.source.host, stagingHost);
assert.equal(accepted.restore.database, restoreDatabase);
mustReject((env) => { env.TEST_MONGO_URI = uri("unknown-atlas.example.mongodb.net", sourceDatabase); }, "STAGING_HOST_NOT_ALLOWED");
mustReject((env) => { env.TEST_MONGO_URI = uri("production-atlas.example.mongodb.net", sourceDatabase); }, "PRODUCTION_HOST_FORBIDDEN");
mustReject((env) => { env.TEST_MONGO_URI = uri(stagingHost, "restosphere_staging"); }, "APPLICATION_DATABASE_FORBIDDEN");
mustReject((env) => { env.RESTORE_VALIDATION_MONGO_URI = uri(stagingHost, sourceDatabase); }, "SOURCE_AND_TARGET_MUST_DIFFER");
mustReject((env) => { delete env.RESTORE_VALIDATION_APPROVED; }, "RESTORE_APPROVAL_REQUIRED");
mustReject((_env, args) => { args.splice(args.indexOf("--approve-restore"), 1); }, "RESTORE_APPROVAL_REQUIRED");
assert.throws(() => assertEmptyDatabase({ database: restoreDatabase, collections: ["orders"] }), { code: `DATABASE_NOT_EMPTY:${restoreDatabase}` });
assert.doesNotThrow(() => assertEmptyDatabase({ database: restoreDatabase, collections: [] }));
assert.ok(!buildRestoreArguments({ mode: "staging", uri: uri(stagingHost, restoreDatabase), archive: "safe.archive" }).includes("--drop"));
assert.ok(buildRestoreArguments({ mode: "local", uri: "mongodb://127.0.0.1/restosphere_restore_test", archive: "safe.archive" }).includes("--drop"));
assert.doesNotThrow(() => assertMongoVersion("8.0.12"));
assert.throws(() => assertMongoVersion("8.2.0"), { code: "MONGODB_8_0_REQUIRED" });
const secret = "never-log-this-password";
const safeError = sanitizeErrorCode(new Error(uri(stagingHost, sourceDatabase, secret)));
assert.equal(safeError, "BACKUP_VALIDATION_FAILED");
assert.doesNotMatch(JSON.stringify({ error: safeError }), new RegExp(secret));
console.log("backupRestoreStagingSafety.test.js passed: Atlas staging allowlist, database isolation, approval, empty-target, version, and secret-safe failures.");