# FIX-005 — Service Creation Isolation

**Assignment:** FIX-005  
**Date:** 2026-10-17  
**Disposition:** PASS — P0-B6 may resume at owner service creation.

## Result

Service creation is working through both the authenticated local API and the real Chromium Service Editor. The earlier timeout was a browser-automation diagnostic failure, not an application, authorization, HTTP transport, Express, or PostgreSQL persistence failure.

The first FIX-005 diagnostic attempt used a nonexistent login submit selector (`#auth-submit` instead of `#submit-btn`). It waited for that element for 30 seconds, so it never logged in and never sent a service request. A later attempt also raced the application's expected post-login navigation to `business-owner.html`. Both are harness synchronization problems.

The corrected runner explicitly waited for the actual login completion/navigation before opening the Service Editor, then used bounded waits and synchronous NDJSON writes for every event.

## Safety preflight

- Branch/HEAD: `restore-source-files` at `7d41093`.
- Existing modified and untracked files were preserved.
- Local Supabase CLI status reported the pinned loopback API and database identity required by `docs/LOCAL_E2E.md`.
- `public.slotzy_test_control.is_disposable` was `true` in local `postgres`.
- API health reported `ok: true`, `storage: postgres`, `environment: development`.
- Served frontend configuration contained `http://127.0.0.1:3001/api` and no hosted reference.
- The launcher provided blank SMTP settings plus forced Dev Outbox mode. No hosted API, hosted Supabase, SMTP, reset, migration, deployment, commit, or push was used.

## Persistent diagnostic evidence

Temporary, untracked runner output was written and flushed to `%TEMP%` as NDJSON; sanitized server output was written to `%TEMP%/slotzy-fix005-server.out.log`. The temporary runner and opt-in instrumentation were removed after the run.

Successful run ID: `fix005-mvdb6w86`.

| Check | Evidence |
| --- | --- |
| Direct authenticated create | `POST /api/services` returned `201`; server recorded the write lifecycle in 12 ms. |
| Browser authentication | Chromium sent `POST /api/auth/login`, received `200`, then navigated to the owner dashboard. |
| Browser service creation | Service Editor sent `POST /api/services`, received `201` in 45 ms, and rendered `Saved.` success state. |
| Refresh persistence | Browser reloaded the Service Editor, received `GET /api/services` `200`, and found the created service card. |
| PostgreSQL persistence | Local query found `FIX005 Browser Service fix005-mvdb6w86` with `price_cents=3200` and `duration_minutes=35`. |

The browser trace also recorded aborted initial reads during intentional document navigation. The next navigation issued fresh authenticated reads, all of which completed `200`; this is expected cancellation behavior and not a failed storage operation.

## Root cause

The prior conclusion that service creation had timed out was unsupported because diagnostic output was emitted only after a long-running browser command completed. The corrected persistent trace proves that the app path completes normally. The actionable cause is test automation:

1. It used an invalid login-button selector in the first diagnostic attempt.
2. It attempted to navigate away before the app's own post-login dashboard navigation settled.

No service-route repair is justified. No localStorage fallback occurred: the API-backed Service Editor received a real `201`, then its authoritative `GET /api/services` response rendered the persisted record after refresh.

## Tests

- `npm run test:local-e2e-config`: **4/4 passed**.
- `npm --prefix server run test:storage`: **33/33 passed**.
- Real Chromium direct/API/browser comparison: **passed** as described above.
- `npm --prefix server run test:api`: the command exposed one pre-existing-looking timeout in `authenticated staff password change revokes old sessions and returns a fresh token` (10,048 ms); the harness terminated before a final suite summary, so this run is **not counted as a passing API suite**. The service-specific observability/API checks printed before that timeout passed. This test is outside the service creation path and should be rerun separately before claiming a full API regression pass.

## Changes

No production application repair was made. A temporary local diagnostic runner and opt-in local logging were created solely for this investigation and removed after evidence capture. This report is the only FIX-005 artifact retained.

## Remaining risk and recommendation

The original owner-setup wizard should be exercised using the corrected wait discipline (wait for actual login/navigation, attach listeners before clicking, and wait for the `POST /api/services` response) when QA resumes. The narrowly scoped service-creation blocker is cleared; P0-B6 may resume from owner service setup without treating the prior timeout as a product defect.
