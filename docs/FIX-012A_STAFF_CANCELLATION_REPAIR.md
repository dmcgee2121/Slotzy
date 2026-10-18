# FIX-012A: Staff appointment cancellation repair

**Disposition: PASS CANDIDATE**

## Safety and baseline

- Repository: `C:\Dev\Slotzy`
- Branch: `restore-source-files`
- Committed baseline: `256e53cd5319bd7f40087f356fad19e1c7061136`
- Existing untracked FIX-012 report was preserved.
- Docker/local Supabase identity was verified before application: the local
  database reported `postgres|127.0.0.1/32|true` for database, loopback
  address, and disposable marker.
- Local Supabase API was verified as `127.0.0.1:54321`; PostgreSQL was used
  through the database container's loopback listener only.
- The application ran in PostgreSQL storage mode with the Dev Outbox forced and
  SMTP disabled. No hosted service, real email, reset, deletion, commit, push,
  or deployment was used.

The Supabase CLI executable was not installed globally, so a repository-local
`npx supabase status` verification was used for the isolated API environment.
The migration was applied only with the local database container's explicit
`127.0.0.1:5432` connection. This avoids any linked-project or hosted target.

## Root cause and repair

FIX-012 found two independent staff-cancellation defects:

1. Dashboard Upcoming sent a full booking snapshot, taking the legacy snapshot
   write path.
2. The narrow PostgreSQL status update set `status = cancelled` without the
   schema-required `cancelled_at`; it also created no staff audit event.

The repair uses an atomic service-role-only RPC for staff cancellation rather
than a partial multi-request update.

### Migration

New additive migration:

`supabase/migrations/20261018210000_staff_booking_cancellation.sql`

It creates:

`public.slotzy_cancel_booking_by_staff(p_booking_id uuid, p_actor_user_id uuid)`

The function:

- locks the target booking;
- derives the staff actor from the trusted server-provided canonical user ID and
  validates an active owner/barber membership in the booking's shop;
- rejects missing, cross-shop, and non-booked/non-confirmed transitions;
- atomically sets `status = cancelled`, `cancelled_at`,
  `cancelled_by_member_id`, and `updated_at`;
- inserts exactly one `booking_events` record with the derived
  `owner` or `barber` actor type/member;
- returns only a small status/timestamp result; and
- explicitly revokes `PUBLIC`, `anon`, and `authenticated` execution,
  granting execution only to `service_role`.

The migration contains no destructive statement and does not modify existing
rows at application time. After local application, the function signature was
present and permissions verified as `anon=false`, `authenticated=false`,
and `service_role=true`.

## Server and frontend integration

Changed:

- `server/src/storage/postgresStore.js`: added the server-only RPC adapter,
  resolving the legacy booking ID to its canonical UUID and passing the
  authenticated server user ID.
- `server/src/storage/index.js`: exposed the Postgres-only cancellation
  operation.
- `server/src/index.js`: after existing Express owner/barber authorization,
  PostgreSQL status-only cancellation invokes the atomic RPC and maps actual
  outcomes to stable `200`, `403`, `404`, or safe `409` responses.
  Other status transitions and JSON storage behavior remain unchanged.
- `js/owner-upcoming.js`: now submits only `{ status: "cancelled" }`,
  matching `js/owner-appointments.js`.
- `server/test/migration-safety.test.js` and
  `server/test/staff-cancellation-contract.test.js`: focused regression
  coverage.
- `server/package.json`: includes the new focused API contract test.

The browser never supplies actor authority. Express authorizes the staff user;
the service-role adapter passes that authenticated identity; the RPC verifies
the actor's active membership in the affected shop again.

## Local PostgreSQL/API lifecycle evidence

A fresh uniquely named synthetic owner, barber, shops, service, availability,
and future public appointments were created through the isolated local API.
No `test1234` or founder appointment was read or modified. Sensitive contact
values, credentials, and management tokens are omitted.

| Check | Result |
| --- | --- |
| Unauthenticated staff route | `401` |
| Different-shop owner cancellation | `403` |
| Authorized owner cancellation | `200`, persisted `cancelled` |
| Authorized barber cancellation | `200`, persisted `cancelled` |
| Repeated cancellation | safe `409 cancellation_unavailable` |
| Two concurrent owner attempts | one `200`, one safe `409` |
| Released same slot | replacement booking accepted (`201`) |
| Private manage-link cancellation | remained successful (`200`) |

Read-only PostgreSQL verification showed:

- owner-cancelled booking: cancelled timestamp and staff actor present; exactly
  one cancellation event with actor `owner`;
- barber-cancelled booking: cancelled timestamp and staff actor present; exactly
  one cancellation event with actor `barber`;
- concurrently cancelled booking: exactly one owner cancellation event;
- cross-shop target: still booked, no cancellation metadata/event; and
- private-link cancellation: cancelled with one `public_client` event and no
  staff actor, preserving that separate workflow.

## Regression results

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | 4/4 passed |
| `npm --prefix server run test:storage` | 36/36 passed |
| `npm --prefix server run test:api` | 50/50 passed |

The reset-capable PostgreSQL integration suite was intentionally not run.
Focused live PostgreSQL acceptance was performed instead using only new
synthetic records in the verified disposable database.

## Founder retest

Browser automation was not used because the prior browser harness was not
reliably available. The founder should restart the standard local E2E process
so the edited server/frontend modules load, then:

1. Sign into the `test1234` owner account.
2. Create a new synthetic future appointment; do not alter the historical
   founder appointment.
3. From Dashboard > Upcoming, cancel it and confirm the success message,
   cancelled status after refresh, disappearance/disabled cancel action, and
   owner dashboard consistency.
4. Create a second synthetic future appointment. Open Staff Appointments,
   cancel it, refresh, and confirm the same persisted state.
5. Verify a newly available original slot can be booked again.
6. Confirm a private customer management link can still cancel a separately
   created eligible appointment.

These are founder-operated browser acceptance steps; they have not yet been
claimed as automated visual acceptance.

## Remaining risks

- The migration was applied directly to the disposable local database, not via
  a hosted or linked-project migration command. It must be applied through the
  normal reviewed migration process in any future environment.
- An isolated local API on port 3002 was started only for this verification
  because the existing port-3001 runner could not be stopped by this session's
  process-control policy. It used the same loopback Supabase/API configuration
  and Dev Outbox. The founder's normal retest should use the standard runner
  after restart.
- The original port-3001 process must be restarted before it will load this
  repair.

## Final Git status

No commit or push was made. Modified/untracked work consists of the FIX-012
report, this report, the additive migration, the narrow implementation changes,
and focused tests described above.
