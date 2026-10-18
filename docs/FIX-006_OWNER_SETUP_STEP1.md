# FIX-006 — Owner Setup Step 1 Diagnostic

**Status:** BLOCKED — no application repair justified by current evidence.

## Intended workflow

Step 1 has one application validation requirement: `#setupShopName` must contain at least two trimmed characters. The control is `<button id="setupStep1Next" type="button">`; it is not an HTML form submit control. `owner-setup.js` binds its click event to `runWithPendingButton("setupStep1Next", "Saving...", handleSaveShopStep)`.

`handleSaveShopStep` clears the status, validates the name, then calls `saveOwnerShop`. `saveOwnerShop` reads local/API-backed user/shop state and calls `dataStore.saveShopsAsync(..., { fallbackOnError: false })`; in API mode that invokes `apiSaveShops`, which should first read `/api/shops` and then issue `POST /api/shops` for a new shop. Only a returned, identified shop causes `showStep(2)`.

## Evidence reviewed

QA-005 used a valid generated shop name, reached the visible Step 1 button, and captured successful setup initialization reads. Its persistent trace contained no `POST /api/shops`, no matching PostgreSQL row, and no browser page error. It did not capture the post-click button state, status text, or console output long enough to prove that the click handler executed; its response waiter therefore cannot distinguish a handler non-execution from an earlier frontend path failure.

The local E2E safety checks remained valid: loopback frontend/API, Postgres storage health, local disposable marker, and forced Dev Outbox/blank SMTP. `npm run test:local-e2e-config` passed 4/4.

## Classification

**D — still unverified.** The evidence rules out neither a browser click/readiness issue nor a frontend execution failure, and it does not establish an Express or PostgreSQL defect. No production code was changed.

## Required next diagnostic

Run the same isolated browser path while flushing events before and after the click: button `disabled`/`aria-busy`/text, `#setupShopStatus`, `#setupStatus`, page errors, console messages, and request lifecycle. Use an explicit dispatch/click completion check before waiting for `POST /api/shops`. If the handler starts, retain the emitted error/status before classifying a frontend defect.

## Git status

All pre-existing modified and untracked work was preserved. No commit, push, deploy, migration, reset, deletion, or hosted access occurred.

## Recommendation

Do not resume P0-B6 booking acceptance yet. Complete the specified post-click diagnostic; a repair should follow only if it identifies a concrete application failure.
