# RestoSphere Pilot Handover Checklist

Restaurant: `[RESTAURANT NAME]`  
Outlet(s): `[OUTLET NAME]`  
Handover date: `[DATE]`

## Configuration Handover

- [ ] Restaurant identity confirmed.
- [ ] Outlet names/codes/addresses confirmed.
- [ ] Business hours/timezone confirmed.
- [ ] Menu/categories/items/prices/availability confirmed by client.
- [ ] Tables/capacities/sections confirmed.
- [ ] Kitchen/KDS setup confirmed.
- [ ] Staff list, roles, and outlet assignments confirmed.
- [ ] Tax/billing settings confirmed by client.
- [ ] Payment configuration owner identified.
- [ ] Inventory opening balances confirmed if inventory is in scope.
- [ ] Recipe mappings confirmed if recipes are in scope.
- [ ] QR labels generated and placed if QR is enabled.

## Access Handover

- [ ] Admin access delivered through the approved secure process.
- [ ] Staff access delivered through the approved secure process.
- [ ] No passwords, tokens, or payment secrets are stored in this document.
- [ ] Client knows how to change/revoke access.
- [ ] Outlet selection and access boundaries demonstrated.

## Workflow Handover

- [ ] Admin can manage menu, staff, tables, reports, and settings.
- [ ] Waiter can create and review Orders.
- [ ] Kitchen can process KDS/KOT states.
- [ ] Cashier can bill, take cash, process approved payment flows, and reconcile.
- [ ] Manager can handle operational escalation.
- [ ] One approved test Order → one KOT was demonstrated.
- [ ] Table occupancy/release behavior was demonstrated.
- [ ] Offline pending-sync/manual retry behavior was explained.

## Support Handover

- Support contact: `[ANOVA SUPPORT CONTACT]`
- Escalation hours/process:
- Severity definitions reviewed: [ ]
- Production support runbook reviewed: [ ]
- Request ID/order number/payment ID collection explained: [ ]
- Client instructed never to send passwords, tokens, payment signatures, or secrets: [ ]

## Known Limitations Disclosed

- Local performance benchmark is not a production capacity guarantee.
- Full offline transaction/payment/KOT processing is not supported; offline intent requires manual sync.
- Provider backup/PITR and external monitoring must be verified in provider dashboards.
- Live aggregator integrations are not claimed unless separately onboarded and validated.

## Acceptance

Client representative: ____________________  Date: __________

ANOVA implementation owner: ______________  Date: __________

Open issues and owners:
