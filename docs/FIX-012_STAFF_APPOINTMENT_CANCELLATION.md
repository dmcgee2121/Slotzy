# FIX-012: Staff appointment cancellation investigation

**Disposition: BLOCKED - a safe complete repair requires approved database migration work.**

## Scope and safety

Investigation was performed on `restore-source-files` at
`256e53cd5319bd7f40087f356fad19e1c7061136`, initially with a clean worktree.
The verified disposable local Supabase/PostgreSQL environment was used only at
the loopback endpoints: API `127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`,
and the local application API. `slotzy_test_control.is_disposable` was `true`.
No hosted Supabase/API, reset, migration, deletion, real email, commit, push,
or deployment was used.

The local frontend was reachable at `127.0.0.1:5173`; browser automation was
not used because it was not reliably available. The browser result therefore
still needs founder-operated visual acceptance after an approved repair.

## Founder evidence

The reported Samsung behavior remains relevant evidence: confirming a cancel
from Dashboard > Upcoming appeared to start work, then re-enabled the active
appointment; Appointments displayed "Could not cancel appointment." This was
not treated as a missing booking because the appointment card remained visible.

## Architecture and request-path findings

Both staff views use the authenticated `PATCH /api/bookings/:bookingId` route,
which applies owner/barber scope checks before persistence. The server uses the
Postgres service-role storage adapter; no browser talks to PostgreSQL directly.

| Staff entry point | Frontend request | Server persistence branch | Result before repair |
| --- | --- | --- | --- |
| Dashboard Upcoming (`js/owner-upcoming.js`) | Full booking object plus `status: "cancelled"` | Legacy snapshot write | `500`; booking remains booked |
| Appointments (`js/owner-appointments.js`) | `{ status: "cancelled" }` | Narrow `updateBookingStatus` | `500`; booking remains booked |

The Dashboard request shape is independently stale: a cancellation is a status
transition and should not submit the whole booking. It takes the snapshot-write
branch and can encounter unrelated snapshot conflicts. The Appointments page
already uses the correct narrow request shape, so this is not the sole defect.

## Controlled local reproduction and database evidence

A fresh, uniquely named FIX-012 synthetic owner/shop/service and future normal
public booking were created through the local Express API only. No founder
`test1234` data was read or changed. Identifiers, contact values, credentials,
and management tokens are intentionally omitted.

- Cross-shop owner cancellation returned `403 not allowed to update this booking`.
- Dashboard-shaped full patch returned `500 booking_update_failed`; a refreshed
  owner booking read still reported `booked`.
- Appointments-shaped `{ status: "cancelled" }` returned the same `500`; the
  booking remained `booked`.
- A repeated cancellation returned the same failure with no status corruption.
- A same-slot replacement booking correctly returned `409 booking_conflict`,
  because the failed cancellation left the original active.
- Read-only PostgreSQL verification after the attempts showed `booked`, no
  `cancelled_at`, one original `created` event, and zero `cancelled` events.

PostgreSQL logged the confirmed cause for the narrow path:

`new row for relation "bookings" violates check constraint "bookings_cancelled_metadata"`

`postgresStore.updateBookingStatus()` updates only `status` and `updated_at`.
For `cancelled`, the schema requires `cancelled_at`. It also does not create a
staff cancellation event or record the staff actor. This explains the API
failure and the unchanged UI state; it is not an authorization or management-
token problem.

## Authorization and customer-path assessment

Owner/barber authorization is evaluated in Express before persistence, and the
cross-shop denial above confirms it remains enforced. The private customer
cancel route is separate: it uses a hashed opaque management token and the
existing service-role-only `slotzy_cancel_booking_by_manage_token_hash` RPC.
That RPC locks, updates, timestamps, and writes its cancellation event in one
transaction. No customer token, hash, or customer contact was exposed during
this investigation, and no customer flow was changed.

## Required repair and approval boundary

The smallest *complete and safe* repair is an additive service-role-only staff
cancellation RPC, called only after the existing Express owner/barber scope
authorization. It must atomically:

1. lock and validate the booking is currently booked/confirmed;
2. set `status = cancelled` and `cancelled_at`;
3. persist the authenticated staff member as cancellation actor where available;
4. insert the `booking_events` cancellation audit record; and
5. return a sanitized persisted result.

Then `postgresStore` should call that RPC for staff cancellations, and
`js/owner-upcoming.js` should send only `{ status: "cancelled" }`. This avoids
the snapshot branch while preserving the current authorization, availability,
and private-token boundaries.

A client-side timestamp plus separate table updates would remove the immediate
constraint failure but could persist a cancellation without its audit event (or
show a false failure after a partial write). That is not an acceptable repair.
FIX-012 explicitly requires approval before creating a needed migration, so no
migration, code change, or focused regression test was added.

## Regression results

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | 4/4 passed |
| `npm --prefix server run test:storage` | 35/35 passed |
| `npm --prefix server run test:api` | 48/48 passed |

The reset-capable PostgreSQL integration suite was not run. Existing tests
cover the atomic private manage-token cancellation path, not staff cancellation
against the live Postgres constraint; that coverage is required with the
approved migration.

## Recommended post-approval verification

1. Add focused Postgres/storage and API regression coverage for an authorized
   owner and barber cancellation, required metadata, one staff audit event,
   repeated-cancel behavior, and cross-shop `403`.
2. Run the three non-destructive suites above plus the focused test.
3. Create a fresh local synthetic booking. Cancel it once through Dashboard >
   Upcoming and once through Appointments; refresh each view and the owner
   dashboard.
4. Confirm status is Cancelled, the cancel action is no longer offered, the
   freed slot can be booked, and unauthorized staff cannot cancel it.
5. Confirm customer private-link cancellation remains unchanged.

## Remaining risk and Git status

Staff cancellation is currently not reliable against PostgreSQL and is a beta
blocker. The synthetic booking remains booked by design; no data was deleted.
At report creation, the only worktree change is this report; no source files
were changed.
