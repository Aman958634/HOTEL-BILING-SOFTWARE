# Step 31 Performance Validation

Environment: local isolated MongoDB only

Database: `restosphere_load_test`

Production database used: no

The harness runs progressively and verifies database truth by run ID, including Order count, KOT count, duplicate counts, status counts, and latency.

## Final direct run

Run ID: `load-20260906164135951-98ts8l`

| Stage | Success | Failures | P50 | P95 | P99 | RPS | Orders | KOTs | Duplicate Orders | Duplicate KOTs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | 4 | 0 | 347 ms | 361 ms | 361 ms | 11.08 | 5 | 5 | 0 | 0 |
| 10 | 5 | 0 | 376 ms | 385 ms | 385 ms | 12.99 | 10 | 10 | 0 | 0 |
| 20 | 10 | 0 | 1095 ms | 1141 ms | 1141 ms | 8.76 | 20 | 20 | 0 | 0 |
| 50 | 30 | 0 | 1287 ms | 1499 ms | 1513 ms | 19.83 | 50 | 50 | 0 | 0 |
| 100 | 50 | 0 | 1494 ms | 1579 ms | 1636 ms | 30.56 | 100 | 100 | 0 | 0 |

All stages returned HTTP `201` for distinct logical orders. No unexpected `409`, `429`, 5xx, or timeout was observed.

The 20-order p95 target of `<=1000 ms` remains unmet. This is a local benchmark result, not a production capacity claim. Correctness through 100 orders was verified from MongoDB, including `100` unique order numbers and `100` KOTs.
