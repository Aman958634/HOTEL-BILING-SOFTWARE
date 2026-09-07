# RestoSphere Pilot Staff Training

Restaurant: `[RESTAURANT NAME]`  
Outlet: `[OUTLET NAME]`  
Training date: `[DATE]`

## Shared Rules

- Confirm the selected outlet before operational work.
- Never share passwords, access tokens, refresh tokens, or payment secrets.
- Do not click submit twice. If the result is unclear, use the order number/request support process before retrying.
- Server values are authoritative for price, tax, table state, payment state, inventory, and KOT.
- Offline mode is device-local pending intent with manual retry. It does not create a server Order, KOT, payment, or inventory movement offline.
- Report incidents with time, outlet, order number, screenshot, and request ID when visible.

## Admin Training

- Login and select the correct outlet.
- Restaurant settings and receipt identity.
- Categories/menu items, prices, availability, and preparation details.
- Tables and table lifecycle.
- Staff creation, role assignment, and outlet access.
- Inventory/recipes where in scope.
- Reports and reconciliation.
- Notifications and support escalation.

## Waiter Training

- Select the correct outlet.
- Open the correct table.
- Create an Order with the correct items, quantities, notes, and order type.
- Verify the order confirmation before moving on.
- Check order/KOT state without creating a duplicate.
- Handle a disconnected network by preserving the pending draft/intent and manually retrying when the server is reachable.

## Kitchen Training

- Keep KDS visible and connected.
- Process `NEW` orders into `PREPARING`, then `READY`, then completion according to the current workflow.
- Read item notes and quantities carefully.
- Report a missing KOT using the Order number; do not create a duplicate ticket manually.
- Confirm that the KDS outlet is correct.

## Cashier Training

- Open the correct Order/bill.
- Confirm totals, tax, discount, and payment method.
- Use approved cash workflow.
- Use approved digital payment workflow only when configured by authorized staff.
- Understand partial/split payment behavior.
- Print/download receipts where supported.
- Escalate payment mismatches with Order number, payment ID, and provider reference; never edit financial status directly.

## Manager Training

- Monitor orders, KDS, tables, payments, inventory, and reports.
- Authorize cancellations/discounts according to policy.
- Review end-of-day reconciliation.
- Handle table-stuck, payment-mismatch, inventory-mismatch, and KOT-missing incidents using the production support runbook.
- Decide whether a pilot issue is P0, P1, P2, or P3 and escalate accordingly.

## Completion Record

- Admin trained: [ ]
- Waiter trained: [ ]
- Kitchen trained: [ ]
- Cashier trained: [ ]
- Manager trained: [ ]
- Questions/actions remaining:
