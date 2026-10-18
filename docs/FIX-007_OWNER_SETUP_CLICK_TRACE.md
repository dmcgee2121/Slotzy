# FIX-007 — Owner Setup Button Execution Trace

**Outcome:** B — test synchronization issue; no application repair made.

## Captured result

Persistent browser evidence: `%TEMP%/fix007-mvdc9d7a.ndjson`.

The real Chromium click completed. Immediately before click, the input contained `FIX007 Shop fix007-mvdc9d7a`, was HTML-valid, the button was visible/enabled, had no `aria-busy`, and Step 2 was hidden.

However, setup initialization reads were still completing after the test filled the input. The trace shows successful `GET /api/auth/me`, `/api/shops`, `/api/services`, and two `/api/availability` requests between the pre-click snapshot and click completion. By the immediate post-click snapshot, the input had been overwritten to an empty value. The handler then displayed:

`Shop name must be at least 2 characters.`

The button returned to enabled/non-busy state; Step 2 stayed hidden. There were no page errors, no failed requests, no console exception, and no `POST /api/shops`. This is the expected frontend validation result for the value actually present when the handler ran.

## Classification

The prior procedure treated button visibility as readiness. It must instead wait for initialization reads to settle and verify the filled value immediately before the click (and, if necessary, after a brief stabilization interval). The app correctly rejects an empty Step 1 value. No backend or PostgreSQL defect was exercised.

## PostgreSQL

No matching FIX-007 shop was created, consistent with no shop-create request. No reset, migration, deletion, hosted access, or email delivery occurred.

## Changes and recommendation

No application code changed. The reusable QA procedure should wait for initialization completion before filling Step 1, then confirm the value remains present immediately before clicking. Owner setup acceptance can resume using that corrected procedure.

## Git status

All pre-existing modified/untracked work was preserved; no commit or push was made.
