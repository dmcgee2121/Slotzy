# FIX-014: Service Removal Reliability

## Disposition

**PASS CANDIDATE.** A concrete local defect was reproduced and corrected with a narrow, reversible service-deactivation path. Founder browser acceptance remains required.

## Safety verification

- Repository: `C:\Dev\Slotzy`; branch: `restore-source-files`; committed baseline: `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a`.
- The pre-existing uncommitted `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md` report was preserved.
- Local Supabase API: `http://127.0.0.1:54321`; local PostgreSQL: `127.0.0.1:54322`.
- `public.slotzy_test_control.is_disposable` returned `true`.
- Local Express health reported PostgreSQL storage in development mode.
- Local E2E configuration verifies loopback binding, PostgreSQL storage, blank SMTP values, and forced Dev Outbox. No hosted API/Supabase access, reset, migration, permanent service/booking deletion, real email, commit, push, or deployment occurred.

## Existing architecture and intended lifecycle

`pages/manage-services.html` loads `js/manage-services.js`. In this beta, only shop owners may manage services; barbers receive the explicit owner-managed state. The server enforces the same owner-only policy on service mutations.

The customer booking projection selects only `services.is_active = true`. The authenticated staff projection retains inactive service rows. PostgreSQL service rows are relationship-bearing records: `provider_services` and `bookings` both reference them with `ON DELETE RESTRICT`. Consequently the safe, existing-model interpretation of “Remove” is **deactivate/archive from public booking**, not permanent deletion. Historical booking `service_snapshot` data remains intact.

## Historical founder observation

The historical Samsung Galaxy report described a barber confirming a service removal while the service remained active. Current beta policy intentionally does not grant barbers service management. The report does not assert that the historical UI or account role exactly matches the current owner-only implementation.

## Reproduction and root cause

Separate uniquely named synthetic owners, shops, and services were used; `test1234` and its bookings were not changed. Sanitized pre-fix results:

| Check | Result |
| --- | --- |
| Owner creates synthetic shop/service | `201` / `201` |
| Service appears in owner and public booking projections | confirmed |
| Unrelated owner DELETE | `403` |
| Barber DELETE | `403` |
| Authorized owner DELETE | `500` |
| Service after failed DELETE | remained active in owner and public projections |
| Repeat DELETE | `500` |
| PostgreSQL state after failure | active row, provider link retained |

The defect was confirmed in the authorized owner path. `DELETE /api/services/:serviceId` spliced the service from an in-memory whole-store snapshot, then called `writeStore`. The local `slotzy_storage_write_snapshot` RPC upserts service rows present in its snapshot but does not reconcile a missing service into a deletion or deactivation. Replaying the whole store also risks unrelated persistence work before deletion. In the observed local state the whole-store write failed and returned `500`, leaving the service publicly active.

## Correction

- `server/src/index.js`: the authorized DELETE route now builds only the target service with `active: false` and persists it through the existing narrow `writeService` path. It returns the persisted deactivated service; it does not splice the service or replay the full store.
- `js/dataStore.js`: added `deactivateServiceAsync`, which performs only the DELETE request, validates the deactivated response, and updates the local cache only after server confirmation.
- `js/manage-services.js`: changed the user-facing action/copy to **Deactivate**, explains that historical appointments are preserved, and calls the narrow API operation rather than resaving every service.
- `server/test/service-deactivation-contract.test.js`: focused regression coverage prevents reintroduction of broad collection-save removal and requires the narrow deactivation contract.
- `server/package.json`: includes the new focused contract test in `test:api`.

No schema migration was required. The narrow PostgreSQL writer was exercised directly against a synthetic service: it remained present in the staff projection with `active: false`, and the corresponding public projection excluded it. This validates the persistence mechanism used by the repaired route without restarting or disrupting the founder’s running local API process.

## Historical appointments

No synthetic booking was created because existing booking/service snapshots were inspected rather than modifying appointment data for this lifecycle test. The correction does not touch bookings, booking events, snapshots, or service foreign keys. The relational service row is retained and its `is_active` value is changed; public booking is filtered by that value. This preserves historical appointment association and snapshot information by design.

## Regression results

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | 4 passed, 0 failed |
| `npm --prefix server run test:storage` | 36 passed, 0 failed |
| `npm --prefix server run test:api` | 51 passed, 0 failed |

An initial storage run was invalidated by intentionally exported local service-role variables used for the direct narrow-writer verification; it was rerun with those variables removed and passed 36/36. This is an environment-isolation observation, not an application test failure.

## Founder retest

1. Start/restart the verified local application with `npm run local:e2e` so the browser uses the repaired source.
2. Sign in to the existing `test1234` owner dashboard in Chrome and open **Services**.
3. Create a new temporary service with a clearly disposable name. Do not deactivate Classic Cut, Fade, or any service associated with historical founder appointments.
4. Select **Deactivate**, confirm the dialog, and verify the service displays as inactive in the owner view after refresh.
5. Open the public booking page for `test1234` in a fresh tab and confirm that temporary service cannot be selected.
6. Verify existing appointments remain present and unchanged. Do not edit historical bookings.
7. If the action fails, capture the visible error and the safe HTTP status for the service request; never capture passwords, JWTs, or service-role credentials.

## Remaining risks

- The repaired Express route could not be live-exercised in a second isolated API process because process launch was blocked before it began; the founder’s running local process was intentionally not interrupted. Static route coverage, the API suite, and direct local narrow-writer verification support the result, but do not replace browser acceptance.
- Inactive services remain visible to authenticated owners with an Inactive badge. This is intentional archival visibility; the current scope does not add reactivation UX.
- The historical mobile report remains an observation rather than a current browser reproduction.

## Changed-file inventory and Git status

- Modified: `server/src/index.js`
- Modified: `js/dataStore.js`
- Modified: `js/manage-services.js`
- Modified: `server/package.json`
- Added: `server/test/service-deactivation-contract.test.js`
- Added: `docs/FIX-014_SERVICE_REMOVAL_RELIABILITY.md`
- Modified, preserved: `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md` (FAT-007 acceptance note only)

No files were committed or pushed. Final Git status: modified `js/dataStore.js`, `js/manage-services.js`, `server/package.json`, and `server/src/index.js`; untracked `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md`, this report, and `server/test/service-deactivation-contract.test.js`. `HEAD` remains `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a`; the branch is `0` ahead / `0` behind `origin/restore-source-files`.
