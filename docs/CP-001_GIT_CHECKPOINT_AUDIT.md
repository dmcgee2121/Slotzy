# CP-001 — Pre-Beta Git Checkpoint Audit

**Repository:** `C:\Dev\Slotzy`  
**Branch:** `restore-source-files`  
**Audited HEAD:** `7d41093bc7bec49fa7eb1b0c81364f64fd9e0afc`  
**Audit date:** 2026-10-18  
**Scope:** Read-only checkpoint audit and non-mutating verification. No staging, commit, push, deployment, database reset, migration, or deletion was performed.

## Executive result

The working tree contains a coherent local-E2E isolation implementation, a focused API-backed availability fail-closed repair, and the supporting acceptance evidence. The changes are suitable for a **proposed local checkpoint** after normal review. The only intended residual risk is that the local-only `forceApiMode` served configuration has unit coverage indirectly through the browser acceptance evidence rather than a dedicated assertion in `local-e2e-config.test.cjs`.

No credential, token, connection string, SMTP secret, or generated diagnostic log was found among the changed/untracked checkpoint candidates. The local launcher obtains a transient Supabase CLI service-role key at runtime and does not write or print it.

## Baseline and working tree

- Expected branch: `restore-source-files`; observed branch: `restore-source-files`.
- Expected baseline commit: `7d41093`; observed HEAD: `7d41093bc7bec49fa7eb1b0c81364f64fd9e0afc`.
- Tracked modifications: 8 files.
- Existing untracked records/infrastructure: 20 files before this audit report.
- `git diff --check` reported only Windows CRLF normalization warnings; no whitespace defect.
- No unrelated temporary diagnostic runner or log is present in the repository worktree.

## File classification and review

### A — Application behavior / safe bug repair

| File | Review result |
| --- | --- |
| `js/dataStore.js` | Enables API mode when the served local-only configuration explicitly sets `forceApiMode`; API-backed availability reads fail closed instead of silently treating browser storage as successful persistence. Standalone localStorage behavior remains available when API mode is not selected. |
| `server/src/storage/jsonStore.js` | Allows an unshoppped newly registered owner to read only their own default availability; cross-owner protection remains intact. |
| `server/src/storage/postgresStore.js` | Matches the JSON behavior for PostgreSQL snapshots. |
| `server/test/storage-contract.test.js` | Adds focused owner/default availability authorization coverage. |

### B — Local test infrastructure and isolation guardrails

| File | Review result |
| --- | --- |
| `package.json` | Adds `local:e2e` and `test:local-e2e-config` scripts only. |
| `scripts/serve.cjs` | In the explicit local E2E process only, serves loopback API configuration plus `forceApiMode: true`; checked-in hosted `public-config.js` and normal `npm run serve` behavior remain unchanged. |
| `scripts/local-e2e-config.cjs` | Accepts only Supabase CLI identity `127.0.0.1:54321` and `127.0.0.1:54322/postgres`; creates a minimal environment, pins PostgreSQL, disables inherited SMTP, and forces Dev Outbox. |
| `scripts/local-e2e-config.test.cjs` | Tests parsing, exact local identity rejection/acceptance, PostgreSQL pinning, loopback bind, blank SMTP, and Dev Outbox. |
| `scripts/start-local-e2e.cjs` | Fails before child startup on missing/mismatched CLI credentials; starts loopback frontend/API and verifies health/config before ready. It neither resets nor migrates Supabase. |
| `server/src/emailService.js` | Makes the explicit local isolation flag authoritative for Dev Outbox. |
| `server/src/index.js` | Honors controlled loopback binding and adds listener error handling. |
| `docs/LOCAL_E2E.md` | Documents the intentionally isolated, non-destructive local workflow. |

### C — Acceptance and diagnostic evidence (retain as history)

| File | Purpose |
| --- | --- |
| `docs/QA-001_P0-B6_CONTROLLED_LOCAL_E2E_ACCEPTANCE_REPORT.md` | Initial controlled-local acceptance baseline. |
| `docs/QA-002_P0-B6_CONTROLLED_LOCAL_ACCEPTANCE.md` | Availability 403 and fallback evidence. |
| `docs/QA-003_P0-B6_ACCEPTANCE_RESUMPTION.md` | Resumption evidence and service-setup blocker. |
| `docs/QA-004_P0-B6_ACCEPTANCE_CONTINUATION.md` | Acceptance continuation record. |
| `docs/QA-005_P0-B6_END_TO_END_ACCEPTANCE.md` | Owner setup/end-to-end evidence. |
| `docs/QA-006_P0-B6_BOOKING_ACCEPTANCE.md` | Owner setup and booking readiness evidence. |
| `docs/QA-007_PUBLIC_BOOKING_ACCEPTANCE.md` | Public booking readiness evidence. |
| `docs/QA-008_FIRST_CUSTOMER_BOOKING.md` | First-customer-booking investigation record. |
| `docs/QA-009_TIME_SLOT_AND_BOOKING_ACCEPTANCE.md` | Browser-created appointment and PostgreSQL evidence. |
| `docs/QA-010_CUSTOMER_TO_OWNER_VERIFICATION.md` | Customer-to-owner dashboard verification. |
| `docs/FIX-004_SERVICE_CREATION_DIAGNOSTICS.md` | Historical diagnostic limitation and evidence. |
| `docs/FIX-005_SERVICE_CREATION_ISOLATION.md` | Service-creation isolation finding. |
| `docs/FIX-006_OWNER_SETUP_STEP1.md` | Owner setup step-one diagnostic. |
| `docs/FIX-007_OWNER_SETUP_CLICK_TRACE.md` | Wizard timing/root-cause trace. |
| `docs/FIX-008_PUBLIC_BOOKING_CONTEXT.md` | Public booking context diagnosis. |
| `docs/FIX-009_PUBLIC_BOOKING_INITIALIZATION.md` | API-mode initialization repair evidence. |

The intermediate `BLOCKED` conclusions in early historical reports are not current release dispositions; later reports record the corresponding repairs and successful browser evidence. They should nevertheless be retained as traceable acceptance history.

### D — Explicit exclusions

None identified. In particular, no local `.env`, generated browser/API log, diagnostic runner, credential artifact, database dump, dependency cache, or unrelated user file is proposed for inclusion.

## Security and isolation review

- **Credentials:** No actual Supabase service-role key, JWT, SMTP credential, or hosted connection string appears in the candidate files. `local-only-key` is a test fixture.
- **Hosted routing:** The local launcher uses a clean environment rather than inheriting shell configuration. It derives the only Supabase values from `supabase status --output env`, then rejects every identity except the documented loopback target.
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` are blank in the backend child. `SLOTZY_FORCE_DEV_OUTBOX=true` prevents real delivery from becoming active through local `.env` values.
- **Public configuration:** `forceApiMode` is supplied only in the local E2E server response for `/js/public-config.js`. It removes the unsafe fresh-browser localStorage mode for public API flows while preserving hosted behavior and intentional standalone behavior outside API mode.
- **Authorization:** The availability exception is constrained to the authenticated owner reading their own pre-shop default record. The focused tests preserve denial for other identities; no management endpoint becomes public.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run test:local-e2e-config` | PASS — 4/4. |
| `npm --prefix server run test:storage` | PASS — 33/33. Includes migration-safety checks and new-owner availability scope tests. |
| `npm --prefix server run test:api` (separately rerun) | PASS — 42/42. |
| Local health | PASS — `ok: true`, `storage: postgres`, `environment: development`. |
| Served local configuration | PASS — contains `http://127.0.0.1:3001/api` and `forceApiMode: true`; contains no hosted/staging route. |
| Read-only Playwright browser smoke | PASS — `pages/book.html?shop=qa006-shop-qa006-mvdcccem` returned 200, displayed the known synthetic shop, fetched `/api/public/booking-context` from local Express, and all 17 observed requests were loopback-only (`127.0.0.1:5173` or `127.0.0.1:3001`). No record was created or changed. |

## Proposed checkpoint plan — not executed

Use three reviewable commits rather than one large mixed commit:

1. `feat(local-e2e): add isolated loopback acceptance environment`
   - Include `package.json`, `scripts/serve.cjs`, `scripts/local-e2e-config.cjs`, `scripts/local-e2e-config.test.cjs`, `scripts/start-local-e2e.cjs`, `server/src/emailService.js`, `server/src/index.js`, and `docs/LOCAL_E2E.md`.
2. `fix(availability): fail closed for API-backed owner sessions`
   - Include `js/dataStore.js`, `server/src/storage/jsonStore.js`, `server/src/storage/postgresStore.js`, and `server/test/storage-contract.test.js`.
3. `docs(acceptance): retain controlled local P0-B6 evidence`
   - Include every file in classification C plus this audit report.

No `git add`, `git commit`, `git push`, or modification of historical evidence was performed during this audit.

## Residual risks and recommendation

- Add a small dedicated assertion for the served `forceApiMode` local response in a future focused test if practical; the behavior is currently covered by direct browser verification.
- The retained reports include historical troubleshooting states, so release readers should treat QA-009 and QA-010 as the latest end-to-end evidence.
- The proposed checkpoint is **recommended after reviewer approval**. It is not a substitute for the remaining P0-B6 scenario matrix, but it cleanly preserves the local isolation and verified customer-to-owner path achieved so far.
