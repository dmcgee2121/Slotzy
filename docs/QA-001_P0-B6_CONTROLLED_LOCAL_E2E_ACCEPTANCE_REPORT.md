# SLOTZY — QA-001
## P0-B6 Controlled Local End-to-End Acceptance Report

**Department:** Quality Assurance  
**Priority:** P0 — Release Blocking  
**Execution date:** 2026-10-17 (America/Chicago)  
**Execution environment:** Local-development verification only  
**Recommended disposition:** **BLOCKED**

## 1. Repository and safety verification

| Check | Expected | Observed | Result |
| --- | --- | --- | --- |
| Repository root | `C:\Dev\Slotzy` | `C:/Dev/Slotzy` | PASS |
| Active branch | `restore-source-files` | `restore-source-files` | PASS |
| HEAD commit | `7d41093` | `7d41093` | PASS |
| Working tree | Headquarters baseline | Clean; `git status --short` produced no entries | PASS |
| P0-B5 acceptance plan | Available and reviewable | No P0-B5 plan was found in the current worktree or reachable Git history by name/content search | BLOCKED |

No application state-changing command was run. No hosted environment was contacted, no deployment was performed, and no branch, commit, or runtime configuration file was changed. This QA report is the sole new worktree file.

Potentially destructive operations identified but **not run**:

- `npx supabase start` / `npx supabase stop` (local Docker-stack lifecycle).
- SQL schema and marker commands documented in `docs/SUPABASE_TEST_SETUP.md`.
- `test:storage:postgres:local`, which can invoke the disposable-data reset workflow after guard checks.
- Dev Outbox clearing (`DELETE /api/dev/emails`) and any app flows that write bookings or configuration.

## 2. Existing plan and implementation alignment

The requested P0-B5 acceptance plan is absent from this baseline, so formal plan alignment cannot be completed.

The currently documented local startup path is `npm run serve` for the static frontend and `cd server; npm run dev` for Express. The repository also documents `npm run dev:all`.

The storage selection is controlled by `SLOTZY_STORAGE` in `server/src/storage/index.js`. Its default is `json`; the sample environment config also sets `SLOTZY_STORAGE=json`. The JSON adapter persists to `server/src/db.json`. A Postgres adapter exists and is selected only by `SLOTZY_STORAGE=postgres` with server-only Supabase URL and service-role credentials.

Owner authentication is JWT-based (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`). Owner-protected domain routes require JWT authorization; booking updates use `PATCH /api/bookings/:bookingId`. Customer public-booking and manage-link flows are documented separately. Email uses Nodemailer only when every SMTP setting is configured; otherwise the API stores messages in the Dev Outbox through the active storage adapter.

## 3. Local-environment verification

| Component | Required endpoint | Observation | Result |
| --- | --- | --- | --- |
| Frontend | `http://localhost:5173` | No TCP listener on port 5173; HTTP probe timed out. | BLOCKED |
| Express API | `http://localhost:3001/api` | No TCP listener on port 3001; health probe timed out. | BLOCKED |
| Supabase API | `http://127.0.0.1:54321` | Local `supabase_kong_Slotzy` Docker container was running and bound to port 54321. | PASS (port/container only) |
| PostgreSQL | `127.0.0.1:54322/postgres` | Local `supabase_db_Slotzy` Docker container was running and bound to port 54322. | PASS (port/container only) |

### Critical configuration finding — DEFECT QA-001-01

`js/public-config.js`, a tracked runtime configuration file loaded by `js/api-config.js`, sets `apiBaseUrl` to `https://slotzy-staging-api.onrender.com/api`.

**Severity:** P0 (release-blocking for this controlled-local acceptance assignment)  
**Area:** Configuration / frontend API routing  
**Expected:** The local acceptance frontend must use `http://localhost:3001/api` for the booking workflow.  
**Actual:** The checked-in frontend runtime configuration overrides the local default with a hosted staging API URL.  
**Reproduction:** Serve the repository unchanged, then load any module importing `js/api-config.js`; it imports `js/public-config.js`, reads the configured URL, and normalizes it as the active API base.  
**Evidence:** Static inspection of `js/public-config.js` and `js/api-config.js`; no browser was launched because that could connect to prohibited hosted staging.  
**Impact:** The team cannot demonstrate isolated local end-to-end behavior from this checkout. It also violates the assignment's explicit prohibition on connecting to `slotzy-staging` if launched unchanged.

### Persistence and email isolation result

The active API process and active runtime environment could not be inspected because Express was not running. Therefore all of the following remain unverified:

- Runtime `SLOTZY_STORAGE` selection and its exact database target.
- That customer booking uses the local Express API.
- That customer booking cannot fall back to browser storage.
- API request/response and PostgreSQL record creation.
- Runtime SMTP absence and Dev Outbox-only delivery.

Although a local Supabase/PostgreSQL stack exists, container/port availability alone is not evidence that the application would use it. No test data was created.

## 4. Scenario matrix

| ID | Scenario | Actual result | Execution record / reason |
| --- | --- | --- | --- |
| QA-01 | Owner registration and authentication | BLOCKED | Local frontend/API unavailable; frontend configuration points to hosted staging. |
| QA-02 | Shop configuration | BLOCKED | Same environment gate; no data created. |
| QA-03 | Public booking link | BLOCKED | Launch would select hosted staging API. |
| QA-04 | Customer booking and PostgreSQL persistence | BLOCKED | Local API persistence path could not be established. |
| QA-05 | Owner appointment visibility | BLOCKED | Depends on QA-04 and local authenticated API. |
| QA-06 | Conflict prevention | BLOCKED | Depends on controlled local booking creation. |
| QA-07 | Customer cancellation and rescheduling | BLOCKED | Depends on controlled local booking creation. |
| QA-08 | Owner appointment lifecycle | BLOCKED | Depends on controlled local booking creation. |
| QA-09 | Access-control boundaries | BLOCKED | No safe local authenticated API session could be established. |
| QA-10 | Local Dev Outbox | BLOCKED | Runtime email mode cannot be established without the local API; no email-producing flow was run. |

No scenario is reported PASS, FAIL, or UNVERIFIED because none was exercised. All are blocked by the verified environment/configuration gate.

## 5. Evidence of real API and PostgreSQL usage

No evidence can be supplied because no booking request was safely executed. The available evidence instead shows:

- local Docker containers `supabase_kong_Slotzy` and `supabase_db_Slotzy` were running on ports 54321 and 54322, respectively;
- ports 3001 and 5173 had no local listeners at verification time; and
- static frontend configuration selected the hosted staging API rather than local Express.

## 6. Defects and blockers

| ID | Classification | Severity | Status | Summary |
| --- | --- | --- | --- | --- |
| QA-001-01 | Configuration / frontend routing | P0 | Open | Tracked public runtime config directs the local frontend to hosted staging. |
| QA-001-B01 | Test-environment blocker | P0 | Open | Required local frontend and Express API were not running/listening. |
| QA-001-B02 | Test-artifact blocker | P1 | Open | Referenced P0-B5 acceptance plan is not present in the baseline or reachable history. |

## 7. Environment changes and test data

No runtime configuration was modified. Apart from this QA report, no repository files were changed. No database migration, reset, cleanup, schema command, booking, shop, user, availability record, or Dev Outbox entry was created or removed. Existing local Docker containers were only observed.

## 8. Outstanding risks

- The local runtime could silently use JSON storage even if the Dockerized database is healthy; its actual target was not verifiable without a safe local API process.
- Existing frontend configuration risks hosted-staging traffic during a purportedly local run.
- Email delivery mode is unverified at runtime; SMTP settings were not read or exposed.
- Access-control, conflict, cancellation, rescheduling, lifecycle, and persistence guarantees remain untested.

## 9. Recommendation

**BLOCKED.** Headquarters should provide or restore the P0-B5 plan, make the frontend explicitly select the local Express API for this isolated run without changing staging configuration, and start/provide a verified local Express/frontend pair whose runtime storage target and non-delivering email mode can be confirmed. A controlled P0-B6 scenario run can then begin with uniquely identified disposable local records.
