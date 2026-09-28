# Slotzy Project Status — non-OneDrive re-baseline (2026-09-27)

## Result

The OneDrive cloud-provider read failures are resolved in this clean clone at `C:\Dev\Slotzy`. `npm`, Node, Playwright test discovery, static-server startup within Playwright, and the backend all successfully read project files. No application code, booking logic, nested `slotzy/` directory, deployment configuration, or native/Capacitor files were changed.

## Customer-login smoke fix (2026-09-27)

- **Failing test:** `tests/smoke/critical-flows.spec.js:309` — `customer login is blocked with a friendly inline message`.
- **Selector/assertion:** `expect(page.locator("#auth-error")).toContainText(...)`.
- **Old expected text:** `Customer logins are not enabled. Use your booking link instead.`
- **Actual app text:** `Customer logins not enabled — use booking link`.
- **Root cause:** two assertions retained older, longer copy while the concise text is consistently used by `js/auth.js`, `js/main.js`, and `pages/customer-dashboard.html`.
- **Source of truth decision:** the app copy is consistent and clearer for the current product direction, so only test expectations were updated. No app/auth/session/booking behavior changed.
- **File changed:** `tests/smoke/critical-flows.spec.js` (two stale text expectations: the failed login assertion and the retired-dashboard assertion).
- **Focused result:** `npx playwright test tests/smoke/critical-flows.spec.js --grep "customer login is blocked" --reporter=list` — **1 passed (2.2s)**.

## Public booking and manage-link pilot hardening (2026-09-27)

### Files changed

- `pages/book.html`
- `pages/manage.html`
- `js/booking-engine.js`
- `css/styles.css`
- `tests/smoke/public-manage-access.spec.js`

### Booking page improvements

- Added a compact, numbered four-step guide: barber, service, date/time, then customer details.
- Clarified that no account is required and that the receipt's manage link is how customers return to make changes.
- Added a clearly labelled `Your details` section and browser-friendly name/phone input hints.
- Retained all existing empty, unavailable-date, no-times, stale-slot, policy, and booking-error messages; no slot generation, availability, time-off, buffer, overlap, or booking persistence code changed.
- Added responsive step layout: four columns on desktop, two on tablets, one on narrow phones.

### Receipt and manage-link improvements

- Retained the existing appointment details, confirmation code, copy link, copy confirmation, and calendar/ICS action.
- Added an explicit `Open Manage Page` link beside the existing visible manage URL and Copy Link action. It uses the same generated URL and is stacked/full-width with comfortable tap size on mobile.
- Added a smoke assertion that the explicit open action uses the same manage-link URL as the receipt link.

### Manage page improvements

- Clarified that the manage link works without an account and is private to the booking contact.
- Clarified that per-appointment policy rules control cancellation/rescheduling.
- Improved the no-slot message in the reschedule dialog with a safe next step: try another day or keep the current appointment.
- Preserved the deliberate Cancel -> Confirm Cancel -> Keep Appointment pattern and all existing policy-blocked controls/messages.

### Behavior and validation

- No auth/session, booking model, API/local-storage data mode, `server/src/db.json`, or nested `slotzy/` change was made.
- `npm run test:smoke -- --list`: passed; **24 tests in 7 files**.
- `npx playwright test tests/smoke/public-manage-access.spec.js --workers=1 --reporter=list`: passed; **2 passed (7.6s)**. This covers public booking, receipt manage link, explicit open action, link copy, contact-scoped manage access, Cancel -> Confirm Cancel, policy limits, rescheduling, overlap protection, and persistence refresh.
- The requested combined critical/public-manage command and a critical-flow subset were attempted. They produced no final result before the environment's 30-second command cap; related Playwright/Node processes were stopped. A fresh `npm run test:smoke` attempt likewise passed tests 1-5 (including the corrected customer-login checks) before the same cap. This is an environment timeout/process-lifecycle limitation, not an observed assertion failure.
- Mobile verification was performed from the responsive CSS behavior and covered receipt/manage action stacking in automated public/manage tests. A visual device/browser pass at 375px and 768px remains recommended before inviting pilot barbers.

### Remaining pilot concerns

1. Run the configured 24-test one-worker suite in a terminal or CI job without the 30-second command cap and retain the final summary.
2. Perform a visual phone-width pass for `/pages/book.html?shop=demo-fade-studio`, receipt, valid manage link, invalid/missing manage link, cancellation confirmation, and reschedule dialog.
3. Confirm pilot environment secrets, durable storage/backups, and API deployment configuration before real customer data is used.

## Owner appointment management pilot polish (2026-09-27)

### Files changed

- `pages/manage-appointments.html`
- `js/owner-appointments.js`
- `css/owner-dashboard.css`
- `tests/smoke/critical-flows.spec.js`

### Improvements

- Appointment cards now present an explicit Service label, a prominent customer name, contact details, provider (for owners), date/time, deposit state, no-show count, and an accessible status badge label.
- Added status-aware card presentation: completed appointments have a calm success treatment; cancelled and no-show appointments have a distinct, subdued danger treatment. Booking data and status semantics are unchanged.
- Clarified filter, schedule, and reschedule-empty-state language for a barber operating the pilot.
- Updated all owner destructive status confirmations with the appointment/customer/time context. Owner cancellation still uses the existing browser confirmation; customer Cancel -> Confirm Cancel behavior was not changed.
- Existing mobile card stacking, full-width action controls, wrapping, and long-text handling remain in place; the card additions use the same responsive grid and overflow-safe text styles.

### Data reliability and tests

- Owner appointments still load through the shared `dataStore` booking collection used by public booking; no API/local-storage adapter was changed.
- The owner reschedule/cancel focused smoke test passed: **1 passed (12.9s)**. It verifies rescheduling, cancellation confirmation acceptance, and persisted `cancelled` status.
- The public booking-to-owner integration smoke test initially revealed a deterministic test-harness issue: the clipboard stub was registered after reload. Moved that test-only stub before navigation; the focused test then passed: **1 passed (3.0s)**. This also verifies a public booking appears in `pages/manage-appointments.html` with service, contact, and readable status.
- `public-manage-access.spec.js` passed: **2 passed (7.6s)**, preserving receipt/manage-link, customer cancellation confirmation, policy-aware reschedule, overlap prevention, and persistence coverage.
- `npm run test:smoke -- --list` remains **24 tests in 7 files**.
- The requested combined focused command began **16 tests** and passed tests 1-5 before the environment's 30-second command cap stopped it. A fresh full `npm run test:smoke` attempt likewise passed tests 1-5 before the same cap. No new assertion failure was emitted; spawned Playwright/Node processes were stopped after each cutoff.

### Remaining pilot concerns

1. Run the complete configured one-worker smoke suite outside the 30-second command cap and capture its final result.
2. Do a visual owner-phone-width pass for active, completed, cancelled, and no-show cards; filter chips; action buttons; and reschedule modal.
3. Before production-like staging, address the previously recorded environment secret, dependency audit, durable-storage, backup, and monitoring gaps.

## Owner onboarding and first-time setup pilot polish (2026-09-27)

### Files changed

- `pages/owner-setup.html`
- `js/owner-setup.js`
- `css/owner-dashboard.css`
- `tests/smoke/owner-setup.spec.js`

### First-time flow summary and improvements

- The existing five-step flow remains: Shop, Team, Services, Hours, then Ready. It uses the current setup-state rules and does not add fields or backend data.
- Each step now explains the essential decision in barber-facing language: recognizable shop name, solo-first team setup, clear services/prices/durations, weekly hours/buffer, and the public share moment.
- Added a live progress-detail message. A true first-step owner gets a short essentials-first reassurance; resumed named shops see an explicit "You're picking up where you left off" explanation that identifies the previously saved prerequisites. This preserves the existing named-shop resume behavior rather than restarting onboarding.
- Improved empty guidance for missing team and services with the next concrete action and its effect on booking.
- The Ready screen now makes `Copy Booking Link` the primary action, keeps Open Booking Page/QR/Dashboard readily available, and explains practical sharing options. The same existing generated public URL and QR behavior are used.
- Existing mobile setup layout, responsive stepper, stacked forms/actions, and 44px owner control targets are retained. The new progress text has a readable line length and wraps safely at phone widths.

### Behavior and validation

- No auth/session, public booking logic, setup completion criteria, data-store adapter, nested `slotzy/`, deployment, or native files changed.
- `npx playwright test tests/smoke/owner-setup.spec.js --workers=1 --reporter=list`: **2 passed (3.2s)**. It covers named-shop resume at services, the new resume explanation, adding services, availability, ready booking link/QR, visible Copy Booking Link/Open Booking Page controls, and configured-owner dashboard bypass.
- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- The requested owner-setup/critical combined run started 16 tests and passed critical tests 1-5 before the environment's 30-second command cap. A fresh full suite attempt also passed tests 1-5 before the same cap. No new assertion failure was emitted; Playwright/Node processes were stopped after each cutoff.

### Remaining pilot concerns

1. Walk through an actual freshly registered owner on a 375px phone and confirm whether the data-model-created default shop should enter at Shop or resume at Services; current behavior intentionally resumes named shops at their first incomplete prerequisite.
2. Run the full 24-test one-worker smoke suite in a terminal/CI job without the 30-second command cap.
3. Before pilot data is used, complete the recorded staging readiness work: real secret configuration, dependency audit, durable storage/backup, and monitoring.

## Services, team, and availability management pilot polish (2026-09-27)

### Files changed

- `pages/manage-services.html`
- `pages/manage-barbers.html`
- `js/manage-services.js`
- `js/manage-barbers.js`
- `js/owner-availability.js`
- `css/owner-dashboard.css`

### Services improvements

- Service add fields now state USD, minutes, appropriate input bounds, and mobile input modes.
- Service cards retain the existing name/price/duration actions and now show an accessible Active/Inactive state badge where that stored field exists.
- Service removal confirmation now explains that deleting removes the item from the public booking menu and cannot be undone.
- The existing no-services state remains actionable and points owners to Add Service.

### Team improvements

- Reframed the simple existing barber list as a shop-provider list without adding roles, permissions, or payroll concepts not supported by the data model.
- Added clearer active/inactive badges and distinct inactive card treatment; provider cards/actions wrap safely with the existing responsive owner-card layout.
- Replaced the bare no-barbers message with a pilot-friendly solo-shop empty state.
- Added a contextual, irreversible delete confirmation. Activation/deactivation behavior is unchanged.

### Availability improvements

- Clarified the no-time-off guidance: breaks, planned time off, and blocked days prevent public slot generation.
- Time-off deletion confirmation now explains that deleting the block may make those times bookable again.
- Weekly-hours, timezone, buffer, time-off validation, overlap prevention, and shared availability persistence are unchanged.

### Validation and remaining concerns

- `npx playwright test tests/smoke/owner-setup.spec.js --workers=1 --reporter=list`: **2 passed (2.9s)**.
- The focused availability smoke command started but did not produce a final result before the 30-second execution cap; no assertion output was emitted. A fresh full suite attempt passed tests 1-5 before the same cap. Playwright/Node child processes were stopped after the cap.
- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- No data-store, auth/session, public booking rule, API/local-storage adapter, nested experiment, deployment, or native-app change was made.
- Recommended next action: run the full one-worker suite in a terminal/CI job without the 30-second cap, then do a visual phone-width pass for service cards, provider cards, weekly-hours table, and time-off controls.

## Settings, policies, and branding consistency audit (2026-09-27)

### Files changed

- `pages/settings.html`
- `css/owner-dashboard.css`

### Branding and policy consistency improvements

- Settings header now identifies the page as shop branding and booking rules rather than profile/account details.
- Marked business name as required and shop phone/email as optional.
- Kept the existing public booking URL, QR, logo, cover preview, download, and print controls unchanged; their existing constrained previews and fallback messages remain intact.
- Clarified that policy rules are the rules shown or enforced on public booking and manage links.
- Added field-level guidance: the cancellation window also governs rescheduling, the public-booking buffer should align with provider availability buffers, and a zero no-show limit disables the limit for pilot use.
- Clarified that branding is optional, uses the same public-booking/QR-print assets, and that services, availability, and team records are managed on their own screens.
- No policy keys, save behavior, booking-engine enforcement, auth/session behavior, demo/support visibility, or backup/restore confirmation behavior changed.

### Validation

- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- Focused branding test result: `tests/smoke/logo-branding.spec.js:92` timed out at `page.setInputFiles("#shopLogoInput")` after 15 seconds, waiting for the selector. Artifact: `test-results/logo-branding-shop-logo-up-10c32-public-booking-and-QR-print/error-context.md` (ignored). This was not caused by the copy/CSS-only Settings change; it needs separate investigation of the seeded owner/setup guard state before changing branding behavior.
- Initial focused/full command attempts encountered the established 30-second process-lifecycle cap. No new booking-policy assertion failure was emitted.

### Remaining pilot concerns

1. Diagnose why the logo-branding seed does not expose `#shopLogoInput` before its timeout, then rerun the branding smoke test.
2. Run the full configured one-worker smoke suite outside the 30-second command cap.
3. Perform a visual 375px/768px Settings pass for branding previews, QR actions, policy fields, and toggle layout before pilot rollout.

## Remaining smoke-failure triage (2026-09-27)

Both previously documented failures reproduce individually in the configured one-worker mode and are stale test scenarios, not application defects. No app, booking, auth, or session source was changed.

### Owner setup resume flow

- **Test file/title:** `tests/smoke/owner-setup.spec.js` - `fresh owner is guided through onboarding and gets a working public booking link` (renamed to `owner resumes incomplete setup and gets a working public booking link`).
- **Original assertion:** `expect(page.locator("#setupStepSummary")).toHaveText("Step 1 of 5")`.
- **Exact error:** expected `Step 1 of 5`; received `Step 3 of 5` after 10 seconds.
- **Diagnostic artifact:** `test-results/owner-setup-fresh-owner-is-5fbbc-working-public-booking-link/error-context.md` (ignored; not committed).
- **Classification/root cause:** stale test fixture/expectation. The fixture seeds an owner with a named shop and no services. `owner-setup-state.js` intentionally resumes a named-shop owner at the first incomplete requirement, services (step 3). Emptying the fixture's name does not make it first-run because the data-store normalization supplies a fallback shop name.
- **Minimal test change:** retain the named-shop fixture, assert step 3, validate services/availability completion and the existing booking link, and rename the test to describe the actual resume flow.
- **Focused result:** passed, 1 passed (2.7s).

### Public cancellation confirmation

- **Test file/title:** `tests/smoke/public-manage-access.spec.js` - `public booking receipt exposes a manage link and contact-based manage page can cancel within policy`.
- **Original assertion:** after clicking `button[data-action='cancel-appointment']`, expected `#manageStatus` to contain `Appointment cancelled.`.
- **Exact error:** expected `Appointment cancelled.`; received `Click "Confirm Cancel" to cancel this appointment.` after 10 seconds.
- **Diagnostic artifact:** `test-results/public-manage-access-publi-a961f-ge-can-cancel-within-policy/error-context.md` (ignored; not committed).
- **Classification/root cause:** stale test interaction. `js/client-manage.js` deliberately uses a two-step cancellation control: Cancel sets the pending state and renders `button[data-action='confirm-cancel-appointment']`; that second action performs cancellation.
- **Minimal test change:** assert the confirmation prompt, click Confirm Cancel, then retain the existing cancellation, toast, history, and owner-refresh assertions.
- **Focused result:** passed, 1 passed (4.7s).

### Files changed in this triage

- `tests/smoke/owner-setup.spec.js`
- `tests/smoke/public-manage-access.spec.js`

`tests/smoke/critical-flows.spec.js` remains modified from the prior customer-copy-only fix. No generated data or runtime source file was changed.

## Repository state

- **Branch:** `restore-source-files`
- **Commit:** `c514d4fc1ca7a30d8c1316c9e6cf811a42cbf75a` (`c514d4f Polish settings page for pilot readiness`)
- **Initial working tree:** clean (`git status --short` produced no output).
- **Audit output:** `PROJECT_STATUS.md` is the only intentional new file. Test output remains in ignored `test-results/`; it must not be committed.
- **Nested experiment:** `slotzy/` was not inspected or changed.

## Commands and outcomes

| Command | Result |
| --- | --- |
| `git branch --show-current` | Passed: `restore-source-files` |
| `git status --short` | Passed: clean before audit |
| root `npm install` | Passed: up to date; audited 4 packages; 0 vulnerabilities |
| `npm run test:smoke -- --list` | Passed: listed 24 tests in 7 files |
| `npm run test:smoke` (before fix) | Reproduced the test-4 copy mismatch; tests 1–3 passed and test 4 failed. |
| `npm run test:smoke -- --list` (after fix) | Passed: still lists **24 tests in 7 files**. |
| `npm run test:smoke` (after fix) | The sequential run passed tests 1–5, including tests 4 and 5, before the execution environment’s 30-second command window stopped the still-running Playwright process. It did not yield a complete-suite verdict. |
| focused customer-login smoke test (after fix) | Passed: 1 passed (2.2s) |
| `cd server && npm install` | Passed: up to date; audited 115 packages; 7 vulnerabilities (1 low, 1 moderate, 5 high) |
| `cd server && npm run dev` | Passed: Nodemon loaded `src/index.js`; API announced `Slotzy API server listening on http://localhost:3001`; process then stopped intentionally |
| `GET http://localhost:3001/api/health` | Passed: HTTP 200, `{"ok":true,"service":"slotzy-api"}` |

## Smoke-test status

Discovery confirms **24 tests in 7 files**:

- `critical-flows.spec.js`
- `logo-branding.spec.js`
- `owner-setup.spec.js`
- `owner-today-glance.spec.js`
- `public-manage-access.spec.js`
- `public-shop-directory.spec.js`
- `share-booking-link.spec.js`

The original full run failed `critical-flows.spec.js:309` — **“customer login is blocked with a friendly inline message.”** The original mismatch was:

```text
Expected substring: "Customer logins are not enabled. Use your booking link instead."
Received string:    "Customer logins not enabled — use booking link"
Timeout: 10000ms
```

This was a smoke-test expectation/UI-copy drift, not a booking-logic failure. After the test-only correction, the focused test passes and the sequential full command passes tests 1–5 (including the corrected tests 4 and 5). A complete sequential-suite result remains outstanding because the local command runner stops long-running commands after 30 seconds.

An additional **non-authoritative parallel diagnostic** (`npx playwright test --workers=4`) exposed two unrelated failures; the project’s configured suite uses one worker, so these are documented but not fixed in this task:

```text
owner-setup.spec.js:89 — expected #setupStepSummary "Step 1 of 5"; received "Step 3 of 5".
public-manage-access.spec.js:153 — expected #manageStatus to contain "Appointment cancelled."; received "Click \"Confirm Cancel\" to cancel this appointment.".
```

The parallel command was stopped before a final suite summary and should not be used as a replacement for the configured one-worker smoke run.

After the two triage fixes, `npm run test:smoke -- --list` still reports **24 tests in 7 files**. A fresh configured one-worker full-suite attempt passed tests 1–5, including the customer-login fix, before this environment stopped the process at its 30-second command limit. That is an environment execution limit, not a newly observed smoke assertion failure; child Node/Playwright processes were stopped after the cutoff.

## Backend startup result

Backend startup and health check are confirmed. Startup emitted this important warning:

```text
[Slotzy:auth] JWT_SECRET is not set. Using the development fallback secret; set JWT_SECRET before any pilot or production deployment.
```

This is acceptable only for local development. It blocks real pilot and staging readiness until a secret is supplied through an uncommitted environment configuration.

## Remaining risks

1. The three corrected focused smoke tests pass, but a complete configured one-worker smoke-suite verdict is still required.
2. The full Playwright run does not finish inside this environment’s 30-second command window and leaves child processes requiring explicit cleanup.
3. Server dependency audit reports 7 vulnerabilities, including 5 high; inspect the dependency tree before staging.
4. `JWT_SECRET` is absent and the server uses a development fallback.
5. The prior architecture risk remains: `server/src/db.json`/`db.js` appear to be file-backed persistence and need a concurrency, backup, and hosting review before real barber testing.
6. Full booking, authorization, cancellation/reschedule, timezone, and role-access regression coverage is not yet green because the smoke suite is incomplete.
7. Do not treat local API health as staging readiness: CORS, environment variables, durable storage, monitoring, and backup/restore remain to be validated.

## Recommended next Codex tasks

1. Run the configured one-worker 24-test smoke suite in a terminal/CI environment without the 30-second command cap and capture its final summary.
2. Determine whether Playwright/web-server cleanup can be made reliable after an interrupted run, without changing user-facing behavior.
3. If parallel smoke execution becomes a requirement, add deliberate storage isolation and then assess parallel-only failures separately.
4. Run `npm audit` in `server/`, identify the seven reported vulnerabilities, and plan safe dependency updates.
5. Add a documented local `.env.example` and require `JWT_SECRET` outside local development; do not commit `.env` or secret values.
6. Inventory API endpoints, auth/role checks, and booking constraints from `server/src/index.js`.
7. Confirm whether `server/src/db.json` is seed data or mutable runtime data; define reset, backup, and concurrent-write behavior.
8. Build a role/route access matrix for public, client, owner/barber, and dev/admin pages.
9. Validate mobile device flows and booking edge cases only after the smoke baseline is green.
10. Design staging (Netlify/static host plus hosted API, managed storage, CORS, observability, and secrets) before deploying anything.

## Guardrails retained

- Do not change booking logic or make broad refactors.
- Do not deploy, merge `main`, force-push, or run release automation.
- Do not touch nested `slotzy/`.
- Do not add native/Capacitor files yet.
- Do not commit `node_modules`, `test-results`, `playwright-report`, zip files, `.env`, secrets, or mutable `server/src/db.json` data.
## Logo-branding smoke blocker fix (2026-09-27)

- Root cause: stale test setup/navigation, not a missing selector or Settings rendering bug. `#shopLogoInput` remains a static Settings control. The logo test seeded a named shop with no services and no enabled availability, so the existing owner setup guard correctly redirected the test to `owner-setup.html`; Playwright then timed out waiting for `#shopLogoInput`.
- Previous exact failure: `tests/smoke/logo-branding.spec.js` timed out at `page.setInputFiles('#shopLogoInput', ...)` after 15 seconds. Artifact: `test-results/logo-branding-shop-logo-up-10c32-public-booking-and-QR-print/error-context.md`.
- Changed [tests/smoke/logo-branding.spec.js](C:/Dev/Slotzy/tests/smoke/logo-branding.spec.js): its seeded owner now has one active, shop-scoped service and enabled Monday availability. This satisfies the existing setup-completion guard and lets the test reach the real Settings screen.
- No application, branding, public-link, QR, booking-policy, or authentication behavior changed.
- Validation:
  - `npm run test:smoke -- --list`: **24 tests in 7 files**.
  - `npx playwright test tests/smoke/logo-branding.spec.js --workers=1 --reporter=list`: **1 passed (3.4s)**.
- Remaining Settings concern: none found for this blocker. The passing test still verifies logo upload persistence, public booking branding, and QR print behavior.

## Deployment and database architecture plan (2026-09-27)

- Created `docs/DEPLOYMENT_ARCHITECTURE.md`. This is documentation only: no deployment, database, migration, SDK, secret, booking, authentication, or session behavior was changed.
- Major recommendation: retain Express as Slotzy's business-logic/API boundary and replace only its `db.json` adapter with Supabase Postgres in phases. This preserves the current client/API seam and avoids combining database migration with a client authorization rewrite.
- The plan documents current static/local-storage/API behavior, Express/JWT/db.json/email model, routes/endpoints, relational schema, manage-token requirement, environment separation, security, staged migration, rollback, smoke-test impact, and explicit deferred work.
- Next recommended implementation task, after approval: define a public API base-URL configuration mechanism and staging-safe failure behavior that prevents authenticated writes from silently falling back to local storage. Do not add Supabase code or change persistence in that task.

## Environment-aware frontend API configuration (2026-09-27)

- Added `js/api-config.js` as the canonical browser API base. It reads the non-secret `window.SLOTZY_CONFIG.apiBaseUrl` configuration from `js/public-config.js`, accepts an origin or `/api` value, and otherwise preserves the local `http://localhost:3001/api` default.
- Centralized frontend backend URLs in `js/dataStore.js`, `js/auth.js`, `js/booking-notifications.js`, `js/dev-emails.js`, and `js/admin.js`. Endpoint paths and local/local-storage behavior are unchanged. Playwright fixtures may still deliberately reference localhost while simulating backend availability.
- Added `js/public-config.example.js` and documented staging/production examples in `README.md`. Both configuration files contain no deployment URL or secret by default.
- CORS was reviewed only: Express remains `cors({ origin: true })` for local behavior. README and architecture documentation now require an explicit, environment-specific `CORS_ALLOWED_ORIGINS` allowlist before hosted staging; no CORS behavior was changed in this task.
- Validation: `npm run test:smoke -- --list` remains **24 tests in 7 files**. Focused critical-flow tests passed for backend-offline local fallback (**1 passed, 2.1s**) and backend-health server mode (**1 passed, 2.4s**). `cd server && npm run dev` started successfully and `GET http://localhost:3001/api/health` returned HTTP 200; the local process was then stopped.
- Next recommended task: add a staging-safe API failure policy for configured hosted mode so authenticated writes do not silently fall back to browser storage. Do not add database or Supabase code yet.

## Supabase Postgres schema foundation (2026-09-27)

- Created `docs/SUPABASE_SCHEMA.sql` and `docs/SUPABASE_SCHEMA_NOTES.md`. They are design/migration artifacts only; no Supabase project, SDK, connection, runtime adapter, deployment, `db.json`, booking, or auth/session behavior changed.
- The schema preserves Express as the server-only data access and authorization layer, while adding multi-shop memberships, provider services, weekly availability/time off, shop settings, booking snapshots/history, active-booking overlap protection, and hashed/expiring manage tokens.
- The notes document field-by-field `db.json` mapping, safe seed/staging/production separation, RLS rationale for a server-only phase, migration order, backup/rollback, and continued local-storage smoke tests.
- Next recommended task: specify a Postgres repository adapter and API contract tests against disposable Postgres. Do not modify `server/src/db.js`, install Supabase packages, create a Supabase project, or switch persistence yet.

## Backend storage adapter seam (2026-09-27)

- Added `server/src/storage/index.js` as the canonical storage entry point and `server/src/storage/jsonStore.js` as the only active implementation. JSON remains the default through `SLOTZY_STORAGE=json` and continues to persist to `server/src/db.json`.
- `server/src/index.js` now imports generic `readStore`/`writeStore`, so routes no longer import the file adapter or know the JSON path. Existing route-level in-memory array/object mutations are intentionally retained to preserve API and booking behavior while the first persistence seam is established.
- The JSON adapter owns file read/write/shape normalization and Dev Outbox append/list/clear operations. `emailService.js` now uses those storage operations rather than directly reading or mutating `db.emails`.
- `server/src/db.js` remains a compatibility shim exporting `readDb`/`writeDb` from the canonical storage entry point. Unsupported `SLOTZY_STORAGE` values fail clearly at startup; no Supabase SDK, connection, SQL execution, migration, or deployment was added.
- Validation: root `npm run test:smoke -- --list` remains **24 tests in 7 files**; focused `auth uses server mode when backend health is online` passed (**1 passed, 2.4s**). The default storage selector reports `json`; an unsupported selector reports `Unsupported SLOTZY_STORAGE value "unsupported". Only "json" is available in this release.` `cd server && npm run dev` started successfully and `/api/health` returned `{"ok":true,"service":"slotzy-api"}` before the local process was stopped. `server/src/db.json` was not modified.
- Next recommended task: define and test a Postgres adapter under `server/src/storage/` against the current JSON storage contract, including transactional booking writes and outbox behavior, before making any adapter selectable.

## Storage contract tests and Postgres adapter foundation (2026-09-27)

- Added `docs/STORAGE_CONTRACT.md` and `server/test/storage-contract.test.js`. The contract covers normalized document read/write, the required default shape, and Dev Outbox append/list/clear semantics. Tests use a unique temporary OS directory per case and do not read or write `server/src/db.json`.
- `server/src/storage/jsonStore.js` now exports `createJsonStore({ filePath })` for isolated tests while preserving its default production file path and exported operations.
- Added `server/src/storage/postgresStore.js`. It exports the same named storage operations and validates `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` when `SLOTZY_STORAGE=postgres` is selected. It intentionally has no Supabase SDK, network, SQL, database connection, JSON fallback, or runtime persistence implementation.
- Storage selection now recognizes `json` (default) and explicit `postgres`; unknown values fail clearly. Explicit Postgres without credentials fails with `SLOTZY_STORAGE=postgres requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Keep Supabase service-role credentials server-side only.`
- Validation: `cd server && npm run test:storage` passed **7/7**; root smoke discovery remains **24 tests in 7 files**; focused server-mode auth smoke passed (**1 passed, 2.4s**); normal JSON backend startup succeeded and `/api/health` returned HTTP 200. No schema SQL, Supabase project, deployment, or `server/src/db.json` modification occurred.
- Next recommended task: implement and contract-test a real parameterized Postgres adapter against a disposable local/test database, including the documented atomic booking transaction, before selecting `postgres` in any hosted environment.

## Postgres storage operations (2026-09-27)

- Added `@supabase/supabase-js` to `server/package.json` and its server lockfile only. The SDK is imported exclusively from `server/src/storage/postgresStore.js`; no browser/frontend dependency or credential was added.
- The Postgres adapter now validates server-only Supabase credentials, creates a server-side client, maps relational users/shops/settings/members/services/provider services/availability/time off/bookings/outbox rows back to existing JSON-style Express shapes, and performs outbox operations through SDK calls.
- Legacy full-document `writeStore` calls a required `slotzy_storage_write_snapshot` RPC rather than attempting a race-prone client-side table replacement. That reconciliation RPC is deliberately not yet defined because it needs reviewed source-ID mapping and disposable-database tests before Postgres can be enabled.
- Added a planned atomic `slotzy_create_booking(payload jsonb)` RPC to `docs/SUPABASE_SCHEMA.sql`: it inserts the booking, hashed manage token, booking event, and optional outbox row in one transaction while the exclusion constraint rejects active overlaps. Raw tokens are generated/hashes supplied by server code only and must never be logged.
- Added `server/test/postgres-store.integration.test.js` and `npm run test:storage:postgres`. With no `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY`, all seven integration cases are clearly skipped (not passed) and no database is contacted.
- Validation: JSON storage tests remain **7/7 passed**; smoke discovery is **24 tests in 7 files**; focused server-mode auth smoke passed (**1 passed, 2.5s**); `server/src/db.json` remains unchanged. No SQL was executed and no staging/production database or deployment was touched.
- Next required step: provision an explicitly disposable Supabase test project, apply the reviewed schema plus a source-ID-safe snapshot reconciliation RPC, then replace skipped integration fixtures with real create/read/update/overlap/token/outbox assertions before any staging selection of `SLOTZY_STORAGE=postgres`.

## Disposable Postgres snapshot path (2026-09-27)

- Added `legacy_source_ids`, `slotzy_storage_write_snapshot(snapshot jsonb)`, and guarded `slotzy_reset_disposable_test_data` definitions to `docs/SUPABASE_SCHEMA.sql`. The snapshot path maps legacy IDs to generated relational UUIDs, upserts snapshot-owned rows, and avoids deleting unrelated data.
- Added `docs/SUPABASE_TEST_SETUP.md` with exact disposable-project setup, server-only test variables, an explicit destructive-reset marker/confirmation, and teardown instructions. No SQL was applied by this task.
- Real Postgres validation remains unperformed because `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` were not available. The **9** planned integration cases therefore continue to skip clearly; do not treat that as a passing database suite.
- Next manual step: create an empty disposable Supabase project, apply the reviewed schema manually, mark it disposable, set the two test credentials plus reset opt-in, and run `cd server && npm run test:storage:postgres`.

## Disposable Postgres integration fixture lifecycle (2026-09-27)

- Replaced the Postgres integration-test lifecycle placeholder with a real fixture in `server/test/postgres-store.integration.test.js`. It constructs the store from `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` explicitly, without setting runtime `SUPABASE_*` variables or enabling the Postgres adapter for ordinary server execution.
- Before the suite, before every one of the nine cases, and after the suite, the fixture requires the literal process opt-in `SLOTZY_ALLOW_DISPOSABLE_TEST_RESET=true`, reads `public.slotzy_test_control`, and requires `is_disposable=true`. Only then does it invoke the existing `slotzy_reset_disposable_test_data('DISPOSABLE_SLOTZY_TEST_RESET')` RPC. Failed guards are reported as fixture setup failures and no reset is attempted.
- The cases now cover user, shop, service (including soft deletion), availability/time-off, atomic booking/read/update/overlap rejection, hashed manage-token lookup, snapshot round-trip, snapshot idempotency, and outbox behavior. No booking/auth route behavior or `server/src/db.json` was changed.
- Validation in this workspace: `cd server && npm run test:storage` passed **7/7** and `npm run test:smoke -- --list` reported **24 tests in 7 files**. The Postgres command discovered all **9** cases but skipped all nine because test credentials are not present in this process, so no database was contacted and there is no real-database pass/fail result here.
- No SQL change was required: the current schema already defines the guarded reset RPC. The disposable project does not need updated SQL for this fixture; it only needs the already documented schema and disposable marker applied before a credentialed run.

## First disposable Postgres integration failures — schema repair pending validation (2026-09-27)

- Credentialed disposable tests exposed three schema-only defects: JSON extraction in `slotzy_storage_write_snapshot` could apply `->>` to a text-resolved generic loop record; its booking service fallback used ambiguous `shop_id = shop_id`; and the project intentionally had no automatic table grants, so direct service-role outbox access was denied.
- Corrected `docs/SUPABASE_SCHEMA.sql` with typed JSONB loop values, `v_*` PL/pgSQL variables, qualified lookup aliases, and explicit `service_role` schema/table/sequence/function grants. It revokes Slotzy RPC access from `public`; browser roles remain ungranted.
- Added `docs/SUPABASE_TEST_PATCH.sql`, a non-destructive one-time patch for the existing disposable project. It replaces only the snapshot RPC and applies the explicit grants. Apply it manually in the disposable project's SQL editor, then rerun `cd server && npm run test:storage:postgres` with the existing uncommitted test variables. A new credentialed run is required before claiming database success.

## Remaining disposable Postgres repair — patch reapplication required (2026-09-27)

- The still-failing `text ->> unknown` was not a remaining JSON loop type issue. PostgreSQL treats `||` and `->>` as generic left-associative operators, so `v_username || ':' || v_time_off->>'startISO'` was parsed with concatenated text as the left operand of `->>`. The full schema and incremental patch now parenthesize every JSON extraction used with string concatenation, including membership/provider identifiers and legacy date composition.
- `postgresStore.clearOutboxEmails()` now uses the explicit PostgREST predicate `.not("id", "is", null)` before deletion. `email_outbox.id` is a non-null UUID primary key, so this clears all outbox rows while satisfying PostgREST's no-unqualified-delete safety rule; no permissions changed.
- Reapply the current `docs/SUPABASE_TEST_PATCH.sql` to the disposable project (it is safe to rerun), then execute the credentialed Postgres suite again. Local JSON and smoke-discovery checks remain required; no credentialed success is claimed until that external run completes.

## Final disposable Postgres reconciliation fixes pending validation (2026-09-27)

- A user-only legacy snapshot retained `shopId` while intentionally omitting its shop. The snapshot RPC previously inserted an invalid `shop_members` row with a null shop foreign key; it now requires both resolved IDs before creating a membership.
- Booking confirmation collisions were fixture contamination/reused values, not a reason to relax the unique index. Each case now performs its own guarded serial reset and atomic-booking tests use distinct explicit codes (`BKG001`/`BKG002` and `TOK001`).
- Snapshot booking upserts previously left some mutable fields stale, so a prior `Fixture Client` row could survive reconciliation. The conflict update now covers mutable booking relationship, customer/contact, schedule/status, policy/service snapshot, cancellation, deposit, and confirmation fields.
- The outbox count was also isolation contamination. Each integration case now calls the existing guarded reset itself before execution, so the exact `{ cleared: 2 }` contract remains asserted. Apply the current incremental patch and run the credentialed suite again.

## Staging Postgres runtime preparation (2026-09-27)

- JSON remains the default adapter. Explicit `SLOTZY_STORAGE=postgres` continues to require server-only Supabase credentials and cannot fall back to JSON.
- Staging/production-like startup now requires both `JWT_SECRET` and a non-empty `CORS_ALLOWED_ORIGINS`; local development retains the existing JWT fallback and permissive CORS. `/api/health` reports only `ok`, service name, active adapter, and runtime environment—never URLs, credentials, or tokens.
- Added `server/.env.example` placeholders and `docs/STAGING_CUTOVER.md`, covering a separate empty staging project, schema application, backend-only secret configuration, functional/manual QA, synthetic-only seed strategy, and the explicit `SLOTZY_STORAGE=json` rollback. No deployment or infrastructure change occurred.

## Successful staging validation and QA gate (2026-09-27)

- Staging is live and validated: Netlify frontend `https://slotzy-staging.netlify.app`, Render API `https://slotzy-staging-api.onrender.com`, and a dedicated Supabase staging project. Health confirms `ok=true`, `storage=postgres`, and `environment=staging`.
- Manual end-to-end checks passed for registration, authenticated owner dashboard, service creation, availability, refresh persistence, public booking link/booking, owner appointment visibility, manage link, cancellation, and rescheduling. This remains synthetic staging data only.
- Added `docs/STAGING_QA_CHECKLIST.md` for repeatable infrastructure, auth, setup, booking, management, mobile, recovery, and data-safety testing, plus `docs/PILOT_READINESS.md` for the pilot, native, and production gates. No runtime, schema, database, deployment, or nested-project change was made.
- Next recommended work: build a staging-only automated E2E smoke path with isolated synthetic data, then complete the remaining manual/mobile/recovery checklist cases before inviting real barbers.

## Guarded staging E2E smoke suite (2026-09-27)

- Added `tests/staging/staging.e2e.spec.js` and `npm run test:staging`. It refuses to run without the literal opt-in plus explicit HTTPS staging frontend/API URLs, requires hostnames containing `staging`, then polls health for up to 150 seconds and requires `ok=true`, `environment=staging`, and `storage=postgres` before any mutation.
- The serial hosted flow uses unique `e2e-` owner/shop/service/client identities, covers registration through public booking, receipt/manage link, owner visibility, cancellation confirmation, persistence reloads, and invalid login/manage-link checks. It does not target production or use customer data.
- No targeted staging cleanup API exists, so no cleanup endpoint or broad reset was added. Test records are intentionally left with the recognizable prefix for manual staging-only removal. Hosted execution remains outstanding until an operator runs the documented PowerShell command with environment values set.

## Staging E2E registration navigation correction (2026-09-27)

- A hosted run completed registration but remained at `pages/index.html`, while the first E2E assertion assumed an immediate setup/dashboard URL. The corrected test first proves registration changed the real UI state: auth modal closes, the authenticated user badge contains the synthetic owner name, and the Dashboard control is visible. It then clicks that actual control and asserts `owner-setup.html` or `business-owner.html` navigation.
- No application behavior, Supabase/Render configuration, schema, credentials, or deployment changed. This is a test correction that preserves owner setup coverage and fails if registration does not establish a usable authenticated UI state.

## Staging E2E registration modal diagnostics (2026-09-27)

- The hosted run showed the registration modal remained open after Continue. Source review confirms this only happens when `submitAuth` throws: successful server registration calls `setUser`, `hideModal`, and dashboard navigation. The form has no undisclosed required field beyond username/password/role.
- The E2E now waits for the actual `POST /api/auth/register` response, fails immediately with its HTTP status and safe error message when unsuccessful, and races modal closure against visible `#auth-error` for a maximum of five seconds. If the API succeeds but neither condition follows, it reports a specific auth-UI defect. A new hosted run is needed to identify the exact response/error; no application code was changed.

## Staging registration HTTP 500 diagnostic hardening (2026-09-27)

- The E2E registration payload is only `username`, `password`, and `role`: a unique 32-character lower-case/hyphen `e2e-...-owner` username, bcrypt-safe synthetic password, and `owner`. Its generated email is not sent. The route accepts these values; existing Postgres test identifiers already exercise hyphens.
- The route's generic catch previously discarded the only server-side error. It now logs a safe route/storage/error-code/message diagnostic to Render while preserving the browser's generic `internal server error` response and never logging request bodies, passwords, JWTs, or credentials.
- Added Postgres regression coverage for an owner with `shopId: null`, matching registration before shop setup. The snapshot RPC is transactional, so a failed write rolls back its user and legacy-source-ID writes rather than leaving a partial relational record. No SQL patch is required by this code review; Render logs from the next guarded run are required to identify any stale-schema or hosted-only error precisely.

## Render-to-Supabase fetch diagnostic hardening (2026-09-27)

- The hosted registration failure occurs before password persistence or snapshot reconciliation: registration calls `readStore()`, whose first ordered Supabase request is `from("users").select("*").is("deleted_at", null)`. The adapter issues all its relational reads in parallel, so the earlier generic `read` label could not identify which request first reported a transport failure.
- The adapter now labels each read and wraps its original SDK error with an allowlisted `storageDiagnostic`. A server-only Supabase fetch wrapper retains the original Node network failure when the SDK flattens it. Logs may include only error name/message, code, errno, syscall, and hostname (including one nested cause); URL-shaped text is redacted. No credentials, headers, JWTs, request bodies, passwords, or raw client configuration are logged or returned to the browser.
- This changes diagnostics only: the API still returns generic HTTP 500 responses, Postgres remains opt-in, and no schema/database/deployment change occurred. A Render redeploy followed by the guarded staging E2E run is required to capture the actual DNS/TLS/socket cause. No SQL patch is required.

## Flattened Render Supabase network diagnostics (2026-09-27)

- Render abbreviated the nested Node fetch cause in `storageDiagnostic.network` as `[Object]`. Storage diagnostics now use flat allowlisted fields: `networkName`, `networkMessage`, `networkCode`, `networkErrno`, `networkSyscall`, `networkHostname`, and the corresponding `networkCause...`/`networkCauseCause...` fields. URL-shaped values remain redacted.
- On staging with the Postgres adapter selected, startup now performs a non-blocking DNS lookup of the configured Supabase hostname. It logs only hostname plus success/failure or the same flat safe network fields. The probe neither sends credentials nor fails startup.
- The browser still receives generic HTTP 500 errors. No schema, credentials, deployment, auth behavior, or database state changed. Redeploy staging Render and rerun the guarded E2E suite to obtain the concrete network cause.

## Successful registration response UI-transition diagnostics (2026-09-27)

- Source review confirms the registration contract matches: the API returns HTTP `201` with a token and `user` from `buildAuthUser` (`username`, `role`, `shopId`, and `displayName`); `submitServerAuth` requires the token plus `user.username`/`user.role`, then stores the session before `setUser`, `hideModal`, and dashboard navigation.
- The guarded staging E2E now asserts that safe response shape and, if the UI does not transition within five seconds, reports only modal/auth-error/user-badge/Dashboard/current-path state plus redacted page and console errors. It never prints the token. This preserves the modal-close and authenticated-state success requirements while making a post-response browser exception actionable.
- The root cause was an E2E-only navigation race, not a response mismatch or client exception: `hideModal()` finalizes after a transition timeout, while the successful owner path immediately calls `goToDashboard()` and can replace `index.html` first. The old helper waited only for the original document's modal state. It now accepts only the intended `owner-setup.html`/`business-owner.html` navigation as an equivalent non-blocking success state, then asserts the synthetic owner session and owner page. No application behavior changed; a hosted rerun remains required for confirmation.

## Staging E2E collision-resistant identities (2026-09-27)

- The latest hosted registration failure is a real database uniqueness result (`23505` on `users_username_key`), not a connectivity or credential problem; the staging DNS probe also succeeded. The uniqueness constraint remains required and unchanged.
- Each staging E2E run now builds a short `e2e-` ID from base-36 timestamp, Node process ID, and 64 bits from `randomUUID()`. The owner username, shop name/slug, service name, and synthetic client values all use that same ID. This avoids timestamp-only collisions across rapid or parallel runs while remaining readable and compatible with the unbounded `citext` username column.
- If a non-generic registration response contains PostgreSQL `23505`, duplicate-key text, or an existing-username message, the E2E explicitly reports a synthetic fixture collision. There is still no automated staging cleanup or reset; any future cleanup must target one exact run prefix only.

## Staging snapshot user-identity reconciliation repair (2026-09-27)

- The `write snapshot` `23505` was not a collision in the newer synthetic username. `readStore()` had returned existing relational `users.id` UUIDs, whereas snapshot reconciliation had mapped the earlier legacy `users[].id` source to a different generated relational UUID. A later full snapshot therefore treated the existing user UUID as a new source, generated a second target UUID, and attempted to insert the already-used username.
- Reads now return the canonical `legacy_source_ids` user source ID where available. The source-ID helper also recognizes an unmapped existing relational user UUID, reuses that UUID, and safely creates the missing mapping instead of creating a duplicate target. Username uniqueness remains unchanged. New disposable integration cases cover a mapped non-empty snapshot plus an unmapped direct relational user followed by a new user.
- Added `docs/SUPABASE_STAGING_REPAIR.sql`: a non-destructive, idempotent staging-only preflight/backfill for users with no canonical mapping. It adds mappings only; it never deletes or changes users. The corrected schema and disposable test patch include the helper repair. Apply the staging repair after reviewing its count if historical users lack mappings, then rerun the guarded E2E. No production action is authorized.
