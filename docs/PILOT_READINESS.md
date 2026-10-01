# Pilot readiness

## Working in staging

The Netlify staging frontend, Render staging API, and dedicated Supabase staging Postgres project are connected. Health reports the staging/Postgres adapter. On 2026-09-30, all three guarded hosted staging tests passed at commit `3db01ac`: the focused owner-setup API chain, the full synthetic owner-to-customer lifecycle, and synthetic negative checks.

The verified lifecycle requires authoritative `POST /api/bookings` persistence before displaying a receipt, opens the generated manage link, and cancels through direct `PATCH /api/bookings/:bookingId`. The manage card must become `Cancelled`, remove its Cancel action, and remain cancelled after reload. Render CORS explicitly permits `X-Slotzy-Notify-Mode` so the cancellation preflight retains manual-notification semantics.

## Staging-only boundaries

Staging uses synthetic data, separate credentials, a separate database, and server-side Supabase access. JSON remains the local/default rollback adapter. This is not production approval and is not authorization to import pilot data.

## Known limitations and deferred UX work

- Complete the remaining checklist cases, especially mobile visual QA, branding/settings, invalid manage links, team edits, status actions, and failure recovery.
- Run the complete local one-worker smoke suite in CI and retain its result alongside the guarded hosted suite.
- UX polish is intentionally deferred: no redesign, native shell, Play Store work, or broad flow changes are included in staging validation.
- The staging E2E suite leaves uniquely prefixed synthetic records because no safe targeted cleanup endpoint exists. Broad database reset is intentionally prohibited in staging.

## Before inviting real barbers

Complete the staging QA checklist, staging backup/restore rehearsal, monitoring/error review, dependency/security review, controlled email validation, and a support/incident owner. Confirm authentication, authorization, booking policies, cancellation/reschedule behavior, and data-retention expectations with synthetic data first.

## Before Play Store or native work

Stabilize hosted web behavior, define offline/deep-link/manage-token behavior, notification requirements, privacy disclosures, native credential storage, and mobile-device QA. Do not start Capacitor/native work merely because staging is reachable.

## Before production

Complete production-specific security review, separate production secrets/project/origins, backup and point-in-time restore rehearsal, observability/alerting, migration rehearsal, data/privacy review, full automated and manual regression, rollback rehearsal, and an approved pilot launch plan.

## Recommended next pilot checks

Run the remaining manual checklist cases on phone-width devices, verify logout/session behavior and invalid manage links, exercise team/service edits and owner status actions, validate controlled email delivery, and rehearse staging backup/restore plus backend failure recovery. Review monitoring and dependency/security results before inviting real barbers.
