# RestoSphere Client Demo — Real UI Capture Plan

## Non-negotiable production rule

Every product frame is captured from the unmodified RestoSphere React application running locally at `http://localhost:5173`. No HTML/CSS recreation, alternative UI, or application-source change is used. Playwright intercepts API calls in memory with fictional, non-identifying sample data so no backend, production tenant, or payment provider is contacted.

## Client story

1. Short branded opening (under 5 seconds), then the actual Login page.
2. Sign in through the real Login form with a safe demo session.
3. Use the real Dashboard, Outlet selector, Table Management, Create Order, Orders, Kitchen Display, Billing/Payment, and receipt-related UI as the operational spine.
4. Continue to real Inventory & Recipes, Staff, Customer CRM, Loyalty, Online Orders, Reports, Business Intelligence, RestoSphere Intelligence, Central Kitchen, and Outlets pages only if rendered normally from the actual application.
5. Finish with a concise real-UI overview and closing card.

## Safe capture protocol

- Sample restaurant and people are fictional, and contact fields use non-routable `example` values.
- All request writes are intercepted in memory; no data is persisted.
- Hotel UPI is shown only as the existing guarded interface, without a usable VPA, payload, or live QR.
- Any screen that reports a loading/error/empty state unexpectedly will be removed rather than included.

## Style

Capture at 1920×1080. Preserve the actual RestoSphere sidebar, header, cards, iconography, typography, responsive desktop layout, tables, forms, and colors. Add only gentle page cuts, cursor movement, and small, non-covering lower-third captions.

## Target duration

Approximately 3–5 minutes, with longer holds for order creation, KDS, billing, inventory/recipes, and reports.
