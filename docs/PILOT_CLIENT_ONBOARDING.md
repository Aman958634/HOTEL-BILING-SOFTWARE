# RestoSphere Pilot Client Onboarding

Use this template for `[RESTAURANT NAME]`, `[OUTLET NAME]`, and `[GO-LIVE DATE]`. Do not put passwords, JWTs, payment secrets, bank credentials, or SMTP credentials in this document.

## 1. Client Information

- Legal/display restaurant name:
- Owner/contact person:
- Operations contact:
- Phone:
- Email:
- Address:
- GSTIN, if applicable and confirmed by client:
- FSSAI, if relevant to the client workflow:
- Logo asset:
- Currency: Confirm application-supported currency.
- Timezone:
- Business hours:
- Number of outlets:
- Support contact and escalation owner:

## 2. Outlet Information

Repeat for each outlet:

- Outlet name:
- Outlet code:
- Address/contact:
- Timezone/business hours:
- Tables and seating areas:
- Kitchen/KDS location:
- Staff assigned:
- Payment configuration owner:
- QR ordering enabled: Yes/No

## 3. Access and Subscription

1. Super Admin creates the restaurant through the protected Super Admin route.
2. Create or associate the restaurant administrator using protected user management.
3. Confirm trial/subscription state and plan with the client.
4. Deliver initial access through the approved secure credential process.
5. Require the user to change any temporary credential immediately.
6. Confirm the user sees only the authorized restaurant and outlets.

Never send credentials through this checklist, email, chat, or source control.

## 4. Business Settings

Configure only fields supported by the current restaurant settings module:

- Restaurant display identity
- Address and contact
- Receipt/invoice information
- Currency/timezone where supported
- Tax/billing values confirmed by the client
- Business hours where supported
- Logo where supported

The client remains responsible for confirming applicable tax and legal configuration.

## 5. Menu Setup

Collect and validate:

- Categories
- Item names/descriptions
- Server-authoritative prices
- Availability
- Vegetarian/non-vegetarian classification where used
- Preparation time where used
- Images/tags where supported
- Outlet availability where supported

Validate one representative item in a real order before go-live. Do not import client totals as authoritative.

Bulk menu import is not part of the verified current onboarding workflow. Use the existing menu/category management screens for the first pilot unless a separately approved importer exists.

## 6. Tables

For each table:

- Table number/name
- Capacity
- Floor
- Section
- Outlet
- Initial status: `AVAILABLE`

Verify multiple active orders per table, settlement/cancellation behavior, and final release before opening service.

## 7. Staff and Permissions

Create staff with least privilege:

- Restaurant Admin: restaurant configuration and approved administration
- Manager: broader operational management
- Cashier: billing and payment workflows
- Chef: KOT/KDS workflows
- Waiter: approved table/order workflows
- Delivery: delivery-scoped workflow
- Inventory Manager: inventory/procurement workflows
- Receptionist/Staff: only the modules granted by the existing role model

Confirm outlet assignment for every staff member. Do not give every employee admin access.

## 8. Kitchen and KDS

- Confirm kitchen area/station arrangement supported by the current module.
- Verify a test order appears as `NEW`.
- Verify the approved kitchen lifecycle: `PREPARING`, `READY`, and completion behavior.
- Confirm outlet-scoped realtime behavior.

## 9. Billing and Payments

- Confirm tax, discount, service-charge, and receipt requirements.
- Run one approved cash test order in a safe pilot context.
- Configure digital payment provider settings only through secure provider/deployment configuration.
- Never request gateway secrets in client documents.
- Confirm partial/split payment workflow if the client uses it.
- Confirm reconciliation ownership and escalation.

No real customer payment is part of onboarding validation.

## 10. Inventory and Recipes

If inventory is in pilot scope, collect from restaurant staff:

- Item/ingredient
- Unit/base unit
- Opening quantity
- Reorder level where supported
- Supplier where supported
- Recipe mapping and supported units

Opening stock is client-provided. Do not fabricate inventory values.

## 11. QR Ordering

If enabled:

1. Generate the QR through the protected table workflow.
2. Label it with the correct table/outlet.
3. Scan from a customer device.
4. Confirm the menu maps to the correct restaurant/outlet/table.
5. Place one approved test QR order.
6. Verify one Order and one KOT only.

## 12. Dependencies and Current Limitations

- Server remains authoritative for prices, taxes, discounts, tables, inventory, payments, Order IDs, and KOTs.
- Offline mode preserves local intent and supports manual sync; it does not create authoritative offline Orders, KOTs, payments, or inventory mutations.
- Provider backups/PITR and monitoring must be verified in provider dashboards.
- Production capacity is not established by local load tests.
