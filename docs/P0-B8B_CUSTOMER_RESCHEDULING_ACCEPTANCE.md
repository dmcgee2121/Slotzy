# P0-B8B — Customer Rescheduling API and Interface

**Date:** 2026-10-18
**Disposition:** **PASS CANDIDATE** — secure PostgreSQL-backed customer rescheduling is wired through the private manage-link API and management interface. Browser/owner-dashboard acceptance remains to be run as a separate live session.

## Preflight

- Branch/HEAD: `restore-source-files` / `19aeef610edd9640e9a288d37d1b85dad9b84bc2`.
- Existing uncommitted reports and migration work were preserved.
- P0-B8A.1 verified the local disposable PostgreSQL migration and service-role-only RPC; no migration was added or applied in this task.
- The earlier password-change API timeout was rerun as part of the suite and passed, indicating an intermittent harness startup failure rather than an application defect.

## Implementation

- Added `PATCH /api/public/manage/reschedule`. It accepts only a management token header and `startISO`; it accepts no client-supplied booking identifier.
- The endpoint hashes the token, requires PostgreSQL mode, invokes `slotzy_reschedule_booking_by_manage_token_hash` through the Postgres adapter, maps outcomes to stable non-enumerating responses, rate-limits the route, and emits only safe observability fields.
- JSON storage explicitly refuses customer rescheduling instead of attempting an unsafe local fallback.
- Added a service-role RPC adapter method and a small safe response mapper.
- Enabled the existing customer-management reschedule UI. In API mode confirmation now calls the token-scoped endpoint directly; it does not call the staff schedule-update route and does not write bookings to local storage.
- Candidate slots are advisory. The private API/PostgreSQL RPC atomically revalidates availability, policy, conflicts, and the booking’s own exclusion at confirmation time.

## Security and notifications

The browser never receives a token hash and cannot select another booking by ID. Existing owner/barber schedule-update authorization is unchanged. No reschedule notification was added because the RPC’s minimal safe result intentionally omits contact/owner delivery data; adding one without a dedicated safe server-side lookup would broaden scope. Dev Outbox behavior therefore remains unchanged.

## Automated verification

| Command | Result |
| --- | --- |
| `npm --prefix server run test:storage` | PASS — 34/34 |
| `npm --prefix server run test:api` | PASS — 44/44 |

The API suite includes new safe response-contract tests. Static migration safety, existing cancellation behavior, staff authorization, and rate-limit policy checks all passed.

## Remaining verification

No browser-to-PostgreSQL or owner-dashboard acceptance was performed in this coding pass. It must be executed with `npm run local:e2e`, a synthetic booking and its private management link, then an approved synthetic owner login. No hosted traffic, reset, deletion, real email, commit, push, or deployment occurred.

## Files modified

- `server/src/index.js`, `server/src/storage/index.js`, `server/src/storage/postgresStore.js`, `server/src/storage/jsonStore.js`
- `server/src/publicManageReschedule.js`, `server/src/rateLimiter.js`
- `js/dataStore.js`, `js/client-manage.js`
- `server/package.json`, `server/test/manage-reschedule-api.test.js`, `server/test/rate-limiter.test.js`
- This report

**Recommendation:** **PASS CANDIDATE** for code and automated checks; complete live browser and owner-dashboard acceptance before final lifecycle sign-off.
