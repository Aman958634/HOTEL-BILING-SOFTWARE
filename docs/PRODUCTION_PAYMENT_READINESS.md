# Production payment readiness checklist

This file intentionally contains variable names only. No secrets or values are stored here.

## Backend variables

- NODE_ENV
- PORT
- MONGO_URI
- MONGODB_URI
- CLIENT_URL
- ALLOWED_ORIGINS
- CASHFREE_ENV
- CASHFREE_PAYMENTS_ENABLED
- CASHFREE_APP_ID
- CASHFREE_SECRET_KEY
- CASHFREE_API_VERSION
- CASHFREE_EASY_SPLIT_ENABLED
- CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED
- CASHFREE_RETURN_URL
- CASHFREE_RETURN_URL_BASE
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- PUBLIC_MENU_CONTEXT_SECRET

## Frontend verification variables

- VITE_API_URL
- VITE_SOCKET_URL

## Deployment notes

- Production backend URL must be HTTPS and non-local.
- Production frontend origin must be an explicit HTTPS URL, not localhost.
- No real credentials or sandbox values should be committed to source control.
- Cashfree production activation remains a manual provider-side action.

## Render backend checklist

- Node version: use the repository-supported Node 20 runtime or newer compatible LTS.
- Build command: `npm install` from the `server` directory.
- Start command: `npm start` from the `server` directory.
- Health check path: `/api/v1/health`.
- Readiness path: `/api/v1/ready`.
- Configure the backend variable names listed above in Render only.
- Keep `CASHFREE_ENV=production` separate from sandbox verification environments.
- Keep `CASHFREE_PAYMENTS_ENABLED=false` until provider activation and approval are complete.
- Keep `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED=false` until Easy Split production approval is complete.

## Vercel frontend checklist

- Configure `VITE_API_URL` as the HTTPS production API base URL.
- Configure `VITE_SOCKET_URL` as the HTTPS production socket URL.
- The production Vite build rejects missing, localhost, and loopback URLs.
- Confirm `vercel.json` SPA rewrites remain enabled for client-side routes.
- Never configure backend credentials in Vercel frontend variables.

## Cashfree production activation checklist

- Complete Cashfree production merchant activation.
- Obtain production-only `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`.
- Configure the production webhook endpoint and signature settings.
- Complete Easy Split production activation separately.
- Onboard one real vendor and complete KYC and bank verification.
- Approve the commission configuration before enabling live payment creation.

## Kill switches and rollback

- `CASHFREE_PAYMENTS_ENABLED=false` blocks new Cashfree order creation while read-only history remains available.
- `CASHFREE_EASY_SPLIT_PAYMENTS_ENABLED=false` blocks new Easy Split allocation/payment creation.
- On any mismatch, disable new payment creation first, preserve read-only reconciliation, and investigate provider references.
- Do not edit payment or settlement history manually as a rollback action.

## First live transaction runbook

1. Enable Cashfree production only after provider activation is confirmed.
2. Onboard exactly one real restaurant vendor.
3. Verify vendor status is `ACTIVE` and bank settlement status is ready.
4. Configure and review the intended commission.
5. Deliberately enable the payment and Easy Split kill switches.
6. Create one small controlled real order and complete one controlled payment.
7. Verify payment is `PAID` and allocation is `ALLOCATED`.
8. Verify platform and vendor shares equal the gross amount.
9. Wait for the provider settlement lifecycle.
10. Record a UTR or settlement reference only when Cashfree supplies it.
11. Disable new payments immediately if any amount, status, or reference mismatches.

## Manual provider actions remaining

- Merchant production approval and credentials
- Easy Split production approval
- Production webhook registration
- Vendor KYC and bank verification
- Commission approval
- Controlled first live transaction
