# Pilot readiness

## Working in staging

The Netlify staging frontend, Render staging API, and dedicated Supabase staging Postgres project are connected. Health reports the staging/Postgres adapter. On 2026-09-30, all three guarded hosted staging tests passed at commit `3db01ac`: the focused owner-setup API chain, the full synthetic owner-to-customer lifecycle, and synthetic negative checks.

The verified lifecycle requires authoritative `POST /api/bookings` persistence before displaying a receipt, opens the generated manage link, and cancels through direct `PATCH /api/bookings/:bookingId`. The manage card must become `Cancelled`, remove its Cancel action, and remain cancelled after reload. Render CORS explicitly permits `X-Slotzy-Notify-Mode` so the cancellation preflight retains manual-notification semantics.

## Staging-only boundaries

Staging uses synthetic data, separate credentials, a separate database, and server-side Supabase access. JSON remains the local/default rollback adapter. This is not production approval and is not authorization to import pilot data.

## Roadmap

Slotzy has moved beyond core staging rescue. Hosted staging E2E is green, the Netlify -> Render -> Supabase staging stack is verified, and the authoritative public booking lifecycle persists through receipt, manage-link access, cancellation, and reload. The mobile readiness suite also passes, the Availability layout has been improved for phone and tablet widths, and the stale service-worker CSS path has been addressed.

The next milestone is **closed pilot readiness**, not Play Store readiness. App packaging and store planning come only after mobile polish, pilot hardening, and feedback from trusted barber/customer users.

### Phase 1: Staging foundation — completed

- Hosted staging E2E is green across the focused setup chain, full owner-to-customer lifecycle, and negative checks.
- Netlify frontend -> Render API -> dedicated Supabase staging Postgres is verified.
- Public bookings persist authoritatively before the receipt is shown.
- Manage links, cancellation, and cancelled state after reload are verified.
- The local mobile readiness suite exists and passes across four representative viewports.
- Mobile Availability uses readable day cards, and the stale installed-shell CSS issue is addressed through cache versioning and network-first shell assets.

### Phase 2: Mobile pilot polish — current

- Use `docs/MOBILE_PILOT_POLISH_CHECKLIST.md` as the working UI checklist and priority order for this phase.
- Review the complete public booking, receipt, manage-link, cancellation, and reschedule experience on real iPhone and Android phones.
- Review the authenticated barber dashboard on real phones, including appointment actions, Availability, settings, and booking-link sharing.
- Reduce dashboard length and navigation friction so common daily actions do not require excessive scrolling or hunting.
- Polish owner setup on mobile, including keyboard behavior, step transitions, form density, and the handoff to the dashboard/public link.
- Polish public booking for small screens, native date/select controls, messaging-app link handoff, and clear recovery paths.
- Make empty, loading, offline/backend-error, invalid-link, and retry states consistent and actionable.
- Remove wording that feels like a developer demo and use concise barber/customer language throughout.

Exit criteria: the key barber and customer journeys are comfortable on physical iOS and Android devices, remaining polish defects are triaged, and no high-severity usability blocker prevents a small trusted pilot.

### Phase 3: Pilot hardening

- [ ] Verify invalid, missing, and expired manage links with a safe recovery path.
- [ ] Verify session expiration, logout, refresh behavior, and protected-page redirects.
- [ ] Add and validate forgot-password/password-reset expectations before relying on owner accounts in a pilot.
- [ ] Define which booking, cancellation, and operational emails or notifications are sent, when delivery is best-effort, and what the UI promises.
- [ ] Document staging backup, restore, recovery, retention, and pilot rollback notes; rehearse the supported recovery path.
- [ ] Review monitoring and logs for useful failure signals without customer data, secrets, tokens, or noisy success diagnostics.
- [ ] Complete a focused security/privacy review covering authorization, manage-link sensitivity, secrets, dependencies, data collection, retention, and disclosures.
- [ ] Maintain a repeatable manual QA checklist for real devices and the critical owner/customer lifecycle.
- [ ] Define a small-pilot support process: named owner, contact channel, response expectations, incident notes, defect triage, and a pause/rollback decision path.

Exit criteria: operational, recovery, security/privacy, authentication, and support gaps are understood and acceptable for a deliberately small pilot using controlled real data.

### Phase 4: Closed pilot with trusted barber/customer users

- Invite a small, named group only after Phases 2 and 3 exit criteria are met.
- Observe setup, daily dashboard use, booking completion, manage-link use, cancellations/reschedules, and support needs.
- Collect structured feedback, prioritize recurring friction, and pause expansion for reliability, privacy, or data-loss concerns.

### Phase 5: Product/brand polish

- Apply pilot learning to navigation, hierarchy, copy, onboarding, empty states, branding, and customer trust cues.
- Resolve the highest-value workflow and presentation issues without expanding scope into speculative features.

### Phase 6: Play Store / app packaging prep

- Decide whether a native/PWA wrapper is justified by pilot evidence.
- Define offline behavior, deep links/manage links, notifications, native credential storage, permissions, privacy disclosures, store assets, device coverage, and release/update mechanics.
- Begin packaging only after the hosted mobile product is stable and closed-pilot feedback has been incorporated.

### Phase 7: Production launch planning

- Plan production-specific infrastructure, secrets/origins, migrations, backups and restore, observability/alerting, security/privacy approval, regression, rollback, support, and staged rollout.
- Treat production approval as a separate gate from staging, closed pilot, and app-store packaging.

## Known limitations and deferred UX work

- Complete the remaining checklist cases, especially real-device mobile visual QA, branding/settings, team edits, status actions, and failure recovery.
- Run the complete local one-worker smoke suite in CI and retain its result alongside the guarded hosted suite.
- Mobile pilot polish is now the active phase. Broad redesign, native packaging, and Play Store work remain deferred until closed-pilot feedback.
- The staging E2E suite leaves uniquely prefixed synthetic records because no safe targeted cleanup endpoint exists. Broad database reset is intentionally prohibited in staging.

## Mobile-first audit (2026-09-30)

Automated local mobile checks cover iPhone SE (375×667), iPhone 15-style (393×852), Pixel/Android-style (412×915), and iPad Mini-style (768×1024) viewports. The suite checks login/register, owner setup, public provider/service/date/time/details flow, receipt/manage link, manage cancellation and reload persistence, invalid manage-link state, dashboard booking-link controls, services, availability, appointments, and settings.

The audit found and fixed three focused blockers: the auth modal could exceed a short viewport without scrolling; live auth fields used `#auth-form` while CSS still targeted obsolete `#login-form`; and public/mobile form controls and primary targets could remain below the 44px tap target used elsewhere. Key audited pages now have automated document-overflow, control-clipping, and tap-height checks. The owner calendar intentionally scrolls inside its bounded container instead of widening the document.

The Availability weekly-hours follow-up replaces the compressed four-column table with seven readable day cards at widths up to 768px. Each card keeps the day on one line, gives Enabled a full-width labelled 44px target, and places labelled Start and End controls in a clean two-column row. Time-off rows also stack on narrow screens. Desktop keeps the existing table layout, and availability persistence/data attributes are unchanged. Mobile automation now checks all seven rows for letter wrapping, viewport/card clipping, and 44px targets, plus timezone, buffer, time-off, and save controls.

The dashboard hierarchy follow-up adds a mobile-only two-column quick-jump bar for Today, Booking Link, Appointments, Services, Availability, and Settings. At widths up to 768px, the existing sections are visually prioritized around daily work, with Insights and Reports following the operational sections; desktop document order remains unchanged. Native fragment navigation focuses and scrolls each in-page section target, and mobile automation verifies 44px targets, target visibility, booking-link controls, Availability, and no document-level horizontal overflow. Business logic and dashboard JavaScript are unchanged.

The customer public-booking follow-up groups the existing controls into four clearly labelled steps, strengthens shop identity and submit/status hierarchy, replaces speed/demo and internal scheduling language with customer-facing guidance, and makes confirmation/manage-link instructions explicit. The receipt still appears only after the existing authoritative save path succeeds, and all existing booking/manage selectors and persistence behavior are preserved. Mobile automation now checks the guided initial state, single-provider handling, key control tap sizes, receipt/manage actions, and overflow across all configured viewports.

Real-phone barber review exposed a stale installed-shell case: `owner-dashboard.css` was cache-first under the unchanged `slotzy-shell-v1`, so a phone/PWA could retain the pre-card stylesheet after the frontend deploy. The shell cache is now versioned to `v2`, and CSS/JavaScript shell requests are network-first with cached offline fallback. The mobile suite now performs an actual local barber login under a controlling service worker and checks the authenticated dashboard Availability container, seven named rows, collapsed table headers, card bounds, overflow, and Save Availability target.

The automated Chromium viewports do not replace physical-device validation. Before pilot invitations, manually check iOS Safari and Android Chrome with the virtual keyboard open, native date/select controls, public-booking step density and error visibility, dashboard jump focus/scroll position, browser and installed-PWA back behavior, sticky header space, calendar horizontal gestures, modal scrolling, copy/open behavior, outdoor readability/contrast, rotation, safe-area insets, and receipt/manage-link handoff between browser tabs or messaging apps.

## Before inviting real barbers

Complete the staging QA checklist, staging backup/restore rehearsal, monitoring/error review, dependency/security review, controlled email validation, and a support/incident owner. Confirm authentication, authorization, booking policies, cancellation/reschedule behavior, and data-retention expectations with synthetic data first.

## Before Play Store or native work

Complete mobile pilot polish, pilot hardening, and the closed pilot first. Then use real pilot evidence to define offline/deep-link/manage-token behavior, notification requirements, privacy disclosures, native credential storage, and mobile-device QA. Slotzy is not ready for Play Store packaging yet; staging reachability and passing automated mobile coverage are necessary foundations, not a store-readiness decision.

## Before production

Complete production-specific security review, separate production secrets/project/origins, backup and point-in-time restore rehearsal, observability/alerting, migration rehearsal, data/privacy review, full automated and manual regression, rollback rehearsal, and an approved pilot launch plan.

## Recommended next pilot checks

The recommended next milestone is **closed pilot readiness**. Use the dedicated mobile polish checklist, starting with a focused mobile owner dashboard hierarchy/navigation task and real-phone public booking and barber-dashboard reviews. Then close the Phase 3 authentication, notification, recovery, monitoring, security/privacy, manual-QA, and support gaps. Invite trusted barbers/customers only after those gates are met; defer Play Store preparation until their feedback has been incorporated.
