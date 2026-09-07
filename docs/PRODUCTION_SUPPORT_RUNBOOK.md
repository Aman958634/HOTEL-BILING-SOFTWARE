# RestoSphere Production Support Runbook

## Safety

- Use `GET /api/v1/health` for liveness and `GET /api/v1/ready` for traffic readiness.
- Never run destructive tests or load tests against production customer data.
- Collect request IDs, order numbers, payment IDs, external references, restaurant IDs, and outlet IDs. Never collect tokens, passwords, cookies, signatures, or database credentials.
- Process-local metrics reset on restart and are not historical monitoring.

## Severity

- **SEV-1:** Core platform unavailable or restaurants cannot process orders.
- **SEV-2:** Major capability degraded, such as KDS, payments, or realtime updates.
- **SEV-3:** Limited restaurant, outlet, or user impact.
- **SEV-4:** Minor reporting or non-critical UI issue.

## Backend Unavailable

**Symptoms:** health fails, readiness fails, or deployment is not serving traffic.

**First checks:** deployment logs, `/api/v1/health`, `/api/v1/ready`, startup configuration, and Mongo connection lifecycle events.

**Recovery:** stop routing traffic to an unready instance, correct configuration, redeploy or roll back to the last known healthy version, then verify health, readiness, authentication, and a safe POS smoke.

**Rollback trigger:** repeated startup failure, fatal process errors, or persistent 5xx responses.

## MongoDB Unavailable

**Symptoms:** readiness returns `503`; API routes return a controlled `503` database-unavailable response.

**First checks:** DB lifecycle logs, provider status, network allowlist, and the configured variable name. Do not print or paste the URI.

**Recovery:** restore connectivity or provider service. The application should recover when the connection returns; verify readiness before restoring traffic.

## Login Failures

Check the request ID, route status, rate-limit events, auth configuration names, and account activity. Do not reset credentials from logs. A network failure must not be treated as a confirmed `401`.

## Order Creation Failure

Locate the request ID, restaurant/outlet, order number if allocated, and external order ID. Check the structured error event and whether an Order exists. Do not replay a request with a new idempotency key until the original state is understood.

## Order Created but KOT Missing

1. Locate the Order by `orderNumber`.
2. Verify the authoritative Order exists and record its `_id`.
3. Locate the KOT by `orderId`.
4. Inspect request ID and KOT failure logs.
5. Check KDS and Socket.IO room health.
6. Do not blindly create a second KOT.
7. Use only an approved idempotent recovery path.

## KDS / Realtime Failure

Check Socket.IO authentication rejection events, outlet room scope, browser network errors, and the authoritative order/KOT state. Polling/database state remains authoritative. Do not grant users arbitrary room joins.

## Payment Mismatch

Correlate Order, Payment, gateway reference, idempotency key, and reconciliation records. Use the authorized refund/reconciliation workflow. Never directly edit payment or order status as first-line recovery.

## Duplicate Payment Suspicion

Compare internal payment ID, transaction ID, gateway reference, and idempotency key. Preserve the original record and escalate through reconciliation. Do not issue a second capture or refund without authorization.

## Inventory Mismatch

Review stock movement history, recipe deduction, receipts/GRN, wastage, adjustments, actor, and timestamps. Never overwrite quantity silently; use an authorized adjustment or reversal.

## Table Stuck Occupied

Inspect active orders for the table, current-order reference, completed/settled orders, cancelled orders, and the existing table reconciliation service. Avoid manual DB mutation except as a documented last resort.

## Provider / Webhook Failure

Use provider name, external order ID, restaurant/outlet mapping, request ID, and event outcome. Do not log or request provider credentials or full payloads.

## High Latency

Use slow-request logs with request ID, route, status, and duration. For order latency, correlate order number and restaurant/outlet. Treat the Step 28 local benchmark as a capacity signal, not a production guarantee.

## Rate-Limit Spike

Look for `RATE_LIMIT` events by route and request ID. Do not disable or raise limits as the first response. Determine whether traffic is legitimate, abusive, retried, or misconfigured.

## Deployment Regression

Check startup, Mongo connection, health, readiness, auth, safe POS smoke, KDS/realtime sanity, 5xx rate, and slow requests. Roll back when core order processing or readiness is unsafe.

## Incident Record

- Incident ID:
- Start time / resolution time:
- Environment:
- Severity:
- Affected restaurant/outlet:
- Symptoms and impact:
- Request IDs:
- Order/KOT/payment/external references:
- Root cause:
- Immediate mitigation:
- Permanent fix:
- Regression test:
- Monitoring improvement:
- Owner:

## Post-Incident Review

For SEV-1/SEV-2 document what happened, root cause, safeguard behavior, detection and recovery times, permanent correction, regression coverage, and monitoring improvements. Keep the review factual and non-blaming.
