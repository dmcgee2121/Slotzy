# SLOTZY — QA-004
## P0-B6 Controlled Acceptance Continuation

**Execution date:** 2026-10-17 (America/Chicago)  
**Recommended disposition:** **BLOCKED**

## Safety preflight

- Branch and baseline: `restore-source-files`, `7d41093`; all pre-existing modified and untracked work was preserved.
- The local Supabase database reported `postgres` and `public.slotzy_test_control.is_disposable=true`.
- `npm run local:e2e` served the frontend loopback configuration (`http://127.0.0.1:3001/api`). API health reported `storage: "postgres"` and `environment: "development"`.
- The launcher’s isolated environment forces Dev Outbox and blanks SMTP settings. No hosted API, Supabase, SMTP, reset, or migration operation was used.
- FIX-001 remains active: prior browser setup availability reads returned 200 rather than 403.

## Corrected two-service owner-setup attempt

Existing synthetic owner/shop fixture: `qa003_owner_20261017` / `QA003 Local Shop`.

The real local Chromium procedure was:

1. Log in through `pages/index.html`.
2. Advance from Team to Services.
3. Enter `QA004 Cut`, `$30`, `30` minutes.
4. Activate **Add Service** while awaiting the actual `POST /api/services` response.

### Result

The expected browser request did not complete within the explicit 30-second bounded wait. PostgreSQL query immediately afterwards showed **zero rows** in `public.services`; no service name was returned. This was not treated as a successful UI action or persisted service.

## Defect QA-004-01

**Severity:** P0 for P0-B6  
**Likely component:** Express/PostgreSQL service-create persistence path (requires investigation)

The corrected test procedure satisfies the two-service wizard requirement, but the first service creation never yielded an observable `POST /api/services` completion and did not create a PostgreSQL service row. The API listener remained alive. The prior QA-003 timeout is therefore no longer explained solely by the incomplete one-service procedure.

No application code was changed under this QA assignment.

## QA matrix

| Scenario | Result | Reason |
| --- | --- | --- |
| QA-01 Owner registration/authentication | PASS (carried forward) | Previous real-browser/Postgres evidence. |
| QA-02 Shop/services/availability setup | BLOCKED | Shop persisted previously; service create did not complete or persist. |
| QA-03–QA-08 | BLOCKED | Require persisted services and availability. |
| QA-09 Authorization | UNVERIFIED | Availability authorization repair remains verified; full boundary suite not run. |
| QA-10 Dev Outbox | BLOCKED | No valid booking could be created. |

## Recommendation

**BLOCKED.** Investigate the service creation request/persistence path before resuming P0-B6. Capture server-side diagnostics around `POST /api/services` and `writeService` against the local Postgres adapter. Do not bypass this prerequisite with direct database/API fixtures for browser acceptance.
