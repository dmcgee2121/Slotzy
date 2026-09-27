# Slotzy Supabase schema notes and migration plan

Status: design only, 2026-09-27. `SUPABASE_SCHEMA.sql` is a reviewed foundation, not an applied migration. No Supabase project, application runtime, `db.json`, authentication, or booking behavior changes are part of this document.

## Design decisions

- Express remains the only application-facing API and the only initial caller of Supabase. It owns JWT verification, owner/barber scope checks, public-booking validation, policy enforcement, email dispatch, and manage-token validation.
- The schema supports multiple shops per user through `shop_members`, even though the current pilot largely assumes one shop per owner. `shops.owner_user_id` remains a convenient primary-owner pointer; membership is the authoritative operating scope.
- Services belong to a shop. `provider_services` makes provider-specific offerings explicit and can be seeded with every active provider/service pair for the current solo-shop behavior.
- Store money as integer cents and timestamps as `timestamptz`. Preserve original policy/service values in booking snapshots so historical receipts remain explainable after an owner edits services or policies.
- Use soft deletion (`deleted_at`, `is_active`) for users, shops, memberships, and services. Do not hard-delete a record that could be referenced by a booking. Booking history is append-only through `booking_events`.
- `email_outbox` is justified only as a server-side delivery/audit queue. The existing Dev Outbox UI and mutable `db.json.emails` collection remain local/test-only.

## Table access and lifecycle

| Table | Purpose | Public/client access | Owner/barber scope | Deletion recommendation |
| --- | --- | --- | --- | --- |
| `users` | Staff/customer identity and password hashes | None | Express reads self/memberships | Soft deactivate; retain records referenced by bookings/events. |
| `shops` | Business identity, slug, public branding | Limited profile by slug through Express only | Owner membership in shop | Soft deactivate/archive. |
| `shop_members` | Owner/barber membership and provider identity | None | Owner manages own shop; barber self only | Soft deactivate; restrict physical delete. |
| `shop_settings` | Policy fields now embedded in local shop data | Computed policy text only through Express | Owner of shop | Keep one row per shop; update in place. |
| `services` | Price/duration/bookability | Active services only through Express public booking profile | Owner shop; barber's provider relationship | Soft deactivate if bookings reference it. |
| `provider_services` | Which provider can perform which service | No raw access | Owner manages shop; barber self as allowed | Hard delete only if unreferenced; otherwise deactivate. |
| `availability`, `time_off` | Recurring provider hours and exceptions | Slots only, computed by Express | Owner shop; barber self | Availability update in place; time off can be hard-deleted if not audited elsewhere. |
| `bookings`, `booking_events` | Appointment record and immutable lifecycle history | Token-scoped booking only through Express | Owner by shop; barber by provider | Never hard-delete during normal operations. |
| `booking_manage_tokens` | Opaque client manage-link credentials | Token verification only through Express | No staff listing needed by default | Revoke/expire; retain hash audit record. |
| `email_outbox` | Optional delivery queue/audit | None | Operational staff only | Retain/redact under an explicit policy. |

## Current `db.json` mapping

The existing file has top-level `users`, `shops`, `services`, `availability` (object keyed by username), `bookings`, and `emails`. Treat it as local/demo data: inspect, sanitize, and map it in a dry run before any import.

| Current object/field | Target | Transformation/default |
| --- | --- | --- |
| `users[].id` | `users.id` | Preserve only if it is a valid UUID; otherwise generate UUID and maintain a temporary source-ID map. |
| `users[].username`, `displayName`, `passwordHash`, `role`, `email`, `phone`, `createdAt` | `users` | Normalize username case via `citext`; map camelCase to snake_case; use migration timestamp where created time is absent. Current raw local-demo passwords must never be imported as `password_hash`. |
| `users[].shopId` | `shop_members` | Resolve after shops/users import. Create owner/barber membership; do not rely on this legacy single-shop field after cutover. |
| `shops[].id`, `name`/`businessName`, `slug`, `ownerUsername`, phone/email/logo/cover fields | `shops` | Resolve `owner_user_id` through source username; generate normalized unique slug if absent/colliding; default timezone to America/Chicago. |
| `shops[].bookingPolicy` | `shop_settings` | Map booleans/integers directly; convert `depositAmount` dollars to rounded `deposit_amount_cents`; supply current server defaults for absent fields. |
| `services[].id`, `name`/`title`, `price`, `durationMinutes`/`duration`, `shopId`, `barberUsername`/`ownerUsername`, `active` | `services`, `provider_services` | Convert price dollars to cents; choose canonical name/duration; resolve shop and provider membership; generate IDs when not UUID. Seed provider-service row as active unless source says inactive. |
| `availability[username].timezone`, `bufferMinutes`, `weekly.{mon..sun}` | `availability` | Resolve provider membership; map days to 1..6/0; create seven rows per provider; preserve enabled/start/end and buffer; default missing entries from current server defaults. |
| `availability[username].timeOff[]` | `time_off` | Generate UUID if needed; parse `startISO`/`endISO` to UTC; reject invalid/non-positive ranges into an import exception report. |
| `bookings[].id`, `shopId`, `barberUsername`/`ownerUsername`, service fields | `bookings` | Resolve UUID foreign keys; copy service and policy snapshots; derive service linkage only when source service resolves. Do not fabricate a service silently—quarantine unmatched rows. |
| `bookings[].clientName`, `clientContact`, client email/phone fields | `bookings` | Preserve contact string for compatibility; split validated email/phone when possible. Encrypt migration exports and redact logs. |
| `bookings[].startISO`/`endISO` or `date` + `time`, duration | `bookings.start_at/end_at/duration_minutes` | Prefer valid ISO fields; otherwise compose with documented legacy timezone. Verify range equals duration; quarantine ambiguous/DST-invalid records. |
| `bookings[].status`, deposit fields, created/updated fields | `bookings` | Map `no_show`/`noshow` to `no-show`; default valid status/deposit values; convert deposit dollars to cents; use timestamps or import time. |
| booking confirmation derived from ID | `bookings.confirmation_code` | Generate a random, non-predictable per-shop code for new rows. Existing displayed codes may be copied only after collision review. |
| cancelled/rescheduled changes implied by current record | `bookings` and `booking_events` | Set cancellation/reschedule metadata only when source has reliable timestamps; otherwise add an `imported` event explaining legacy limits. |
| `emails[]` | `email_outbox` (optional) | Do not migrate by default. If operationally required, redact HTML/personal data, map recipient/subject/meta/payload, mark historical rows `sent` or `suppressed`, never `pending`. |

## Secure public manage links

The existing local route authorizes by shop slug plus contact query text. That is not sufficient for hosted client data.

When a booking is created in the hosted flow, Express should:

1. Generate at least 32 random bytes using `crypto.randomBytes` (base64url encoded).
2. Store only a SHA-256 or keyed HMAC hash in `booking_manage_tokens.token_hash`; never store the raw token.
3. Put the raw token in the receipt/manage link. Prefer a URL fragment exchanged by the browser with a one-time endpoint; if a query parameter is used, redact it in access logs and set restrictive referrer policy.
4. Use a bounded expiry (for example, appointment end plus a documented grace period), support explicit revoke/rotate, and update `last_used_at` after a successful validation.
5. Require the token for every public read/cancel/reschedule operation and return only that booking. Confirmation code is a display identifier, not an authorization secret.

The token table has a unique hash and active-token index. Do not add this behavior until the public hosted API endpoints and tests are implemented.

## Future transactional booking implementation

The storage contract now requires a dedicated Postgres transaction for hosted booking creation rather than a sequence of partial writes. `postgresStore.js` calls the server-side `slotzy_create_booking` RPC when a future route/repository uses `createBookingAtomically`. In one transaction that RPC must validate shop/provider/service scope, availability/time off/policy and overlap; insert the booking; create the hashed manage token; append a booking event; and create a pending outbox record if notifications are enabled. The database exclusion constraint is the final active-overlap safeguard. Email dispatch occurs after commit, so a mail-provider failure cannot roll back a confirmed booking. The RPC and a disposable-database test fixture must be applied/reviewed before Postgres mode is enabled.

## Security and RLS

In phase one, browsers do not access Supabase. Express uses the Supabase service-role key server-side only; it must be stored in the backend host secret manager and never in Netlify/public config, browser storage, source control, logs, or test artifacts.

RLS is not required for this server-only phase because the service role bypasses it and Express remains the enforcement point. The SQL deliberately does not enable RLS to avoid a false sense of protection. Before granting any direct browser/database role access, enable RLS table-by-table, create minimal policies, revoke broad grants, and separately review every policy. Direct public access should not be introduced merely to simplify booking.

## Migration order and environment strategy

1. Create a separate, empty staging Supabase project; do not use production or local `db.json` as the first target.
2. Apply and test the schema in an isolated disposable database first. Capture schema-only checks and rollback rehearsal.
3. Build the Express Postgres adapter behind the current interface, including transactions and API contract tests. Do not switch the application yet.
4. Import sanitized users, then shops, then memberships and shop settings, then services/provider services, availability/time off, and finally bookings/events. This order satisfies foreign keys.
5. Generate/review an import exception report; reconcile counts and foreign keys before enabling API mode for any staging user.
6. Seed staging with synthetic, clearly marked data. Staging and production must be separate Supabase projects, backend services, JWT secrets, email credentials, and allowed origins.
7. Keep Playwright smoke tests in local-storage mode. Add separate API-adapter and disposable-database tests later; do not repurpose smoke fixtures as production seed data.

## Legacy source-ID reconciliation

`legacy_source_ids` is the durable bridge between the JSON document and relational UUIDs. Its `(entity_type, source_id)` key is authoritative for repeated snapshot writes; `target_id` is the relational UUID used by foreign keys. IDs are never inferred from array order.

- Legacy `users[].id` is canonical when present; username is recorded as a non-canonical alias so existing `barberUsername`/`ownerUsername` references resolve.
- `shops[].id`, `services[].id`, `bookings[].id`, time-off IDs, and outbox IDs map to their own entity types. New relational rows always use generated UUIDs.
- Membership source IDs are `legacyShopId:username`; provider-service and availability resolve through that key. Service ownership resolves by source shop ID and provider username, never by display name alone.
- Booking source IDs resolve shop, membership/provider, and service IDs through the mapping table. If a legacy booking lacks a service ID, import/reconciliation must report and resolve it explicitly; it must not use array position.
- Snapshot writes upsert only mapped source rows and do not delete unrelated relational rows. Repeating an identical snapshot therefore updates the same UUID rows rather than duplicating them.

The SQL snapshot RPC is a test-only reconciliation path until it has been exercised in a disposable project. It is not a pilot-data migration tool. The Postgres integration fixture calls the existing `slotzy_reset_disposable_test_data` RPC only after independently verifying both the process opt-in and the one-row `slotzy_test_control.is_disposable` marker; the RPC repeats the database-side marker and literal-confirmation checks. It truncates only the Slotzy tables and source-ID map named in the schema, never the database/schema or Supabase metadata.

### Disposable integration repair (2026-09-27)

The first credentialed run exposed two snapshot-RPC implementation defects. The booking-service fallback contained `shop_id = shop_id`, which ambiguously referred to a PL/pgSQL variable and table column. A later credentialed run isolated the remaining `operator does not exist: text ->> unknown`: PostgreSQL parses generic operators left-to-right, so expressions such as `text_prefix || json_value->>'field'` can apply `->>` to the preceding concatenated text. The corrected RPC uses typed JSONB variables, explicitly aliases JSON function output, parentheses around every JSON extraction participating in concatenation, and `v_*` variables plus qualified table aliases for every source-ID and relational lookup.

Some Supabase projects disable automatic grants for newly created tables. `SUPABASE_SCHEMA.sql` therefore explicitly grants only `service_role` the required schema/table/RPC access and revokes the Slotzy RPCs from `public`; `anon` and `authenticated` remain ungranted. This UUID-based schema uses no application sequences. Existing disposable projects need the non-destructive `SUPABASE_TEST_PATCH.sql` applied manually once.

Legacy users can exist before a shop is created. Snapshot reconciliation now creates a `shop_members` row only when both the legacy user and referenced shop resolve; it preserves the non-null membership foreign keys rather than inserting an invalid partial relationship. Booking snapshot upserts also update mutable customer/contact, provider/service, schedule, status, policy/service-snapshot, deposit, cancellation, and confirmation fields while leaving immutable audit creation data intact.

## Backup and rollback

- Before every applied migration, take a verified backup and record migration version/checksum. Verify point-in-time recovery and a restore rehearsal in staging.
- Use forward-compatible, versioned migrations. For booking data problems, prefer a forward repair or restore from a tested point-in-time backup over a destructive down migration.
- Keep deployment versions compatible across the cutover. Stop booking writes with a tested kill switch if integrity is uncertain; do not silently redirect writes to browser storage.
- Retain a read-only encrypted pre-import export outside the repository. Do not commit dumps, `db.json` copies, contacts, email bodies, or manage tokens.

## Next implementation step

Create a small Postgres repository-adapter design and contract-test task: define the exact operations currently consumed by `server/src/index.js`, map each to parameterized queries/transactions, and test against a disposable Postgres database. Do not modify `server/src/db.js`, install an SDK, create a Supabase project, or switch runtime persistence in that task.
