# Pilot readiness

## Working in staging

The Netlify staging frontend, Render staging API, and dedicated Supabase staging project are connected. Health reports the staging/Postgres adapter, and manual validation has covered registration, owner dashboard access, service creation, availability, refresh persistence, public booking, owner visibility, manage links, cancellation, and rescheduling.

## Staging-only boundaries

Staging uses synthetic data, separate credentials, a separate database, and server-side Supabase access. JSON remains the local/default rollback adapter. This is not production approval and is not authorization to import pilot data.

## Known limitations and deferred UX work

- Complete the remaining checklist cases, especially mobile visual QA, branding/settings, invalid manage links, team edits, status actions, and failure recovery.
- Run the complete one-worker smoke suite in CI or a terminal without the local execution cap.
- UX polish is intentionally deferred: no redesign, native shell, Play Store work, or broad flow changes are included in staging validation.
- The staging E2E suite leaves uniquely prefixed synthetic records because no safe targeted cleanup endpoint exists. Broad database reset is intentionally prohibited in staging.

## Before inviting real barbers

Complete the staging QA checklist, staging backup/restore rehearsal, monitoring/error review, dependency/security review, controlled email validation, and a support/incident owner. Confirm authentication, authorization, booking policies, cancellation/reschedule behavior, and data-retention expectations with synthetic data first.

## Before Play Store or native work

Stabilize hosted web behavior, define offline/deep-link/manage-token behavior, notification requirements, privacy disclosures, native credential storage, and mobile-device QA. Do not start Capacitor/native work merely because staging is reachable.

## Before production

Complete production-specific security review, separate production secrets/project/origins, backup and point-in-time restore rehearsal, observability/alerting, migration rehearsal, data/privacy review, full automated and manual regression, rollback rehearsal, and an approved pilot launch plan.

## Recommended next implementation task

Create a staging-only automated end-to-end smoke suite using isolated synthetic shop/user data and a non-production cleanup path, then run the remaining manual checklist cases on phone-width devices.
