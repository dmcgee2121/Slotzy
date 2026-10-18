# P0-B8A — Secure Rescheduling Database Foundation

**Date:** 2026-10-18
**Disposition:** **BLOCKED** — migration source and static safety coverage are complete, but the verified disposable local Supabase/PostgreSQL stack was unavailable before any database connection or mutation.

## Architecture findings

- `bookings` already preserves the needed identity and metadata: provider, shop, service, canonical `duration_minutes`, `rescheduled_at`, `rescheduled_by_member_id`, and `reschedule_count`.
- `booking_manage_tokens` stores only a token hash and supports expiry, revocation, and `last_used_at`. Public authority must be derived from that hash, never a client booking ID.
- `booking_events` is append-only lifecycle history. Existing public cancellation uses `before_state` and `after_state` JSON snapshots.
- Active `booked` and `confirmed` bookings have a PostgreSQL exclusion constraint on provider and appointment range. It remains the final concurrent same-interval safeguard.
- Existing booking policy is `allow_same_day`, `max_days_advance`, `cancel_hours`, and `buffer_minutes`. The current customer-side reschedule behavior treats `cancel_hours` as the reschedule cutoff; the migration preserves that rule rather than adding a new policy.
- Existing atomic booking checks weekly provider availability, time off, recurring blocks, canonical duration, and active overlap. The staff schedule update remains independently authenticated and was not changed.
- Database RPCs use `security definer`, `set search_path = public`, revoke public execution, and grant only `service_role`. Browser roles receive no direct database authority.

## Migration

Created `docs/SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql`.

It adds `public.slotzy_reschedule_booking_by_manage_token_hash(text, timestamptz) returns jsonb`. In a single PostgreSQL function it locks the active token and its appointment, validates state/cutoff/future time/window/provider schedule/time-off/recurring blocks/buffer conflicts, updates the original booking, increments `reschedule_count`, sets `rescheduled_at`, writes a `rescheduled` public-client event, and records token use.

The function returns only a safe booking/previous-booking envelope; it never returns a token hash. It creates no tables, columns, policies, or grants for `anon`/`authenticated`, and does not weaken staff authorization.

## Verification

| Command | Result |
| --- | --- |
| `npm --prefix server run test:storage` | PASS — 34/34 |
| `npx --yes supabase status --output env` | BLOCKED before connection — Docker Desktop Linux engine pipe `//./pipe/dockerDesktopLinuxEngine` was unavailable |

The failed Supabase status command prevents independently confirming the required loopback API (`127.0.0.1:54321`), database (`127.0.0.1:54322/postgres`), and `slotzy_test_control.is_disposable=true` marker. Therefore the migration was **not applied**, no SQL fixture was created, no reset-capable test command was run, and no hosted target was contacted.

## Files changed

- `docs/SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql` — additive RPC migration.
- `server/test/migration-safety.test.js` — static additive/authorization/locking/policy/event assertions.
- `docs/P0-B8A_RESCHEDULE_DATABASE_FOUNDATION.md` — this report.

## Remaining risks

- Database-level behavior, including concurrent reschedules, simultaneous cancellation/reschedule, PostgreSQL syntax, event persistence, and privilege inspection remain unverified until the local Docker Supabase stack is available and passes the explicit loopback/disposable preflight.
- No Express public endpoint, storage adapter binding, or customer UI was added by design; those belong to the later P0-B8 implementation after this foundation is verified.
- The canonical bootstrap schema must be followed by this versioned migration in every approved environment; this task did not alter any environment.

## Final Git status

Untracked pre-existing report preserved: `docs/P0-B7_BOOKING_LIFECYCLE_ACCEPTANCE.md`.

New uncommitted P0-B8A files are listed above. No commit, push, deploy, hosted access, email delivery, reset, deletion, or database migration application occurred.

**Recommendation:** **BLOCKED** pending restoration of the disposable local Supabase/PostgreSQL stack and successful safety preflight.
