# FAT-009: Service Deactivation Acceptance and Checkpoint Audit

## Recommendation

**READY FOR CHECKPOINT.** The reviewed pending implementation, founder acceptance, local database evidence, and non-destructive regressions are consistent with the approved FIX-014 scope.

## Founder acceptance evidence

The founder personally completed FAT-008 in desktop Chrome against the local `test1234` owner account. The following seven checks are founder-operated browser observations, not automated browser results:

1. Local E2E application restarted successfully.
2. A temporary service was created.
3. It was deactivated through Owner Services.
4. Its Inactive state persisted after refresh.
5. It disappeared from public customer booking.
6. Classic Cut remained available.
7. Fade remained available.

FAT-007 desktop Chrome login acceptance also remains passed, 4/4, as recorded in `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md`.

## Safety preflight

- Repository: `C:\Dev\Slotzy`
- Branch: `restore-source-files`
- Committed HEAD: `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a`
- Local Supabase API verified at `http://127.0.0.1:54321`.
- Local PostgreSQL verified at `127.0.0.1:54322/postgres`.
- `public.slotzy_test_control.is_disposable` returned `true`.
- Local Express health reported `slotzy-api`, PostgreSQL storage, and development mode.
- No hosted API/database routing, migration, reset, data change, real email, staging, commit, push, or deployment was performed in this audit.

All pre-existing modified/untracked files were preserved.

## Independent read-only database evidence

The uniquely identified shop has slug `test1234`. Only service state, provider-link existence, and aggregate booking-snapshot fields were queried; no customer contacts, credentials, JWTs, or management tokens were read.

| Evidence | Result |
| --- | --- |
| Classic Cut | retained, active, provider-linked, eligible for public projection |
| Fade | retained, active, provider-linked, eligible for public projection |
| FAT-008 temporary service | retained, inactive, provider-linked, not eligible for public projection |
| Services in shop | 2 active and 1 inactive |
| Inactive service other than the FAT-008 row | 0 |
| Existing bookings | 2 total; 2 service relationships; 2 nonempty service snapshots |

The brief called the temporary service `FAT008 Test Service`; the database row is named `FAT008`. The row is uniquely identifiable in the `test1234` shop and matches the reported lifecycle: it is the sole inactive retained service while Classic Cut and Fade are active. This naming discrepancy is recorded rather than assumed away.

The temporary service remains a relational service row rather than being deleted. Its provider link remains, and inactive state excludes it from the same public-booking eligibility condition used by the storage projection. The aggregate booking relationship and snapshot counts establish that historical booking records were retained; the audit did not inspect customer or appointment details.

## Source and security audit

The complete pending implementation was reviewed.

- `server/src/index.js` deactivates only the selected, authorized service (`active: false`) through `writeService`; it no longer splices a whole-store snapshot or invokes `writeStore` in the DELETE path.
- `js/dataStore.js` performs a direct DELETE request, requires a returned service with the same ID and `active: false`, then updates local state only after that confirmed response.
- `js/manage-services.js` invokes the narrow deactivation operation and accurately states that historical appointments are preserved.
- Owner-only service controls remain enforced in both UI and API; customers and barbers receive `403` on deletion.
- `server/src/storage/postgresStore.js` continues to restrict the public service projection to `is_active = true` and non-deleted rows.
- The focused contract test requires the narrow writer, rejects the former array splice route, and rejects a broad collection-save removal.

No secrets, management tokens, customer contact values, database dumps, browser traces, logs, or generated artifacts were found in the reviewed pending source/test/report paths. Line-ending warnings are Git workspace normalization warnings only.

## Regression results

| Command | Actual result |
| --- | --- |
| `npm run test:local-e2e-config` | 4 passed, 0 failed |
| `npm --prefix server run test:storage` | 36 passed, 0 failed |
| `npm --prefix server run test:api` | 51 passed, 0 failed |

The API suite includes service-deactivation contract coverage, staff cancellation coverage, customer management/cancellation/rescheduling coverage, authorization/rate-limit checks, and the existing authentication coverage. The storage suite includes migration and scoped persistence contracts.

## Pending-file inventory

| Path | Classification | Checkpoint disposition |
| --- | --- | --- |
| `server/src/index.js` | FIX-014 application repair | Commit 1 |
| `js/dataStore.js` | FIX-014 client persistence repair | Commit 1 |
| `js/manage-services.js` | FIX-014 owner-service UI/copy repair | Commit 1 |
| `server/package.json` | API test registration | Commit 1 |
| `server/test/service-deactivation-contract.test.js` | FIX-014 regression coverage | Commit 1 |
| `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md` | QA report, including FAT-007 4/4 acceptance | Commit 2 |
| `docs/FIX-014_SERVICE_REMOVAL_RELIABILITY.md` | FIX-014 investigation and verification report | Commit 2 |
| `docs/FAT-009_SERVICE_DEACTIVATION_ACCEPTANCE_AND_CHECKPOINT_AUDIT.md` | FAT-009 audit report | Commit 2 |

No exclusions are required from the current pending inventory.

## Proposed checkpoint plan

1. `fix(services): make service deactivation reliable`
   - Include only the five reviewed implementation/test paths listed for Commit 1.
2. `docs(qa): record login and service acceptance`
   - Include only the three reviewed documentation paths listed for Commit 2.

Before either future commit, inspect staged paths and diffs, run `git diff --cached --check`, and repeat a literal secret/token/customer-data scan. This FAT-009 assignment did not stage or commit anything.

## Remaining risks

- FAT-008 is founder desktop-browser evidence; it is not automated browser coverage.
- The temporary service name differs from the brief, although the uniquely matching inactive row supports the acceptance result.
- Inactive services remain visible to owners as archived records. The current checkpoint does not add reactivation UI.

## Final Git status

`HEAD` remains `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a` on `restore-source-files`, with the eight pending paths listed above. No changes were staged; ahead/behind remains `0/0` relative to `origin/restore-source-files`.
