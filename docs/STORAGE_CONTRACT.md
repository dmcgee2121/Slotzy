# Slotzy backend storage contract

This contract is the persistence boundary used by `server/src/index.js` and `server/src/emailService.js`. It intentionally preserves the current document-shaped JSON behavior while allowing a future adapter under `server/src/storage/` to be selected without changing HTTP routes.

## Required operations

| Operation | Input/output | Current JSON behavior |
| --- | --- | --- |
| `readStore()` | Returns one normalized store document | Reads `server/src/db.json`. Missing file is created with the required empty shape. |
| `writeStore(store)` | Accepts one store document | Normalizes and rewrites the full document. Route business logic currently mutates the loaded document before this call. |
| `appendOutboxEmail(email)` | Returns the supplied email record | Adds it to `emails` and persists the document. |
| `listOutboxEmails(limit)` | Returns newest-first email records | Reads from `emails`, sorts by `createdAtISO`, and applies a non-negative integer limit. |
| `clearOutboxEmails()` | Returns `{ cleared }` | Removes all `emails` records and persists. |

The canonical selector exports these named functions and `STORAGE_ADAPTER`. `SLOTZY_STORAGE` is `json` when missing; supported values are `json` and `postgres`. Unknown values fail startup. Explicit `postgres` selection validates `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and never falls back to JSON.

## Required store shape

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

## Adapter rules

- The adapter must preserve the route-visible data shapes and existing API status/response behavior.
- It must not silently switch adapters or fall back to local JSON after an explicitly selected adapter fails.
- JSON is the only active runtime adapter today. `db.js` remains a compatibility shim for legacy `readDb`/`writeDb` imports.
- A Postgres adapter must use server-only credentials. Browser code must never import it or receive Supabase service-role credentials.
- The eventual Postgres implementation may internally use narrower domain queries/transactions, but it must be covered by equivalent contract and API tests before selection is enabled for a real environment.

## Postgres adapter status

`postgresStore.js` now creates a server-only Supabase client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; it never imports into browser code. It performs relational reads for users, shops/settings, members/providers, services/provider services, availability/time off, bookings, and outbox records, mapping them back to the current JSON-style application shape. It also writes/reads/clears `email_outbox` through parameterized Supabase SDK calls.

Current Express routes still mutate and save a complete legacy document. In Postgres mode, `writeStore` invokes the required `slotzy_storage_write_snapshot` database RPC so any full-document reconciliation is atomic. That RPC must be reviewed and applied to a disposable test database before Postgres mode can be enabled. This intentional boundary avoids a race-prone sequence of browser/server check-then-write operations.

## Future booking transaction contract

The current document adapter cannot provide relational transactions. The Postgres adapter must expose a dedicated transaction-level booking operation before public hosted booking is enabled. In one database transaction it must:

1. Load and validate shop, provider membership, service/provider relationship, booking policy, availability, time off, and active booking overlap.
2. Insert the booking using the schema's active-booking overlap constraint as the final concurrency safeguard.
3. Generate a high-entropy client manage token, persist only its hash and expiry, and return the raw token exactly once for receipt/link construction.
4. Insert an immutable `booking_events` creation record with actor/request metadata.
5. Insert a pending server-side notification/outbox record if notification delivery is part of the flow.

Commit only when every required record is valid. Dispatch email after commit; delivery failure must not roll back an already confirmed booking. Reschedule/cancel need analogous event and token/policy handling. This is a design requirement only, not a runtime operation yet.
