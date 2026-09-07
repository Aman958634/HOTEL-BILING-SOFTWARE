# RestoSphere Pilot Go-Live Checklist

Restaurant: `[RESTAURANT NAME]`  
Outlet: `[OUTLET NAME]`  
Go-live date: `[GO-LIVE DATE]`  
Support owner: `[ANOVA SUPPORT CONTACT]`

## Before Opening

- [ ] Approved restaurant/outlet scope confirmed.
- [ ] Subscription/trial state confirmed.
- [ ] Admin login verified.
- [ ] Staff logins and outlet assignments verified.
- [ ] `/api/v1/health` returns `200`.
- [ ] `/api/v1/ready` returns `200`.
- [ ] Frontend loads from the production URL.
- [ ] Menu categories/items/prices/availability confirmed.
- [ ] Tables exist with initial status `AVAILABLE`.
- [ ] KDS is open and connected.
- [ ] Receipt/printer workflow checked where supported.
- [ ] QR labels are attached to the correct tables where enabled.
- [ ] Backup internet/hotspot is available.
- [ ] No unresolved P0/P1 incident exists.

## One Approved Test Order

Use only an approved pilot test table/item.

- [ ] Create one dine-in Order.
- [ ] Confirm the generated order number.
- [ ] Confirm table becomes occupied.
- [ ] Confirm exactly one KOT appears in the correct KDS/outlet.
- [ ] Confirm item, quantity, table, and notes.
- [ ] Generate/inspect the bill.
- [ ] Run the approved cash test if included in the pilot plan.
- [ ] Confirm final table behavior after settlement.
- [ ] Confirm the Order/report entry is expected.
- [ ] Record the request ID/order number for evidence.

## Staff Readiness

- [ ] Admin understands settings, menu, staff, tables, reports, and support escalation.
- [ ] Waiter understands correct outlet selection, order creation, notes, and duplicate-submit avoidance.
- [ ] Kitchen understands `NEW`, `PREPARING`, `READY`, and completion workflow.
- [ ] Cashier understands bills, cash, approved digital flow, partial/split payments, receipts, and reconciliation.
- [ ] Manager understands cancellations, staff, payments, inventory, reports, and incident escalation.
- [ ] Staff understand that offline mode saves pending intent and requires manual sync; it does not create an offline KOT/payment.

## Opening Decision

Release service only when the approved owner signs off:

- Operations owner:
- Restaurant admin:
- ANOVA implementation owner:
- Open issues:
- Decision: `GO` / `GO WITH MITIGATION` / `HOLD`

## During Day 1

- [ ] Monitor health/readiness.
- [ ] Monitor Order/KOT mismatch.
- [ ] Monitor 5xx, DB disconnect, payment failure, Socket.IO auth/reconnect, and repeated 429 events.
- [ ] Record request IDs and order numbers for incidents.
- [ ] Do not run synthetic load against the live pilot.

## End of Day

- [ ] Order count sanity check.
- [ ] Revenue and payment reconciliation.
- [ ] Cancelled/rejected order review.
- [ ] Inventory sanity review if in scope.
- [ ] Error/slow-request log review.
- [ ] Staff feedback captured.
- [ ] Day-1 review owner assigned.
