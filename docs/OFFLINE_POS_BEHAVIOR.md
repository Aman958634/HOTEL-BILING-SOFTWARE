# Offline POS Behavior

RestoSphere stores a device-local, versioned pending order intent when an authenticated operator loses the network during order creation. The intent is scoped by user, restaurant, and outlet and uses one stable idempotency key.

## Works Offline

- Compose an order in the existing order workflow.
- Save a bounded pending intent locally when the server cannot be reached.
- Keep multiple pending intents independently.
- Preserve the idempotency key across refresh and manual retry.
- Review the pending-sync count from the Orders page.
- Manually retry synchronization when the server is reachable.

## Does Not Work Offline

- No authoritative Order is created offline.
- No order number is generated offline.
- No KOT/KDS ticket is created offline.
- No table occupancy is changed offline.
- No payment success is recorded offline.
- No inventory, recipe, or loyalty mutation is performed offline.
- No client price, tax, discount, payment, or stock value becomes authoritative.
- No automatic submission occurs on the browser `online` event.

During manual sync, the existing server create-order endpoint validates current menu availability, price, tax, discount, table state, tenant scope, outlet scope, and idempotency. A lost response can be retried with the same key and reconciles to the original Order.

## Conflicts and Failure

Network errors, timeouts, 409 conflicts, 422 validation errors, 429 responses, and 5xx responses preserve the pending record with a bounded safe error category. Operators resolve business conflicts using current server data before retrying.

The queue has a maximum of 50 pending records per browser storage and rejects additional saves rather than silently discarding intents. Malformed or unsupported records are ignored by the versioned reader.

## Device-Local Limitation

Pending intents live in the current browser/device only. They are not synchronized across devices. Losing the device or clearing browser storage can lose unsynced intent. Logout clears the existing local draft/session behavior; pending order ownership must not be transferred to another user.
