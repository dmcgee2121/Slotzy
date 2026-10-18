# SLOTZY — QA-003
## P0-B6 Acceptance Resumption

**Execution date:** 2026-10-17 (America/Chicago)  
**Recommended disposition:** **BLOCKED**

## Safety and FIX-001 regression

| Check | Result | Evidence |
| --- | --- | --- |
| Repository baseline | PASS | `restore-source-files`, HEAD `7d41093`; existing modified/untracked work retained. |
| Local-only endpoints | PASS | `local:e2e` served frontend on `127.0.0.1:5173`, API on `127.0.0.1:3001`, and served loopback API config. |
| Disposable DB | PASS | Local Supabase Docker API/database were present; `postgres` database marker was `is_disposable=true`. |
| Postgres adapter | PASS | Health reported `storage: "postgres"`, `environment: "development"`. |
| Email isolation | PASS | Launcher force-enabled Dev Outbox and blanked SMTP configuration. |
| FIX-001 availability regression | PASS | Real Chromium owner setup observed `GET /api/availability?barberUsername=qa003_owner_20261017` twice with HTTP 200. No 403 occurred. |
| Hosted traffic | PASS | Browser/API evidence contained only `127.0.0.1` loopback endpoints. |

## Owner setup evidence

Synthetic owner `qa003_owner_20261017` was registered through the real frontend. Browser API evidence included:

- `POST /api/auth/register` — 201
- `GET /api/auth/me` — 200
- `POST /api/shops` — 201
- `GET /api/availability?barberUsername=qa003_owner_20261017` — 200

The setup advanced to team step after shop save. Direct local PostgreSQL read confirmed `QA003 Local Shop` in `public.shops`; the database contained two shops total (the prior QA synthetic shop plus this one). This is browser → Express → PostgreSQL persistence evidence, not browser-storage evidence.

## Blocking defect QA-003-01

**Severity:** P0 for P0-B6 completion  
**Component:** Owner setup service/availability workflow

### Reproduction

1. Log in as `qa003_owner_20261017` through the local frontend.
2. Advance from the persisted shop/team steps to Services.
3. Enter service `QA003 Cut`, price `30`, duration `30`, and activate **Add Service**.
4. Continue the supported setup flow.

### Expected

The service should be created through local Express/PostgreSQL and the setup should advance to availability, enabling an availability save and persistence check.

### Observed

The real Chromium setup flow did not complete before the 30-second controlled browser-action timeout. PostgreSQL afterwards contained zero services, so no service creation was accepted as persisted evidence. The public booking and all appointment workflows therefore lacked a valid persisted service and could not be exercised without bypassing the browser workflow.

No source change was made for this new defect.

## QA matrix

| ID | Result | Notes |
| --- | --- | --- |
| QA-01 Owner registration/authentication | PASS | Real browser registration/login and prior session persistence verified. |
| QA-02 Shop configuration | BLOCKED | Shop persisted; service/availability setup did not complete. |
| QA-03 Public booking link | BLOCKED | Requires persisted service/availability. |
| QA-04 Customer booking | BLOCKED | Requires QA-03. |
| QA-05 Owner visibility | BLOCKED | No valid appointment created. |
| QA-06 Conflict prevention | BLOCKED | No valid appointment created. |
| QA-07 Customer cancellation/rescheduling | BLOCKED | No valid appointment created. |
| QA-08 Owner lifecycle statuses | BLOCKED | No valid appointment created. |
| QA-09 Authorization boundaries | UNVERIFIED | FIX-001 self-owner read regression passed; full unrelated-owner/customer coverage was not run. |
| QA-10 Dev Outbox | BLOCKED | Runtime isolation passed; no valid booking email was generated. |

## Remaining data and final status

- No reset, migration, hosted access, real email, commit, push, or deployment occurred.
- New synthetic records: `qa003_owner_20261017` and `QA003 Local Shop` in the disposable local database.
- Existing BE-001/FIX-001/QA work remains preserved.
- Final Git status includes the pre-existing BE-001/FIX-001 changes and this untracked QA-003 report.

## Recommendation

**BLOCKED.** FIX-001 is regression-verified and P0-B6 can resume only after QA-003-01 is diagnosed: establish why browser-driven service setup does not complete/persist. Re-run from the service step with new uniquely labeled local records; do not use direct API writes as a substitute for the owner UI acceptance workflow.
