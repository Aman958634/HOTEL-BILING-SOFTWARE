import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_DATABASE_PATTERN = /(?:^|[-_])(test|tests|testing|stage|staging|ci)(?:[-_]|$)/i;
const SYNTHETIC_COLLECTION = "__restore_validation_synthetic";

class ValidationError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (code) => { throw new ValidationError(code); };
const clean = (value) => String(value || "").trim();
const hostName = (value) => clean(value).replace(/^\[|\]$/g, "").toLowerCase();
const list = (value, code, separator = ",") => {
  const values = clean(value).split(separator).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (!values.length || new Set(values).size !== values.length) fail(code);
  return values;
};

export const parseDatabaseUri = (uri, code = "INVALID_DATABASE_URI") => {
  let parsed;
  try { parsed = new URL(clean(uri)); } catch { fail(code); }
  const database = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
  if (!database || database.includes("/")) fail(code);
  return { protocol: parsed.protocol.toLowerCase(), host: hostName(parsed.hostname), database };
};
export const assertMongoVersion = (version) => { if (!/^8\.0\.\d+(?:[-+].*)?$/i.test(clean(version))) fail("MONGODB_8_0_REQUIRED"); };
export const assertEmptyDatabase = ({ database, collections }) => {
  if (!Array.isArray(collections) || collections.some((name) => !String(name).startsWith("system."))) fail(`DATABASE_NOT_EMPTY:${database}`);
};

const assertStagingName = (database, patterns, forbidden) => {
  if (forbidden.includes(database.toLowerCase())) fail("APPLICATION_DATABASE_FORBIDDEN");
  if (!patterns.some((pattern) => pattern.test(database))) fail("DISPOSABLE_DATABASE_NAME_REJECTED");
};

export const validateConfiguration = ({ args = [], env = process.env } = {}) => {
  if (!args.includes("--run")) fail("RUN_FLAG_REQUIRED");
  const mode = args.includes("--staging") ? "staging" : "local";
  const configuredMode = clean(env.RESTORE_VALIDATION_MODE).toLowerCase();
  if (configuredMode && configuredMode !== mode) fail("MODE_CONFIGURATION_MISMATCH");
  const sourceUri = clean(env.TEST_MONGO_URI);
  const restoreUri = clean(env.RESTORE_VALIDATION_MONGO_URI);
  const source = parseDatabaseUri(sourceUri);
  const restore = parseDatabaseUri(restoreUri);
  if (source.host === restore.host && source.database.toLowerCase() === restore.database.toLowerCase()) fail("SOURCE_AND_TARGET_MUST_DIFFER");

  if (mode === "local") {
    if (source.protocol !== "mongodb:" || restore.protocol !== "mongodb:" || !LOOPBACK_HOSTS.has(source.host) || !LOOPBACK_HOSTS.has(restore.host) || !LOCAL_DATABASE_PATTERN.test(source.database) || !LOCAL_DATABASE_PATTERN.test(restore.database)) fail("LOCAL_LOOPBACK_DATABASE_REQUIRED");
    return { mode, sourceUri, restoreUri, source, restore, seedSyntheticFixture: false };
  }

  if (configuredMode !== "staging") fail("STAGING_MODE_CONFIGURATION_REQUIRED");
  if (!args.includes("--approve-restore") || clean(env.RESTORE_VALIDATION_APPROVED).toLowerCase() !== "true") fail("RESTORE_APPROVAL_REQUIRED");
  if (!args.includes("--seed-synthetic-fixture")) fail("SYNTHETIC_FIXTURE_FLAG_REQUIRED");
  if (!["mongodb:", "mongodb+srv:"].includes(source.protocol) || !["mongodb:", "mongodb+srv:"].includes(restore.protocol)) fail("ATLAS_URI_REQUIRED");

  const allowedHosts = list(env.RESTORE_VALIDATION_STAGING_HOSTS, "STAGING_HOST_ALLOWLIST_REQUIRED");
  const productionHosts = list(env.RESTORE_VALIDATION_PRODUCTION_HOSTS, "PRODUCTION_HOST_DENYLIST_REQUIRED");
  const forbiddenDatabases = list(env.RESTORE_VALIDATION_APPLICATION_DATABASES, "APPLICATION_DATABASE_DENYLIST_REQUIRED");
  const rawPatterns = list(env.RESTORE_VALIDATION_DISPOSABLE_DATABASE_PATTERNS, "DISPOSABLE_DATABASE_PATTERNS_REQUIRED", ";");
  let patterns;
  try { patterns = rawPatterns.map((entry) => new RegExp(entry, "i")); } catch { fail("DISPOSABLE_DATABASE_PATTERNS_INVALID"); }
  if (allowedHosts.some((host) => productionHosts.includes(host))) fail("HOST_ALLOWLIST_AMBIGUOUS");
  if (productionHosts.includes(source.host) || productionHosts.includes(restore.host)) fail("PRODUCTION_HOST_FORBIDDEN");
  if (!allowedHosts.includes(source.host) || !allowedHosts.includes(restore.host) || source.host !== restore.host) fail("STAGING_HOST_NOT_ALLOWED");
  assertStagingName(source.database, patterns, forbiddenDatabases);
  assertStagingName(restore.database, patterns, forbiddenDatabases);
  const expectedClusterIdentity = clean(env.RESTORE_VALIDATION_STAGING_CLUSTER_ID);
  if (!expectedClusterIdentity) fail("STAGING_CLUSTER_ID_REQUIRED");
  return { mode, sourceUri, restoreUri, source, restore, expectedClusterIdentity, seedSyntheticFixture: true };
};

const connect = (uri) => mongoose.createConnection(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 }).asPromise();
const identity = async (connection) => {
  const hello = await connection.db.admin().command({ hello: 1 });
  const value = { setName: clean(hello.setName), serviceId: clean(hello.serviceId) };
  if (!value.setName && !value.serviceId) fail("CLUSTER_IDENTITY_UNAVAILABLE");
  return value;
};
const sameIdentity = (a, b) => a.setName === b.setName && a.serviceId === b.serviceId;
const matchesIdentity = (value, expected) => value.setName === expected || value.serviceId === expected;

const inspect = async (uri) => {
  const connection = await connect(uri);
  try {
    const version = String((await connection.db.admin().command({ buildInfo: 1 })).version || "");
    assertMongoVersion(version);
    const collections = (await connection.db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name);
    const counts = {};
    for (const name of collections.filter((entry) => !entry.startsWith("system."))) counts[name] = await connection.db.collection(name).countDocuments({});
    return { version, identity: await identity(connection), collections, counts };
  } finally { await connection.close(); }
};
const seedSyntheticFixture = async (uri) => {
  const connection = await connect(uri);
  try {
    await connection.db.collection(SYNTHETIC_COLLECTION).insertMany([
      { fixture: "restosphere-backup-validation", sequence: 1, runId: crypto.randomUUID(), synthetic: true },
      { fixture: "restosphere-backup-validation", sequence: 2, runId: crypto.randomUUID(), synthetic: true },
    ]);
  } finally { await connection.close(); }
};
const runTool = (tool, args) => new Promise((resolve, reject) => {
  const child = spawn(tool, args, { shell: false, windowsHide: true });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve() : reject(new ValidationError(`${tool.toUpperCase()}_FAILED`)));
});
export const buildRestoreArguments = ({ mode, uri, archive }) => {
  const args = ["--uri", uri, "--stopOnError", `--archive=${archive}`, "--gzip"];
  if (mode === "local") args.splice(2, 0, "--drop");
  return args;
};
export const sanitizeErrorCode = (error) => error instanceof ValidationError ? error.code : "BACKUP_VALIDATION_FAILED";

export const runValidation = async ({ args = process.argv.slice(2), env = process.env } = {}) => {
  const summary = { validation: "isolated-mongodb-8-backup-restore", status: "FAILED" };
  let archiveDirectory = null;
  try {
    const config = validateConfiguration({ args, env });
    Object.assign(summary, { mode: config.mode, sourceDatabase: config.source.database, restoreDatabase: config.restore.database });
    const [sourcePreflight, restorePreflight] = await Promise.all([inspect(config.sourceUri), inspect(config.restoreUri)]);
    if (config.mode === "staging") {
      assertEmptyDatabase({ database: config.source.database, collections: sourcePreflight.collections });
      assertEmptyDatabase({ database: config.restore.database, collections: restorePreflight.collections });
      if (!sameIdentity(sourcePreflight.identity, restorePreflight.identity) || !matchesIdentity(sourcePreflight.identity, config.expectedClusterIdentity) || !matchesIdentity(restorePreflight.identity, config.expectedClusterIdentity)) fail("STAGING_CLUSTER_IDENTITY_MISMATCH");
      await seedSyntheticFixture(config.sourceUri);
    }
    const sourceSnapshot = config.mode === "staging" ? await inspect(config.sourceUri) : sourcePreflight;
    archiveDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "restosphere-backup-restore-"));
    const archive = path.join(archiveDirectory, "backup.archive.gz");
    await runTool(env.MONGODUMP_PATH || "mongodump", ["--uri", config.sourceUri, `--archive=${archive}`, "--gzip"]);
    const restoreArgs = buildRestoreArguments({ mode: config.mode, uri: config.restoreUri, archive });
    await runTool(env.MONGORESTORE_PATH || "mongorestore", restoreArgs);
    const restoreSnapshot = await inspect(config.restoreUri);
    assert.deepEqual(restoreSnapshot.counts, sourceSnapshot.counts, "Restored document counts must match source counts");
    Object.assign(summary, { status: "COMPLETE", mongodbVersion: sourceSnapshot.version, collections: sourceSnapshot.counts });
    if (config.mode === "staging") summary.clusterIdentity = config.expectedClusterIdentity;
  } catch (error) { summary.error = sanitizeErrorCode(error); }
  finally { if (archiveDirectory) await fs.rm(archiveDirectory, { recursive: true, force: true }).catch(() => {}); }
  return summary;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const summary = await runValidation();
  console.log(JSON.stringify(summary));
  if (summary.status !== "COMPLETE") process.exitCode = 1;
}