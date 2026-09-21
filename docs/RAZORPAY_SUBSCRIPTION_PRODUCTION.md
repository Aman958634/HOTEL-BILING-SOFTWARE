# RestoSphere Razorpay subscription payments

RestoSphere SaaS plans use the platform Razorpay merchant account only. They do not use Cashfree Easy Split, Razorpay Route, linked accounts, restaurant credentials, restaurant payouts, or the operational `Payment` ledger.

## Server variables

Configure these in the Render server environment, without committing values:

- `RAZORPAY_KEY_ID` — used when creating a platform subscription order and returned to Checkout.
- `RAZORPAY_KEY_SECRET` — used only on the server to create orders and verify Checkout signatures.
- `RAZORPAY_WEBHOOK_SECRET` — used only on the server for the Razorpay webhook signature.
- `BILLING_TEST_MODE=false` — required in production; test completion is not available there.

The existing production deployment is Render service `hotel-biling-software`, so its webhook URL is:

`https://hotel-biling-software.onrender.com/api/webhooks/razorpay`

In Razorpay Dashboard, create a webhook for that URL, use the exact `RAZORPAY_WEBHOOK_SECRET`, and enable `payment.captured`, `payment.failed`, and `order.paid`. Do not configure transfers, Route, linked accounts, or restaurant bank-account destination details for these events.

## Tenant endpoints

- `POST /api/v1/subscriptions/razorpay/create-order` with `{ "planId": "basic" }` and an `Idempotency-Key` header.
- `POST /api/v1/subscriptions/razorpay/verify-payment` with Razorpay Checkout's order ID, payment ID, and signature.

Both endpoints require an authenticated restaurant `admin`; restaurant context is taken only from the access token. Amount, duration, expiry, provider ownership, and plan price are server-controlled.
