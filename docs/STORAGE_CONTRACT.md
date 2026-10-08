# Slotzy backend storage contract

This contract is the persistence boundary used by `server/src/index.js` and `server/src/emailService.js`. It intentionally preserves the current document-shaped JSON behavior while allowing a future adapter under `server/src/storage/` to be selected without changing HTTP routes.

## Required operations

| Operation | Input/output | Current JSON behavior |
| --- | --- | --- |
| `readStore()` | Returns one normalized store document | Reads `server/src/db.json`. Missing file is created with the required empty shape. |
| `readUserByUsername(username)` | Returns the matching authentication-safe user identity, including canonical shop linkage when present, or `null` | Reads only the requested identity. It must not expose password hashes or require reconstruction of unrelated operational collections. |
| `readLoginCredentialByUsername(username)` | Returns one login-only credential record or `null` | Reads only the requested active user. This is the sole auth read allowed to include `passwordHash`; it is used only for server-side bcrypt comparison and must never be serialized in an API response. |
| `readPublicBookingStore({ shopId, slug })` | Returns the scoped public booking projection | Returns selected public shops, active providers/services, scheduling exclusions, and active booking windows only. It excludes credentials, customer contacts, manage-token hashes, and email/outbox records. |
| `listServicesForAuthenticatedUser(user)` | Returns the owner or barber's authorized service list, or `null` for a customer | Uses the authenticated role and canonical shop/provider membership. It preserves the existing JSON-shaped `/api/services` response rows without reconstructing unrelated bookings, schedules, shops, or credentials. |
| `writeStore(store)` | Accepts one store document | Normalizes and rewrites the full document. Route business logic currently mutates the loaded document before this call. |
| `writeUser(user)` | Creates one authoritative user identity | JSON appends to its local document; Postgres sends only the user through the additive snapshot RPC. Duplicate usernames fail and unrelated operational rows remain untouched. |
| `writeBooking(booking, store?)` | Persists one validated booking | JSON retains its document write. Postgres resolves only the referenced shop, provider membership, and service, then calls the atomic booking RPC. |
| `appendOutboxEmail(email)` | Returns the supplied email record | Adds it to `emails` and persists the document. |
| `listOutboxEmails(limit)` | Returns newest-first email records | Reads from `emails`, sorts by `createdAtISO`, and applies a non-negative integer limit. |
| `clearOutboxEmails()` | Returns `{ cleared }` | Removes all `emails` records and persists. |

The canonical selector exports these named functions and `STORAGE_ADAPTER`. `SLOTZY_STORAGE` is `json` when missing; supported values are `json` and `postgres`. Unknown values fail startup. Explicit `postgres` selection validates `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and never falls back to JSON.

## Required store shape

## Public manage authorization

Anonymous booking creation generates a cryptographically random bearer token and returns it once. The browser puts it in the manage URL fragment; the API receives it only on explicit token-scoped lookup/cancel routes. Contact, shop slug, booking id, and confirmation code are not public authorization inputs in API/hosted mode. Postgres stores only a SHA-256 hash in `booking_manage_tokens`; JSON demo storage retains only the hash alongside its booking. Owner and barber booking reads remain authenticated and do not require this token.

The non-enumerating `POST /api/public/manage/recover` endpoint accepts contact, shop reference, and appointment date only to identify a notification recipient. It always returns the same success message and never returns a booking, token, or manage URL. A matching email booking rotates the prior token, then sends or queues the replacement link through the existing server email path. Postgres revokes active prior token hashes before persisting the replacement; no schema migration is required.

```js
{
  users: [],
  shops: [],
  services: [],
  availability: {},
  bookings: [],
  emails: [],
}
```

`readStore` and `writeStore` normalize malformed or missing top-level collections to that shape. This normalization is a compatibility requirement for the current Express helpers, which read and mutate these collections in memory before persistence.

Login uses `readLoginCredentialByUsername` for its server-side bcrypt comparison. JWT middleware uses `readUserByUsername`, which never includes a password hash. A valid JWT followed by an identity-storage failure is classified as a temporary `503` dependency failure rather than an invalid `401`; missing, invalid, expired, or unknown-user tokens remain `401`. Protected routes that still need the legacy document for resource authorization load it explicitly after identity authentication, keeping that compatibility read out of the authentication boundary until those routes are narrowed separately.

Public booking context now uses `readPublicBookingStore`; the Postgres adapter queries only selected public shop records and their active provider/service/scheduling relations. Owner and barber `GET /api/services` calls use `listServicesForAuthenticatedUser`; customer service-list behavior remains on the legacy compatibility path until a separately reviewed authorization projection is introduced. Public booking creation, optional authentication, and the atomic booking RPC are unchanged.

Each provider availability entry also preserves `recurringBlocks`, an array of `{ id, weekday, start, end, label, enabled }`. `weekday` uses `sun` through `sat`; times are local `HH:mm` values in the entry's timezone. These weekly exclusions are distinct from absolute-date `timeOff` entries.

## Adapter rules

- The adapter must preserve the route-visible data shapes and existing API status/response behavior.
- It must not silently switch adapters or fall back to local JSON after an explicitly selected adapter fails.
- JSON remains the local/default adapter. Hosted environments may explicitly select the Postgres adapter. `db.js` remains a compatibility shim for legacy `readDb`/`writeDb` imports.
- A Postgres adapter must use server-only credentials. Browser code must never import it or receive Supabase service-role credentials.
- Postgres may use narrower domain queries/transactions, but each narrow operation must preserve the route-visible contract and have equivalent storage/API coverage.

## Postgres adapter status

`postgresStore.js` now creates a server-only Supabase client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; it never imports into browser code. It performs relational reads for users, shops/settings, members/providers, services/provider services, availability/time off, bookings, and outbox records, mapping them back to the current JSON-style application shape. It also writes/reads/clears `email_outbox` through parameterized Supabase SDK calls.

Most legacy Express writes still mutate and save a complete legacy document. In Postgres mode, `writeStore` invokes `slotzy_storage_write_snapshot_with_recurring`. Registration uses `writeUser` with only the new user after a narrow duplicate lookup. Shop creation and branding/settings updates are intentionally narrower: `writeShop` invokes the additive base snapshot RPC with only the target shop and, for creation, its authoritative owner membership. Service creation uses the same additive base RPC with only the new service and its provider membership. Availability updates use the recurring-aware RPC with only the named provider's weekly schedule, time off, and recurring blocks. Public booking creation uses `writeBooking`: it resolves only the selected shop/service/provider mappings and calls `slotzy_create_booking`, which atomically validates availability/recurring blocks and overlap, inserts the booking, stores the hashed manage token, and records the booking event. Notification dispatch occurs after that commit through the existing narrow email path. These narrow writes do not retransmit or reconcile unrelated services, availability, bookings, emails, branding, or other shops/providers. The recurring wrapper runs existing snapshot reconciliation and recurring-block reconciliation in one database transaction. It upserts retained block IDs and deletes omitted IDs only for providers explicitly present in the snapshot; unrelated providers and existing availability/time-off rows are untouched. `docs/SUPABASE_RECURRING_BLOCKS_MIGRATION.sql` must be applied before deploying this server version. Until then, Postgres writes intentionally fail rather than silently losing recurring blocks.

Public booking creation must enforce weekly hours, one-time time off, recurring blocks, and active-booking overlap on the authoritative server path. Browser slot filtering is presentation only and is not the security boundary.

## Shop branding field contract

Browser clients may supply historical branding aliases (`logoDataUrl`, `logoUrl`, `logoImage`, `logoImageDataUrl`, `coverDataUrl`, `coverImage`, or `coverImageDataUrl`). API writes and the Postgres adapter canonicalize these to `logo` and `cover`, which the RPC stores in `shops.logo_url` and `shops.cover_url`. Relational reads use the canonical names; browser readers accept both forms for compatibility. API requests must not send duplicate aliases because image data URLs are large.

The anonymous booking-context response remains an allowlist and exposes branding only as `logo` and `cover`; it does not return owner-only shop fields. Empty values select default Slotzy branding. Data URL contents must not appear in diagnostics or test failure messages.

## Future booking transaction contract

The current document adapter cannot provide relational transactions. The Postgres adapter must expose a dedicated transaction-level booking operation before public hosted booking is enabled. In one database transaction it must:

1. Load and validate shop, provider membership, service/provider relationship, booking policy, availability, time off, and active booking overlap.
2. Insert the booking using the schema's active-booking overlap constraint as the final concurrency safeguard.
3. Generate a high-entropy client manage token, persist only its hash and expiry, and return the raw token exactly once for receipt/link construction.
4. Insert an immutable `booking_events` creation record with actor/request metadata.
5. Insert a pending server-side notification/outbox record if notification delivery is part of the flow.

Commit only when every required record is valid. Dispatch email after commit; delivery failure must not roll back an already confirmed booking. Reschedule/cancel need analogous event and token/policy handling. This is a design requirement only, not a runtime operation yet.
# Hosted write fallback policy

When the browser is configured for API mode, writes are authoritative only after the Express API succeeds. `dataStore.runAsync` must never redirect a failed write to browser storage, including owner setup, services, availability, settings, appointments, public booking, and manage actions. Browser storage remains a compatibility cache after successful API reads/writes; it is not proof that a hosted write succeeded.

Local/demo mode intentionally continues to use browser storage. Read operations may use the existing compatibility fallback where the screen is explicitly designed to tolerate cached data, but screens that promise current server state must opt out and show a retry state.

## Hosted development and notification routes

`GET`/`DELETE /api/dev/emails` and the legacy free-form `/api/notify/*` routes exist only when `NODE_ENV` is `development` or `test`. Staging and production return `404` before reading email content or processing a notification payload. Hosted notifications are produced inside the authoritative booking create/update/token-cancel routes after persistence; delivery is best-effort and cannot turn a persisted action into an apparent failure.
