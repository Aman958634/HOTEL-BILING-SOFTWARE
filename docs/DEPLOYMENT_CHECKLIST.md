# RestoSphere Deployment Checklist

## Pre-Deploy

- Review `git diff` and changed-file ownership.
- Run server lint, syntax checks, security tests, database-safety tests, QR idempotency, tenant/outlet isolation, and realtime-scope tests.
- Build the client when client files changed.
- Verify environment variable names and production values through the deployment platform, without putting secret values in source or tickets.
- Review database compatibility and planned migrations.
- For the external-order uniqueness correction, run `npm run migrate:external-order-index` against the intended database during an approved maintenance window; verify the index before restoring traffic.
- For the nullable idempotency-key uniqueness correction, run `npm run migrate:order-idempotency-index` against the intended database during the same approved maintenance window; verify the index before restoring traffic.
- Confirm provider-side backup/PITR status with the provider; the application cannot verify provider backups.
- Identify the last known healthy commit/tag and rollback owner.

## Backend Deploy

- Confirm deployment starts without fatal startup errors.
- Confirm MongoDB connects without logging credentials.
- Confirm the server listens.
- Confirm `GET /api/v1/health` returns `200`.
- Confirm `GET /api/v1/ready` returns `200` only after startup dependencies are ready.
- Check startup, DB lifecycle, and fatal-process logs.
- Confirm no unexpected 5xx or rate-limit spike.

## Frontend Deploy

- App loads and direct routes work.
- Login and refresh flow work.
- API base URL is correct.
- Network failures do not force a false logout.
- No major console errors.

## Post-Deploy

- Recheck health and readiness.
- Run a safe authentication smoke.
- Run a non-destructive POS smoke in an approved test tenant/outlet when available.
- Verify KDS/realtime sanity and outlet room isolation.
- Review errors, rate-limit events, and slow requests using request IDs.
- Confirm rollback readiness.

## Rollback

1. Identify the last known healthy commit/deploy.
2. Check frontend/backend compatibility.
3. Check whether the release included schema changes.
4. Roll back application artifacts safely.
5. Do not automatically reverse database migrations.
6. Verify health, readiness, auth, POS, KDS/realtime, and error rate.

## Configuration Drift

### Critical

`MONGO_URI` or `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, and `PUBLIC_MENU_CONTEXT_SECRET` when public menu context is enabled.

### Optional

Backup controls, email configuration, cloud storage configuration, and non-live integrations.

### Provider-specific

Razorpay and Stripe credentials, webhook secrets, external provider credentials, and deployment-platform settings.

### Test-only

`TEST_MONGO_URI`, `LOAD_TEST_MODE`, and local load-test port settings. Test values must never be used for production startup.

## Uptime Guidance

Configure the deployment platform liveness check to use `/api/v1/health`. Use `/api/v1/ready` for traffic readiness when the platform supports separate readiness checks. Health is lightweight; readiness includes application startup and database state.

## Backup and Recovery

Managed database backups/PITR are provider responsibilities and must be verified in the provider console. Application backup/restore controls are documented in `docs/PRODUCTION_RECOVERY.md`. Test restores only against a safe isolated target and record RPO/RTO evidence; never restore destructively into production without an approved operation.
