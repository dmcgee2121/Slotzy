# FAT-003 — Founder Acceptance Record and Pre-Checkpoint Audit

**Date:** 2026-10-18
**Branch:** `restore-source-files`
**Committed baseline:** `19aeef610edd9640e9a288d37d1b85dad9b84bc2`
**Scope:** read-only verification and documentation. No application behavior, database records, migrations, commits, pushes, deployments, resets, or hosted services were changed or accessed.

## Recommendation

**READY FOR CHECKPOINT.**

The working tree contains a coherent, passing local booking/rescheduling increment plus its supporting migration, focused regression coverage, and acceptance records. The remaining usability observations and normal beta-readiness work should be tracked after a checkpoint; they do not invalidate the founder's local acceptance or the evidence-backed FIX-010 correction.

This is a checkpoint recommendation, not a production/beta release approval. See [Remaining beta blockers](#remaining-beta-blockers).

## Safety preflight

| Check | Result |
| --- | --- |
| Branch / committed baseline | `restore-source-files` / `19aeef610edd9640e9a288d37d1b85dad9b84bc2` |
| Working tree | Preserved; modified and untracked files are inventoried below. Nothing was staged, discarded, or reset. |
| Docker / Supabase identity | Local `supabase_db_Slotzy` was running as `supabase/postgres:17.11.0.004`. The local configuration validator accepted only `http://127.0.0.1:54321` and `127.0.0.1:54322/postgres`. |
| Disposable guard | `public.slotzy_test_control.is_disposable = true` in local `postgres`. |
| External safety | No hosted Supabase/API access, real email delivery, deletion, reset, migration application, commit, push, or deployment was performed. |

One unrelated local container (`supabase_vector_Slotzy`) was restarting during the read-only preflight. The database, REST, auth, storage, and API-facing local services needed for this audit were running; no repair was attempted.

## Founder-observed acceptance

The following is **founder-operated Chrome evidence**, not automated-test evidence:

1. The founder created the local `test1234` shop, registered/authenticated as its owner, completed all five shop-setup steps, configured a solo provider, created services/business hours, and opened the owner dashboard.
2. The founder made a public customer booking, observed it in the `test1234` owner account, then rescheduled it using the private customer-management link.
3. The founder refreshed and observed the changed appointment time persist; the owner dashboard displayed the changed appointment correctly.
4. An earlier founder-operated QA006 synthetic appointment also successfully rescheduled after FIX-010.

These observations close the human browser path that earlier P0-B8C/P0-B8C.1 automation reports could not complete. Those reports remain useful historical evidence of the automation limitation and were not altered.

## Independent local PostgreSQL evidence

Read-only SQL was run only after the local-loopback and disposable-marker checks. It did not select management tokens, password hashes, customer names, emails, phones, or contacts.

| Evidence | Result |
| --- | --- |
| `test1234` shop | Exactly one active target: name/slug `test1234`; it has an owner association. |
| Services / provider setup | 2 services, both active; 2 active provider-service rows for 1 active provider. |
| Solo owner/provider association | 1 active owner membership, 1 active provider membership, and the provider membership is associated with the shop owner. |
| Booking candidate | Exactly 1 booking row in `test1234`, status `booked`. It is therefore the uniquely identifiable founder booking for this shop at audit time. |
| Persisted appointment time | Start `2026-10-22 18:00:00+00`; end `2026-10-22 18:30:00+00`. |
| Reschedule metadata | `reschedule_count = 1`; `rescheduled_at = 2026-10-18 19:43:58.929725+00`. |
| Booking event history | One `created` event and one `rescheduled` event, both recorded with the public-client actor type. The reschedule event timestamp matches `rescheduled_at`. |
| Duplicate check | 1 booking row / 1 distinct booking ID / 0 duplicate booking-ID rows. |

The evidence confirms persistence and a single rescheduling lifecycle for the current `test1234` booking. It does not infer or disclose a customer identity or private management token.

## Regression results

Only non-destructive suites were run. No reset-capable PostgreSQL integration suite was invoked.

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | **PASS — 4/4** |
| `npm --prefix server run test:storage` | **PASS — 34/34**; includes migration-safety coverage for the reschedule RPC and storage contract checks. |
| `npm --prefix server run test:api` | **PASS — 45/45**; includes public manage-reschedule response/error coverage and the focused token-scoped management-page regression. |

The focused browser visual behavior remains founder-validated. The prior automated browser harness limitation means these unit/API results are supporting evidence, not a substitute for the founder's direct Chrome acceptance.

## Founder issue register (no fixes made)

| Observation | Evidence classification | Root-cause status / follow-up |
| --- | --- | --- |
| Customer management page may show `$0.00` despite a nonzero original service price. | Founder screenshot observation. | Uninvestigated; do not assume whether the defect is projection, snapshot, formatting, or stale state. Reproduce with a nonzero service and compare safe public-manage response fields. |
| Customer receipt/management pages contain cancel-and-rebook wording. | Founder screenshot observation. | Likely stale copy, but not root-caused in this audit. Audit all customer-facing states before changing messaging. |
| Customer-facing views sometimes show technical provider identifiers. | Founder screenshot observation. | Uninvestigated presentation/data-mapping issue; verify the exact view and whether a display-name fallback is missing. |
| Solo-shop booking pages show an empty barber-selection step. | Founder-observed behavior. | Uninvestigated flow condition; determine whether it is a harmless empty-state rendering issue or can block booking. |
| Optional shop/barber image acquisition/upload was difficult. | Founder usability report. | Not a confirmed application failure. Capture the exact upload/control/error path before prioritizing. |

## Repository inventory and checkpoint plan

### Application and test changes

| Classification | Files proposed for inclusion |
| --- | --- |
| Booking/rescheduling application | `js/client-manage.js`, `js/dataStore.js`, `server/package.json`, `server/src/index.js`, `server/src/rateLimiter.js`, `server/src/storage/index.js`, `server/src/storage/jsonStore.js`, `server/src/storage/postgresStore.js`, `server/src/publicManageReschedule.js` |
| Database migration and focused tests | `docs/SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql`, `server/test/migration-safety.test.js`, `server/test/manage-reschedule-api.test.js`, `server/test/client-manage-token-scope.test.js`, `server/test/rate-limiter.test.js` |
| Local testing infrastructure | No new local-infrastructure file is pending in this checkpoint; the existing configuration tests passed unchanged. |
| Founder acceptance / QA reports | `docs/P0-B7_BOOKING_LIFECYCLE_ACCEPTANCE.md`, `docs/P0-B8A_RESCHEDULE_DATABASE_FOUNDATION.md`, `docs/P0-B8A1_LOCAL_MIGRATION_VERIFICATION.md`, `docs/P0-B8B_CUSTOMER_RESCHEDULING_ACCEPTANCE.md`, `docs/P0-B8C_LIVE_RESCHEDULING_ACCEPTANCE.md`, `docs/P0-B8C1_BROWSER_ACCEPTANCE_RECOVERY.md`, `docs/FIX-010_FOUNDER_RESCHEDULE_ENTRY_DEFECT.md`, `docs/FAT-003_FOUNDER_ACCEPTANCE_AND_CHECKPOINT_AUDIT.md` |

### Suggested commit grouping (proposal only)

1. **`feat(reschedule): add token-scoped customer rescheduling`** — application files in the first row above, plus `server/test/manage-reschedule-api.test.js`, `server/test/client-manage-token-scope.test.js`, and `server/test/rate-limiter.test.js`.
2. **`db(reschedule): add service-role reschedule RPC safety coverage`** — `docs/SUPABASE_MANAGE_RESCHEDULE_MIGRATION.sql` and `server/test/migration-safety.test.js`.
3. **`docs(qa): record booking and rescheduling acceptance`** — all report files in the final row above, including this FAT-003 audit.

No files were staged as part of this proposal.

### Exact exclusion list

No untracked or modified file is an inappropriate artifact and no source/report file needs exclusion from the proposed checkpoint. The audit found:

- no browser traces, HAR files, videos, zip archives, coverage directories, database dumps, SQLite files, or test-result directories;
- no merge-conflict whitespace errors (`git diff --check` completed without errors);
- no credential/private-key values in the proposed changed/untracked files.

The repository-wide pattern scan did find expected *references* to service-role environment-variable names or PostgreSQL URL syntax in existing local-config/test guards and one staging documentation placeholder. The scan found no embedded secret value in the proposed set. Keep actual `.env` files, Docker runtime configuration, and any future generated test artifacts excluded from Git.

## Security assessment

- The customer reschedule path remains token-authorized: the management token is hashed server-side before the service-role-only RPC call, and the public client is restricted to the token-resolved booking.
- The rescheduling RPC is covered by migration safety tests as additive and service-role-only; API tests confirm safe response envelopes for invalid token/availability conditions.
- This audit did not retrieve or log private management tokens, password hashes, or sensitive customer contact values.
- The local database query was read-only and did not change the founder booking.

## Remaining beta blockers

1. The founder issue-register items need separate reproduction, prioritization, and fixes before broader customer beta quality claims.
2. Browser automation remains unreliable in the earlier local harness; retain a repeatable founder/manual acceptance procedure until it is repaired.
3. A future release decision still requires the broader operational readiness evidence already tracked elsewhere (deployment configuration, backup/restore and monitoring exercises, and authorized staging validation). None was attempted here.

## Final Git status

At audit completion, the working tree remains intentionally dirty and unstaged:

- **Modified (10):** `js/client-manage.js`, `js/dataStore.js`, `server/package.json`, `server/src/index.js`, `server/src/rateLimiter.js`, `server/src/storage/index.js`, `server/src/storage/jsonStore.js`, `server/src/storage/postgresStore.js`, `server/test/migration-safety.test.js`, `server/test/rate-limiter.test.js`.
- **Untracked (12):** the 11 pre-existing P0/FIX/migration report/source/test files listed in the inventory, plus `docs/FAT-003_FOUNDER_ACCEPTANCE_AND_CHECKPOINT_AUDIT.md`.

No staging, commit, push, deployment, reset, deletion, or database mutation occurred in this assignment.
