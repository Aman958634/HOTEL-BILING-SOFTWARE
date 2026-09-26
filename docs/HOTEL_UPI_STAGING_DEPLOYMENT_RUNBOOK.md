# Hotel UPI staging deployment runbook

This runbook prepares a staging-only release. It does not authorize a deployment, a database migration, a real payment, or any backup/restore action.

## Deployment artifacts

Deploy the reviewed working-tree change set, including:

- `server/controllers/hotelPaymentController.js`
- `server/routes/hotelPaymentRoutes.js`
- `server/models/HotelPaymentSettings.js`
- `server/models/Payment.js`
- `server/services/paymentService.js`
- `server/services/billService.js`
- `server/scripts/migrateHotelUpiIndexes.js`
- `server/config/envValidation.js`, `server/utils/allowedOrigins.js`, and `server/server.js`
- `client/src/services/hotelPaymentService.js`
- `client/src/components/payments/HotelUpiPaymentModal.jsx`
- `client/src/components/payments/HotelUpiVerificationModal.jsx`
- `client/src/pages/Orders/OrdersPage.jsx`
- `client/src/pages/admin/Payments.jsx`
- `client/src/pages/admin/Settings.jsx`
- the reviewed payment, tenant, and release-supporting model/service changes in the same release

Do not cherry-pick the Hotel UPI controller, model, UI, or migration independently. They form one compatible release.

## Staging environment handoff

Use `server/.env.staging.example` and `client/.env.staging.example` as names-only templates. Set values only in the staging deployment platform.

Required backend values:

- `NODE_ENV=staging`
- `MONGO_URI` or `MONGODB_URI` — injected staging-only credential; exactly one URI
- `STAGING_MONGODB_HOSTS` — exact comma-separated staging Atlas hostnames
- `STAGING_PRODUCTION_MONGODB_HOSTS` — exact comma-separated production Atlas hostnames to reject
- `STAGING_MONGODB_DATABASE` — exact staging application database name
- `CLIENT_URL` and `ALLOWED_ORIGINS` — explicit HTTPS staging browser origins; `CLIENT_URL` must be included in `ALLOWED_ORIGINS`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and, when public menus are enabled, `PUBLIC_MENU_CONTEXT_SECRET` — unique staging-only secrets
- `BILLING_TEST_MODE=true`
- `CASHFREE_ENV=sandbox`
- `LIVE_DIGITAL_PAYMENTS=false`, `CASHFREE_PAYMENTS_ENABLED=false`, `CASHFREE_EASY_SPLIT_ENABLED=false`, and `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED=false`
- Razorpay values are optional for this Hotel UPI release. If staging tests platform subscriptions, use only `rzp_test_*` credentials and a staging-only webhook secret.
- `BACKUP_ENABLED=false`, `ENABLE_BACKUP_RESTORE=false`, `BACKUP_RESTORE_MAINTENANCE_MODE=false`, `RUN_STARTUP_DATA_BOOTSTRAP=false`, `SUPER_ADMIN_SEED=false`, and `WHATSAPP_ENABLED=false` unless separately approved.

Approved RestoSphere staging binding (non-secret):

- `STAGING_MONGODB_HOSTS=restospherestaging.50b7xma.mongodb.net`
- `STAGING_PRODUCTION_MONGODB_HOSTS=cluster0.7fvxcg5.mongodb.net`
- `STAGING_MONGODB_DATABASE=restosphere_staging`

Required frontend build values:

- `VITE_API_URL=https://<staging-api>/api/v1`
- `VITE_SOCKET_URL=https://<staging-api>`
- `VITE_DEPLOYMENT_ENV=staging`
- `VITE_STAGING_API_HOSTS=<staging-api-hostname>` - exact comma-separated hostnames, without a scheme or path

Never put `MONGO_URI`, JWT secrets, Razorpay/Cashfree secrets, or webhook secrets in `VITE_*` values. Vercel Preview builds fail closed unless they declare `VITE_DEPLOYMENT_ENV=staging` and both API endpoints use the explicit staging-host allowlist; they cannot silently use the production API or Socket.IO host. The staging runtime now fails before opening MongoDB unless the URI is `mongodb+srv://`, keeps TLS enabled, matches its exact staging host/database allowlist, and does not match its production denylist. Staging CORS and Socket.IO use only configured HTTPS origins; localhost defaults are disabled.

## Pre-deployment checks

1. Review the full dirty worktree and approve the release artifact list above.
2. Run backend lint and the Hotel UPI, payment-security, idempotency, ledger, index-safety, and staging-config tests against isolated local test infrastructure.
3. Build the frontend with the intended staging HTTPS origins. Confirm the generated bundle contains no credential values.
4. In the staging platform, inspect configured variable names and redacted values. Do not copy secrets to terminals, tickets, or source control.
5. Confirm the staging MongoDB host and database are distinct from production before deployment. The runtime guard is a second control, not a substitute for review.
6. Confirm API and Socket.IO share the same HTTPS staging origin policy. Browser CORS preflight and Socket.IO handshake must both be allowed from the staging frontend only.
7. Do not register a production Razorpay webhook on staging. If a staging webhook is needed, use its staging HTTPS endpoint and test credentials only.

## Staging MongoDB TLS diagnostic plan

The earlier TLS handshake failure is a blocker until a staging operator resolves it. Do not disable TLS, add `tlsAllowInvalidCertificates`, downgrade TLS, or use an unencrypted URI.

Run these diagnostics from the staging host or its approved diagnostic runner, without printing a URI password:

1. Check the host clock and timezone; a materially incorrect clock can invalidate certificate checks.
2. Resolve the Atlas SRV and TXT records for the configured staging hostname, and compare the resulting hostnames with `STAGING_MONGODB_HOSTS`.
3. Confirm the deployment image uses the supported Node/MongoDB driver and has current system CA certificates.
4. Confirm Atlas network access allows the staging service egress IP/range and that outbound TCP 27017 is permitted.
5. Use the platform's secret-injected URI for a one-time TLS diagnostic with normal certificate validation, retaining only sanitized error class, hostname, driver version, and timestamp.
6. Compare a sanitized `openssl s_client` or driver TLS trace, run by the approved operator, against the Atlas certificate chain and SNI hostname. Do not capture credentials or disable verification.

If the error remains, record the sanitized handshake error, Atlas hostname, deployment region, timestamp, Node version, and driver version for Atlas support. Do not work around the error by pointing staging at production.

## Approved staging migration sequence

Do not run these commands until the staging deployment is healthy, the staging URI is injected, and a change approver has confirmed the target. The migration is additive-only; it must not run with production credentials.

```powershell
# In the staging service shell only. Confirm the exact host/database through
# redacted platform configuration; do not echo the URI.
$env:NODE_ENV = 'staging'
$env:MIGRATION_APPROVED = 'true'

npm --prefix server run migrate:hotel-upi-indexes -- --verify
npm --prefix server run migrate:hotel-upi-indexes -- --apply
npm --prefix server run migrate:hotel-upi-indexes -- --verify
```

The migration uses the same exact staging host/database allowlist as the runtime guard and fails closed unless `MIGRATION_APPROVED=true` is supplied for the command window. Remove that variable immediately after the final verify. Do not set `LOAD_TEST_MODE` in staging.

Expected evidence after a future approved apply is a final JSON object with `status:"COMPLETE"` and no missing index names:

- `hotel_upi_active_order_attempt_unique`
- `hotel_upi_active_bill_attempt_unique`
- `hotel_upi_settings_scope_unique`

## Manual staging acceptance checklist

Use only a designated staging hotel, restaurant, outlet, and non-production UPI identifier. No customer or production bank data.

- [ ] Health (`/api/v1/health`) and readiness (`/api/v1/ready`) return 200 after a successful staging DB connection.
- [ ] API preflight and Socket.IO authenticated connection succeed from the configured staging frontend origin and fail from an unapproved origin.
- [ ] A cashier with `payments.collect` saves Hotel UPI settings for the designated outlet only.
- [ ] Generate a QR for an unpaid order; verify its amount equals the server-calculated outstanding amount and the order remains `AWAITING_VERIFICATION`.
- [ ] Verify the generator cannot approve the same attempt.
- [ ] A different cashier with `payments.collect` validates a controlled non-production bank/UPI reference and approves the exact amount.
- [ ] Confirm payment status, receipt, invoice, order payment mirror, dashboard revenue, and reconciliation are each updated once.
- [ ] Create a partial non-Hotel-UPI ledger payment, then verify the Hotel UPI QR is limited to the exact remaining amount; attempt a partial Hotel UPI approval and confirm rejection.
- [ ] Reject an awaiting attempt with a required note; verify the order/bill returns to pending and a new QR can be issued.
- [ ] Submit a duplicate approval and concurrent QR/approval attempts; confirm one active QR and one settlement only.
- [ ] Attempt QR generation and verification across another hotel and another outlet; confirm access is denied or not found.
- [ ] As an authorized hotel-wide user with an active outlet, verify that outlet's payment; confirm another outlet remains inaccessible.
- [ ] Create a consolidated bill; issue a QR for one linked order; verify the QR equals bill balance and that settlement updates all linked orders, bill receipt, invoice/revenue, and reconciliation exactly once.
- [ ] Confirm Hotel UPI does not use the Razorpay operational checkout or webhook path. If SaaS Razorpay testing is enabled separately, confirm test keys and staging webhook only.
- [ ] Review sanitized server logs for CORS, Socket.IO, database, payment, and webhook errors; do not retain credentials or transaction details in evidence.

## Rollback

1. Stop staging traffic or roll back frontend and backend artifacts together to the last known compatible staging release.
2. Verify `/api/v1/health` and `/api/v1/ready`, login, API CORS, and Socket.IO origin behavior after rollback.
3. Do not drop indexes or edit payment, invoice, bill, reconciliation, or receipt history as a rollback action.
4. The Hotel UPI migration is additive-only. Keep successfully created indexes unless a separately reviewed corrective migration is approved.
5. Disable the Hotel UPI outlet setting in the designated staging tenant if operational testing must stop; preserve the ledger and audit timeline.
6. Preserve sanitized deployment logs, migration JSON, and acceptance evidence; investigate before any retry.

## Release gates still outside this package

- Staging Atlas TLS connection and host/database identity verification.
- Approved staging deployment and migration-guard alignment.
- Full manual staging acceptance evidence.
- Separate MongoDB 8 backup/restore validation (on hold; not part of this runbook).
- Explicit production deployment approval, production index verification, real hotel bank-credit process approval, and production smoke/rollback owner confirmation.
