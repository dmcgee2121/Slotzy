# FAT-006: Staff cancellation founder acceptance and checkpoint audit

**Recommendation: READY FOR CHECKPOINT**

## Founder-observed acceptance

The founder personally verified the repaired local `test1234` workflow in
desktop Chrome:

1. Dashboard > Upcoming Appointments cancellation succeeded.
2. The separate Appointments-page cancellation succeeded.
3. Both cancelled states remained persisted after refresh.
4. The historical Founder Test 002 appointment was also accidentally
   cancelled and must be retained.

These are founder-operated browser observations. They are distinct from the
automated and API/database evidence below.

## Safety preflight

- Repository: `C:\Dev\Slotzy`
- Branch: `restore-source-files`
- Committed baseline: `256e53cd5319bd7f40087f356fad19e1c7061136`
- Existing modified and untracked FIX-012/FIX-012A work was preserved.
- Local Supabase API: `http://127.0.0.1:54321`
- Local PostgreSQL: `127.0.0.1:54322/postgres`
- Database identity query: `postgres|127.0.0.1/32|true` for database,
  server address, and disposable marker.
- PostgreSQL, REST, and gateway Docker services were healthy/running.
- No hosted route was used. No database reset, migration, deletion, email,
  commit, push, or deployment was performed by this audit.

## Independent PostgreSQL acceptance evidence

The unique `test1234` shop slug resolved to one local shop association.
Queries returned only aggregate cancellation metadata/event results and did not
select contact values, password hashes, or management-token hashes.

| Evidence | Result |
| --- | --- |
| Current cancelled bookings in `test1234` | 2 |
| Cancelled bookings with `cancelled_at` | 2/2 |
| Cancelled bookings with `cancelled_by_member_id` | 2/2 |
| Staff cancellation events | 2 owner events across 2 bookings |
| Cancelled bookings with more than one cancellation event | 0 |
| Event lifecycle before/after states valid | 2/2 |
| Event actor member populated | 2/2 |
| Founder-test-pattern appointments | 2 cancelled with timestamps |

The exact stored client-name value did not equal the literal
`Founder Test 002`, so that exact name-to-row linkage is **unverified** and is
not asserted. A privacy-safe founder/test-name pattern found two cancelled
appointments with timestamps, consistent with the founder account of two
cancellations. Evidence cannot determine which UI created which row; that
mapping is therefore not claimed.

Existing booking/rescheduling history was preserved: the shop retains three
bookings with reschedule timestamps and one historical reschedule event. This
audit made no change to that history.

## Regression results

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | 4/4 passed |
| `npm --prefix server run test:storage` | 36/36 passed |
| `npm --prefix server run test:api` | 50/50 passed |

The non-destructive coverage includes customer booking, private-link
cancellation, and private-link rescheduling regressions. The reset-capable
PostgreSQL integration suite was not run.

## Security audit

The pending staff-cancellation migration
`supabase/migrations/20261018210000_staff_booking_cancellation.sql` is
additive: it creates one RPC and does not alter or delete existing rows.

The RPC:

- uses a booking row lock and validates an active owner/barber membership in
  the affected shop;
- atomically persists status, `cancelled_at`, `cancelled_by_member_id`, and
  the cancellation event;
- records the actor role/member from verified membership rather than browser
  input;
- rejects non-booked/non-confirmed/repeated transitions; and
- explicitly denies execution to `PUBLIC`, `anon`, and `authenticated`,
  granting execution only to `service_role`.

Read-only privilege verification returned:

| Role | Execute permission |
| --- | --- |
| PUBLIC | false |
| anon | false |
| authenticated | false |
| service_role | true |

Express retains the existing owner/barber authorization before invoking the
trusted server-side adapter. The Dashboard now sends the same minimal
status-only contract already used by the Appointments page. The customer
management-token cancellation path remains separate.

A pending-file scan found no literal secrets, raw bearer/manage tokens,
customer contact values, generated logs, browser artifacts, or database dumps.
References to service-role configuration are source-code variable names only.

## Pending-file inventory

### Application, migration, and test checkpoint

- `supabase/migrations/20261018210000_staff_booking_cancellation.sql`
- `server/src/storage/postgresStore.js`
- `server/src/storage/index.js`
- `server/src/index.js`
- `js/owner-upcoming.js`
- `server/test/migration-safety.test.js`
- `server/test/staff-cancellation-contract.test.js`
- `server/package.json`

Suggested commit message:

`fix(staff): make appointment cancellation atomic`

### Founder acceptance and QA documentation checkpoint

- `docs/FIX-012_STAFF_APPOINTMENT_CANCELLATION.md`
- `docs/FIX-012A_STAFF_CANCELLATION_REPAIR.md`
- `docs/FAT-006_STAFF_CANCELLATION_ACCEPTANCE_AND_CHECKPOINT_AUDIT.md`

Suggested commit message:

`docs(qa): record staff cancellation acceptance`

### Exclusions

No pending file is recommended for exclusion. No temporary, generated, secret,
trace, dump, or unrelated artifact was found.

## Remaining limitations

- The founder's two browser paths are accepted as founder observations; this
  audit did not use browser automation.
- The exact literal Founder Test 002 name does not match a stored value, so
  exact row identification is intentionally left unverified. The record is
  preserved.
- The local migration was previously applied only to the disposable local
  database. A future environment must apply the reviewed versioned migration
  through its normal deployment process.

## Final Git status

No staging, commit, push, or deployment occurred. At report creation, the
working tree contains only the reviewed implementation, migration, test, and
documentation files listed above. The branch remains at the expected committed
baseline; it is ready for the requested controlled local checkpoint.
