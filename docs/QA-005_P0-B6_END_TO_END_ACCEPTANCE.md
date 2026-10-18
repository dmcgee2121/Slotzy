# QA-005 — P0-B6 End-to-End Acceptance

**Date:** 2026-10-17  
**Disposition:** **BLOCKED**

## Safety preflight

- Branch/HEAD: `restore-source-files` / `7d41093`; all existing modifications and reports were preserved.
- `npm run test:local-e2e-config`: 4/4 passed.
- Local health reported `ok=true`, `storage=postgres`, `environment=development`.
- Served `public-config.js` used only `http://127.0.0.1:3001/api`.
- Local `postgres` reported `public.slotzy_test_control.is_disposable=true`.
- The local launcher isolates its child environment, forces Dev Outbox, and clears SMTP. No hosted endpoint, reset, migration, deployment, commit, push, or real SMTP delivery was used.

No interactive Computer Use browser surface was available. The real local Chromium browser was driven with Playwright, without request interception or mocks.

## Browser synchronization procedure

The procedure used inspected selectors (`#submit-btn`), waited for the owner-setup URL and specific visible controls, attached response/console listeners before actions, and wrote sanitized events synchronously to a local `%TEMP%` NDJSON file. It used no `networkidle` wait and bounded the Step 1 shop-response wait at 12 seconds.

## Confirmed blocking result: owner wizard Step 1

Fixture: uniquely generated `qa005-mvdbf27p-owner` / `QA005 Shop qa005-mvdbf27p`.

Real browser evidence:

- `POST /api/auth/register` returned **201**.
- `GET /api/auth/me`, `/api/shops`, `/api/services`, and `/api/availability` each returned **200** during owner-wizard initialization.
- The browser reached `owner-setup.html`; the visible Step 1 form was populated and **Save Shop and Continue** was activated.
- No `POST /api/shops` request was emitted within the bounded 12-second wait.
- PostgreSQL check immediately after the run found **0** matching QA-005 shops and **0** QA-005 services; no booking was created.

Expected: Step 1 should issue the supported local API shop creation request, persist the shop, and reveal Step 2.

Observed: Step 2 remained hidden. The persistent trace ended with `page.waitForResponse` timing out while awaiting `POST /api/shops`.

This is separate from FIX-005: the Service Editor was previously proven to create services correctly. The wizard did not reach service creation, availability, or booking. Continuing customer scenarios would create misleading acceptance evidence, so dependent testing was stopped.

## QA matrix

| ID | Result | Evidence |
| --- | --- | --- |
| QA-01 Owner registration/authentication | PASS | New real-browser owner registration returned 201. |
| QA-02 Owner shop/services/hours setup | BLOCKED | Wizard Step 1 did not emit or complete shop creation. |
| QA-03 Public booking link | BLOCKED | Requires a persisted shop/service/hours configuration. |
| QA-04 Customer appointment creation | BLOCKED | Requires QA-03. |
| QA-05 Owner appointment visibility | BLOCKED | No valid appointment exists. |
| QA-06 Conflict prevention | UNVERIFIED | No valid booking baseline. |
| QA-07 Customer cancellation/rescheduling | UNVERIFIED | No valid booking baseline. |
| QA-08 Owner confirmation/completion/no-show | UNVERIFIED | No valid booking baseline. |
| QA-09 Authorization boundaries | UNVERIFIED | FIX-001 remains prior regression evidence; QA-005 did not run the full boundary set. |
| QA-10 Dev Outbox notifications | BLOCKED | No booking notification could be generated. |

## API follow-up

FIX-005's API-suite timeout was not rerun to completion in this assignment because the owner setup blocker occurred first. The failure remains separate from this browser-flow result.

## Recommendation

**BLOCKED.** Investigate why `owner-setup.js` Step 1 fails to start its `apiSaveShops` write after the UI action, with browser-side error/status capture immediately after the click. Do not bypass this with direct API fixture creation for owner-wizard acceptance. Re-run QA-005 from a new synthetic owner after that narrow investigation.
