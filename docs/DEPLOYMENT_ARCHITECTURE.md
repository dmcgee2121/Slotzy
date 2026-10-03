# Slotzy deployment and database architecture

Status: planning only, 2026-09-27. This document describes a behavior-preserving path to staging. It does not authorize a deployment, database creation, data migration, SDK installation, or runtime change.

## Recommendation

Keep the current Express backend and connect it to Supabase Postgres (option A). Do not move most booking logic directly into Supabase at this stage.

The current client already treats Express as its API boundary, and the server contains the role checks, normalizers, email notification decisions, and data shape that the pilot uses. Replacing that boundary with direct Supabase calls would combine an infrastructure migration with a client authorization and booking-flow rewrite. Keeping Express allows the `db.js` persistence adapter to change behind the existing HTTP contract, preserves a single server-side location for overlap/policy logic, and prevents browser clients from needing privileged database access. Supabase should initially provide managed Postgres, backups, connection pooling, and observability; it should not become the public business-logic API.

Reconsider direct Supabase access only after the Express API contract, authorization model, tests, and multi-shop data model are stable. If it is later adopted for limited reads, it must use RLS and never expose a service-role key.

## Current architecture

### Static frontend

- The project root is a static, module-script frontend. `npm run serve` uses `scripts/serve.cjs`; Live Server is also documented. `index.html` and `pages/index.html` load the home/auth entry.
- `manifest.json` provides an installable web-app shell (`start_url: /index.html`, standalone display and PNG icons), but this is not yet a production PWA/native packaging plan.
- `js/dataStore.js` is the client data boundary. It defaults to local mode and uses browser local/session storage keys prefixed with `Slotzy_`.
- API mode is opt-in through `Slotzy_api_mode=1`. `js/api-config.js` is the canonical browser API-base module: it imports the non-secret `js/public-config.js`, accepts `window.SLOTZY_CONFIG.apiBaseUrl`, normalizes an origin or `/api` URL, and otherwise defaults to `http://localhost:3001/api`. `configureApi` can still change it in memory.
- In API mode, async reads may use a compatibility-cache fallback only where the caller permits it. Writes never fall back after an API failure and writes without an API implementation reject explicitly. Local/demo mode continues to persist in browser storage.

### Express API and JWT

- `server/src/index.js` is an Express API. It uses `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, and `nodemailer`.
- Owner and barber registration/login return a seven-day JWT. Browser code stores the token in local storage (`Slotzy_auth_token`) and the display user in session storage (`Slotzy_user`).
- JWT claims currently contain username and role; the server reads current records and applies shop/provider scope checks for services, availability, and bookings.
- The server refuses production startup without `JWT_SECRET`, but local development has a documented fallback secret. That fallback must never be acceptable in staging or production.

### File persistence and email

- `server/src/storage/index.js` is the canonical backend persistence selector. It defaults `SLOTZY_STORAGE` to `json`, selects `postgres` only when explicitly requested, and fails startup for unsupported values. `server/src/storage/jsonStore.js` alone reads and rewrites `server/src/db.json`; `server/src/storage/postgresStore.js` validates server-only credentials and exposes the same intentionally unimplemented contract without an SDK/network/JSON fallback; `server/src/db.js` is a compatibility shim. The current top-level JSON shape is `users`, `shops`, `services`, `availability`, `bookings`, and `emails`.
- This is suitable only for a single local process. Concurrent writes, ephemeral hosted disks, backups, audit history, and relational integrity are not solved by `db.json`.
- `server/src/emailService.js` sends mail through Nodemailer only when all SMTP settings exist. Otherwise it appends email records to `db.json` and exposes them at `/api/dev/emails`. The Dev Outbox is deliberately a local QA feature, not a pilot feature.

### Local smoke-test mode

- The seven Playwright smoke files seed local/session storage directly and run against the static server. They do not require the Express server or real credentials.
- The configured suite currently discovers 24 tests in 7 files. This deterministic local mode should remain during migration as the fast UI regression layer; it is not evidence that the hosted API/database path works.

### Current route inventory

| Area | Current routes |
| --- | --- |
| Public client | `/pages/book.html?shop=slug`; `/pages/manage.html?shop=slug&contact=...` (optional `code` is read for highlighting); `/pages/book-shop.html`; `/pages/pricing.html` |
| Owner/barber pilot | `/pages/business-owner.html`; `/pages/owner-setup.html`; `/pages/manage-appointments.html`; `/pages/manage-services.html`; `/pages/manage-barbers.html`; `/pages/settings.html`; `/pages/owner-today.html`; `/pages/owner-earnings.html` |
| Dev/retired | `/pages/dev-emails.html` is local QA only. `admin.html`, `customer-dashboard.html`, `client-history-overview.html`, and legacy scripts are not pilot entry points and need a separate retirement/security decision before staging. |

The current local public manage link is contact-scoped (`shop` + `contact`) rather than a cryptographic bearer token. It is adequate only for local/demo use and must be replaced before hosted customer data is exposed.

### Current API surface

| Area | Endpoints |
| --- | --- |
| Health/auth | `GET /api/health`; `POST /api/auth/register`; `POST /api/auth/login`; `GET /api/auth/me` |
| Shops/services | `GET, POST /api/shops`; `PATCH /api/shops/:shopId`; `GET, POST /api/services`; `PATCH, DELETE /api/services/:serviceId` |
| Availability/bookings | `GET, PUT /api/availability`; `GET, POST /api/bookings`; `PATCH /api/bookings/:bookingId` |
| Notifications/dev | `POST /api/notify/booking`, `/cancel`, `/reschedule`; `GET, DELETE /api/dev/emails` |
| Admin | `GET /api/admin/status`; `POST /api/admin/login`; `GET /api/admin/shops`; `GET /api/admin/shops/:shopId/export`; `POST /api/admin/shops/:shopId/reset`, `/seed-demo-shop`, `/clear-all` |

Today the API CRUD routes require JWTs. Public booking and public manage flows operate in local storage for smoke/demo mode; a hosted public API contract must be designed explicitly rather than exposing the privileged CRUD endpoints anonymously.

## Target staging architecture

```
Netlify static site (staging)        Hosted Node/Express API (staging)
  public and owner browser  HTTPS -->  JWT, validation, booking rules, email dispatch
           |                                      |
           | environment API URL                  | pooled TLS connection
           v                                      v
       no database keys                       Supabase Postgres (staging)
                                                     |
                                               backups / PITR / monitoring
```

- Use separate Netlify sites (or clearly isolated site contexts) for staging and production.
- Run Express as a separately hosted Node service, with one staging service and one production service. Do not rely on a Netlify static deploy to host this long-running API.
- Use a separate Supabase project for staging and production. Never test migrations against production.
- Expose only the public frontend URL(s) through a strict API CORS allowlist. The API owns database credentials and mail credentials.
- Establish a build/runtime configuration mechanism that supplies an API base URL per environment. Do not put secrets in static JavaScript. A public API URL is not secret; database/JWT/SMTP credentials are.

## Proposed relational data model

Use UUID primary keys, `timestamptz` timestamps, UTC storage, and application-level display in each shop/provider timezone. Use `created_at` and `updated_at` consistently. Preserve existing identifier fields temporarily during migration only where needed for compatibility.

| Table | Purpose and key columns | Keys, indexes, and access |
| --- | --- | --- |
| `users` | Login identity: `id`, normalized unique `username`, `display_name`, `password_hash`, `role`, `is_active`, timestamps. | PK `id`; unique case-insensitive username; index `(role)`. No public access. Owner reads members only in own shop; a barber reads self. |
| `shops` | Shop identity/branding: `id`, `owner_user_id`, `name`, `slug`, phone/email, logo/cover URLs, timestamps. | PK `id`; unique normalized `slug`; FK owner -> users; index owner. Public read only through a deliberately limited booking-profile endpoint by slug. Owners scope to their shop. |
| `shop_members` | Membership/provider relationship: `shop_id`, `user_id`, `role` (`owner`/`barber`), `is_active`, display/provider metadata. | Composite PK `(shop_id,user_id)` or UUID plus unique pair; FKs shops/users; indexes `(user_id)`, `(shop_id,is_active)`. No anonymous access. Owners manage members in own shop; barber is limited to own membership. This replaces reliance on a single user `shopId` and supports future multi-shop safely. |
| `services` | Bookable service: `id`, `shop_id`, name, price in integer cents, duration minutes, `is_active`, timestamps. | PK `id`; FK shop; index `(shop_id,is_active)`. Public read only for active services of the requested public shop; owner scoped by shop. |
| `provider_services` | Explicit provider-to-service capability when providers may offer different services: `provider_membership_id`, `service_id`, optional active/override fields. | Composite PK or UUID; FKs membership/service; indexes by service and provider. Not public directly; its active joined result can feed public availability. If every provider offers every shop service initially, seed it accordingly rather than omitting the future-safe join. |
| `availability` | Recurring provider schedule: `id`, `provider_membership_id`, weekday, start/end local times, timezone, buffer minutes, enabled. | PK `id`; FK provider membership; unique `(provider_membership_id,weekday)`; index provider. Publicly readable only as computed slots, never as an unrestricted raw endpoint. Owner manages shop providers; barber manages self. |
| `time_off` | Blocking periods: `id`, `provider_membership_id`, `starts_at`, `ends_at`, note, timestamps. | PK `id`; FK membership; index `(provider_membership_id,starts_at,ends_at)`, optional range/exclusion strategy. No public direct access; used by server slot calculation. |
| `shop_settings` | Booking policy/settings: `shop_id`, `allow_same_day`, `max_days_advance`, `cancel_hours`, `buffer_minutes`, deposit/reminder/no-show fields, timestamps. | PK/FK `shop_id`; owner-only mutation. A safe, computed subset may be shown to clients as policy text. |
| `bookings` | Appointment record: `id`, `shop_id`, `provider_membership_id`, `service_id`, client name/contact/email, start/end timestamps, timezone snapshot, status, confirmation code, policy/price/duration snapshots, cancellation/reschedule data, timestamps. | PK `id`; FKs shop/provider/service; unique `(shop_id,confirmation_code)`; indexes `(provider_membership_id,start_at)`, `(shop_id,start_at)`, `(client_contact,shop_id,start_at)`, `(status,start_at)`. No broad public database access. Owner scopes by shop; barber scopes by provider. |
| `booking_events` | Immutable audit/status history: `id`, `booking_id`, event type, actor type/id nullable, before/after JSON snapshots, occurred_at, request/correlation ID. | PK; FK booking; index `(booking_id,occurred_at)`. Not public. Owners see events for their shop; providers only their bookings. |
| `booking_manage_tokens` | Secure client manage-link credentials: `id`, `booking_id`, `token_hash`, `expires_at`, `revoked_at`, `last_used_at`, timestamps. Store only a one-way hash of the random bearer token. | PK; FK booking; unique token hash; indexes active booking and expiry. Public access only via a server endpoint that validates a supplied bearer token; never list tokens. |
| `email_outbox` (optional) | Development/operational queue: `id`, booking/shop refs, recipient, template/type, payload, provider message ID, status, attempts, error/redacted metadata, timestamps. | PK; FKs as appropriate; index `(status,created_at)`. No public access. Keep only if delivery retry/auditing is required; do not recreate Dev Outbox in production as a customer-facing route. |

### Booking integrity

Enforce provider/scope checks and policy rules in Express inside a database transaction. For real overlap prevention, use Postgres range support: retain `start_at`/`end_at`, add an indexed time range, and use an exclusion constraint for active statuses (or a transaction plus equivalent locking) per provider. Cancelled appointments must not block slots. Validate service duration, availability, time off, lead time, buffers, and policy at booking creation and reschedule, not only in the browser.

## Security and operations plan

- **Secrets:** Supabase database connection string/service role, `JWT_SECRET`, SMTP/API credentials, and admin bootstrap secret belong only in backend/hosting secret stores. Never expose them to Netlify client bundles, source, test fixtures, screenshots, or logs.
- **JWT/session:** Keep Express-issued access tokens initially to avoid an auth rewrite. Use a strong staging/production secret, short enough expiration with an intentional refresh/logout strategy before production, issuer/audience claims, and key rotation plan. Do not retain the development fallback.
- **Authorization:** Resolve the user and membership from server-side data for every protected request. Do not trust request `shopId`, provider username, or role claims alone. Scope owner actions to their shop and barber actions to their provider membership.
- **Public booking:** Create purpose-built unauthenticated endpoints for public shop profile, active providers/services, computed slots, booking create, and managed booking actions. Apply server validation, idempotency keys for create requests, per-IP/contact/shop rate limits, CAPTCHA or equivalent only if abuse requires it, and generic errors that do not leak account/customer data.
- **Manage links:** Replace contact-in-query authorization with a high-entropy random bearer token in the link (prefer a URL fragment exchanged client-side if practical; otherwise query token must be treated as a secret and redacted from logs/referrers). Store a hash, support expiry/revocation/rotation, and make only that booking accessible. Do not use the confirmation code as its secret.
- **CORS/transport:** HTTPS only. Set an explicit staging or production frontend-origin allowlist, limited methods/headers, and do not use `cors({ origin: true })` in hosted environments. Add security headers and request body-size limits.
- **Validation/observability:** Centralize schema validation (for example Zod or equivalent in a later implementation task), record structured errors with request IDs but never passwords/tokens/contacts, add health/readiness endpoints, backups/PITR checks, and alerting for failed bookings/email delivery.
- **Admin/dev endpoints:** Disable or remove dev outbox and destructive/demo admin actions in staging unless protected by a separate administrative control plane and auditable authorization. `clear-all` must never be available in production.

## Required environment variables

Names are a plan, not a directive to add code now.

| Scope | Variables |
| --- | --- |
| Static frontend build/runtime config | `SLOTZY_API_BASE_URL` (public, environment-specific HTTPS API URL); optionally `SLOTZY_APP_ORIGIN` for link construction. No secret goes here. |
| Express staging Postgres | `NODE_ENV=staging`, `PORT`, `SLOTZY_STORAGE=postgres`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `SLOTZY_APP_ORIGIN`, `LOG_LEVEL` |
| Express email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` or a transactional-email provider API key/from address |
| Restricted administration | a separately managed `ADMIN_SECRET` only if retained, plus audited operator access. Avoid using it as the long-term admin authorization model. |
| Local only | `server/.env` copied from `.env.example`; optional dev SMTP. Never copy hosted credentials into it. |

Staging and production need distinct JWT keys, mail credentials/sender identities, frontend origins, backend services, and Supabase projects. Use least-privilege database roles; direct browser access should not have a service role. JSON remains the default adapter; Postgres is selected only by explicit `SLOTZY_STORAGE=postgres` and fails startup rather than silently falling back.

## Phased migration plan

### Phase A - configuration seam, no behavior switch

The public API URL seam is now defined: `js/public-config.js` is a non-secret release-time configuration file and `js/api-config.js` normalizes it to the canonical `/api` base. Preserve local-storage default for existing smoke tests. Before enabling staging API mode, change the migration plan into implementation tickets that prevent automatic local fallback for authenticated/pilot writes in staging; surface a clear error instead.

Exit criteria: local frontend/API still work unchanged; a config contract and test matrix exist; no hosted resources required yet.

### Phase B - database adapter behind Express

`SUPABASE_SCHEMA.sql`, `SUPABASE_SCHEMA_NOTES.md`, and `STORAGE_CONTRACT.md` now define the reviewed foundation: multi-shop memberships, provider services, weekly availability/time off, policy settings, transactional bookings, event history, opaque manage tokens, optional server-only outbox, and the current persistence contract. The JSON seam now lives at `server/src/storage/index.js` and `server/src/storage/jsonStore.js`; isolated contract tests protect its default shape, read/write and outbox behavior. `postgresStore.js` now uses the server-only Supabase SDK for relational reads, outbox operations, and database RPC calls. `SUPABASE_TEST_SETUP.md` describes the only permitted validation target: a manually created, explicitly marked disposable project with a guarded reset function. Postgres remains disabled until its snapshot reconciliation and atomic-booking RPCs execute successfully in that project. Leave route responses and booking rules unchanged. Keep `db.json` as a local development adapter only during a controlled transition.

Exit criteria: API contract tests pass against both adapters; no client SDK added; no production data migrated.

### Phase C - identity, shops, services, provider availability

Create the users, shops, memberships, services, provider-service, availability, time-off, and settings schema. Port password/JWT handling and authorization checks to relational lookups. Import only sanitized development fixtures into staging after a reviewed mapping and backup.

Exit criteria: owner/barber setup and configuration flow match current behavior against Postgres; scope/authorization tests cover cross-shop denial.

### Phase D - bookings and secure manage links

Introduce transactional booking/reschedule/cancel operations, booking-event records, overlap constraints, idempotency, and tokenized manage links. Add explicit public API endpoints rather than exposing JWT CRUD anonymously. Keep the old local manage-link route usable only in local/demo mode until migration is complete; do not silently mix models.

Exit criteria: public booking, receipt, tokenized manage action, policies, buffer/time-off, overlap prevention, and owner visibility pass end-to-end against staging.

### Phase E - production email

Connect a transactional SMTP/email provider from Express. Add delivery status/error handling and retry policy if needed; retain an internal outbox only for operational auditing, not a public page. Disable Dev Outbox endpoints in staging/production.

Exit criteria: staging mail sends to controlled inboxes; no credentials/logs leak; booking/cancel/reschedule notifications are verified.

### Phase F - staging QA

Deploy only after implementation phases have passed code review. Run static frontend plus hosted API/database smoke, API contract, authorization, rate-limit, and backup/restore tests. Run the full Playwright suite without the current 30-second tool cap, plus manual 375px/768px public/manage/owner checks.

### Phase G - production readiness

Perform data migration rehearsal, security review, monitoring/alerts, backup/PITR restore test, error-budget/incident runbook, privacy/retention review, domain/TLS checks, and rollback rehearsal. Launch with a small barber cohort and an explicit support/rollback owner.

### Phase H - PWA and Capacitor planning

Only after staging behavior is stable, audit offline behavior, notification needs, deep links/manage-token handling, app privacy disclosures, native credential storage, and Play Store policy requirements. Do not create Capacitor files during database migration.

## Data migration, rollback, and test strategy

### Data migration concerns

- Treat current `db.json` as development/demo data until manually classified. It may contain password hashes, contacts, email HTML, and records with legacy fields. Do not commit changes to it or upload it wholesale.
- Inventory and map legacy aliases (`ownerUsername`/`barberUsername`, `name`/`title`, duration fields, local timestamps) before import. Normalize usernames/slugs and deduplicate deterministically.
- Reconcile every imported row with counts and foreign-key checks; encrypt backups, record a migration version, and retain a read-only pre-migration export outside the repository.
- Do not migrate local browser storage automatically. Pilot users should be explicitly cut over or provisioned through a tested migration process.

### Rollback

- Use versioned database migrations that support a tested down/forward-fix strategy; take a verified backup before each staging/prod migration.
- Deploy frontend and API as independently versioned releases. Keep the previous compatible API and frontend ready until post-deploy health checks pass.
- For an issue after data writes, prefer a forward repair or restore from a tested point-in-time backup over schema rollback that discards new bookings. Freeze writes and communicate the incident path when necessary.
- Keep an environment kill switch that stops public booking creation while preserving read/manage visibility, once implemented and tested.

### Smoke-test impact

- Preserve local-storage seeded tests as fast, deterministic UI coverage.
- Add a separate API contract suite against disposable Postgres and a small staging end-to-end suite that uses isolated test shops/users and cleanup APIs unavailable in production.
- Add tests for API outage behavior to ensure staging never quietly writes local storage after a failed authenticated/public write.
- Add authorization, manage-token expiry/revocation, concurrency/overlap, rate-limit, migration, and email adapter tests before production.

## Local/test-only items

- `server/src/db.json` file adapter and its generated email records.
- Browser local-storage demo mode and smoke-test fixtures.
- `pages/dev-emails.html` and `/api/dev/emails` are local development/test tooling; the endpoint returns `404` in staging and production. Legacy manual `/api/notify/*` routes are restricted the same way. Hosted notifications run only inside authoritative booking mutation routes.
- Demo seeding and destructive clear/reset helpers, unless moved behind a separate audited non-production tool.
- The development JWT fallback and permissive local CORS behavior.

## Never commit

- `.env` files, production/staging secrets, JWT keys, Supabase service-role keys, database URLs with passwords, SMTP credentials, provider API keys, or admin secrets.
- `node_modules`, `test-results`, `playwright-report`, zip artifacts, generated `db.json` changes, database dumps, contact exports, or email content containing personal data.
- Any data migration output or screenshots/logs containing bearer manage tokens.

## Do not do yet

1. Do not deploy or create Netlify/Supabase resources from this plan.
2. Do not install Supabase SDKs, change runtime database code, or alter Express routes.
3. Do not migrate `db.json`, browser storage, pilot contacts, bookings, or email outbox data.
4. Do not turn on API mode for real users until the guarded staging checks confirm failed writes cannot fall back to local success state.
5. Do not expose current contact-based manage links to hosted customer data.
6. Do not expose database/service-role credentials to the frontend or commit them anywhere.
7. Do not enable dev email/admin destructive endpoints in a public staging/prod frontend.
8. Do not change booking, policy, auth, or session behavior as part of architecture work.
9. Do not touch the nested `slotzy/` experiment.
10. Do not begin PWA/Capacitor/native work until hosted staging is stable.

## First implementation task after approval

Write a small, reviewed configuration-and-contract task: introduce an explicit public API base-URL mechanism for static builds and a staging-safe API failure mode that does not fall back to local storage for authenticated writes. Add unit/Playwright coverage for local mode versus configured staging mode. It should not add Supabase code or switch persistence yet.
