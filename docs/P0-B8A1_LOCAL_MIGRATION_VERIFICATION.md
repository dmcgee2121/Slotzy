# P0-B8A.1 — Local Rescheduling Migration Verification

**Date:** 2026-10-18
**Disposition:** **PASS CANDIDATE** — the rescheduling RPC was applied and verified only on the existing disposable local Supabase/PostgreSQL instance.

## Docker recovery and local identity

Docker Desktop was installed but stopped: no Desktop/backend process was running and WSL reported `docker-desktop` as stopped. A normal non-destructive start of the existing Docker Desktop application restored the WSL2 engine and the already-existing `supabase_*_Slotzy` containers. No containers, images, volumes, or databases were recreated, removed, reset, or pruned.

Preflight confirmed:

- Supabase API: `http://127.0.0.1:54321`
- PostgreSQL port mapping: `127.0.0.1:54322` to the existing `supabase_db_Slotzy` container
- Database: `postgres`
- `public.slotzy_test_control.is_disposable`: `true`
- PostgreSQL: 17.11

The pre-existing live schema contained every referenced scheduling table, the create/cancel RPCs, and `bookings_provider_active_overlap`. Before the migration it held 7 shops, 8 services, 4 bookings, and 5 booking events. Those pre-existing records remained intact after migration application.

## Migration and compatibility finding

Applied [SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql](SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql) only to the verified local database.

The function is `public.slotzy_reschedule_booking_by_manage_token_hash(text, timestamptz)`. It locks the active token and its booking, validates token expiry/revocation, supported booking state, the existing cancellation-hours cutoff, future/advance-window constraints, canonical persisted duration, provider hours/timezone, time off, recurring blocks, and buffered active-booking conflicts. It updates the original booking, increments `reschedule_count`, sets `rescheduled_at`, records one `rescheduled` public-client event, and updates token last-use time. The existing PostgreSQL exclusion constraint remains the final same-interval concurrent safeguard.

Live ACL inspection found a Supabase-specific compatibility issue in the initial migration: explicit default grants for `anon` and `authenticated` remained after `REVOKE ... FROM public`. The migration was narrowly corrected to explicitly revoke both browser roles before granting only `service_role`, then reapplied locally. Final live ACL evidence was:

| Role | Execute permission |
| --- | --- |
| `service_role` | yes |
| `anon` | no |
| `authenticated` | no |

No tables, columns, RLS rules, or unrelated grants were changed.

## Database acceptance

Uniquely tagged `P0B8A1` synthetic fixtures were added to the disposable local database and deliberately retained; no deletion or reset was used.

- Valid token reschedule: `rescheduled`; original booking identity remained singular, new time persisted, `reschedule_count` advanced, and exactly one event was recorded.
- The old interval accepted a new synthetic booking after the move; attempting to reserve the new interval raised the existing exclusion safeguard inside a rolled-back probe transaction.
- Missing/invalid, expired, and revoked tokens all returned `invalid_token`.
- A cancelled booking returned `reschedule_unavailable`.
- Past, out-of-window, outside-hours, time-off, and recurring-block proposals returned `slot_unavailable`.
- Buffered and occupied proposals returned `booking_conflict`; failed proposals created no reschedule event or partial booking update.
- Two simultaneously launched database calls tried to move distinct active appointments to one target. Results were one `rescheduled`, one `booking_conflict`, and exactly one active appointment at that target.
- Cancellation followed by a reschedule attempt returned `cancelled` then `reschedule_unavailable`; it produced one cancellation event and no reschedule event.

## Regression results

| Command | Result |
| --- | --- |
| `npm --prefix server run test:storage` | PASS — 34/34 |
| `npm --prefix server run test:api` | FAIL — 41/42; unrelated `auth-change-password-api` test server-start timeout after 10 seconds |

The reset-capable Postgres integration suite was intentionally not run because this assignment forbids database resets. The focused live SQL checks above are non-destructive apart from retained synthetic fixtures and provide actual function verification.

## Files modified

- `docs/SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql`
- `server/test/migration-safety.test.js`
- `docs/P0-B8A1_LOCAL_MIGRATION_VERIFICATION.md`

## Remaining risks

- This foundation has no Express public endpoint, storage-adapter method, notification dispatch, or customer UI yet; P0-B8 must add those without exposing staff routes.
- The API regression failure must be diagnosed independently before claiming a full API-suite pass.
- Retained synthetic local fixtures are intentional to honor the no-deletion restriction.

## Final Git status

All work is uncommitted. The existing untracked P0-B7 report was preserved. No hosted service, real SMTP delivery, deployment, reset, destructive operation, commit, or push occurred.

**Recommendation:** **PASS CANDIDATE** for the database foundation, subject to the remaining API regression and the later customer API/UI implementation.
