# Phase 5 Production Activation Preparation

This document prepares a controlled Cashfree PG and Easy Split activation. It contains variable names and procedures only. Do not place credentials, provider IDs, account numbers, PAN, UPI values, or database connection strings in this file.

## Software readiness contract

Production startup must fail fast unless all of these are explicit and valid:

- `NODE_ENV=production`
- `MONGO_URI` or `MONGODB_URI` points to a remote production database
- `CLIENT_URL` is one HTTPS origin
- `ALLOWED_ORIGINS` contains the approved HTTPS origin
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `PUBLIC_MENU_CONTEXT_SECRET`
- `CASHFREE_ENV=production`
- `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`
- `CASHFREE_API_VERSION`
- `CASHFREE_PAYMENTS_ENABLED=true|false`
- `CASHFREE_EASY_SPLIT_ENABLED=true|false`
- `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED=true|false`

Production rejects localhost, loopback, HTTP origins, comma-separated `CLIENT_URL`, test database names, sandbox credential markers, missing flags, and invalid return URLs. Cashfree production maps to `https://api.cashfree.com/pg`; sandbox maps to `https://sandbox.cashfree.com/pg`.

The frontend receives only `VITE_API_URL` and `VITE_SOCKET_URL`. Both must be HTTPS in production. Cashfree credentials are server-only.

## Easy Split preflight

A production Cashfree order is blocked unless payment creation and both Easy Split flags are enabled. The order-creation path then verifies the authenticated tenant/outlet-scoped order, active restaurant and outlet, settlement profile, provider vendor ID, provider vendor `ACTIVE` status, verified bank settlement state, effective commission, integer-paise invariant, and `ORDER_CREATION_SPLIT`. No unsplit production fallback is permitted.

## State and reconciliation controls

Payment, allocation, and settlement remain separate state machines. A paid payment may remain allocated and settlement-pending. Provider settlement evidence is required before `SETTLED`; UTR/reference values are copied only from provider responses. Reconciliation is bounded, idempotent, concurrency-safe, tenant-scoped, and uses the same service for manual refresh and background work. Historical commission snapshots are not rewritten.

## Kill switches

- `CASHFREE_PAYMENTS_ENABLED=false`: blocks new Cashfree order creation.
- `CASHFREE_EASY_SPLIT_ENABLED=false`: blocks Easy Split activation and vendor operations.
- `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED=false`: blocks new Easy Split allocation/order-split processing.
- `CASHFREE_SETTLEMENT_RECONCILIATION_ENABLED=false`: stops background reconciliation.

These switches do not delete records, regress payment state, prevent webhook verification, or hide payment/settlement history.

## Render checklist

- [ ] Runtime strategy is Node.js 20 or a compatible supported LTS.
- [ ] Build command: `npm ci` from `server`.
- [ ] Start command: `npm start` from `server`.
- [ ] Health check: `/api/v1/health`.
- [ ] Readiness check: `/api/v1/ready`.
- [ ] Configure the backend variable names from the production contract.
- [ ] Configure production MongoDB backups/PITR in the database provider.
- [ ] Set `CASHFREE_ENV=production` only with production credentials.
- [ ] Keep payment and Easy Split flags disabled until manual approval.
- [ ] Confirm CORS uses the production frontend origin only.
- [ ] Configure required JWT, menu, email, and Cloudinary variable names where enabled.

## Vercel checklist

- [ ] `VITE_API_URL` is the HTTPS production API base URL.
- [ ] `VITE_SOCKET_URL` is the HTTPS production backend/socket URL.
- [ ] No server credential is configured as a `VITE_*` variable.
- [ ] Build command: `npm run build` from `client`.
- [ ] Output directory: `dist`.
- [ ] SPA rewrites in `client/vercel.json` are retained.
- [ ] Rebuild after any backend hostname change.

## Cashfree dashboard checklist

- [ ] Production API keys are available and are not sandbox keys.
- [ ] Payment Gateway production activation is approved.
- [ ] Easy Split production capability is activated.
- [ ] Production webhook URL is configured.
- [ ] Required payment and settlement webhook events are selected.
- [ ] The production vendor exists under the production account.
- [ ] Production vendor status is `ACTIVE`.
- [ ] Production vendor bank verification is successful.
- [ ] Settlement cycle is configured.
- [ ] Restaurant-to-vendor mapping is independently confirmed.
- [ ] Commission configuration is approved.

A sandbox vendor ID is never sufficient for production.

## First live transaction runbook

1. Confirm deployment health, readiness, logs, backup/PITR, and rollback owner.
2. Confirm Cashfree production and Easy Split activation in the dashboard.
3. Confirm exactly one intended restaurant vendor is `ACTIVE` and verified.
4. Confirm the restaurant commission configuration and effective time.
5. Confirm webhook delivery and the documented kill switches.
6. Intentionally enable `CASHFREE_PAYMENTS_ENABLED`, `CASHFREE_EASY_SPLIT_ENABLED`, and `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED`.
7. Use the smallest legitimate order amount allowed by the live business workflow. Do not hard-code an amount that bypasses order rules.
8. Record local order ID, Cashfree order ID, Cashfree payment ID, payment state, local payment state, allocation strategy, gross, commission, platform share, vendor share, and the integer-paise invariant.
9. Confirm one logical `Payment`, one `SettlementTransaction`, `ORDER_CREATION_SPLIT`, `PAID/SUCCESS`, and `ALLOCATED`.
10. Confirm provider allocation reference. Do not call the result `SETTLED` until explicit provider settlement evidence or UTR exists.
11. Monitor reconciliation. Disable new payments immediately on any mismatch.

## Incident and rollback runbook

- Payment creation failure: set `CASHFREE_PAYMENTS_ENABLED=false`, preserve records, inspect request ID and safe provider diagnostics.
- Payment succeeded but allocation is unknown: do not mark payment failed or create another payment; reconcile provider state; never invoke post-payment split for `ORDER_CREATION_SPLIT`.
- Webhook failure: inspect Cashfree delivery logs, restore the endpoint, then verify payment server-side.
- Settlement remains pending: preserve payment/allocation state, reconcile, and never fabricate a UTR.
- Wrong vendor before payment: keep payment creation disabled for the affected restaurant and correct the mapping before retrying.
- Wrong vendor after payment: disable affected payment creation, preserve historical ownership and evidence, escalate to provider/manual operations, and do not rewrite old transactions.
- Suspected credential exposure: rotate provider, database, JWT, email, Cloudinary, and privileged credentials through their owners; never print the exposed value.

## Manual actions still required

Provider approval, production credentials, production webhook registration, Easy Split activation, production vendor KYC/bank verification, commission approval, deployment, backup/PITR confirmation, and the first controlled live transaction remain manual. This repository does not perform any of them automatically.
