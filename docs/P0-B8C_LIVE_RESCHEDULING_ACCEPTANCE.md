# P0-B8C — Live Customer Rescheduling Acceptance

**Date:** 2026-10-18
**Disposition:** **BLOCKED** — the verified disposable local environment is available, but this session exposes no usable Chromium/browser automation target for the required real-browser acceptance.

## Repository and environment

- Branch/HEAD: `restore-source-files` / `19aeef610edd9640e9a288d37d1b85dad9b84bc2`.
- All existing modified and untracked P0-B7/B8A/B8B work was preserved.
- Docker Desktop and the existing local Supabase containers were running.
- Supabase CLI reported only loopback services: API `127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322/postgres`, and local mail UI `127.0.0.1:54324`.
- Existing database container and local project identity were present. The earlier P0-B8A.1 verification established `public.slotzy_test_control.is_disposable = true`, PostgreSQL mode, and service-role-only reschedule RPC execution.
- `npm run local:e2e` reached its loopback-only ready state: frontend `127.0.0.1:5173`, API `127.0.0.1:3001/api`, PostgreSQL storage, and Dev Outbox isolation. The launcher clears SMTP settings; no real delivery was enabled.

## Browser-acceptance blocker

The computer-use inventory returned no browser and no native app windows. The only supported launcher surface also reported that native app launch was unavailable. Therefore Chromium could not be started or controlled to perform the required customer booking, management-link, rescheduling, conflict, refresh, and owner-dashboard workflow.

No synthetic appointment was created in this P0-B8C run, no management token was viewed or logged, and no browser/API/database mutation was substituted for the required real-browser test. This is a test-harness availability blocker, not evidence of an application defect.

## Prior implementation evidence retained

- P0-B8A.1 applied and verified the atomic token-authorized rescheduling RPC locally, including database concurrency and event-history checks.
- P0-B8B added the token-scoped Express route and management-page integration. Automated coverage passed: storage 34/34 and API 44/44.

## Unverified P0-B8C scenarios

- Real Chromium public booking and receipt management-link acquisition.
- Customer management-link display, rescheduling confirmation, refresh persistence, and occupied-slot rejection through the browser UI.
- Owner login, appointment-dashboard display, and refresh persistence.
- Browser-network evidence that the customer UI invokes only `PATCH /api/public/manage/reschedule` and not the staff route.

## Final Git status

This report is new and uncommitted. Existing modifications and reports remain uncommitted and preserved. No hosted Supabase/API access, email delivery, database reset/migration, deletion, commit, push, or deployment occurred.

**Recommendation:** **BLOCKED** pending an available Chromium/browser automation surface. Re-run this exact acceptance against the already verified loopback disposable environment; do not treat this report as end-to-end product acceptance.
