# Table Lifecycle Invariants

Table occupancy is derived from authoritative Orders. A pending, confirmed, preparing, ready, or unsettled served dine-in Order keeps a table occupied. Takeaway, delivery, and pickup Orders do not occupy a table unless an explicit valid workflow assigns one.

A table may have multiple active Orders. Settling or cancelling one Order reconciles the table against all remaining active Orders. The table becomes available only when no active Order remains. `currentOrder` points to the latest active Order when one exists and is cleared when the last active Order is gone.

Offline pending intent does not change server table state. Only authoritative Order acceptance can occupy a table. Table updates and realtime events remain restaurant/outlet scoped; database queries remain the source of truth.
