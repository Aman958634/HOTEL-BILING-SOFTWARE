# RestoSphere production recovery runbook

## Scope and architecture

RestoSphere is a Vite/React single-page application (Vercel deployment configuration is in `client/vercel.json`) backed by a Node.js/Express and Socket.IO service (documented for Render). Its persistent system of record is MongoDB, configured with `MONGO_URI` or `MONGODB_URI`; the project documentation identifies MongoDB Atlas as the intended managed provider. Cloudinary is configured as an optional media provider. PDF receipts and reports are generated from database records on demand and are not a persistent filesystem dependency.

Production-critical data includes restaurants and settings; users and staff; outlet and table relationships; menus and categories; orders, bills, invoices, KOTs, payments and reconciliation records; inventory, recipes, suppliers and stock movements; customers, loyalty, notifications and activity records; subscriptions, central-kitchen records and inter-outlet operations. This data must remain in MongoDB and must not depend on the application container disk.

The server may create local `mongodump` directories only for an explicitly configured durable mount. Containers are otherwise ephemeral, and the production image does not treat its local disk as backup storage. The local backup job is disabled by default in production and does **not** prove that MongoDB provider backups exist.

## Required provider-side setup

This repository cannot configure MongoDB provider snapshots, point-in-time recovery (PITR), storage retention, Render health-check settings, or Vercel/Render secret stores. Production operators must:

1. Enable managed MongoDB backups: daily automated snapshots at minimum. Prefer PITR/more frequent recovery points when the database plan supports it.
2. Set and periodically test retention: retain daily recovery points for 7–14 days, weekly points for four weeks, and monthly points when business/regulatory needs require it.
3. Configure the backend provider health check to `GET /api/v1/ready` and use a deployment timeout long enough for MongoDB connection (at least 30 seconds).
4. Store environment variables in the hosting providers’ encrypted configuration, restrict backup-console access to authorized operators, and test a restore into an isolated recovery target.

Do not represent these controls as active until the provider dashboards confirm them.

## Backup and restore controls

Managed MongoDB backups are the production recovery mechanism. The existing local dump endpoints are administrative tools, not a replacement for provider backups. In production they require all of the following before list/create/restore is available:

- `BACKUP_ENABLED=true`
- an absolute `BACKUP_DIR` mounted on durable storage
- `BACKUP_LOCAL_STORAGE_CONFIRMED=true`
- MongoDB Database Tools (`mongodump` / `mongorestore`) installed and configured

The service does not enable a restore automatically. A local restore additionally requires an authenticated admin, an exact `RESTORE <backupName>` confirmation, `ENABLE_BACKUP_RESTORE=true`, and `BACKUP_RESTORE_MAINTENANCE_MODE=true`. Turn both restore flags off immediately after the controlled window. Prefer a provider restore to a separate recovery target first; never run an unreviewed destructive restore against the live database.

### Safe restore sequence

1. Declare the incident and record the time, affected restaurant/outlet scope, and suspected last-good time.
2. Use provider traffic controls or the hosting platform to limit writes. Do not invent application maintenance mode.
3. Select the recovery point, and preserve the damaged database/snapshot if it may be useful for reconciliation.
4. Restore to an isolated provider recovery target when supported; validate there before promoting or performing a controlled live restore.
5. Verify document counts and referential relationships, especially restaurant/tenant IDs and outlet IDs.
6. Verify a representative set of orders, totals, bills, payment records, KOT links, inventory/stock movements, subscriptions and central-kitchen/outlet records.
7. Reconcile payments with the authoritative gateway/provider records. Never blindly recreate, mark successful, refund, or duplicate a payment because of a restore.
8. Coordinate inventory recovery with orders and stock movements; a point-in-time restore can make quantities stale. Do not replay Socket.IO/KDS events automatically.
9. Reconnect traffic only after `GET /api/v1/ready` returns HTTP 200 and authentication, tenant isolation, and outlet isolation have been verified.

## Environment recovery and secret rotation

Keep a secured, access-controlled inventory of the production values—not values in Git—for these variables actually used by the project:

- Core: `NODE_ENV`, `PORT`, `MONGO_URI` or `MONGODB_URI`, `CLIENT_URL`.
- Authentication/public menus: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, expiry variables, `PUBLIC_MENU_ENABLED`, `PUBLIC_MENU_CONTEXT_SECRET`, and `PUBLIC_MENU_CONTEXT_EXPIRES`.
- Payments: `LIVE_DIGITAL_PAYMENTS`, Razorpay variables and/or Stripe variables when those integrations are live.
- Operations: `SUPER_ADMIN_*`, `FREE_TRIAL_DAYS`, `BILLING_TEST_MODE`.
- Optional integrations: `CLOUDINARY_*` and `EMAIL_*`.
- Local backup maintenance only: `BACKUP_*`, `MONGODUMP_PATH`, and `MONGORESTORE_PATH`.
- Frontend build-time public configuration: `VITE_API_URL` and `VITE_SOCKET_URL`.

The checked-in `server/.env.example`, `client/.env.example`, and `client/.env.production.example` contain names/placeholders only. Recover a lost deployment by recreating its provider-side configuration from the secured inventory, confirming `NODE_ENV=production`, and rebuilding the frontend after changing any `VITE_*` value. Never recover secrets by copying a prior public build or Git history.

After suspected compromise, rotate affected database credentials, JWT access/refresh and QR context secrets, payment-provider credentials/webhook secrets, Cloudinary credentials, SMTP credentials, and privileged super-admin credentials. Rotation must be coordinated: changing JWT secrets invalidates active sessions, and code rollback must not restore old exposed secrets.

## Startup, health, and deployment

The backend validates required production configuration and refuses localhost MongoDB before boot. It connects to MongoDB before listening; a failed connection exits rather than reporting healthy. `GET /api/v1/health` is a non-sensitive liveness probe. `GET /api/v1/ready` returns 200 only when MongoDB is connected and no controlled restore is in progress. On `SIGTERM`/`SIGINT`, the process stops Socket.IO and HTTP, then disconnects MongoDB with a 30-second fail-safe timeout.

Use Node.js 20 and the lockfile from the selected commit. Docker and CI use `npm ci`; Docker’s backend image sets `NODE_ENV=production`. The Compose service has a readiness health check, but hosted providers still require dashboard configuration. Vercel uses `client/vercel.json` for SPA routing and cache headers. The frontend API/socket URLs are build-time values, so deploy/rebuild it after any API hostname change.

For backward-compatible releases, deploy the backend first, wait for readiness, then deploy the frontend. For a breaking API or data change, first ship a compatibility window and an explicit migration plan; do not rely on simultaneous deploys. Migration, seed, repair, and sync scripts are explicit operator commands and must be reviewed, tested on a copy, and backed up before production use. The normal production boot skips plan/subscription data bootstrap unless the operator explicitly sets `RUN_STARTUP_DATA_BOOTSTRAP=true` for a planned maintenance operation; `SUPER_ADMIN_SEED` also remains off by default in production.

## Rollback and incidents

1. Identify the failing release, last known-good commit/deployment, impact, and whether a schema/data operation ran.
2. Check provider environment variables for drift; use the lockfile from the known-good commit rather than newly resolving dependencies.
3. Roll back backend code first when the frontend needs the previous API; wait for readiness, then roll back/redeploy the frontend with matching `VITE_*` configuration.
4. Verify login, restaurant and outlet access, tables/orders/KDS/billing, payment access, inventory, CRM, staff, notifications, central kitchen, subscription workflows, and super-admin isolation.
5. Code rollback and database rollback are separate decisions. Do **not** restore an older database solely because application code was rolled back. Restore data only for data loss/corruption or a reviewed migration recovery plan.

Recovery priorities are P0: database integrity, authentication, order/KDS continuity, billing and payments; P1: inventory, staff access, customer/loyalty and notifications; P2: reporting and non-critical exports. Record the incident owner, decision times, recovery point, validation results, and follow-up actions. After recovery, review provider backup success/retention, deployment logs, configuration drift, and access/secret rotation needs.

## Post-recovery checklist

- [ ] Liveness and readiness probes pass without exposing configuration or credentials.
- [ ] Authentication works and restaurant/tenant and outlet boundaries remain isolated.
- [ ] Tables, orders, KDS/KOTs, bills, receipts, and payment records are consistent.
- [ ] Inventory/recipes/stock operations are reviewed against restored time.
- [ ] CRM, loyalty, staff, notifications, central kitchen, subscriptions, and super-admin scope are verified.
- [ ] Payment status is reconciled with the payment provider; no transactions were duplicated or fabricated.
- [ ] Provider backups, retention, RPO/RTO targets, and restore evidence are recorded.
- [ ] Restore flags are disabled, temporary recovery targets are protected/retired according to policy, and configuration drift is corrected.

Recommended planning targets are RPO of up to 24 hours with daily snapshots, or tighter only after PITR is enabled and tested; RTO should be set by the operator after a documented restore drill. These are targets, not claims about the current provider plan.
