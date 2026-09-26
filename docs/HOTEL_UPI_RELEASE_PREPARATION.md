# Hotel-Owned UPI Release Preparation

## Automated safeguards now in source

- Hotel UPI QR attempts are tenant and outlet scoped.
- A QR contains the server-calculated outstanding amount only.
- The QR generator cannot approve the same attempt; a second cashier with `payments.collect` must provide a bank/UPI reference.
- Payment settlement uses the existing transactional, idempotent order/bill paths, preserving invoices, receipts, revenue, and reconciliation.
- Hotel UPI uses no Razorpay checkout or webhook path. SaaS subscription Razorpay routes remain separate.
- `migrate:hotel-upi-indexes` creates or verifies only the two active-attempt partial indexes and the settings-scope index. It never drops an index or data.

## Staging audit status

This repository contains no connected staging deployment configuration or staging credentials. Static checks confirm production frontend builds require explicit HTTPS API and socket endpoints, and production server validation rejects loopback/test databases and non-HTTPS origins. Deployment state, environment values, health/readiness, logs, and staff permissions must be checked in the staging platform without copying secrets into this repository.

Before approval, confirm in staging:

1. `NODE_ENV` is not production; its database is a distinct, disposable/staging database, never a production URI.
2. Browser API and socket endpoints are HTTPS and point only to the intended staging API.
3. `CASHFREE_ENV=sandbox`, digital/Easy Split flags follow the intended staged test posture, and no production credential appears in a `VITE_*` value.
4. Hotel UPI settings are set only for the intended hotel/restaurant/outlet, with a non-production UPI identifier where policy permits.
5. Two different cashiers can complete the QR-generator and bank-credit-verifier roles; the generator is rejected from approving the attempt.
6. Health and readiness endpoints pass, and a controlled test verifies an exact-outstanding QR, a partial prior collection, consolidated-bill settlement, receipt/invoice generation, revenue, and reconciliation.

## Isolated backup restore validation

### Local mode

Local mode remains loopback-only. `TEST_MONGO_URI` and `RESTORE_VALIDATION_MONGO_URI` must name two distinct loopback databases whose names contain `test`, `staging`, or `ci`.

### Approved Atlas staging mode

Atlas staging validation is synthetic-fixture-only. It must never dump, restore, or inspect the real staging application database or any production backup/database. The runner must receive these values from the deployment secret store, not Git, tickets, terminal history, or application configuration:

- `RESTORE_VALIDATION_MODE=staging`
- `TEST_MONGO_URI`: new source database URI on the approved staging Atlas cluster
- `RESTORE_VALIDATION_MONGO_URI`: different new restore-target database URI on that same cluster
- `RESTORE_VALIDATION_STAGING_HOSTS`: exact comma-separated staging Atlas hostname allowlist
- `RESTORE_VALIDATION_PRODUCTION_HOSTS`: exact comma-separated production hostname denylist
- `RESTORE_VALIDATION_APPLICATION_DATABASES`: exact comma-separated production and staging application database denylist
- `RESTORE_VALIDATION_DISPOSABLE_DATABASE_PATTERNS`: semicolon-separated anchored regular expressions for approved disposable names
- `RESTORE_VALIDATION_STAGING_CLUSTER_ID`: expected non-secret replica-set or service identity
- `RESTORE_VALIDATION_APPROVED=true`: supplied only by the named approver for the execution window

Use two new names that match the approved patterns, for example:

```text
restosphere_backup_source_staging_test_YYYYMMDD_nonce
restosphere_backup_restore_staging_test_YYYYMMDD_nonce
```

Both must be empty before the run. The harness verifies MongoDB `8.0.x`, both database identities, source/target identity equality, exact host allowlisting, empty databases, approval, and naming rules before it writes its two synthetic fixture documents. Staging restore omits `mongorestore --drop`; a nonempty target fails closed.

### Read-only preflight

After secret injection and before granting restore approval, run these commands. They emit only database names, server versions, and cluster identity values; do not echo URI values.

```powershell
mongosh --quiet $env:TEST_MONGO_URI --eval "JSON.stringify({database:db.getName(),version:db.adminCommand({buildInfo:1}).version,cluster:db.hello().setName})"
mongosh --quiet $env:RESTORE_VALIDATION_MONGO_URI --eval "JSON.stringify({database:db.getName(),collections:db.getCollectionNames().filter(n=>!n.startsWith('system.')).length,cluster:db.hello().setName})"
```

The approver must confirm: both names are the newly created disposable names, both point to the exact allowlisted staging host, the target has zero user collections, identity equals `RESTORE_VALIDATION_STAGING_CLUSTER_ID`, and version is `8.0.x`.

### Exact approved validation command

Only after the written approval names the restore target and validation window:

```powershell
$env:RESTORE_VALIDATION_APPROVED = "true"
npm run validate:backup-restore -- --staging --seed-synthetic-fixture --approve-restore
```

Expected PASS evidence is a final JSON object with `status:"COMPLETE"`, `mode:"staging"`, the two disposable database names, `mongodbVersion` beginning `8.0.`, the configured cluster identity, and matching per-collection document counts. No URI, password, or document contents are printed.

### Cleanup

After evidence is retained, verify the two names again and remove only the two disposable synthetic databases using the staging-approved change procedure. Revoke `RESTORE_VALIDATION_APPROVED`, clear the injected environment, delete the temporary encrypted archive, and remove the runner IP allowlist if it was temporary. Do not drop the staging application database.

Actual production-backup restore validation remains a separate restricted recovery operation. It requires a reviewed production recovery plan, a distinct provider recovery target, explicit approval, provider backup/PITR confirmation, and payment reconciliation; it is not performed by this staging synthetic-fixture harness.
## Production migration command

During an approved maintenance window only, set the approved production environment and `MIGRATION_APPROVED=true`, then run:

```sh
npm run migrate:hotel-upi-indexes -- --verify
npm run migrate:hotel-upi-indexes -- --apply
npm run migrate:hotel-upi-indexes -- --verify
```

Each invocation prints one final JSON object. `--verify` exits nonzero while a required index is missing; `--apply` is additive-only and fails on a conflicting index definition rather than modifying it.
