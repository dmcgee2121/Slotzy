# Slotzy Beta Readiness Audit

**Audit date:** 2026-10-16
**Audited revision:** `restore-source-files` at `81666936c6f8ba250884858e55df62f27b43bbb6`
**Scope:** source and safe local tests only. No hosted endpoint, database, Render, Netlify, deployment, migration, credential, commit, or production action was performed.

## A. Executive readiness assessment

Slotzy is a real, partially validated appointment application, not a UI-only prototype. The owner setup, service/availability configuration, anonymous public booking, opaque-token appointment lookup/cancellation, and owner appointment reads/writes have implemented source paths. The backend can select a PostgreSQL/Supabase adapter and uses an atomic database RPC for anonymous booking and an atomic RPC for token-based cancellation.

**Recommendation:** suitable only for continued **internal synthetic-data testing** today. It is **not yet evidence-ready for a closed beta with outside users**, chiefly because the local full smoke suite does not pass and real database/browser lifecycle coverage is not runnable locally without disposable Supabase credentials. It is unequivocally **not ready for public production**: there is no demonstrated backup/restore drill against staging data, no demonstrated delivery/monitoring/alert response, customer rescheduling is deliberately unavailable, and operational evidence is incomplete.

“Previously passed staging” statements in `PROJECT_STATUS.md` are historical context, not rerun evidence for this audit. This audit intentionally did not contact staging.

| Stage | Assessment | Gate rationale |
|---|---|---|
| Internal synthetic data | **Conditional / limited** | Core local storage contracts pass; static flows exist. Resolve the failing smoke suite and run a local API lifecycle before relying on it. |
| Closed external beta | **No-go pending P0s** | No clean complete local regression, no local disposable-Postgres integration result, and no current controlled deployment/UAT evidence in this audit. |
| Public production | **No-go** | External-beta gates plus operational recovery, monitoring/alerting, delivery, support, and production-security validation remain unproven. |

## B. Feature inventory

| Feature | Status | Evidence | Missing work / priority |
|---|---|---|---|
| Staff registration, login, session revocation, password change | **PARTIALLY IMPLEMENTED** | `server/src/index.js` routes `/api/auth/register` (1475), `/login` (1572), `/change-password` (1755); `server/src/authTokens.js`; isolated password API test passes. | Full smoke’s server-auth expectation is failing; test/mock must match actual dashboard auth restoration. **P0 closed beta.** |
| Owner initial shop setup | **PARTIALLY IMPLEMENTED** | Shop writes at `index.js:1809`, setup UI in `js/owner-setup.js`; static/mobile tests exist. | No local API+database end-to-end proof in this audit. **P0 evidence gap.** |
| Service management | **PARTIALLY IMPLEMENTED** | Protected CRUD at `index.js:1988-2314`; `js/manage-services.js`. | Service descriptions are absent from the managed/public contract (also recorded in `PROJECT_STATUS.md`). **P1.** |
| Multi-provider/team management | **MISSING for hosted beta** | `js/manage-barbers.js` immediately renders “not available in hosted beta”; `pages/manage-barbers.html` says provider changes are coming later. | Limit beta to the setup provider, or implement staff/provider lifecycle. **P1 if multi-barber is in beta scope; not a blocker for single-provider beta.** |
| Hours, timezone, one-time time off, recurring blocks | **PARTIALLY IMPLEMENTED** | Protected availability read/write at `index.js:2314-2460`; authoritative schedule predicate in `server/src/schedulePolicy.js`; owner UI in `js/owner-availability.js`. | Browser tests mostly mock/seed data; physical browser timezone/DST verification is absent. **P1.** |
| Anonymous public discovery and booking | **PARTIALLY IMPLEMENTED** | Public context `index.js:1633`; anonymous `POST /api/bookings` at 2684 validates provider/service, future time, duration, availability and overlap; Postgres atomic write at `storage/postgresStore.js:906-936`; `js/booking-engine.js`. | No local real-Postgres concurrent booking test result; full public lifecycle was not safely rerun hosted. **P0 closed beta.** |
| Booking confirmation / private manage link | **PARTIALLY IMPLEMENTED** | Server creates hash/token at `index.js:106`, 2684+; client receipt gets it only from 201 in `js/dataStore.js:374-400`. | Actual SMTP delivery is unverified; with SMTP absent, staging uses outbox rather than customer delivery (`server/src/emailService.js`). **P0 if invitations promise email delivery; otherwise P1 with explicit manual support.** |
| Customer appointment lookup and cancellation | **VERIFIED WORKING (local contract), unverified against current deployment** | Token lookup/cancel routes `index.js:2520`, `2552`; atomic cancellation adapter `postgresStore.js:996`; client uses `cancelPublicManageBookingAsync` at `js/client-manage.js:450`; storage/manage cancellation tests pass. | Test actual token lifecycle against disposable database/current staging before external use. **P0 evidence gap.** |
| Customer rescheduling | **MISSING in hosted flow** | Token branch in `js/client-manage.js:113-153` explicitly sets `canReschedule: false` and says “cancel and rebook.” | Implement opaque-token reschedule with server-side policy/conflict validation, or document cancellation/rebooking as the beta rule. **P1 for limited beta; P0 if rescheduling is promised.** |
| Owner appointment status and reschedule | **PARTIALLY IMPLEMENTED** | Authenticated patch at `index.js:2941`; schedule/overlap checks there; `js/owner-appointments.js` and `js/owner-today.js`. | No complete local API/database lifecycle proof. **P0 evidence gap.** |
| Data persistence / Supabase | **PARTIALLY IMPLEMENTED** | Adapter selection `storage/index.js`; Postgres adapter uses service-role client and RPCs (`postgresStore.js:208+`, 835+, 906+). | `server/test/postgres-store.integration.test.js` is skipped without dedicated disposable credentials; audit did not use any. **P0 closed beta.** |
| Rate limiting | **PARTIALLY IMPLEMENTED** | `server/src/rateLimiter.js`, enforced auth/manage/booking categories; disabled shared limiter is the default configuration tested by `shared-limiter-config.test.js`. | Shared multi-worker behavior is historical hosted evidence only; current deployment config unverified. **P1 beta / P0 production.** |
| Dev outbox, observability | **PARTIALLY IMPLEMENTED** | Dev endpoint restricted to development/test (`index.js:351-375`); allowlisted telemetry in `observability.js`; tests pass. | No alerting, dashboard, retention, incident runbook exercise, or delivery retry/idempotency verification. **P0 production; P1 closed beta.** |
| Backup/restore | **UNVERIFIED** | Browser-oriented export/restore UI in `js/settings.js`; acceptance checklist asks for it. | No source-backed automated restore target verification or audit execution evidence. **P0 external beta.** |

## C. Owner journey walkthrough

1. **Create/login — PARTIALLY IMPLEMENTED.** Server registration hashes passwords with bcrypt and issues JWTs (`server/src/index.js:1475-1570`); staff scope is checked by `requireAuth` (1254). The owner can reach guarded setup/dashboard pages through `js/owner-setup-guard.js`. The isolated password-change test passed, but the complete frontend smoke test has a server-auth failure.
2. **Set up shop, services and availability — PARTIALLY IMPLEMENTED.** Owner-scoped shop/service/availability routes exist. Availability is checked server-side, including weekly hours, time-off and recurring blocks (`server/src/schedulePolicy.js`). Setup completion and persistence need a real database run before outside testing.
3. **Receive/manage appointments — PARTIALLY IMPLEMENTED.** `/api/bookings` returns scoped owner/barber data (`index.js:2469`); status and schedule updates are protected (`2941`). Owner UI has actionable states, but no audit-run authoritative end-to-end lifecycle demonstrates it against the selected staging storage.
4. **Team/account/settings — PARTIALLY IMPLEMENTED.** Single setup provider is the honest hosted scope. Hosted provider changes are expressly unavailable. Shop branding/policy settings exist; full profile editing is constrained by the API contract. Treat team management as out of scope, not as working functionality.

## D. Customer journey walkthrough

1. **Find shop and select provider/service — PARTIALLY IMPLEMENTED.** Public context deliberately filters synthetic shops for directory browsing (`index.js:1633`), then exposes active services/providers. Its UI is `pages/book.html` + `js/booking-engine.js`.
2. **Pick date/time — PARTIALLY IMPLEMENTED.** UI derives slots from availability; server independently validates canonical duration, future time, availability and overlaps in `POST /api/bookings` (2684+). DST/device browser behavior is not proven.
3. **Book and confirm — PARTIALLY IMPLEMENTED.** Anonymous booking receives 201 only after persistence and a one-time opaque token is used for the receipt/manage URL (`js/dataStore.js:374-400`). Database atomicity is designed but not locally integration-tested.
4. **Manage/recover — PARTIALLY IMPLEMENTED.** Token lookup and cancellation work by possession of an opaque header token (`/api/public/manage`, `/cancel`); recovery response is non-enumerating at `index.js:2627`. Recovery depends on a matching email contact and mail/outbox handling; actual receipt delivery is unverified.
5. **Reschedule — MISSING for public token users.** The UI intentionally suppresses this action and directs users to cancel and rebook (`js/client-manage.js:133-151`).

## E. Top 10 issues/gaps by beta impact

1. **P0 external beta — no clean complete local frontend regression.** `npm run test:smoke` reproducibly fails `auth uses server mode when backend health is online` at `tests/smoke/critical-flows.spec.js:259`; expected token is missing after redirect. The full run also timed out in the dashboard quick-add test at line 340 before completion.
2. **P0 external beta — PostgreSQL integration suite is unavailable by default.** `server/test/postgres-store.integration.test.js` skips unless a dedicated disposable Supabase project is configured. Static contract tests cannot prove deployed schema/RPC/data behavior.
3. **P0 external beta — no audit-run API lifecycle.** Static tests directly seed/mimic storage and route fetches; they do not replace owner setup → anonymous booking → owner visibility → token cancellation persistence against a running API/database.
4. **P0 external beta — backup/restore is unverified.** Settings UI is not recovery evidence. Perform a reversible export/restore and prove the restored application is usable before tester data is entrusted.
5. **P1 / P0 if promised — public customer rescheduling is unavailable.** Token customers can only cancel and rebook.
6. **P1 beta — outbound mail is not operationally demonstrated.** Dev outbox is intentionally development-only; mail dispatch has no demonstrated production-like delivery/retry/alert path.
7. **P1 beta — multi-provider is unsupported in hosted mode.** Restrict onboarding and expectations to one provider per shop.
8. **P1 beta — mobile coverage is automated but physical-device behavior is unverified.** Existing mobile spec is broad, but it uses Playwright/mocks; iOS Safari, Android Chrome, keyboard, PWA cache, links, timezone and touch behavior need hands-on UAT.
9. **P1 beta — shared limiter state/config is unverified at this revision’s deployment.** Code defaults it disabled; do not infer live deployment configuration from source/history.
10. **P2 — service descriptions are absent.** This affects discovery quality, not safety, and should be an additive model/API/UI package after core reliability gates.

## F. Security, privacy, and operational blockers

- **Positive evidence:** staging/production-like startup refuses missing JWT secret/CORS allowlist (`index.js:250-280`); manage tokens are stored hashed and omitted from public envelopes; public recovery gives a generic response; dev email endpoints are gated; login/manage/booking rate limits use opaque key construction.
- **Closed-beta blockers:** prove database RPC/schema behavior in a disposable environment; prove backup/restore; validate real staging secrets/origins/storage mode by an authorized release checklist; and establish monitored, reversible incident handling.
- **Production blockers:** establish alerting and retention, delivery retry/idempotency, backup schedule plus restore drill, dependency/security review, privacy/support policy, and a tested operational owner for data incidents. None are established by source inspection alone.

## G. Test coverage gaps

Existing coverage is substantial but uneven: Node contracts cover JSON storage, migration text safety, scheduling, auth token policy, rate-limiter behavior, and a few API child-process routes. Playwright smoke/mobile tests cover many static/local-storage and mocked API states. The guarded staging suite exists but was not run by constraint.

Missing evidence: disposable-Postgres integration execution; concurrent anonymous booking conflict at the database boundary; real API browser lifecycle without a staff token; current deployed CORS/service-worker behavior; owner status/reschedule lifecycle; SMTP/outbox delivery/recovery; backup restore; accessibility keyboard/screen-reader checks; and physical iOS/Android/browser/timezone/DST UAT.

## H. Recommended next three implementation packages

### 1. Make the API-mode regression suite deterministic (recommended next task)

- **Goal:** restore a trustworthy green local gate for staff authentication and critical owner actions.
- **Affected areas:** `tests/smoke/critical-flows.spec.js`, auth/dashboard boot integration (`js/auth.js`, `js/dataStore.js`, dashboard initialization) only where the observed contract is wrong.
- **Scope:** diagnose why the server-mode token is cleared after redirect; update the app or test fixture to model `auth/me` correctly; diagnose quick-add timeout; add a narrow regression assertion.
- **Acceptance criteria:** `npm run test:smoke` completes green with no hangs; server-mode registration retains a valid token/session through dashboard initialization; quick add finishes or gives an explicit authoritative failure.
- **Required local tests:** focused failing tests, full `npm run test:smoke`, `npm run test:mobile`, and `cd server; npm run test:api`.
- **Frontend/backend:** frontend and tests expected; backend only if diagnosis shows a contract defect.
- **Render/Netlify:** deploy only after local gates are green; then run the separately authorized guarded staging suite.

### 2. Establish a disposable Postgres end-to-end gate

- **Goal:** prove the actual Supabase adapter/RPC schema rather than its mocks.
- **Affected areas:** test-environment configuration and `server/test/postgres-store.integration.test.js`; only fix adapter/schema defects found.
- **Scope:** create/use an explicitly disposable non-production project, provide test-only credentials, run existing guarded integration tests and add concurrent create/cancel/recovery cases if absent.
- **Acceptance criteria:** integration suite executes (not skips), resets only a verified disposable target, proves atomic conflict handling and token cancellation/recovery, and leaves no secrets in source/logs.
- **Required local tests:** `npm run test:storage`, `npm run test:storage:postgres` with disposable guard, then API and browser regression.
- **Frontend/backend:** backend/test infrastructure primarily.
- **Render/Netlify:** no deployment required for disposable test gate; staging validation follows only after success.

### 3. Close the customer lifecycle contract

- **Goal:** make customer self-service unambiguous and reliable for beta.
- **Affected areas:** `js/client-manage.js`, `js/dataStore.js`, `server/src/index.js`, storage adapter/RPC and tests if public rescheduling is included.
- **Scope:** either explicitly retain “cancel and rebook” across booking receipt/tester material, or add opaque-token reschedule with policy, availability and atomic conflict checks. Separately make recovery/email/outbox operational expectations explicit.
- **Acceptance criteria:** customer can complete every promised action with clear success/error feedback; no private data/token leaks; lifecycle survives reload; messages do not claim email delivery without configured/verifiable delivery.
- **Required local tests:** token lookup/cancel/recovery tests; new public reschedule tests if implemented; browser lifecycle tests in API mode; disposable-Postgres integration.
- **Frontend/backend:** both if rescheduling is implemented; frontend/docs only for explicit cancel-and-rebook scope.
- **Render/Netlify:** a backend deploy is required for public-reschedule API/RPC changes, followed by Netlify and authorized guarded staging validation.

## I. Beta Definition of Done

### Before internal synthetic testing

- [ ] `git diff --check` clean and all local server/storage/smoke/mobile gates pass.
- [ ] Owner setup, public anonymous booking, receipt/token manage lookup, cancellation, and owner visibility are run locally against the API, with errors deliberately exercised.
- [ ] Single-provider scope and cancel-and-rebook rule are visible in tester instructions if retained.

### Before external testers

- [ ] All internal gates above pass.
- [ ] Disposable Postgres suite runs green; current controlled staging lifecycle is authorized and green.
- [ ] Backup/export and restore-to-usable-app drill has passed.
- [ ] Mail/outbox and recovery support process is tested and accurately described.
- [ ] Real iOS Safari and Android Chrome/UAT pass for the complete customer and owner flows.
- [ ] Named operator, stop conditions, monitoring/log access and data-incident path are confirmed outside the repository.

## J. PM recommendation

**Do package 1 next: make the API-mode regression suite deterministic.** A beta cannot be responsibly advanced while its primary local smoke gate fails after server authentication and hangs during an owner action. This is the smallest high-leverage task because it both finds a likely session/bootstrap mismatch and restores confidence in every following package.

## Validation performed

### P0-B2 update (2026-10-17)

- The API test command now runs test files serially. The three prior child-server startup timeouts were test-runner resource contention: all affected tests passed individually, then the serialized `npm run test:api` passed **42/42**.
- The original server-auth smoke failure was a stale mock: `js/public-config.js` selects a hosted API, while the test intercepted only `localhost`; the test therefore exercised local fallback. The test now intercepts API paths without contacting a host, includes the authenticated `auth/me` bootstrap response, and asserts the correct first-time-owner setup destination while preserving the JWT assertion.
- The quick-add timeout was a stale fixture: a no-service owner is correctly redirected to required setup. The dashboard test now seeds a configured owner before testing quick add.
- The availability smoke timeout was a Playwright argument misuse (`waitForFunction` accepts one argument). The corrected object argument passes. Public-booking smoke tests were also aligned with the existing `Confirm Appointment` control and seeded before navigation.
- Focused smoke runs passed for server auth/quick add (2/2), availability (1/1), logo (1/1), and public booking (1/1). A subsequent full smoke run advanced through 11 passing tests before exposing additional older stale smoke cases; it was not green at this audit update.

### P0-B2 continuation (2026-10-17)

- Additional isolated smoke repairs were stale expectations only: CSV exports now include the existing `source` column; branding validation correctly reports the current 512 KB cap; and the Today-card action is `Open Appointments` to `manage-appointments.html`, not the retired `View Today` route.
- Focused policy, logo-branding, and both owner Today tests passed after alignment. The CSV focused test exposed and corrected its second outdated header assertion; a final full-suite rerun remains required before marking the smoke suite green.

### P0-B2 final validation (2026-10-17)

- The remaining smoke failures were stale test contracts/fixtures, not application defects: the public-manage tests named the retired `Book Appointment` control; the directory fixture selected Sunday while declaring Sunday unavailable; and the share-link fixture omitted both the explicit local-only API mode and the two services required by owner setup, then asserted retired helper/action labels. These fixtures now retain the current, meaningful booking, policy, share-link, and setup assertions without contacting a host.
- `npm run test:smoke` completed **25 passed, 0 failed** twice consecutively (28.0s and 28.1s). `npm run test:mobile` completed **248 passed, 0 failed** (2.4m).
- The first final `cd server; npm run test:api` attempt had one `auth-change-password-api` child-server startup timeout (**41 passed, 1 failed**). It passed in isolation (**1/1**), no listener remained in the test port ranges, and the immediate aggregate rerun passed **42/42** (12.0s). This was not reproducible after the existing serialized test-file correction; no application assertion failed.
- `cd server; npm run test:storage` completed **32 passed, 0 failed**. No hosted request, deployment, database change, or external environment was used during this validation.

| Command | Result |
|---|---|
| `git branch --show-current`; `git rev-parse HEAD`; `git status --short`; `git diff --check` | Correct branch/HEAD, clean tree before this report, no whitespace errors. |
| `cd server; npm run test:storage` | **32 passed, 0 failed.** |
| `cd server; npm run test:api` | **39 passed, 3 failed** because three concurrently invoked child-server tests timed out waiting for API startup. |
| `cd server; node --test test/auth-change-password-api.test.js`; `rate-limit-api.test.js`; `source-boundary-diagnostic-api.test.js` | **5 passed, 0 failed** when run independently, identifying a test orchestration/port-start issue rather than reproducing those individual behaviors. |
| `npm run test:smoke` | **Not green.** Reproduced token assertion failure at `critical-flows.spec.js:259`; quick-add test timed out; run was stopped after the second failure rather than consuming a prolonged unreliable run. |
| `npm run test:mobile` | **Not run** after the smoke gate failed; no claim is made from historical results. |
| `npm run test:staging` | **Not run by explicit constraint.** |
