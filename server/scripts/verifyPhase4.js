import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { redactLogText } from '../utils/safeLog.js';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const uri = 'mongodb://127.0.0.1:27027/restosphere_cashfree_test?replicaSet=rsCashfreeTest';
if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') throw new Error('Phase 4 refuses production');
if (process.env.TEST_MONGO_URI !== uri) throw new Error('Phase 4 requires the explicit isolated TEST_MONGO_URI');
const env = { ...process.env, NODE_ENV: 'test', TEST_MONGO_URI: uri, MONGO_URI: 'mongodb://127.0.0.1:1/disabled_application_db', MONGODB_URI: '', CASHFREE_ENV: 'sandbox', CASHFREE_APP_ID: 'phase4-mock-app', CASHFREE_SECRET_KEY: 'phase4-mock-secret', CASHFREE_PAYMENTS_ENABLED: 'true', CASHFREE_EASY_SPLIT_ENABLED: 'false', CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED: 'false', CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED: 'false', CASHFREE_RETURN_URL: '', CASHFREE_RETURN_URL_BASE: '', JWT_ACCESS_SECRET: 'phase4-test-access-secret', JWT_REFRESH_SECRET: 'phase4-test-refresh-secret', PUBLIC_MENU_CONTEXT_SECRET: 'phase4-test-public-menu-secret' };
const suites = ['cashfreePayment', 'productionConfigSafety', 'easySplitVendor', 'easySplitVendorDb', 'easySplitSettlement', 'easySplitSettlementDb', 'cashfreeAllocationTriggerDb', 'cashfreeOrderCreationSplitDb', 'webhookSecurity', 'paymentSecurity', 'paymentState', 'tenantIsolation', 'tenantOutletSecurity', 'rolePermissions', 'permissionMiddleware', 'fixtureGuard', 'testDatabaseSafety', 'settlementRateLimit', 'operationalSafety', 'indexMigrationSafety', 'backgroundReconciliation', 'releaseVerification'];
// Dedicated Phase 3 lifecycle/reversal coverage complements the DB suites.
suites.push('settlementLifecycle');
suites.push('notificationDedupe');
const selected = process.argv.slice(2);
const results = [];
const run = (args, childEnv) => new Promise((resolve) => {
  const child = spawn(process.execPath, args, { cwd, env: childEnv, windowsHide: true });
  let output = ''; let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 300000);
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('error', (error) => { output += error.message; });
  child.on('close', (code) => { clearTimeout(timeout); resolve({ code, timedOut, output }); });
});
for (const name of suites) {
  if (selected.length && !selected.includes(name)) continue;
  console.log('RUN: ' + name);
  const result = await run(['--import', './tests/phase4NetworkGuard.js', 'tests/' + name + '.test.js'], env);
  const status = result.timedOut ? 'TIMEOUT' : result.code === 0 ? 'PASS' : 'FAIL';
  results.push({ name, status }); console.log(status + ': ' + name);
  if (status !== 'PASS') console.log(redactLogText(result.output).slice(-14000));
}
if (!selected.length) for (const file of ['migratePaymentIndexes.js', 'migrateEasySplitPhase2Indexes.js', 'migratePaymentReconciliationIndexes.js']) {
  console.log('RUN: ' + file + ' --verify (read-only)');
  const result = await run(['scripts/' + file, '--verify'], { ...env, MONGO_URI: uri });
  const status = result.timedOut ? 'TIMEOUT' : result.code === 0 ? 'PASS' : 'FAIL';
  results.push({ name: file, status }); console.log(status + ': ' + file); console.log(redactLogText(result.output).slice(-6000));
}
console.log(JSON.stringify({ phase: 4, results, passed: results.filter((r) => r.status === 'PASS').length, total: results.length }, null, 2));
if (!results.length || results.some((result) => result.status !== 'PASS')) process.exitCode = 1;
