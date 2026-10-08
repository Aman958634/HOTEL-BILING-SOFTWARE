# 5-day to 7-day trial production migration

## Safety guarantees

The one-time migration selects only active subscriptions whose stored `metadata.trialDurationDays` is exactly `5`. It adds exactly 172800000 milliseconds (48 hours) to the stored `trialEndDate`, leaves `trialStartDate` unchanged, changes the duration label to `7`, and writes `metadata.trialExpiryExtendedForSevenDayPolicyV1`.

Paid, expired, cancelled, suspended, legacy, and already-seven-day subscriptions are excluded. The marker and atomic compare-and-set filter make retrying safe: an already-migrated row cannot receive another 48 hours.

## Production runbook

1. Deploy the backend first. Request-time entitlement validation continues to read the persisted expiry timestamp.
2. Create and verify a MongoDB Atlas snapshot or PITR recovery point. Record its provider snapshot/restore-point identifier in the change record. If policy requires a dump, verify it restores to an isolated target; never restore over production.
3. Run the read-only preflight from `server`:

   ```powershell
   node scripts/migrateTrialFiveToSevenDays.js
   ```

   Review every sample: `newTrialEndDate` must be exactly 48 hours after `originalTrialEndDate`; `trialStartDate` must be unchanged.
4. Apply only after the backup is verified:

   ```powershell
   $env:TRIAL_7_DAY_BACKUP_REFERENCE = "atlas-snapshot-or-pitr-id"
   $env:CONFIRM_TRIAL_7_DAY_EXTENSION = "YES"
   node scripts/migrateTrialFiveToSevenDays.js --apply
   ```

   The guarded command refuses to write without both values and exits non-zero if a row changes while it is being processed.
5. Rerun the read-only preflight. It should report `eligible: 0`. Verify representative accounts: unchanged start, expiry two days later, `7-Day Free Trial` heading, and a continuing countdown based on that expiry.
6. If rollback is needed, use the verified provider recovery point following [the production recovery runbook](PRODUCTION_RECOVERY.md). Do not run a blanket subtraction update: it could affect manually extended or subsequently changed records.

## Checks before deployment

Run `npm run test:trial`, `npm run test:trial-migration`, and `npm run test:subscription-entitlement` in `server`; run `npm run test:trial-countdown` and `npm run build` in `client`.
