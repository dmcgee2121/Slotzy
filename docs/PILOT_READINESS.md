# Pilot readiness

## Working in staging

The Netlify staging frontend, Render staging API, and dedicated Supabase staging Postgres project are connected. Health reports the staging/Postgres adapter. On 2026-09-30, all three guarded hosted staging tests passed at commit `3db01ac`: the focused owner-setup API chain, the full synthetic owner-to-customer lifecycle, and synthetic negative checks.

The verified lifecycle requires authoritative `POST /api/bookings` persistence before displaying a receipt, opens the generated manage link, and cancels through direct `PATCH /api/bookings/:bookingId`. The manage card must become `Cancelled`, remove its Cancel action, and remain cancelled after reload. Render CORS explicitly permits `X-Slotzy-Notify-Mode` so the cancellation preflight retains manual-notification semantics.

## Staging-only boundaries

Staging uses synthetic data, separate credentials, a separate database, and server-side Supabase access. JSON remains the local/default rollback adapter. This is not production approval and is not authorization to import pilot data.

## Known limitations and deferred UX work

- Complete the remaining checklist cases, especially real-device mobile visual QA, branding/settings, team edits, status actions, and failure recovery.
- Run the complete local one-worker smoke suite in CI and retain its result alongside the guarded hosted suite.
- UX polish is intentionally deferred: no redesign, native shell, Play Store work, or broad flow changes are included in staging validation.
- The staging E2E suite leaves uniquely prefixed synthetic records because no safe targeted cleanup endpoint exists. Broad database reset is intentionally prohibited in staging.

## Mobile-first audit (2026-09-30)

Automated local mobile checks cover iPhone SE (375×667), iPhone 15-style (393×852), Pixel/Android-style (412×915), and iPad Mini-style (768×1024) viewports. The suite checks login/register, owner setup, public provider/service/date/time/details flow, receipt/manage link, manage cancellation and reload persistence, invalid manage-link state, dashboard booking-link controls, services, availability, appointments, and settings.

The audit found and fixed three focused blockers: the auth modal could exceed a short viewport without scrolling; live auth fields used `#auth-form` while CSS still targeted obsolete `#login-form`; and public/mobile form controls and primary targets could remain below the 44px tap target used elsewhere. Key audited pages now have automated document-overflow, control-clipping, and tap-height checks. The owner calendar intentionally scrolls inside its bounded container instead of widening the document.

The Availability weekly-hours follow-up replaces the compressed four-column table with seven readable day cards at widths up to 768px. Each card keeps the day on one line, gives Enabled a full-width labelled 44px target, and places labelled Start and End controls in a clean two-column row. Time-off rows also stack on narrow screens. Desktop keeps the existing table layout, and availability persistence/data attributes are unchanged. Mobile automation now checks all seven rows for letter wrapping, viewport/card clipping, and 44px targets, plus timezone, buffer, time-off, and save controls.

Real-phone barber review exposed a stale installed-shell case: `owner-dashboard.css` was cache-first under the unchanged `slotzy-shell-v1`, so a phone/PWA could retain the pre-card stylesheet after the frontend deploy. The shell cache is now versioned to `v2`, and CSS/JavaScript shell requests are network-first with cached offline fallback. The mobile suite now performs an actual local barber login under a controlling service worker and checks the authenticated dashboard Availability container, seven named rows, collapsed table headers, card bounds, overflow, and Save Availability target.

The automated Chromium viewports do not replace physical-device validation. Before pilot invitations, manually check iOS Safari and Android Chrome with the virtual keyboard open, native date/select controls, sticky header space, calendar horizontal gestures, modal scrolling, copy/open behavior, outdoor readability/contrast, rotation, safe-area insets, and receipt/manage-link handoff between browser tabs or messaging apps.

## Before inviting real barbers

Complete the staging QA checklist, staging backup/restore rehearsal, monitoring/error review, dependency/security review, controlled email validation, and a support/incident owner. Confirm authentication, authorization, booking policies, cancellation/reschedule behavior, and data-retention expectations with synthetic data first.

## Before Play Store or native work

Stabilize hosted web behavior, define offline/deep-link/manage-token behavior, notification requirements, privacy disclosures, native credential storage, and mobile-device QA. Do not start Capacitor/native work merely because staging is reachable.

## Before production

Complete production-specific security review, separate production secrets/project/origins, backup and point-in-time restore rehearsal, observability/alerting, migration rehearsal, data/privacy review, full automated and manual regression, rollback rehearsal, and an approved pilot launch plan.

## Recommended next pilot checks

Run the remaining real-device checks above, verify logout/session behavior, exercise team/service edits and owner status actions, validate controlled email delivery, and rehearse staging backup/restore plus backend failure recovery. Review monitoring and dependency/security results before inviting real barbers.
