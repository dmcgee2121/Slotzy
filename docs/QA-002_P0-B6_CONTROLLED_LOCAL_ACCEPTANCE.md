# SLOTZY — QA-002
## P0-B6 Controlled Local End-to-End Acceptance

**Execution date:** 2026-10-17 (America/Chicago)  
**Repository:** `C:\Dev\Slotzy`  
**Recommended disposition:** **BLOCKED**

## 1. Repository and Git verification

- Repository: `C:\Dev\Slotzy`
- Branch: `restore-source-files`
- HEAD: `7d41093` (matches required baseline)
- Preserved pre-existing work: BE-001 modified/untracked files and `docs/QA-001_P0-B6_CONTROLLED_LOCAL_E2E_ACCEPTANCE_REPORT.md` were not edited. Its SHA-256 before this run was recorded as `9EF12922CF786BC826DF14D977DB7F1CFED31BFF7A...`.
- Final worktree status is reported below. No commit, push, deploy, reset, migration, or deletion was performed.

## 2. Safety preflight

| Check | Result | Evidence |
| --- | --- | --- |
| Hosted isolation | PASS | `local:e2e` uses a clean child environment and permits only the loopback Supabase API. No hosted endpoint was contacted. |
| Frontend API base | PASS | Served `js/public-config.js` set `http://127.0.0.1:3001/api`; browser observed its health request at that origin. |
| Local Supabase API | PASS | Launcher accepted only `http://127.0.0.1:54321`. |
| Local PostgreSQL | PASS | Local Docker database reported `postgres`; disposable marker table existed and `is_disposable=true`. The launcher pins outer port 54322. |
| Express storage | PASS | `GET /api/health` returned `{"storage":"postgres","environment":"development"}`. |
| Email isolation | PASS (configuration) | Local child set blank SMTP variables and `SLOTZY_FORCE_DEV_OUTBOX=true`; no real SMTP path was enabled. |
| Startup database mutation | PASS | Reviewed launcher contains no start/stop/reset/migrate/seed/cleanup command. |
| Real browser availability | PASS (headless fallback) | No interactive browser surface was available to Computer Use. Installed Playwright Chromium drove the real local frontend; no request was mocked or intercepted. |

## 3. Local startup and connectivity evidence

`npm run local:e2e` started successfully and announced loopback-only readiness. It started:

- frontend: `http://127.0.0.1:5173`
- Express: `http://127.0.0.1:3001`
- storage mode: `postgres`

Browser evidence from the actual local frontend:

- `GET /api/health` — 200
- `POST /api/auth/register` — 201
- `GET /api/auth/me` — 200
- `POST /api/auth/login` — 200
- `GET /api/shops` — 200
- `GET /api/services` — 200
- `GET /api/availability` — 200

PostgreSQL evidence after registration showed `users|1`, with the uniquely labeled synthetic user `qa002_owner_20261017|owner`; shops, services, bookings, and outbox records remained zero. This proves browser → local Express → local PostgreSQL for registration, without using browser storage as the persistence proof.

## 4. Scenario results

| ID | Result | Actual result and evidence |
| --- | --- | --- |
| QA-01 Owner registration | PASS | Registered `qa002_owner_20261017` via the actual frontend (`POST /api/auth/register` 201). Login returned 200; the browser retained its token/session through reload and remained on the protected owner-setup route. PostgreSQL contained the owner record. |
| QA-02 Shop setup | BLOCKED | See DEFECT QA-002-01. Owner setup invoked a forbidden localStorage fallback after an API 403, so shop/services/hours were not accepted as PostgreSQL-backed test evidence. |
| QA-03 Public booking | BLOCKED | Depends on a verified persisted shop/service/availability configuration. |
| QA-04 Customer booking | BLOCKED | Depends on QA-02/03. No booking was created. |
| QA-05 Owner visibility | BLOCKED | No valid persisted appointment was created. |
| QA-06 Conflict prevention | BLOCKED | No valid persisted appointment was created. |
| QA-07 Customer management | BLOCKED | No valid persisted appointment was created. |
| QA-08 Owner statuses | BLOCKED | No valid persisted appointment was created. |
| QA-09 Authorization | UNVERIFIED | Owner authentication and protected-route session were exercised, but unrelated-owner and customer-modification boundaries were not exercised after the persistence blocker. |
| QA-10 Dev Outbox | BLOCKED | Dev Outbox mode was verified by isolated runtime configuration, but no booking notification was generated because no valid booking was created. |

## 5. Defect QA-002-01

**Severity:** P0 — release-blocking for P0-B6  
**Component:** Frontend owner setup / API authorization and persistence behavior

### Reproduction

1. Start the verified local E2E environment.
2. Register and log in as a new owner through `pages/index.html`.
3. The frontend navigates to `pages/owner-setup.html`.
4. Observe the setup initialization request: `GET /api/availability?barberUsername=qa002_owner_20261017`.

### Expected

The new owner setup should obtain any required availability state through the local Express/PostgreSQL path, or handle a valid empty state without using browser local storage as persistence.

### Actual

The request returned **403 Forbidden** with `owner can only view availability for own shop providers`. Browser console evidence then reported:

`[Slotzy:dataStore] API availability barber read failed; falling back to localStorage.`

This fallback makes subsequent owner setup potentially browser-storage-backed, which is prohibited by this acceptance assignment. The first setup attempt was therefore not treated as evidence and no shop/service/availability record was accepted.

## 6. Dev Outbox and remaining data

- No real email was sent.
- The database outbox row count remained zero.
- Remaining intentionally created local synthetic data: one owner user, `qa002_owner_20261017`.
- No shop, service, availability, booking, or email test record was created by the accepted QA evidence.

## 7. Files created or modified

Created by this assignment:

- `docs/QA-002_P0-B6_CONTROLLED_LOCAL_ACCEPTANCE.md`

Pre-existing BE-001 changes retained without modification:

- `package.json`
- `scripts/serve.cjs`
- `server/src/emailService.js`
- `server/src/index.js`
- `docs/LOCAL_E2E.md`
- `scripts/local-e2e-config.cjs`
- `scripts/local-e2e-config.test.cjs`
- `scripts/start-local-e2e.cjs`
- `docs/QA-001_P0-B6_CONTROLLED_LOCAL_E2E_ACCEPTANCE_REPORT.md`

## 8. Final Git status

Modified: `package.json`, `scripts/serve.cjs`, `server/src/emailService.js`, `server/src/index.js`.

Untracked: the retained BE-001 files above, the earlier QA-001 report, and this QA-002 report.

## 9. Recommendation

**BLOCKED.** Correct QA-002-01 so owner setup never silently falls back to browser storage when the local API rejects availability for a newly registered owner. Re-run P0-B6 from an isolated local environment after the fix, using new uniquely labeled synthetic records. Headquarters retains final approval authority.
