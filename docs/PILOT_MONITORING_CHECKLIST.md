# RestoSphere Pilot Monitoring Checklist

Use this checklist for the first real restaurant pilot. It is an operational observation guide, not a synthetic load plan. Do not perform real digital payment verification unless the payment operation is explicitly approved.

## Start of Day

- [ ] Confirm the deployment is the expected release and record the commit/deployment ID.
- [ ] `GET /api/v1/health` returns HTTP 200.
- [ ] `GET /api/v1/ready` returns HTTP 200.
- [ ] Check recent startup and MongoDB lifecycle logs for fatal errors or disconnect loops.
- [ ] Sign in with an approved pilot account.
- [ ] Confirm the expected restaurant is visible.
- [ ] Confirm the selected outlet is authorized and correct.
- [ ] Load the menu and confirm representative items are available.
- [ ] Load tables and confirm table numbers/statuses are plausible.
- [ ] Open KDS/KOT view and confirm the realtime connection is live.
- [ ] Confirm no unexpected 5xx, repeated 429, or Socket.IO auth failures are present before service.

## During Service

### Orders

- [ ] Watch order-create failures by request ID and order number.
- [ ] Investigate any Order without its expected KOT.
- [ ] Investigate duplicate-order or duplicate-KOT reports immediately.
- [ ] Confirm table state remains consistent when multiple orders exist for one table.
- [ ] Check slow-request logs for sustained abnormal order latency.
- [ ] Treat a single slow request as a signal; investigate sustained patterns before escalation.

### KOT / KDS

- [ ] Confirm new orders appear in the correct outlet KDS.
- [ ] Verify KOT lifecycle transitions are visible to authorized staff.
- [ ] Watch for KOT creation errors and Socket.IO reconnect/authentication failures.
- [ ] Confirm no event appears in another outlet’s room.

### Billing / Payments

- [ ] Confirm bill totals reference server-calculated Order totals.
- [ ] For cash payments, verify the approved cash workflow and receipt reference.
- [ ] Do not perform an unapproved real digital payment as a monitoring check.
- [ ] Escalate payment verification failures with payment ID, order number, provider reference, and request ID.
- [ ] Watch for reconciliation mismatches or duplicate-payment suspicion.

### Tables

- [ ] Confirm first active dine-in order occupies the table.
- [ ] Confirm multiple active orders do not release the table prematurely.
- [ ] Confirm settling/cancelling one of several active orders leaves the table occupied.
- [ ] Confirm the final settled/cancelled active order releases the table according to policy.

### Inventory / Operations

- [ ] Watch for inventory movement or recipe-deduction errors.
- [ ] Do not manually overwrite stock quantities as a first response.
- [ ] Use movement history, audit actor, and order references when investigating.

### Errors / Latency

- [ ] Review request IDs for all investigated failures.
- [ ] Watch unexpected 5xx responses.
- [ ] Watch repeated 429 events without changing rate limits immediately.
- [ ] Watch MongoDB disconnect/reconnect/error events.
- [ ] Watch Socket.IO authentication failures and reconnect loops.
- [ ] Watch KOT and payment failure events.
- [ ] Record route, duration, restaurant/outlet, order number, and request ID; never record tokens or secrets.

## End of Day

- [ ] Compare the day’s order count against the restaurant’s POS/back-office expectation.
- [ ] Compare revenue totals against approved business reports.
- [ ] Reconcile cash and payment records.
- [ ] Review cancelled/rejected orders and unusual status transitions.
- [ ] Review Order/KOT mismatch reports; there should be no unexplained mismatch.
- [ ] Review inventory movements, deductions, wastage, and unusual adjustments.
- [ ] Review error logs, 5xx events, DB disconnects, KOT failures, payment failures, and rate-limit events.
- [ ] Confirm backup/PITR status in the provider dashboard. Source code cannot prove provider backups.
- [ ] Record pilot observations, request IDs, order numbers, payment IDs, and follow-up owners.

## Thresholds For Investigation

Open an incident investigation for any of the following:

- Any cross-tenant or cross-outlet data exposure.
- Any Order created without the expected KOT.
- Any duplicate Order or duplicate KOT.
- Any payment verification or reconciliation integrity failure.
- Any unexplained production 5xx response affecting order/payment workflows.
- MongoDB readiness failure or repeated disconnect/reconnect loop.
- Repeated Socket.IO authentication failures or outlet-room leakage.
- Sustained abnormal order latency compared with normal pilot observations.
- Repeated 429 responses affecting legitimate POS traffic.

Do not treat the local Step 28 benchmark as a production capacity guarantee. The known local isolated median 20-order p95 is approximately 1254 ms; production performance must be measured from real pilot telemetry without synthetic load against the live system.

## Pilot Rollout

### Day 1

- Limited trained users only.
- One restaurant and approved outlet scope.
- Active support owner monitoring health, readiness, errors, KDS, payments, and tables.
- No expansion based only on a successful login; require a stable service day.

### Days 2–3

- Continue normal pilot operations if Day 1 has no critical correctness, security, payment, or reliability incident.
- Review real latency and error evidence daily.
- Resolve any Order/KOT mismatch before adding users or outlets.

### Days 4–7

- Continue observation and collect real production evidence.
- Review readiness, 5xx, DB lifecycle, KOT/payment failures, Socket.IO behavior, and support volume.
- Compare operational reports with restaurant records.

### Expansion Gate

Expand to another restaurant or outlet only when:

- No cross-tenant or cross-outlet issue occurred.
- No duplicate Order/KOT issue occurred.
- No payment integrity issue occurred.
- No unexplained Order/KOT mismatch occurred.
- No sustained readiness or Mongo instability occurred.
- Support can trace incidents using request IDs, order numbers, and payment references.
- Provider backup/PITR and restore readiness have been confirmed externally.
