# Slotzy Project Status — staging and mobile readiness (2026-10-01)

## Pilot operations and day-one gate (2026-10-04)

Operational roles are confirmed for the first tiny trusted staging-only pilot. The founder/product owner is the authorized staging operator, named pilot operator, and incident decision maker. A private direct-message/text support channel exists outside Git. No phone numbers, email addresses, tester names, or private contact details are stored in this repository. The round remains staging-only, has no payments or production activity, and is limited to the tiny trusted tester group.

The day-one guarded staging suite and synthetic lifecycle check must pass before invitations. Stop invitations immediately for an authoritative-save discrepancy, unauthorized private-link access, failed persisted cancellation, missing owner appointment, or possible data disclosure.

**Day-one result: passed.** A separately authorized guarded staging run passed **3/3**: focused staging owner setup API chain, synthetic owner-to-customer booking lifecycle, and staging negative checks. The tiny trusted staging pilot is cleared for invitations within its documented limits.

**Launch materials:** tester-facing instructions, role checklists, limitations, stop conditions, and a redacted feedback/severity template are prepared in `docs/CLOSED_PILOT_TESTER_INSTRUCTIONS.md` and `docs/CLOSED_PILOT_FEEDBACK_TEMPLATE.md`. Do not place private support details in Git.

## Pilot feedback triage 1 — owner mobile/calendar and branding polish (2026-10-04)

Pilot customer feedback confirms booking, available times, recovery, and cancellation remained straightforward. Owner feedback identified a collapsed-looking mobile calendar, a cramped desktop calendar column/header area, unclear delete progress, and logo framing. This focused frontend patch reserves a readable mobile month grid, gives the calendar the primary desktop column, separates account badges from navigation styling, adds explicit deleting/clearing feedback with retryable failure recovery, and uses a centered contained public-logo frame. The tiny trusted staging pilot remains active within its staging-only, no-payments, no-production limits; all existing stop conditions remain active.

**Service descriptions:** not implemented. A legacy local/demo `desc` value exists, but managed services do not edit it, the Postgres `services` schema/adapter does not preserve it, and public booking does not render it. This is a beta improvement requiring a deliberate additive data-model/API/public-contract package and migration review.

**Deployed UAT result: passed.** After an initial cancellation-observation flake, the guarded staging rerun passed **3/3** (focused owner setup API chain, synthetic owner-to-customer lifecycle, and staging negative checks). Manual UAT found the owner mobile calendar/header improvements acceptable. Public logo alignment improved; the remaining not-perfectly-flush logo detail is a beta improvement, not a blocker. The tiny trusted staging pilot remains active.

## Beta reliability and recovery validation (2026-10-04)

**Result: the conditional tiny-pilot go decision remains appropriate.** Local mobile automation now covers logout credential cleanup, duplicate booking prevention, duplicate cancellation prevention, canceled-booking safety, and retryable cancellation failure. The cancellation UI was hardened so a failed token cancellation restores an enabled Cancel action instead of remaining stuck in a pending state. No backend, storage contract, Supabase, staging, or production behavior changed.

| Reliability area | Classification | Result / remaining boundary |
| --- | --- | --- |
| Owner logout | Already covered / acceptable for beta | Automated across the mobile browser matrix; stored session credentials clear and protected Settings returns to sign-in. |
| Invalid JWT/session expiry | Needs test only | Client fails closed and clears rejected sessions; retain a hosted expiry/revocation check because per-user immediate JWT revocation is not implemented. |
| Invalid/expired manage links | Already covered / acceptable for beta | Generic unavailable copy, no appointment disclosure, and no browser token response. A real time-expired hosted fixture remains a useful test-only follow-up. |
| Canceled manage links | Already covered / acceptable for beta | Canceled state persists and exposes no further Cancel action; it may offer booking another appointment. |
| Slow/failed booking and owner saves | Already covered / acceptable for beta | Pending controls and authoritative success/failure behavior prevent fake receipts or fake saves. |
| Duplicate booking submission | Already covered / acceptable for beta | New automation proves rapid duplicate activation produces one create request. |
| Duplicate/retry cancellation | Needs small code hardening — completed locally | An in-flight guard prevents duplicate cancel requests; failure rerenders a usable Cancel action without showing canceled success. |
| PWA cache rollover | Needs test only | Versioned cache cleanup and network-first document/script/style handling exist; installed-app upgrade/reconnect remains real-device validation. |
| iPhone-size containment | Already covered / acceptable for beta | Automated iPhone SE and iPhone 15 projects cover public/manage layouts; physical Safari/home-screen rollover remains a beta improvement. |
| Restore-target API/UI smoke | Beta improvement | Still unperformed because no isolated target service was authorized for this task. Do not repoint staging. |
| Recurring-block backup/restore | Beta improvement | Runbook inventory is corrected. The completed 2026-10-03 rehearsal predates recurring rollout, so a refreshed isolated rehearsal must verify the table and booking exclusion behavior. |

**Operational and day-one gates:** resolved for the first tiny round. Invitations are cleared only for the documented tiny, trusted, staging-only cohort; immediate stop conditions remain active. **Post-beta:** self-service recovery/per-user revocation, production recovery/monitoring, broader offline guarantees, and automated restore-environment provisioning.

## Beta readiness gate review (2026-10-04)

**Decision: Conditional go — ready for the next tiny trusted real-user staging round, within the documented limits.** Core owner setup, services, scheduling, public booking, branding, private manage/cancel/recovery, owner visibility, and operator support procedures have deployed staging evidence. This is not production readiness or approval for a broad/open beta.

The operational roles and private support channel are confirmed outside Git, and the separately authorized day-one guarded synthetic lifecycle check passed 3/3. Invitations may proceed for the tiny trusted staging-only cohort.

| Area | Gate classification | Evidence / limitation |
| --- | --- | --- |
| Owner onboarding/setup | Already complete / acceptable for beta | Authoritative hosted setup chain is covered by guarded staging. |
| Services | Already complete / acceptable for beta | Owner CRUD and public selection are covered; richer team/provider assignment is deferred. |
| Availability and recurring blocks | Already complete / acceptable for beta | Weekly hours, recurring exclusions, backend enforcement, staging migration, staging 3/3, and manual UAT passed. |
| One-time time off | Already complete / acceptable for beta | Create/delete and public exclusion paths are covered independently from recurring blocks. |
| Public chooser and booking | Already complete / acceptable for beta | Chooser/direct links, date/time selection, authoritative save, receipt-after-save, and negative states are covered. |
| Branding | Already complete / acceptable for beta | Logo/cover persistence and public rendering are implemented; continue real-device visual observation. |
| Receipt/manage link/cancel/recovery | Already complete / acceptable for beta | Opaque token links, persisted cancellation, generic recovery, and no browser token recovery response are covered. |
| Owner appointment visibility/management | Already complete / acceptable for beta | Owner visibility and core management work; Calendar overflow remains a non-blocking improvement. |
| Owner account/profile/recovery | Already complete / acceptable for beta | Hosted personal profile is intentionally read-only; recovery is operator-assisted through private support. |
| Backup/restore | Beta improvement | Database-level isolated restore passed. App/API smoke against the restore target and explicit recurring-block restore coverage remain unverified. |
| Privacy/support/incident | Already complete / acceptable for beta | Roles and private channel are confirmed outside Git for the tiny round; no private details are stored in the repository. |
| Mobile/PWA usability | Already complete / acceptable for beta | Android and iPad browser/home-screen core flows passed; iPhone-specific and adverse network/cache cases remain improvements. |
| Staging reliability | Already complete / acceptable for beta | Multiple guarded 3/3 passes, including after recent deployed packages. Run the day-one check before invitations. |

**Recommended next development package:** Beta Reliability and Recovery Validation. Keep it validation/hardening focused: exercise logout/session expiry, invalid/expired manage links, slow/offline/reconnect and duplicate-submit behavior, installed-PWA cache rollover, iPhone-size Safari/home-screen coverage where available, and an isolated restore-target API/UI smoke that includes `recurring_time_blocks`. Do not add product scope during that package.

**Post-beta backlog:** verified self-service owner recovery and per-user session revocation; full multi-provider invitations/permissions; customer accounts/history; token-authorized rescheduling; production privacy/retention/monitoring and abuse/rate-limit controls; production backup/restore; payments; Calendar/dashboard/tablet polish; app-store packaging.

## Owner account/profile/recovery beta cleanup (2026-10-04)

- **Complete for beta on staging.** Netlify is deployed, the guarded staging suite passed **3/3**, and manual UAT passed with confirmation that “all of that looks right.” No Render deploy, Supabase migration, or production change was required.
- Chosen scope: **Option B — intentional hosted read-only profile plus clearer recovery help.** Hosted profile fields have no authoritative write API, and registration does not establish a verified recovery email, so enabling edits or automated recovery would create identity and persistence risk.
- Settings now separates immutable account identity, local/demo-only personal profile fields, and editable public Shop settings. Username, password, hosted personal email, hosted personal phone, and hosted display name remain read-only for beta; public shop contact and branding remain editable through the existing authoritative shop path.
- Login and Settings expose generic operator-assisted recovery help. They perform no account lookup, do not reveal whether an account exists, and do not send or expose credentials or tokens.
- Manual UAT confirmed the login help entry point, clear separation of account/profile/shop settings, intentional hosted read-only profile fields, editable public business settings, and recovery copy that makes no email/text delivery claim.
- Self-service password reset, verified recovery-email enrollment, password change, username changes, and per-user JWT revocation remain post-beta work. Recovery remains operator-assisted through private pilot support.

## Recurring weekly scheduling blocks (2026-10-04)

- **Beta package complete on staging.** The additive Supabase migration was applied to staging, the deployed guarded staging suite passed **3/3**, and manual owner/customer UAT passed. Production was not touched.
- Owners can create a weekly Lunch, Break, or custom unavailable range for one or more weekdays, review it separately from one-time time off, and delete it with authoritative save feedback.
- Public slot generation excludes any service interval that overlaps an enabled recurring block. Express independently rejects crafted bookings outside weekly hours or overlapping one-time/recurring blocks.
- Manual UAT confirmed a recurring lunch/break hides overlapping public times, preserves available times before and after the block, and can be deleted successfully.
- Local JSON and relational Postgres mappings preserve the same recurring-block shape. No production migration or deployment was performed.

## Closed-pilot operational gate (2026-10-03)

## Pilot Round 2 cover-rendering follow-up (2026-10-04)

- Hosted Round 2 retest confirmed that branding persistence and logo delivery are fixed: the saved logo appears in both the public shop chooser and the selected booking page.
- The same retest found the saved cover still missing from the selected booking hero. Storage and the allowlisted public booking-context response already use the canonical `cover` field; the remaining defect was frontend-only. The booking page now normalizes `cover` and historical cover aliases and renders the selected cover through a contained decorative `<img>` layer instead of a CSS custom-property/pseudo-element background. An absent cover retains the existing Slotzy fallback.
- Local regression coverage now checks decoded, visible logo and cover images, the no-cover fallback, direct `?shop=` links, and mobile horizontal containment. Publish this fix with a Netlify deploy, then rerun guarded staging and manual Round 2 branding checks. Render and Supabase changes are not required.

## Pilot Round 2 iPhone Safari/PWA feedback follow-up (2026-10-03)

- Core iPhone Safari/PWA Round 2 flow passed: booking, actual available times, Sunday/Monday availability blocking, private manage-link opening, cancellation, and owner/customer flow.
- Private manage tokens intentionally authorize only appointment read and cancellation. They do not authorize the staff-authenticated reschedule workflow. The prior disabled Reschedule button was therefore expected by policy but confusing; it is removed for token links and replaced with: “Rescheduling is not available yet. Please cancel and rebook.”
- The public chooser now keeps shop hero and booking details hidden behind its existing loading state until the shop context is known, preventing the first-load services/booking flash. Direct booking links still reveal the correct shop after context load.
- Owner dashboard cramped top area and long-scroll feedback is recorded for Owner Dashboard 2.0 polish. No dashboard redesign is included in this focused fix.
- This is frontend-only and requires a Netlify deploy. Render, Supabase, staging data, and production are unchanged.

## Pilot Round 2 profile, branding, and team follow-up (2026-10-03)

- Shop settings could fail after an otherwise accepted logo/cover upload because a 5 MiB source image expands as a data URL; saving sends the complete shop record and exceeded the server's prior 5 MB JSON request limit. The server limit is raised to 15 MB to support the documented two-image 5 MiB maximum.
- The first cover fix accepted the public `cover` field in alias lookup, but hosted Round 2 retest still showed only the logo. The 2026-10-04 follow-up replaces the hero's CSS custom-property background with a real contained image layer and keeps the unbranded fallback.
- Team management remains owner-only and the pilot still does not offer a complete multi-provider invite/onboarding workflow. Team now explicitly tells barber accounts: “Only the shop owner can add team members during the pilot.”
- Recurring weekly lunch/break blocks are complete for beta on staging. Confirmation email/text and manage-link recovery, and optional client accounts/history remain separate roadmap work. One-time time-off blocks remain explicitly date/time-range specific.
- This batch requires Netlify and Render deployment; no Supabase migration is required.

- **Ready for internal staged UAT:** **Yes.** Guarded hosted staging is passing **3/3**: focused staging owner setup API chain, synthetic owner-to-customer booking lifecycle, and staging negative checks.
- **Verified owner-side UAT fixes:** commit `58dbe8e` fixes the Availability lunch/break/time-off delete path; manual verification confirmed a confirmed delete removes the block as expected. Branding logo and cover uploads now accept JPG/PNG/WEBP files up to 5 MB (previously 1 MB). Dashboard action redundancy remains a non-blocking Owner Dashboard 2.0 follow-up.
- **Ready for a trusted barber/customer pilot:** **Yes, with strict limits.** The final assessment is **Ready for tiny trusted closed pilot with strict limits**: one named barber/operator and one to three named customer testers, staging only. This is not production readiness or authorization to expand.
- **Privacy/support/incident readiness:** the practical trusted-pilot process is now documented in `docs/CLOSED_PILOT_PRIVACY_SUPPORT_INCIDENT_RUNBOOK.md`, covering data handling, restricted support intake, correction/deletion requests, incident triage, pilot pause, and tester communications. This removes the privacy/support/incident **documentation** blocker, not the separate production privacy/retention/monitoring gap.
- **Recovery status:** the database-level isolated backup/restore rehearsal is **completed and validated** (2026-10-03): an authorized manual CSV export/import restored `slotzy-staging` into the isolated `slotzy-postgres-test` Supabase target in dependency-safe batches. Render staging remained pointed at `slotzy-staging`; production and staging data were not touched, and no destructive SQL was run. Final target table counts and relational integrity checks are recorded in `docs/CLOSED_PILOT_BACKUP_RESTORE_RUNBOOK.md`. `email_outbox` was intentionally skipped because it is not needed to prove core booking recovery and may contain contact/message data. This validates the database-level restore only; app-level validation against the restore target was not performed.
- **Remaining limitations:** owner password recovery is manual/operator-mediated only and password changes do not immediately revoke issued JWTs. The private support channel, incident decision maker, and authorized staging operator are confirmed outside the repository for this tiny round. Installed Android PWA, Android Chrome, iPad Safari, and the iPad home-screen app all passed the critical booking/manage/cancel/owner-visibility path; iPhone-specific UAT and recovery/cache coverage remain open. The isolated restore rehearsal was database-level only; no app-level validation ran against its restore target. Calendar overflow and tablet visual-polish follow-ups remain non-blocking.
- **Minor observation:** on the first Android Chrome opening of the “I'm a client” page, services briefly appeared before a barbershop was selected and then corrected itself. Inspection of `js/booking-engine.js` found service population gated on selected shop and barber state, so this is tracked as a non-blocking transient observation rather than a confirmed state bug.
- **Should fix or close before pilot:** complete the remaining target-device/browser coverage, including iPhone Safari and installed iOS home-screen app if required for the pilot; iPad now covers the Apple/Safari browser and home-screen paths. Verify logout/session behavior, invalid/expired manage-link recovery, slow/offline behavior, and installed-app cache refresh. Follow up on the non-blocking iPad/tablet owner-dashboard centering and Settings/Profile branding-upload alignment observations.
- **Can wait:** mobile Calendar overflow remains parked; richer multi-provider invite/account and hours workflow is future work. Do not represent the current Team page as multi-provider management.
- **Decision record:** the final scope, stop conditions, invitation copy, and day-one gate are in `docs/CLOSED_PILOT_GO_NO_GO.md`. The documented recommendation is a tiny trusted staging pilot only, not a production or broader-pilot go.
- Use `docs/CLOSED_PILOT_UAT_CHECKLIST.md` for the tester run and report format. This is a documentation/status update only; it changes no application, backend, Supabase, staging data, or production behavior.

## Manage-token authorization hardening (2026-10-02)

- Hosted anonymous booking now receives a one-time opaque manage token. Receipt links use a URL fragment, and token-scoped API endpoints load or cancel only that booking. Hosted contact-query authorization is removed.
- The server persists only a SHA-256 token hash (JSON demo booking field or Supabase `booking_manage_tokens`), never the raw token; owner appointment access remains authenticated and unchanged.
- Render and Netlify redeploys are required. Supabase migration is required only if the existing `booking_manage_tokens` table from `docs/SUPABASE_SCHEMA.sql` has not already been applied.

## Public Booking visual polish Phase 2 (2026-10-02)

- The public shop chooser, direct booking flow, receipt, and manage-link handoff now have explicit mobile containment checks. The chooser action, service/date/time/details controls, receipt link, and manage actions remain easy to tap without horizontal scrolling.
- Customer-facing error copy no longer exposes a raw shop identifier for an unavailable manage link. Cancellation success confirms the saved appointment state without making an optional notification delivery issue sound like a failed cancellation.
- Authoritative save-before-receipt, anonymous booking creation, manage-link format, cancellation persistence, owner visibility, and all backend/Supabase behavior are unchanged. Calendar mobile overflow remains parked.
- This is a frontend-only batch for the next approved Netlify deploy; Render does not require a redeploy.

## Current roadmap position (2026-10-01)

Slotzy is no longer in core staging rescue. Hosted staging E2E is green against the verified Netlify -> Render -> Supabase staging stack. Authoritative public booking persistence, manage-link access, cancellation, and cancellation persistence after reload are covered. The mobile readiness suite passes across its representative viewports; mobile Availability has been redesigned into readable day cards; and the service-worker stale CSS path was corrected.

The active phase is **Mobile Pilot Polish**. The next milestone is **closed pilot readiness**, reached through real-phone barber/customer review followed by pilot hardening. Slotzy is not ready for Play Store packaging: app-store work follows mobile polish, a controlled closed pilot, and incorporation of pilot feedback.

Roadmap phases are maintained in `docs/PILOT_READINESS.md`:

1. Staging foundation — completed
2. Mobile pilot polish — current
3. Pilot hardening
4. Closed pilot with trusted barber/customer users
5. Product/brand polish
6. Play Store / app packaging prep
7. Production launch planning

## Owner Dashboard North Star — Phase 1 mobile layout (2026-10-02)

- The dashboard now leads with a clearer shop-focused hero, compact icon-supported quick-action cards, a scan-friendly Today card, a polished share-booking-page card, and a direct Open Appointments handoff below the upcoming preview.
- Existing real dashboard data is retained: today/upcoming appointments, services, availability, and booking-link/QR controls. No new metrics or data sources were added.
- Copying the dashboard booking link now leaves plain on-card feedback. Calendar remains a separately parked issue.
- This is frontend markup/CSS/JavaScript/test/documentation work only. No backend, Supabase, persistence, booking, or appointment-refresh behavior changed. Batch it with the next approved Netlify deploy; Render does not require a redeploy.

## Settings / Business Profile mobile polish (2026-10-02)

- The owner Settings page now uses plain Business Profile wording, keeps every profile/policy control at least 44px tall, and contains save and booking-link feedback without horizontal overflow.
- Save now announces `Saving your changes...`, success, validation, and retryable failure in the form; copying and opening the booking link also leave a clear on-page result.
- Mobile automation verifies contained controls and validation, save feedback, copy feedback, the exact opened public booking URL, and the saved cancellation policy on public booking.
- This is frontend markup/CSS/JavaScript/test/documentation work only. No backend, Supabase, booking persistence, or Calendar behavior changed. Batch it with the next approved Netlify deploy; Render does not require a redeploy.

## Owner mobile header and calendar controls polish (2026-10-02)

- Resolved the real-phone owner-dashboard header crowding: the duplicate `Welcome, username` badge is no longer in the dashboard navigation; the existing hero greeting remains the single username location.
- At mobile widths, Dashboard, Appointments, Services, Team, and Settings now use a contained two-column navigation grid, with a full-width 44px Logout target. Desktop navigation remains unchanged.
- Resolved the owner Appointments calendar toolbar squeeze: FullCalendar now renders month/year on its own row, with paired previous/next controls and a full-width-in-row Today control below. The mobile calendar no longer imposes a wide minimum width.
- This is frontend presentation and test coverage only. Booking, appointment filtering/refresh, walk-ins, exports, cancellation, persistence, backend, Supabase, staging data, and production were not changed.
- Validation: 48 mobile checks passed across iPhone SE, iPhone 15, Pixel 7, and iPad Mini; smoke discovery listed 25 tests in 7 files; `git diff --check` passed. The staging command remained blocked by its required opt-in mutation guard, so no staging data changed.

## Services management mobile polish (2026-10-02)

- The mobile Services page now presents price and appointment length as distinct scan-friendly details, with contained wrapping actions and 44px add, edit, save, cancel, and delete controls.
- Add and edit forms use plain, explicit labels and numeric keyboard hints. Validation remains inline and contained; owners now see durable `Saving…`, `Saved.`, and friendly retryable save/remove failure messages in addition to the existing toast.
- The no-services state still leads directly to Add Service, and the existing delete confirmation clearly explains that removal stops client selection and cannot be undone.
- This is frontend markup, CSS, JavaScript, mobile-test, and documentation work only. Service persistence, public booking service reads/selection, owner setup, staging lifecycle, backend, Supabase, and Calendar were not changed. Calendar mobile overflow remains parked.

## Availability and Hours mobile polish (2026-10-02)

- Weekly Hours retains its seven contained mobile day cards with 44px Open/Closed, Start, and End controls; each card now explicitly states whether the day is Open or Closed.
- Saving weekly hours now provides durable Saving, Saved, and plain-language failure messages. Missing start/end times and invalid time ranges remain visible in the contained inline error panel.
- Local mobile coverage verifies all day controls, validation, saved-hour refresh, overflow containment, and selectable public-booking times after a valid hours save. Calendar overflow remains parked.
- This is a frontend-only batch for a later Netlify deploy. Availability persistence, public booking calculations, setup hours, staging lifecycle, backend, Supabase, and production were not changed; Render does not require redeployment.

## Team provider pilot safety correction (2026-10-02)

- Audit found that the legacy Team page called local `Slotzy_staff` entries “Providers,” although public booking only uses actual owner/barber user records scoped to the shop. Those local entries could never become bookable providers.
- Chose Option B for pilot safety: the misleading add, activate, deactivate, and delete UI is removed. The Team Providers page now clearly explains that customers book with the provider created during setup and that additional provider accounts require a later sign-in/hours workflow.
- No staff data was removed and public provider selection is unchanged. This is a frontend-only batch for a later Netlify deploy; backend, API/provider contract, Supabase, Render, Calendar, and production are unchanged.

## Owner mobile calendar containment follow-up (2026-10-02)

- Resolved the remaining Android/installed-app calendar clipping report by removing the mobile calendar's nested border/scroll surface and containing it within the existing Calendar card.
- The month label now has explicit horizontal padding; Today is a full-width row; previous/next controls use an equal two-button row below it. The controls and card cannot expose an internal horizontal scrollbar.
- No navigation, Today, appointment, booking, persistence, backend, or Supabase behavior changed.

## Manage Appointments mobile polish, excluding Calendar (2026-10-02)

- Tightened the mobile Appointment Manager hero, preserved the month summary and Add Walk-in action, and reduced unnecessary spacing between page sections.
- Replaced the horizontal-scrolling appointment filter strip with a wrapped two-column 44px chip grid; search and scope controls now fill their available width cleanly.
- Refined the appointment list/empty-state spacing and ensured empty-state actions and appointment cards remain contained and easy to tap.
- The parked Calendar mobile overflow issue was intentionally not redesigned or fixed in this pass. No appointment behavior, booking/cancellation persistence, backend, or Supabase configuration changed.
- Validation: 52 mobile checks passed across the configured iPhone SE, iPhone 15, Pixel 7, and iPad Mini projects; smoke discovery listed 25 tests in 7 files; `git diff --check` passed. Staging did not mutate because its explicit opt-in guard was not enabled.

## Mobile state consistency pass (2026-10-01)

- Added a small shared state-panel pattern for loading, error, success, empty, and retry presentation, including overflow-safe copy and 44px mobile actions.
- Public booking now shows real shop-context loading and retry states, a distinct no-services state, the existing actionable no-times state, and `Saving...` only while the authoritative booking write is pending. A failed write still cannot display a receipt.
- The private manage page now announces its real async load, offers retry after load failure, and labels a pending cancellation. Invalid links remain errors rather than loading indefinitely.
- Owner appointments now expose the authoritative refresh, preserve any cached list with a visible stale-data warning on failure, and provide a real retry action. Empty Today/All/filter results use one clear owner-facing pattern.
- Owner setup shop/team/hours actions now expose save/finish progress. Availability failures are caught and shown as `Could not save changes. Try again.`; successful explicit hour saves say `Saved.`
- The dashboard upcoming empty state was aligned with the same plain-language pattern. Dashboard modules that render already-hydrated local state were intentionally not given a fake loading phase.
- No persistence, API contract, authentication, booking/cancellation rules, service-worker policy, Supabase configuration, or backend behavior changed. This is a frontend-only deploy.
- Automated mobile coverage now includes shop-context loading/error/retry, no services, no times, invalid manage links, no fake receipt after failure, and owner appointment refresh-error/empty/retry behavior at all configured viewports.
- Validation: mobile readiness passed **44 tests across four configured viewports**; smoke discovery listed **25 tests in 7 files**; `git diff --check` passed. The hosted staging command was stopped by its required `SLOTZY_ALLOW_STAGING_E2E=true` mutation guard, so no staging data changed and two tests did not run.
- Real-phone follow-up remains required for slow/offline transitions, virtual-keyboard positioning, native controls, retry after connectivity returns, duplicate-tap resistance, installed-PWA cache transitions, and screen-reader announcements.

## Owner setup mobile polish pass (2026-10-01)

- Kept the existing five setup gates and all save behavior, but reframed the page as a concise Shop, Team, Services, Hours, and Ready flow with clearer titles and later-edit guidance.
- Replaced wizard/first-run and internal slot-generation language, enlarged the solo choice, compacted the mobile progress indicator, strengthened primary actions, and rendered validation/success text as readable contained notices.
- Promoted `Finish and Open Dashboard` as the final completion action while retaining copy/open/QR access to the same generated public booking link.
- Expanded the mobile suite from an active-panel spot check to a full controlled new-owner completion path at every configured viewport, including shop/team/services/hours validation, overflow and tap-target checks, all seven responsive Hours cards, and final actions. The hosted staging lifecycle retains its authoritative shop/service/availability assertions; only its Step 1 initialization-copy synchronization was updated.
- Validation: mobile readiness passed **24 tests across four configured viewports**; focused owner-setup smoke passed **2 tests**; smoke discovery remains **24 tests in 7 files**. The staging command stopped at its required `SLOTZY_ALLOW_STAGING_E2E=true` mutation guard, so no staging data changed and the two later tests did not run.
- No setup persistence, authentication, public booking persistence, backend, Supabase, staging data, production, or native packaging behavior changed. Frontend changes require a Netlify redeploy; Render does not require a redeploy.
- Remaining real-phone risks are virtual-keyboard resize/scroll, native file/time/select controls, focus after validation, thumb reach on long steps, resumed setup, rotation/safe areas, and installed/browser back behavior. Later polish may add explicit saving states or focus-to-first-error if device observation justifies it.
- A manually observed mobile customer booking save error remains logged separately as a **pilot-blocker candidate**. This task did not touch that save path and does not resolve or downgrade the risk.

## Mobile owner dashboard hierarchy and navigation pass (2026-10-01)

- Added a mobile-only two-column quick-jump bar for Today, Booking Link, Appointments, Services, Availability, and Settings. Each target is at least 44px tall; in-page targets are focusable and use native fragment navigation.
- At widths up to 768px, the existing dashboard sections are visually ordered around daily work: hero/status, quick navigation, Today, booking-link controls, appointments, service/settings shortcuts, Availability, then Insights and Reports. Desktop retains the existing source order.
- No booking, appointment, service, availability, settings, authentication, persistence, or dashboard JavaScript behavior changed.
- Mobile readiness passed: **20 tests across four configured viewports**. Coverage now checks jump-link tap size, focus/scroll destination, section visibility, booking-link controls, Availability layout, and document-level horizontal overflow.
- Staging E2E command was invoked without enabling its mutation guard: the first test stopped immediately with the expected `SLOTZY_ALLOW_STAGING_E2E=true` safety message and the remaining two did not run. No staging mutation occurred.
- Smoke discovery passed: **24 tests in 7 files**.
- Remaining risk: validate the new hierarchy, focus landing, browser back behavior, and installed-PWA scrolling on physical iPhone and Android devices; consider further collapsing secondary Insights/Reports only after that review.

## Customer public booking mobile polish pass (2026-10-01)

- Grouped the existing booking controls into four visible steps: barber, service, date/time, and customer details. Shop identity remains first, and the confirmation/manage-link handoff remains the final state.
- Replaced the repeated `Book in 30 seconds` promise, internal slot-generation wording, and client/developer terminology with concise customer guidance. The receipt now tells customers to review the confirmed details and save the private manage link.
- Added focused mobile styling for step grouping, comfortable spacing, 44px time/manage targets, a full-width confirmation action, and prominent inline status/error states. Desktop remains responsive and uses the same flow.
- No persistence, booking rules, cancellation/reschedule persistence, API, authentication, Supabase, staging, or production behavior changed. `js/booking-engine.js` changes are presentation copy only.
- Mobile readiness passed: **20 tests across four configured viewports**. New coverage checks identity, initial empty state, single-provider selection, key controls, receipt/manage actions, and overflow.
- The guarded staging command stopped before mutation because `SLOTZY_ALLOW_STAGING_E2E=true` was not set; two tests did not run. Smoke discovery remains **24 tests in 7 files**.
- Remaining risk: physical iPhone/Android review of native date/select controls, keyboard scrolling, status visibility, receipt density, browser back behavior, and manage-link handoff.

## Result

The OneDrive cloud-provider read failures are resolved in this clean clone at `C:\Dev\Slotzy`. `npm`, Node, Playwright test discovery, static-server startup within Playwright, and the backend all successfully read project files. No application code, booking logic, nested `slotzy/` directory, deployment configuration, or native/Capacitor files were changed.

## Customer-login smoke fix (2026-09-27)

- **Failing test:** `tests/smoke/critical-flows.spec.js:309` — `customer login is blocked with a friendly inline message`.
- **Selector/assertion:** `expect(page.locator("#auth-error")).toContainText(...)`.
- **Old expected text:** `Customer logins are not enabled. Use your booking link instead.`
- **Actual app text:** `Customer logins not enabled — use booking link`.
- **Root cause:** two assertions retained older, longer copy while the concise text is consistently used by `js/auth.js`, `js/main.js`, and `pages/customer-dashboard.html`.
- **Source of truth decision:** the app copy is consistent and clearer for the current product direction, so only test expectations were updated. No app/auth/session/booking behavior changed.
- **File changed:** `tests/smoke/critical-flows.spec.js` (two stale text expectations: the failed login assertion and the retired-dashboard assertion).
- **Focused result:** `npx playwright test tests/smoke/critical-flows.spec.js --grep "customer login is blocked" --reporter=list` — **1 passed (2.2s)**.

## Public booking and manage-link pilot hardening (2026-09-27)

### Files changed

- `pages/book.html`
- `pages/manage.html`
- `js/booking-engine.js`
- `css/styles.css`
- `tests/smoke/public-manage-access.spec.js`

### Booking page improvements

- Added a compact, numbered four-step guide: barber, service, date/time, then customer details.
- Clarified that no account is required and that the receipt's manage link is how customers return to make changes.
- Added a clearly labelled `Your details` section and browser-friendly name/phone input hints.
- Retained all existing empty, unavailable-date, no-times, stale-slot, policy, and booking-error messages; no slot generation, availability, time-off, buffer, overlap, or booking persistence code changed.
- Added responsive step layout: four columns on desktop, two on tablets, one on narrow phones.

### Receipt and manage-link improvements

- Retained the existing appointment details, confirmation code, copy link, copy confirmation, and calendar/ICS action.
- Added an explicit `Open Manage Page` link beside the existing visible manage URL and Copy Link action. It uses the same generated URL and is stacked/full-width with comfortable tap size on mobile.
- Added a smoke assertion that the explicit open action uses the same manage-link URL as the receipt link.

### Manage page improvements

- Clarified that the manage link works without an account and is private to the booking contact.
- Clarified that per-appointment policy rules control cancellation/rescheduling.
- Improved the no-slot message in the reschedule dialog with a safe next step: try another day or keep the current appointment.
- Preserved the deliberate Cancel -> Confirm Cancel -> Keep Appointment pattern and all existing policy-blocked controls/messages.

### Behavior and validation

- No auth/session, booking model, API/local-storage data mode, `server/src/db.json`, or nested `slotzy/` change was made.
- `npm run test:smoke -- --list`: passed; **24 tests in 7 files**.
- `npx playwright test tests/smoke/public-manage-access.spec.js --workers=1 --reporter=list`: passed; **2 passed (7.6s)**. This covers public booking, receipt manage link, explicit open action, link copy, contact-scoped manage access, Cancel -> Confirm Cancel, policy limits, rescheduling, overlap protection, and persistence refresh.
- The requested combined critical/public-manage command and a critical-flow subset were attempted. They produced no final result before the environment's 30-second command cap; related Playwright/Node processes were stopped. A fresh `npm run test:smoke` attempt likewise passed tests 1-5 (including the corrected customer-login checks) before the same cap. This is an environment timeout/process-lifecycle limitation, not an observed assertion failure.
- Mobile verification was performed from the responsive CSS behavior and covered receipt/manage action stacking in automated public/manage tests. A visual device/browser pass at 375px and 768px remains recommended before inviting pilot barbers.

### Remaining pilot concerns

1. Run the configured 24-test one-worker suite in a terminal or CI job without the 30-second command cap and retain the final summary.
2. Perform a visual phone-width pass for `/pages/book.html?shop=demo-fade-studio`, receipt, valid manage link, invalid/missing manage link, cancellation confirmation, and reschedule dialog.
3. Confirm pilot environment secrets, durable storage/backups, and API deployment configuration before real customer data is used.

## Owner appointment management pilot polish (2026-09-27)

### Files changed

- `pages/manage-appointments.html`
- `js/owner-appointments.js`
- `css/owner-dashboard.css`
- `tests/smoke/critical-flows.spec.js`

### Improvements

- Appointment cards now present an explicit Service label, a prominent customer name, contact details, provider (for owners), date/time, deposit state, no-show count, and an accessible status badge label.
- Added status-aware card presentation: completed appointments have a calm success treatment; cancelled and no-show appointments have a distinct, subdued danger treatment. Booking data and status semantics are unchanged.
- Clarified filter, schedule, and reschedule-empty-state language for a barber operating the pilot.
- Updated all owner destructive status confirmations with the appointment/customer/time context. Owner cancellation still uses the existing browser confirmation; customer Cancel -> Confirm Cancel behavior was not changed.
- Existing mobile card stacking, full-width action controls, wrapping, and long-text handling remain in place; the card additions use the same responsive grid and overflow-safe text styles.

### Data reliability and tests

- Owner appointments still load through the shared `dataStore` booking collection used by public booking; no API/local-storage adapter was changed.
- The owner reschedule/cancel focused smoke test passed: **1 passed (12.9s)**. It verifies rescheduling, cancellation confirmation acceptance, and persisted `cancelled` status.
- The public booking-to-owner integration smoke test initially revealed a deterministic test-harness issue: the clipboard stub was registered after reload. Moved that test-only stub before navigation; the focused test then passed: **1 passed (3.0s)**. This also verifies a public booking appears in `pages/manage-appointments.html` with service, contact, and readable status.
- `public-manage-access.spec.js` passed: **2 passed (7.6s)**, preserving receipt/manage-link, customer cancellation confirmation, policy-aware reschedule, overlap prevention, and persistence coverage.
- `npm run test:smoke -- --list` remains **24 tests in 7 files**.
- The requested combined focused command began **16 tests** and passed tests 1-5 before the environment's 30-second command cap stopped it. A fresh full `npm run test:smoke` attempt likewise passed tests 1-5 before the same cap. No new assertion failure was emitted; spawned Playwright/Node processes were stopped after each cutoff.

### Remaining pilot concerns

1. Run the complete configured one-worker smoke suite outside the 30-second command cap and capture its final result.
2. Do a visual owner-phone-width pass for active, completed, cancelled, and no-show cards; filter chips; action buttons; and reschedule modal.
3. Before production-like staging, address the previously recorded environment secret, dependency audit, durable-storage, backup, and monitoring gaps.

## Owner onboarding and first-time setup pilot polish (2026-09-27)

### Files changed

- `pages/owner-setup.html`
- `js/owner-setup.js`
- `css/owner-dashboard.css`
- `tests/smoke/owner-setup.spec.js`

### First-time flow summary and improvements

- The existing five-step flow remains: Shop, Team, Services, Hours, then Ready. It uses the current setup-state rules and does not add fields or backend data.
- Each step now explains the essential decision in barber-facing language: recognizable shop name, solo-first team setup, clear services/prices/durations, weekly hours/buffer, and the public share moment.
- Added a live progress-detail message. A true first-step owner gets a short essentials-first reassurance; resumed named shops see an explicit "You're picking up where you left off" explanation that identifies the previously saved prerequisites. This preserves the existing named-shop resume behavior rather than restarting onboarding.
- Improved empty guidance for missing team and services with the next concrete action and its effect on booking.
- The Ready screen now makes `Copy Booking Link` the primary action, keeps Open Booking Page/QR/Dashboard readily available, and explains practical sharing options. The same existing generated public URL and QR behavior are used.
- Existing mobile setup layout, responsive stepper, stacked forms/actions, and 44px owner control targets are retained. The new progress text has a readable line length and wraps safely at phone widths.

### Behavior and validation

- No auth/session, public booking logic, setup completion criteria, data-store adapter, nested `slotzy/`, deployment, or native files changed.
- `npx playwright test tests/smoke/owner-setup.spec.js --workers=1 --reporter=list`: **2 passed (3.2s)**. It covers named-shop resume at services, the new resume explanation, adding services, availability, ready booking link/QR, visible Copy Booking Link/Open Booking Page controls, and configured-owner dashboard bypass.
- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- The requested owner-setup/critical combined run started 16 tests and passed critical tests 1-5 before the environment's 30-second command cap. A fresh full suite attempt also passed tests 1-5 before the same cap. No new assertion failure was emitted; Playwright/Node processes were stopped after each cutoff.

### Remaining pilot concerns

1. Walk through an actual freshly registered owner on a 375px phone and confirm whether the data-model-created default shop should enter at Shop or resume at Services; current behavior intentionally resumes named shops at their first incomplete prerequisite.
2. Run the full 24-test one-worker smoke suite in a terminal/CI job without the 30-second command cap.
3. Before pilot data is used, complete the recorded staging readiness work: real secret configuration, dependency audit, durable storage/backup, and monitoring.

## Services, team, and availability management pilot polish (2026-09-27)

### Files changed

- `pages/manage-services.html`
- `pages/manage-barbers.html`
- `js/manage-services.js`
- `js/manage-barbers.js`
- `js/owner-availability.js`
- `css/owner-dashboard.css`

### Services improvements

- Service add fields now state USD, minutes, appropriate input bounds, and mobile input modes.
- Service cards retain the existing name/price/duration actions and now show an accessible Active/Inactive state badge where that stored field exists.
- Service removal confirmation now explains that deleting removes the item from the public booking menu and cannot be undone.
- The existing no-services state remains actionable and points owners to Add Service.

### Team improvements

- Reframed the simple existing barber list as a shop-provider list without adding roles, permissions, or payroll concepts not supported by the data model.
- Added clearer active/inactive badges and distinct inactive card treatment; provider cards/actions wrap safely with the existing responsive owner-card layout.
- Replaced the bare no-barbers message with a pilot-friendly solo-shop empty state.
- Added a contextual, irreversible delete confirmation. Activation/deactivation behavior is unchanged.

### Availability improvements

- Clarified the no-time-off guidance: breaks, planned time off, and blocked days prevent public slot generation.
- Time-off deletion confirmation now explains that deleting the block may make those times bookable again.
- Weekly-hours, timezone, buffer, time-off validation, overlap prevention, and shared availability persistence are unchanged.

### Validation and remaining concerns

- `npx playwright test tests/smoke/owner-setup.spec.js --workers=1 --reporter=list`: **2 passed (2.9s)**.
- The focused availability smoke command started but did not produce a final result before the 30-second execution cap; no assertion output was emitted. A fresh full suite attempt passed tests 1-5 before the same cap. Playwright/Node child processes were stopped after the cap.
- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- No data-store, auth/session, public booking rule, API/local-storage adapter, nested experiment, deployment, or native-app change was made.
- Recommended next action: run the full one-worker suite in a terminal/CI job without the 30-second cap, then do a visual phone-width pass for service cards, provider cards, weekly-hours table, and time-off controls.

## Settings, policies, and branding consistency audit (2026-09-27)

### Files changed

- `pages/settings.html`
- `css/owner-dashboard.css`

### Branding and policy consistency improvements

- Settings header now identifies the page as shop branding and booking rules rather than profile/account details.
- Marked business name as required and shop phone/email as optional.
- Kept the existing public booking URL, QR, logo, cover preview, download, and print controls unchanged; their existing constrained previews and fallback messages remain intact.
- Clarified that policy rules are the rules shown or enforced on public booking and manage links.
- Added field-level guidance: the cancellation window also governs rescheduling, the public-booking buffer should align with provider availability buffers, and a zero no-show limit disables the limit for pilot use.
- Clarified that branding is optional, uses the same public-booking/QR-print assets, and that services, availability, and team records are managed on their own screens.
- No policy keys, save behavior, booking-engine enforcement, auth/session behavior, demo/support visibility, or backup/restore confirmation behavior changed.

### Validation

- `npm run test:smoke -- --list`: **24 tests in 7 files**.
- Focused branding test result: `tests/smoke/logo-branding.spec.js:92` timed out at `page.setInputFiles("#shopLogoInput")` after 15 seconds, waiting for the selector. Artifact: `test-results/logo-branding-shop-logo-up-10c32-public-booking-and-QR-print/error-context.md` (ignored). This was not caused by the copy/CSS-only Settings change; it needs separate investigation of the seeded owner/setup guard state before changing branding behavior.
- Initial focused/full command attempts encountered the established 30-second process-lifecycle cap. No new booking-policy assertion failure was emitted.

### Remaining pilot concerns

1. Diagnose why the logo-branding seed does not expose `#shopLogoInput` before its timeout, then rerun the branding smoke test.
2. Run the full configured one-worker smoke suite outside the 30-second command cap.
3. Perform a visual 375px/768px Settings pass for branding previews, QR actions, policy fields, and toggle layout before pilot rollout.

## Remaining smoke-failure triage (2026-09-27)

Both previously documented failures reproduce individually in the configured one-worker mode and are stale test scenarios, not application defects. No app, booking, auth, or session source was changed.

### Owner setup resume flow

- **Test file/title:** `tests/smoke/owner-setup.spec.js` - `fresh owner is guided through onboarding and gets a working public booking link` (renamed to `owner resumes incomplete setup and gets a working public booking link`).
- **Original assertion:** `expect(page.locator("#setupStepSummary")).toHaveText("Step 1 of 5")`.
- **Exact error:** expected `Step 1 of 5`; received `Step 3 of 5` after 10 seconds.
- **Diagnostic artifact:** `test-results/owner-setup-fresh-owner-is-5fbbc-working-public-booking-link/error-context.md` (ignored; not committed).
- **Classification/root cause:** stale test fixture/expectation. The fixture seeds an owner with a named shop and no services. `owner-setup-state.js` intentionally resumes a named-shop owner at the first incomplete requirement, services (step 3). Emptying the fixture's name does not make it first-run because the data-store normalization supplies a fallback shop name.
- **Minimal test change:** retain the named-shop fixture, assert step 3, validate services/availability completion and the existing booking link, and rename the test to describe the actual resume flow.
- **Focused result:** passed, 1 passed (2.7s).

### Public cancellation confirmation

- **Test file/title:** `tests/smoke/public-manage-access.spec.js` - `public booking receipt exposes a manage link and contact-based manage page can cancel within policy`.
- **Original assertion:** after clicking `button[data-action='cancel-appointment']`, expected `#manageStatus` to contain `Appointment cancelled.`.
- **Exact error:** expected `Appointment cancelled.`; received `Click "Confirm Cancel" to cancel this appointment.` after 10 seconds.
- **Diagnostic artifact:** `test-results/public-manage-access-publi-a961f-ge-can-cancel-within-policy/error-context.md` (ignored; not committed).
- **Classification/root cause:** stale test interaction. `js/client-manage.js` deliberately uses a two-step cancellation control: Cancel sets the pending state and renders `button[data-action='confirm-cancel-appointment']`; that second action performs cancellation.
- **Minimal test change:** assert the confirmation prompt, click Confirm Cancel, then retain the existing cancellation, toast, history, and owner-refresh assertions.
- **Focused result:** passed, 1 passed (4.7s).

### Files changed in this triage

- `tests/smoke/owner-setup.spec.js`
- `tests/smoke/public-manage-access.spec.js`

`tests/smoke/critical-flows.spec.js` remains modified from the prior customer-copy-only fix. No generated data or runtime source file was changed.

## Repository state

- **Branch:** `restore-source-files`
- **Commit:** `c514d4fc1ca7a30d8c1316c9e6cf811a42cbf75a` (`c514d4f Polish settings page for pilot readiness`)
- **Initial working tree:** clean (`git status --short` produced no output).
- **Audit output:** `PROJECT_STATUS.md` is the only intentional new file. Test output remains in ignored `test-results/`; it must not be committed.
- **Nested experiment:** `slotzy/` was not inspected or changed.

## Commands and outcomes

| Command | Result |
| --- | --- |
| `git branch --show-current` | Passed: `restore-source-files` |
| `git status --short` | Passed: clean before audit |
| root `npm install` | Passed: up to date; audited 4 packages; 0 vulnerabilities |
| `npm run test:smoke -- --list` | Passed: listed 24 tests in 7 files |
| `npm run test:smoke` (before fix) | Reproduced the test-4 copy mismatch; tests 1–3 passed and test 4 failed. |
| `npm run test:smoke -- --list` (after fix) | Passed: still lists **24 tests in 7 files**. |
| `npm run test:smoke` (after fix) | The sequential run passed tests 1–5, including tests 4 and 5, before the execution environment’s 30-second command window stopped the still-running Playwright process. It did not yield a complete-suite verdict. |
| focused customer-login smoke test (after fix) | Passed: 1 passed (2.2s) |
| `cd server && npm install` | Passed: up to date; audited 115 packages; 7 vulnerabilities (1 low, 1 moderate, 5 high) |
| `cd server && npm run dev` | Passed: Nodemon loaded `src/index.js`; API announced `Slotzy API server listening on http://localhost:3001`; process then stopped intentionally |
| `GET http://localhost:3001/api/health` | Passed: HTTP 200, `{"ok":true,"service":"slotzy-api"}` |

## Smoke-test status

Discovery confirms **24 tests in 7 files**:

- `critical-flows.spec.js`
- `logo-branding.spec.js`
- `owner-setup.spec.js`
- `owner-today-glance.spec.js`
- `public-manage-access.spec.js`
- `public-shop-directory.spec.js`
- `share-booking-link.spec.js`

The original full run failed `critical-flows.spec.js:309` — **“customer login is blocked with a friendly inline message.”** The original mismatch was:

```text
Expected substring: "Customer logins are not enabled. Use your booking link instead."
Received string:    "Customer logins not enabled — use booking link"
Timeout: 10000ms
```

This was a smoke-test expectation/UI-copy drift, not a booking-logic failure. After the test-only correction, the focused test passes and the sequential full command passes tests 1–5 (including the corrected tests 4 and 5). A complete sequential-suite result remains outstanding because the local command runner stops long-running commands after 30 seconds.

An additional **non-authoritative parallel diagnostic** (`npx playwright test --workers=4`) exposed two unrelated failures; the project’s configured suite uses one worker, so these are documented but not fixed in this task:

```text
owner-setup.spec.js:89 — expected #setupStepSummary "Step 1 of 5"; received "Step 3 of 5".
public-manage-access.spec.js:153 — expected #manageStatus to contain "Appointment cancelled."; received "Click \"Confirm Cancel\" to cancel this appointment.".
```

The parallel command was stopped before a final suite summary and should not be used as a replacement for the configured one-worker smoke run.

After the two triage fixes, `npm run test:smoke -- --list` still reports **24 tests in 7 files**. A fresh configured one-worker full-suite attempt passed tests 1–5, including the customer-login fix, before this environment stopped the process at its 30-second command limit. That is an environment execution limit, not a newly observed smoke assertion failure; child Node/Playwright processes were stopped after the cutoff.

## Backend startup result

Backend startup and health check are confirmed. Startup emitted this important warning:

```text
[Slotzy:auth] JWT_SECRET is not set. Using the development fallback secret; set JWT_SECRET before any pilot or production deployment.
```

This is acceptable only for local development. It blocks real pilot and staging readiness until a secret is supplied through an uncommitted environment configuration.

## Remaining risks

1. The three corrected focused smoke tests pass, but a complete configured one-worker smoke-suite verdict is still required.
2. The full Playwright run does not finish inside this environment’s 30-second command window and leaves child processes requiring explicit cleanup.
3. Server dependency audit reports 7 vulnerabilities, including 5 high; inspect the dependency tree before staging.
4. `JWT_SECRET` is absent and the server uses a development fallback.
5. The prior architecture risk remains: `server/src/db.json`/`db.js` appear to be file-backed persistence and need a concurrency, backup, and hosting review before real barber testing.
6. Full booking, authorization, cancellation/reschedule, timezone, and role-access regression coverage is not yet green because the smoke suite is incomplete.
7. Do not treat local API health as staging readiness: CORS, environment variables, durable storage, monitoring, and backup/restore remain to be validated.

## Recommended next Codex tasks

1. Run the configured one-worker 24-test smoke suite in a terminal/CI environment without the 30-second command cap and capture its final summary.
2. Determine whether Playwright/web-server cleanup can be made reliable after an interrupted run, without changing user-facing behavior.
3. If parallel smoke execution becomes a requirement, add deliberate storage isolation and then assess parallel-only failures separately.
4. Run `npm audit` in `server/`, identify the seven reported vulnerabilities, and plan safe dependency updates.
5. Add a documented local `.env.example` and require `JWT_SECRET` outside local development; do not commit `.env` or secret values.
6. Inventory API endpoints, auth/role checks, and booking constraints from `server/src/index.js`.
7. Confirm whether `server/src/db.json` is seed data or mutable runtime data; define reset, backup, and concurrent-write behavior.
8. Build a role/route access matrix for public, client, owner/barber, and dev/admin pages.
9. Validate mobile device flows and booking edge cases only after the smoke baseline is green.
10. Design staging (Netlify/static host plus hosted API, managed storage, CORS, observability, and secrets) before deploying anything.

## Guardrails retained

- Do not change booking logic or make broad refactors.
- Do not deploy, merge `main`, force-push, or run release automation.
- Do not touch nested `slotzy/`.
- Do not add native/Capacitor files yet.
- Do not commit `node_modules`, `test-results`, `playwright-report`, zip files, `.env`, secrets, or mutable `server/src/db.json` data.
## Logo-branding smoke blocker fix (2026-09-27)

- Root cause: stale test setup/navigation, not a missing selector or Settings rendering bug. `#shopLogoInput` remains a static Settings control. The logo test seeded a named shop with no services and no enabled availability, so the existing owner setup guard correctly redirected the test to `owner-setup.html`; Playwright then timed out waiting for `#shopLogoInput`.
- Previous exact failure: `tests/smoke/logo-branding.spec.js` timed out at `page.setInputFiles('#shopLogoInput', ...)` after 15 seconds. Artifact: `test-results/logo-branding-shop-logo-up-10c32-public-booking-and-QR-print/error-context.md`.
- Changed [tests/smoke/logo-branding.spec.js](C:/Dev/Slotzy/tests/smoke/logo-branding.spec.js): its seeded owner now has one active, shop-scoped service and enabled Monday availability. This satisfies the existing setup-completion guard and lets the test reach the real Settings screen.
- No application, branding, public-link, QR, booking-policy, or authentication behavior changed.
- Validation:
  - `npm run test:smoke -- --list`: **24 tests in 7 files**.
  - `npx playwright test tests/smoke/logo-branding.spec.js --workers=1 --reporter=list`: **1 passed (3.4s)**.
- Remaining Settings concern: none found for this blocker. The passing test still verifies logo upload persistence, public booking branding, and QR print behavior.

## Deployment and database architecture plan (2026-09-27)

- Created `docs/DEPLOYMENT_ARCHITECTURE.md`. This is documentation only: no deployment, database, migration, SDK, secret, booking, authentication, or session behavior was changed.
- Major recommendation: retain Express as Slotzy's business-logic/API boundary and replace only its `db.json` adapter with Supabase Postgres in phases. This preserves the current client/API seam and avoids combining database migration with a client authorization rewrite.
- The plan documents current static/local-storage/API behavior, Express/JWT/db.json/email model, routes/endpoints, relational schema, manage-token requirement, environment separation, security, staged migration, rollback, smoke-test impact, and explicit deferred work.
- Next recommended implementation task, after approval: define a public API base-URL configuration mechanism and staging-safe failure behavior that prevents authenticated writes from silently falling back to local storage. Do not add Supabase code or change persistence in that task.

## Environment-aware frontend API configuration (2026-09-27)

- Added `js/api-config.js` as the canonical browser API base. It reads the non-secret `window.SLOTZY_CONFIG.apiBaseUrl` configuration from `js/public-config.js`, accepts an origin or `/api` value, and otherwise preserves the local `http://localhost:3001/api` default.
- Centralized frontend backend URLs in `js/dataStore.js`, `js/auth.js`, `js/booking-notifications.js`, `js/dev-emails.js`, and `js/admin.js`. Endpoint paths and local/local-storage behavior are unchanged. Playwright fixtures may still deliberately reference localhost while simulating backend availability.
- Added `js/public-config.example.js` and documented staging/production examples in `README.md`. Both configuration files contain no deployment URL or secret by default.
- CORS was reviewed only: Express remains `cors({ origin: true })` for local behavior. README and architecture documentation now require an explicit, environment-specific `CORS_ALLOWED_ORIGINS` allowlist before hosted staging; no CORS behavior was changed in this task.
- Validation: `npm run test:smoke -- --list` remains **24 tests in 7 files**. Focused critical-flow tests passed for backend-offline local fallback (**1 passed, 2.1s**) and backend-health server mode (**1 passed, 2.4s**). `cd server && npm run dev` started successfully and `GET http://localhost:3001/api/health` returned HTTP 200; the local process was then stopped.
- Next recommended task: add a staging-safe API failure policy for configured hosted mode so authenticated writes do not silently fall back to browser storage. Do not add database or Supabase code yet.

## Supabase Postgres schema foundation (2026-09-27)

- Created `docs/SUPABASE_SCHEMA.sql` and `docs/SUPABASE_SCHEMA_NOTES.md`. They are design/migration artifacts only; no Supabase project, SDK, connection, runtime adapter, deployment, `db.json`, booking, or auth/session behavior changed.
- The schema preserves Express as the server-only data access and authorization layer, while adding multi-shop memberships, provider services, weekly availability/time off, shop settings, booking snapshots/history, active-booking overlap protection, and hashed/expiring manage tokens.
- The notes document field-by-field `db.json` mapping, safe seed/staging/production separation, RLS rationale for a server-only phase, migration order, backup/rollback, and continued local-storage smoke tests.
- Next recommended task: specify a Postgres repository adapter and API contract tests against disposable Postgres. Do not modify `server/src/db.js`, install Supabase packages, create a Supabase project, or switch persistence yet.

## Backend storage adapter seam (2026-09-27)

- Added `server/src/storage/index.js` as the canonical storage entry point and `server/src/storage/jsonStore.js` as the only active implementation. JSON remains the default through `SLOTZY_STORAGE=json` and continues to persist to `server/src/db.json`.
- `server/src/index.js` now imports generic `readStore`/`writeStore`, so routes no longer import the file adapter or know the JSON path. Existing route-level in-memory array/object mutations are intentionally retained to preserve API and booking behavior while the first persistence seam is established.
- The JSON adapter owns file read/write/shape normalization and Dev Outbox append/list/clear operations. `emailService.js` now uses those storage operations rather than directly reading or mutating `db.emails`.
- `server/src/db.js` remains a compatibility shim exporting `readDb`/`writeDb` from the canonical storage entry point. Unsupported `SLOTZY_STORAGE` values fail clearly at startup; no Supabase SDK, connection, SQL execution, migration, or deployment was added.
- Validation: root `npm run test:smoke -- --list` remains **24 tests in 7 files**; focused `auth uses server mode when backend health is online` passed (**1 passed, 2.4s**). The default storage selector reports `json`; an unsupported selector reports `Unsupported SLOTZY_STORAGE value "unsupported". Only "json" is available in this release.` `cd server && npm run dev` started successfully and `/api/health` returned `{"ok":true,"service":"slotzy-api"}` before the local process was stopped. `server/src/db.json` was not modified.
- Next recommended task: define and test a Postgres adapter under `server/src/storage/` against the current JSON storage contract, including transactional booking writes and outbox behavior, before making any adapter selectable.

## Storage contract tests and Postgres adapter foundation (2026-09-27)

- Added `docs/STORAGE_CONTRACT.md` and `server/test/storage-contract.test.js`. The contract covers normalized document read/write, the required default shape, and Dev Outbox append/list/clear semantics. Tests use a unique temporary OS directory per case and do not read or write `server/src/db.json`.
- `server/src/storage/jsonStore.js` now exports `createJsonStore({ filePath })` for isolated tests while preserving its default production file path and exported operations.
- Added `server/src/storage/postgresStore.js`. It exports the same named storage operations and validates `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` when `SLOTZY_STORAGE=postgres` is selected. It intentionally has no Supabase SDK, network, SQL, database connection, JSON fallback, or runtime persistence implementation.
- Storage selection now recognizes `json` (default) and explicit `postgres`; unknown values fail clearly. Explicit Postgres without credentials fails with `SLOTZY_STORAGE=postgres requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Keep Supabase service-role credentials server-side only.`
- Validation: `cd server && npm run test:storage` passed **7/7**; root smoke discovery remains **24 tests in 7 files**; focused server-mode auth smoke passed (**1 passed, 2.4s**); normal JSON backend startup succeeded and `/api/health` returned HTTP 200. No schema SQL, Supabase project, deployment, or `server/src/db.json` modification occurred.
- Next recommended task: implement and contract-test a real parameterized Postgres adapter against a disposable local/test database, including the documented atomic booking transaction, before selecting `postgres` in any hosted environment.

## Postgres storage operations (2026-09-27)

- Added `@supabase/supabase-js` to `server/package.json` and its server lockfile only. The SDK is imported exclusively from `server/src/storage/postgresStore.js`; no browser/frontend dependency or credential was added.
- The Postgres adapter now validates server-only Supabase credentials, creates a server-side client, maps relational users/shops/settings/members/services/provider services/availability/time off/bookings/outbox rows back to existing JSON-style Express shapes, and performs outbox operations through SDK calls.
- Legacy full-document `writeStore` calls a required `slotzy_storage_write_snapshot` RPC rather than attempting a race-prone client-side table replacement. That reconciliation RPC is deliberately not yet defined because it needs reviewed source-ID mapping and disposable-database tests before Postgres can be enabled.
- Added a planned atomic `slotzy_create_booking(payload jsonb)` RPC to `docs/SUPABASE_SCHEMA.sql`: it inserts the booking, hashed manage token, booking event, and optional outbox row in one transaction while the exclusion constraint rejects active overlaps. Raw tokens are generated/hashes supplied by server code only and must never be logged.
- Added `server/test/postgres-store.integration.test.js` and `npm run test:storage:postgres`. With no `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY`, all seven integration cases are clearly skipped (not passed) and no database is contacted.
- Validation: JSON storage tests remain **7/7 passed**; smoke discovery is **24 tests in 7 files**; focused server-mode auth smoke passed (**1 passed, 2.5s**); `server/src/db.json` remains unchanged. No SQL was executed and no staging/production database or deployment was touched.
- Next required step: provision an explicitly disposable Supabase test project, apply the reviewed schema plus a source-ID-safe snapshot reconciliation RPC, then replace skipped integration fixtures with real create/read/update/overlap/token/outbox assertions before any staging selection of `SLOTZY_STORAGE=postgres`.

## Disposable Postgres snapshot path (2026-09-27)

- Added `legacy_source_ids`, `slotzy_storage_write_snapshot(snapshot jsonb)`, and guarded `slotzy_reset_disposable_test_data` definitions to `docs/SUPABASE_SCHEMA.sql`. The snapshot path maps legacy IDs to generated relational UUIDs, upserts snapshot-owned rows, and avoids deleting unrelated data.
- Added `docs/SUPABASE_TEST_SETUP.md` with exact disposable-project setup, server-only test variables, an explicit destructive-reset marker/confirmation, and teardown instructions. No SQL was applied by this task.
- Real Postgres validation remains unperformed because `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` were not available. The **9** planned integration cases therefore continue to skip clearly; do not treat that as a passing database suite.
- Next manual step: create an empty disposable Supabase project, apply the reviewed schema manually, mark it disposable, set the two test credentials plus reset opt-in, and run `cd server && npm run test:storage:postgres`.

## Disposable Postgres integration fixture lifecycle (2026-09-27)

- Replaced the Postgres integration-test lifecycle placeholder with a real fixture in `server/test/postgres-store.integration.test.js`. It constructs the store from `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` explicitly, without setting runtime `SUPABASE_*` variables or enabling the Postgres adapter for ordinary server execution.
- Before the suite, before every one of the nine cases, and after the suite, the fixture requires the literal process opt-in `SLOTZY_ALLOW_DISPOSABLE_TEST_RESET=true`, reads `public.slotzy_test_control`, and requires `is_disposable=true`. Only then does it invoke the existing `slotzy_reset_disposable_test_data('DISPOSABLE_SLOTZY_TEST_RESET')` RPC. Failed guards are reported as fixture setup failures and no reset is attempted.
- The cases now cover user, shop, service (including soft deletion), availability/time-off, atomic booking/read/update/overlap rejection, hashed manage-token lookup, snapshot round-trip, snapshot idempotency, and outbox behavior. No booking/auth route behavior or `server/src/db.json` was changed.
- Validation in this workspace: `cd server && npm run test:storage` passed **7/7** and `npm run test:smoke -- --list` reported **24 tests in 7 files**. The Postgres command discovered all **9** cases but skipped all nine because test credentials are not present in this process, so no database was contacted and there is no real-database pass/fail result here.
- No SQL change was required: the current schema already defines the guarded reset RPC. The disposable project does not need updated SQL for this fixture; it only needs the already documented schema and disposable marker applied before a credentialed run.

## First disposable Postgres integration failures — schema repair pending validation (2026-09-27)

- Credentialed disposable tests exposed three schema-only defects: JSON extraction in `slotzy_storage_write_snapshot` could apply `->>` to a text-resolved generic loop record; its booking service fallback used ambiguous `shop_id = shop_id`; and the project intentionally had no automatic table grants, so direct service-role outbox access was denied.
- Corrected `docs/SUPABASE_SCHEMA.sql` with typed JSONB loop values, `v_*` PL/pgSQL variables, qualified lookup aliases, and explicit `service_role` schema/table/sequence/function grants. It revokes Slotzy RPC access from `public`; browser roles remain ungranted.
- Added `docs/SUPABASE_TEST_PATCH.sql`, a non-destructive one-time patch for the existing disposable project. It replaces only the snapshot RPC and applies the explicit grants. Apply it manually in the disposable project's SQL editor, then rerun `cd server && npm run test:storage:postgres` with the existing uncommitted test variables. A new credentialed run is required before claiming database success.

## Remaining disposable Postgres repair — patch reapplication required (2026-09-27)

- The still-failing `text ->> unknown` was not a remaining JSON loop type issue. PostgreSQL treats `||` and `->>` as generic left-associative operators, so `v_username || ':' || v_time_off->>'startISO'` was parsed with concatenated text as the left operand of `->>`. The full schema and incremental patch now parenthesize every JSON extraction used with string concatenation, including membership/provider identifiers and legacy date composition.
- `postgresStore.clearOutboxEmails()` now uses the explicit PostgREST predicate `.not("id", "is", null)` before deletion. `email_outbox.id` is a non-null UUID primary key, so this clears all outbox rows while satisfying PostgREST's no-unqualified-delete safety rule; no permissions changed.
- Reapply the current `docs/SUPABASE_TEST_PATCH.sql` to the disposable project (it is safe to rerun), then execute the credentialed Postgres suite again. Local JSON and smoke-discovery checks remain required; no credentialed success is claimed until that external run completes.

## Final disposable Postgres reconciliation fixes pending validation (2026-09-27)

- A user-only legacy snapshot retained `shopId` while intentionally omitting its shop. The snapshot RPC previously inserted an invalid `shop_members` row with a null shop foreign key; it now requires both resolved IDs before creating a membership.
- Booking confirmation collisions were fixture contamination/reused values, not a reason to relax the unique index. Each case now performs its own guarded serial reset and atomic-booking tests use distinct explicit codes (`BKG001`/`BKG002` and `TOK001`).
- Snapshot booking upserts previously left some mutable fields stale, so a prior `Fixture Client` row could survive reconciliation. The conflict update now covers mutable booking relationship, customer/contact, schedule/status, policy/service snapshot, cancellation, deposit, and confirmation fields.
- The outbox count was also isolation contamination. Each integration case now calls the existing guarded reset itself before execution, so the exact `{ cleared: 2 }` contract remains asserted. Apply the current incremental patch and run the credentialed suite again.

## Staging Postgres runtime preparation (2026-09-27)

- JSON remains the default adapter. Explicit `SLOTZY_STORAGE=postgres` continues to require server-only Supabase credentials and cannot fall back to JSON.
- Staging/production-like startup now requires both `JWT_SECRET` and a non-empty `CORS_ALLOWED_ORIGINS`; local development retains the existing JWT fallback and permissive CORS. `/api/health` reports only `ok`, service name, active adapter, and runtime environment—never URLs, credentials, or tokens.
- Added `server/.env.example` placeholders and `docs/STAGING_CUTOVER.md`, covering a separate empty staging project, schema application, backend-only secret configuration, functional/manual QA, synthetic-only seed strategy, and the explicit `SLOTZY_STORAGE=json` rollback. No deployment or infrastructure change occurred.

## Successful staging validation and QA gate (2026-09-27)

- Staging is live and validated: Netlify frontend `https://slotzy-staging.netlify.app`, Render API `https://slotzy-staging-api.onrender.com`, and a dedicated Supabase staging project. Health confirms `ok=true`, `storage=postgres`, and `environment=staging`.
- Manual end-to-end checks passed for registration, authenticated owner dashboard, service creation, availability, refresh persistence, public booking link/booking, owner appointment visibility, manage link, cancellation, and rescheduling. This remains synthetic staging data only.
- Added `docs/STAGING_QA_CHECKLIST.md` for repeatable infrastructure, auth, setup, booking, management, mobile, recovery, and data-safety testing, plus `docs/PILOT_READINESS.md` for the pilot, native, and production gates. No runtime, schema, database, deployment, or nested-project change was made.
- Next recommended work: build a staging-only automated E2E smoke path with isolated synthetic data, then complete the remaining manual/mobile/recovery checklist cases before inviting real barbers.

## Guarded staging E2E smoke suite (2026-09-27)

- Added `tests/staging/staging.e2e.spec.js` and `npm run test:staging`. It refuses to run without the literal opt-in plus explicit HTTPS staging frontend/API URLs, requires hostnames containing `staging`, then polls health for up to 150 seconds and requires `ok=true`, `environment=staging`, and `storage=postgres` before any mutation.
- The serial hosted flow uses unique `e2e-` owner/shop/service/client identities, covers registration through public booking, receipt/manage link, owner visibility, cancellation confirmation, persistence reloads, and invalid login/manage-link checks. It does not target production or use customer data.
- No targeted staging cleanup API exists, so no cleanup endpoint or broad reset was added. Test records are intentionally left with the recognizable prefix for manual staging-only removal. Hosted execution remains outstanding until an operator runs the documented PowerShell command with environment values set.

## Staging E2E registration navigation correction (2026-09-27)

- A hosted run completed registration but remained at `pages/index.html`, while the first E2E assertion assumed an immediate setup/dashboard URL. The corrected test first proves registration changed the real UI state: auth modal closes, the authenticated user badge contains the synthetic owner name, and the Dashboard control is visible. It then clicks that actual control and asserts `owner-setup.html` or `business-owner.html` navigation.
- No application behavior, Supabase/Render configuration, schema, credentials, or deployment changed. This is a test correction that preserves owner setup coverage and fails if registration does not establish a usable authenticated UI state.

## Staging E2E registration modal diagnostics (2026-09-27)

- The hosted run showed the registration modal remained open after Continue. Source review confirms this only happens when `submitAuth` throws: successful server registration calls `setUser`, `hideModal`, and dashboard navigation. The form has no undisclosed required field beyond username/password/role.
- The E2E now waits for the actual `POST /api/auth/register` response, fails immediately with its HTTP status and safe error message when unsuccessful, and races modal closure against visible `#auth-error` for a maximum of five seconds. If the API succeeds but neither condition follows, it reports a specific auth-UI defect. A new hosted run is needed to identify the exact response/error; no application code was changed.

## Staging registration HTTP 500 diagnostic hardening (2026-09-27)

- The E2E registration payload is only `username`, `password`, and `role`: a unique 32-character lower-case/hyphen `e2e-...-owner` username, bcrypt-safe synthetic password, and `owner`. Its generated email is not sent. The route accepts these values; existing Postgres test identifiers already exercise hyphens.
- The route's generic catch previously discarded the only server-side error. It now logs a safe route/storage/error-code/message diagnostic to Render while preserving the browser's generic `internal server error` response and never logging request bodies, passwords, JWTs, or credentials.
- Added Postgres regression coverage for an owner with `shopId: null`, matching registration before shop setup. The snapshot RPC is transactional, so a failed write rolls back its user and legacy-source-ID writes rather than leaving a partial relational record. No SQL patch is required by this code review; Render logs from the next guarded run are required to identify any stale-schema or hosted-only error precisely.

## Render-to-Supabase fetch diagnostic hardening (2026-09-27)

- The hosted registration failure occurs before password persistence or snapshot reconciliation: registration calls `readStore()`, whose first ordered Supabase request is `from("users").select("*").is("deleted_at", null)`. The adapter issues all its relational reads in parallel, so the earlier generic `read` label could not identify which request first reported a transport failure.
- The adapter now labels each read and wraps its original SDK error with an allowlisted `storageDiagnostic`. A server-only Supabase fetch wrapper retains the original Node network failure when the SDK flattens it. Logs may include only error name/message, code, errno, syscall, and hostname (including one nested cause); URL-shaped text is redacted. No credentials, headers, JWTs, request bodies, passwords, or raw client configuration are logged or returned to the browser.
- This changes diagnostics only: the API still returns generic HTTP 500 responses, Postgres remains opt-in, and no schema/database/deployment change occurred. A Render redeploy followed by the guarded staging E2E run is required to capture the actual DNS/TLS/socket cause. No SQL patch is required.

## Flattened Render Supabase network diagnostics (2026-09-27)

- Render abbreviated the nested Node fetch cause in `storageDiagnostic.network` as `[Object]`. Storage diagnostics now use flat allowlisted fields: `networkName`, `networkMessage`, `networkCode`, `networkErrno`, `networkSyscall`, `networkHostname`, and the corresponding `networkCause...`/`networkCauseCause...` fields. URL-shaped values remain redacted.
- On staging with the Postgres adapter selected, startup now performs a non-blocking DNS lookup of the configured Supabase hostname. It logs only hostname plus success/failure or the same flat safe network fields. The probe neither sends credentials nor fails startup.
- The browser still receives generic HTTP 500 errors. No schema, credentials, deployment, auth behavior, or database state changed. Redeploy staging Render and rerun the guarded E2E suite to obtain the concrete network cause.

## Successful registration response UI-transition diagnostics (2026-09-27)

- Source review confirms the registration contract matches: the API returns HTTP `201` with a token and `user` from `buildAuthUser` (`username`, `role`, `shopId`, and `displayName`); `submitServerAuth` requires the token plus `user.username`/`user.role`, then stores the session before `setUser`, `hideModal`, and dashboard navigation.
- The guarded staging E2E now asserts that safe response shape and, if the UI does not transition within five seconds, reports only modal/auth-error/user-badge/Dashboard/current-path state plus redacted page and console errors. It never prints the token. This preserves the modal-close and authenticated-state success requirements while making a post-response browser exception actionable.
- The root cause was an E2E-only navigation race, not a response mismatch or client exception: `hideModal()` finalizes after a transition timeout, while the successful owner path immediately calls `goToDashboard()` and can replace `index.html` first. The old helper waited only for the original document's modal state. It now accepts only the intended `owner-setup.html`/`business-owner.html` navigation as an equivalent non-blocking success state, then asserts the synthetic owner session and owner page. No application behavior changed; a hosted rerun remains required for confirmation.

## Staging E2E collision-resistant identities (2026-09-27)

- The latest hosted registration failure is a real database uniqueness result (`23505` on `users_username_key`), not a connectivity or credential problem; the staging DNS probe also succeeded. The uniqueness constraint remains required and unchanged.
- Each staging E2E run now builds a short `e2e-` ID from base-36 timestamp, Node process ID, and 64 bits from `randomUUID()`. The owner username, shop name/slug, service name, and synthetic client values all use that same ID. This avoids timestamp-only collisions across rapid or parallel runs while remaining readable and compatible with the unbounded `citext` username column.
- If a non-generic registration response contains PostgreSQL `23505`, duplicate-key text, or an existing-username message, the E2E explicitly reports a synthetic fixture collision. There is still no automated staging cleanup or reset; any future cleanup must target one exact run prefix only.

## Staging snapshot user-identity reconciliation repair (2026-09-27)

- The `write snapshot` `23505` was not a collision in the newer synthetic username. `readStore()` had returned existing relational `users.id` UUIDs, whereas snapshot reconciliation had mapped the earlier legacy `users[].id` source to a different generated relational UUID. A later full snapshot therefore treated the existing user UUID as a new source, generated a second target UUID, and attempted to insert the already-used username.
- Reads now return the canonical `legacy_source_ids` user source ID where available. The source-ID helper also recognizes an unmapped existing relational user UUID, reuses that UUID, and safely creates the missing mapping instead of creating a duplicate target. Username uniqueness remains unchanged. New disposable integration cases cover a mapped non-empty snapshot plus an unmapped direct relational user followed by a new user.
- Added `docs/SUPABASE_STAGING_REPAIR.sql`: a non-destructive, idempotent staging-only preflight/backfill for users with no canonical mapping. It adds mappings only; it never deletes or changes users. The corrected schema and disposable test patch include the helper repair. Apply the staging repair after reviewing its count if historical users lack mappings, then rerun the guarded E2E. No production action is authorized.

## Staging E2E owner-setup visibility correction (2026-09-27)

- `#setupGoDashboard` is intentionally inside the hidden fifth (Ready) wizard panel; it is not a post-registration navigation control. A new owner must save a shop name and owner profile, keep a solo team or add a barber, add at least two services, and save availability with at least one enabled day before it becomes visible.
- The staging E2E now follows those real steps with synthetic data, waits for the Ready panel's visible button, clicks it, and verifies the owner dashboard. If setup has already been completed and the route is directly `business-owner.html`, it verifies the dashboard instead. Authentication, user-badge, session, persistence, and booking coverage remain required. No application code changed.

## Hosted registration 201 response-shape diagnostics (2026-09-27)

- The checked-in Express success contract is `201` with top-level `{ token, user: buildAuthUser(user) }`; `user` contains `username`, `role`, `shopId`, and `displayName`. `js/auth.js` requires the same top-level token and user username/role, so a `201` with no top-level fields is invalid and must not be accepted.
- The staging E2E now captures only a `POST` to the configured staging API origin at exact pathname `/api/auth/register`. If the response shape is invalid, it prints only safe method/path/origin-match/content-type/JSON-parse/key-presence diagnostics, including nested `data` keys where relevant; it never prints JWT values. A hosted rerun is required to determine whether the prior empty response was a stale deployment, proxy/wrapper response, or an incorrectly captured response. No application code changed.

## Hosted 201 JSON parse diagnostics (2026-09-27)

- The hosted E2E confirmed the exact staging API `POST /api/auth/register` returned `201 application/json`, but Playwright could not parse a body. The E2E now follows its failed `response.json()` attempt with `response.text()` (Playwright response bodies are buffered), reporting only length, empty/non-empty state, coarse structure, and a redacted parser/read error. It never emits body contents or token-like values.
- The Express route has no alternate storage-specific success branch: after `writeStore` it signs the token and sends `res.status(201).json({ token, user })`. It now logs a server-only success-contract marker containing only status and response/user field names. If a hosted 201 lacks that marker, the deployed Render revision or an intervening response layer is stale/different; if it has the marker but the body diagnostic is invalid, investigate Render/proxy response handling. Browser behavior remains unchanged and `js/auth.js` correctly rejects the invalid body.

## Staging E2E browser registration-state verification (2026-09-27)

- Render confirmed the successful registration contract, while Playwright failed to retrieve the already-consumed page response body with `Network.getResponseBody: No resource with given identifier found`. This is a Chrome automation lifecycle limitation after navigation, not evidence that Express omitted the body.
- The UI E2E now requires the exact API `POST` and HTTP 201 but verifies frontend-observable state instead of reading that response body: the non-empty JWT is stored by the existing app in `localStorage["Slotzy_auth_token"]`, and `sessionStorage["Slotzy_user"]` must parse to the synthetic owner username/role. It then retains the badge and owner-route assertions. No token value is logged. No application behavior changed.

## Staging service persistence/load correction (2026-09-27)

- Owner setup correctly requires two services and persists each list through the authenticated service API. The subsequent management page was the inconsistent path: `manage-services.js` rendered only the synchronous browser cache and never hydrated it from `GET /api/services`, so a persisted service could disappear from that page after navigation/reload whenever the cache was absent or stale.
- The management page now loads the authenticated service list through `getServicesAsync()` before rendering. The staging E2E separately requires each setup `POST /api/services` to return `201`, verifies the synthetic name through an authenticated API read, requires the reload's `GET /api/services` to return `200`, and finally verifies the exact service heading in the UI.
- Failure diagnostics contain only endpoint path, HTTP status, service count, expected-name presence, current path, and visible `E2E ` service names. They do not expose tokens or non-synthetic service names. The prior hosted run did not capture the service response, so a new hosted run is required to confirm the deployed save and corrected rendering path end to end.

## Staging service API navigation-race correction (2026-09-27)

- The hosted E2E reached service persistence verification, but the post-reload API check ran through `page.evaluate()`. Although `page.reload()` had reached its load event, `owner-setup-guard.js` was still resolving setup state and could replace the management-page document; that destroyed the evaluation context while its fetch was in progress.
- The test now reads the authentication token once from a stable authenticated owner page, verifies only that it exists, and performs service reads with Playwright's runner-side `APIRequestContext`. The token remains in memory solely as an Authorization header and is never included in diagnostics.
- Service POST status, authenticated GET status/content, management-page reload, and exact rendered heading remain required. This is a test-only stabilization; application behavior and the management-page server hydration fix are unchanged. A hosted rerun is required.

## Staging setup service-scope reconciliation fix (2026-09-27)

- The hosted run proved both authentication and the API read were healthy, but setup completion later returned zero owner-scoped services and redirected `manage-services.html` to `owner-setup.html`. The Postgres adapter preserved canonical source IDs only for users; it returned relational UUIDs for shop/service IDs and user/service shop references. A later setup snapshot write, such as availability, could therefore reconcile those relational UUIDs as different legacy identities and leave services outside the owner's resolved shop scope.
- `readStore()` now loads all canonical source mappings and consistently restores user, shop, service, booking, time-off, and shop-reference IDs to the API-facing legacy shape. A credentialed regression now covers reading a non-empty shop, adding a second service, writing availability afterward, and retaining one relational shop plus both correctly scoped services.
- The E2E now records safe input-completion booleans, click occurrence, exact POST path/status, created-service object/name-match booleans, and the immediate authenticated service count/presence. No token or non-synthetic service value is logged. This requires a Render staging redeploy and hosted rerun; no SQL/schema patch is required.

## Hosted service-scope instrumentation and mapping pagination (2026-09-27)

- Commit `24cdcbe` correctly restored canonical shop/service IDs when their mappings were returned, but its single `legacy_source_ids` read was still subject to PostgREST's per-request row cap. The long-lived staging project can place a newly created run's mappings beyond that first response page. Later availability/setup snapshot reconciliation then receives relational UUID fallbacks, treats them as source identities, and detaches otherwise-created services from the owner's resolved shop scope. This is branch **E**: POST and immediate GET can succeed, then a later setup snapshot loses the scope relationship.
- The adapter now retrieves canonical mappings in deterministic 500-row pages until exhausted. The disposable regression preloads 1,005 unrelated mappings, then performs the hosted sequence: shop/owner state, two services, a subsequent availability snapshot, and a scoped read that must retain one shop and both services.
- Staging/development-only GET/POST service markers now log safe status/storage/scope-presence/count/shape booleans, never IDs, auth headers, tokens, request bodies, user objects, passwords, or non-synthetic names. Retain these markers through one confirmed hosted pass, then remove or reduce them after the incident is closed.
- The E2E adds checkpoints after both service saves, after availability/setup completion, and after dashboard navigation. Its POST diagnostics include input/click booleans, response/service key names, created-ID presence, and synthetic-name match; its GET diagnostics retain only counts and synthetic presence. Render must be redeployed; no schema patch is required.

## Hosted owner-shop resolution pagination fix (2026-09-27)

- Current Render markers proved `requireAuth` could resolve the JWT username to a user, while `getUserShopId()` received neither `user.shopId` nor an owned shop. The owner link is reconstructed by `readStore()` from `shop_members`; only canonical mappings had been paginated in the prior fix. Users, shops, memberships, services, and the other relational tables still used single capped PostgREST reads, so a newly inserted membership in populated staging could be omitted even while its user row was present.
- All Postgres adapter collection reads are now deterministically paginated in 500-row pages. The populated-state regression inserts 1,005 unrelated users and 1,005 unrelated canonical mappings before creating the fixture owner/shop, two services, and availability; it then requires the owner membership and both service scopes to survive.
- Service diagnostics also reported `authUserHasShopId`, UUID-shape booleans, owned-shop count, and E2E-shop presence without logging any identifier or name. These temporary normal-success markers were removed after the successful hosted lifecycle recorded below. No schema change was required.

## Hosted owner setup authoritative shop save (2026-09-27)

- The latest fully paginated diagnostics show the owner exists but no synthetic shop exists at all, ruling out a read-side scope mismatch. Branch **C** was true: Step 1 could advance after an unsuccessful shop API operation because its generic async storage helper silently fell back to localStorage.
- `saveOwnerShop()` previously launched three concurrent paths: a browser-only user-cache update, the authoritative shop collection create/update, and a redundant legacy single-shop PATCH using a newly generated local ID that the server had never assigned. Failures were converted into local success, leaving the registered server user without `shopId`, no owned shop row, and therefore no service scope.
- Step 1 now awaits exactly one authoritative shop collection write and disables API-error fallback for setup shop, service, and availability writes. Local JSON mode remains supported. The E2E requires the exact `POST /api/shops` `201` response, safe response shape, immediate `/api/auth/me` shop linkage, and an authenticated `/api/shops` result before entering Step 2.
- Staging/development-only shop route markers report only status/storage and E2E-name, creation/linkage, owner-shop-count, and shopId-presence booleans. Keep both shop and service markers through one successful hosted lifecycle, then remove or reduce them. No schema change is required.

## Focused staging owner-setup API isolation (2026-09-27)

- Added the serial test `focused staging owner setup API chain` before the full browser lifecycle. It uses Playwright's runner-side request context and the same staging/Postgres health guard, but a separate unique synthetic identity.
- The test classifies failures at the exact API boundary: **A** register owner; **B** create/link shop with the owner-setup payload; **C** re-read `/api/auth/me` shop linkage; **D** create two services; **E** read both through `/api/services`; **F** write owner availability and prove both services remain. If all pass, the remaining full-flow defect is **G**, browser owner-setup behavior.
- Diagnostics contain only paths/statuses, response key names, presence/match booleans, counts, and E2E-prefixed service names. Tokens are kept only in request headers and never emitted. `/api/auth/me` now has a staging/development-only marker with auth/shop presence and owner-shop count. No functional API contract or schema changed.

## Browser owner-setup guard synchronization (2026-09-27)

- The focused API chain passed, proving the backend shop/service/availability sequence. The browser divergence was **H**, which caused apparent **A/E** behavior: registration navigates staff to `business-owner.html`, then `owner-setup-guard.js` asynchronously redirects a new owner. The E2E accepted the transient dashboard URL and inspected setup controls before the guard completed, so it skipped the wizard entirely and later observed the guard's `owner-setup.html` redirect with zero services.
- A fresh synthetic browser owner must now reach `owner-setup.html` and see the shop field before Step 1 begins; the direct-dashboard alternative was removed for this necessarily incomplete account. Existing strong shop/service checks now execute rather than being bypassed. The availability step additionally captures the exact `PUT /api/availability` path/method/status and safe response keys before verifying both services again.
- This correction is test-only. The wizard, guard, backend contracts, and application navigation remain unchanged. The temporary normal-success shop/service/auth markers were later removed after the confirmed full hosted pass; failure diagnostics remain.

## Staging browser Step 1 initialization race (2026-09-29)

- The focused owner-setup API chain still passes; its route/payload contract was not changed.
- The browser lifecycle was clicking the correct `#setupStep1Next` control after installing `waitForResponse`, but it only waited for `#setupShopName` to be visible. That input exists in static HTML before `initSetupWizard()` completes its asynchronous setup-state read. The test could fill it, then `applySetupStatus()` restored the initial empty server value. Step 1's existing minimum-length validation then blocked `handleSaveShopStep()` before `saveOwnerShop()`, so no `POST /api/shops` was emitted.
- The E2E now waits for the Step 1 intro rendered by initialized wizard state before filling. It also records safe, bounded diagnostics immediately before the POST wait: path, visible step/label, non-empty field booleans, Step 1 button count/state/text, visible validation messages, and redacted console/page errors. On a missing response it emits those diagnostics without tokens, request bodies, passwords, or real shop names.
- This is a test-only synchronization and diagnostic change. It retains the exact `POST /api/shops` 201, `/api/auth/me` shop linkage, service persistence, availability, and management reload assertions. Hosted confirmation remains required.

## Staging dashboard public booking-link selector correction (2026-09-29)

- The dashboard has no `a[href*="book.html"]` element. Its actual public-booking UI is the readonly `#pilotBookingLink` input, populated from the persisted shop slug, with visible `#pilotCopyBookingBtn` and `#pilotOpenBookingBtn` controls. The previous anchor selector therefore waited until timeout despite completion of owner setup and dashboard navigation.
- The browser E2E now requires that real input to be visible and contain `/pages/book.html?shop=…`, then requires both dashboard controls before opening the exact input value in the public browser page. It still completes customer booking, owner appointment visibility, manage/cancel flow, and negative checks.
- Before asserting the control, diagnostics safely record dashboard path/load state, synthetic-only badge text, anchor count and booking-related paths, booking/share controls, local/API slug-presence booleans, public-link shape booleans, and allowlisted visible headings. No credential, request body, token, real user, or real shop value is emitted.
- This is test-only; no dashboard or setup behavior changed. Hosted confirmation remains required.

## Staging public-booking barber selection correction (2026-09-29)

- The public-booking page and its provider data were reached successfully. The failure was a Playwright API misuse: `selectOption({ label: new RegExp(...) })` is invalid because `label` must be a string, value, or index—not a regular expression.
- The E2E now waits for the enabled provider select, reads its option labels/values, finds the non-empty option whose label contains the synthetic owner username case-insensitively, asserts that it exists, and selects by its exact value. Service, date/slot, receipt/manage link, owner appointment, cancellation, and negative coverage remain unchanged.
- A missing synthetic provider reports only option count, match boolean, E2E-prefixed option labels, and the synthetic public booking URL. This is test-only; no public booking application behavior changed. Hosted confirmation remains required.

## Staging public-booking single-provider selection (2026-09-29)

- `booking-engine.js` intentionally applies `.hidden` to `#barberField` when the selected shop has exactly one provider. It auto-selects that provider in the native `#barberSelect`, so there is no visible custom provider control for a solo owner. Playwright correctly refused a visible-user `selectOption()` interaction with this hidden native element.
- The E2E now uses normal `selectOption()` when the selector is visible. For the intentional one-provider hidden state, it sets the matched synthetic option value in page context and dispatches bubbling `input` and `change` events—the same event path used by the booking engine—then requires the select value and enabled service selector. Provider selection is therefore still exercised and service rendering remains required.
- Failure diagnostics contain only select visibility/enabled state, option count, synthetic match boolean, E2E-prefixed visible provider controls, and the synthetic booking URL. This is test-only; no application behavior changed. Hosted confirmation remains required.

## Staging public-booking service-option label correction (2026-09-29)

- **Classification: B.** `booking-engine.js` renders each service option as `Name - $Price - Duration min` and stores the canonical name in `option.dataset.serviceName`. The E2E requested an exact label equal to only the synthetic name, so Playwright correctly found no exact option even though the service/provider relationship and persisted service were valid.
- The E2E now waits for a non-empty service option whose canonical dataset name equals the synthetic name (with the rendered-label prefix as a compatibility fallback), selects that option by value, and verifies the selected value. Public booking reads the already-hydrated browser service cache via `public-book.js`; it does not issue a separate public service API request.
- Missing-option diagnostics report only safe URL, selected provider value, service-select visible/enabled state, count, E2E-prefixed labels, synthetic expected-name/match booleans, and the cache-source fact. This is test-only; no application behavior changed. Hosted confirmation remains required.

## Staging public booking and manage-link persistence correction (2026-09-29)

- **Classification: A, followed by D.** Public booking previously called the synchronous local `saveBookings()` path. It could render a receipt and manage link from browser storage, but `client-manage.js` correctly loads bookings through `getBookingsAsync()` and therefore could not find that local-only booking on a later manage-page document. Separately, the customer-facing manage cards intentionally do not render the client's own name; they render service, confirmation, date/time, provider, status, and allowed actions.
- `public-book.js` now supplies the API-backed `saveBookingsAsync(..., { fallbackOnError: false })` persistence callback. `booking-engine.js` now awaits its save callback before rendering a successful receipt, showing a booking error instead of a false confirmation on failure. This is an application-code fix for authoritative hosted booking persistence; no route, schema, Supabase, or production setting changed.
- The staging E2E now requires exact `POST /api/bookings` HTTP 201, receipt visibility, receipt client/service text, and a manage-link shape before continuing. It verifies the manage page with its real privacy-preserving details—synthetic service, date/time, and Cancel—not the client name. Failure diagnostics report only safe URL path/query keys, allowlisted headings, E2E text, boolean detail presence, Cancel presence, and booking-read response status/key names.

## Staging manage cancellation status selector correction (2026-09-29)

- The generic `getByText(/cancelled/i)` assertion was ambiguous because the static Past-section description and empty-state copy both contain “cancelled.” It could not prove that the managed booking changed state.
- The E2E now finds the exact `.client-manage-card` containing the synthetic service, requires its appointment-actions badge to equal `Cancelled`, and requires no Cancel button on that same card. It checks this immediately after Confirm Cancel and again after reload. This is a test-only selector correction that strengthens, rather than weakens, cancellation evidence.
- Failure diagnostics contain only manage path/query keys, card count, status badge text, Cancel visibility/enabled state, and safe service/date-time presence booleans.

## Staging manage cancellation authoritative-refresh correction (2026-09-29)

- **Classification: E.** The Confirm Cancel handler does call `PATCH /api/bookings/:bookingId` through `saveBookingsAsync`, but it previously waited for the optional booking-cancellation notification before refetching and rendering the manage card. A delayed notification left the correctly targeted card showing its old `Booked` badge even after the authoritative write had completed.
- `client-manage.js` now refetches/renders immediately after the successful authoritative save, before notification delivery. Booking writes from manage actions now also use `fallbackOnError: false`; an API failure shows the existing error state rather than silently presenting a local-only cancellation.
- The E2E installs its exact PATCH response waiter before Confirm Cancel and requires method `PATCH`, a booking route path, HTTP `200`, response key names, and returned `booking.status === "cancelled"`. It then requires the synthetic card badge and no Cancel action both before and after reload. This adds app-code refresh/error handling plus stronger test-only diagnostics; no backend, Supabase, staging data, or production configuration changed.

## Staging cancellation timeout-safe diagnostics (2026-09-29)

- The hosted timeout’s visible `Target page, context or browser has been closed` error was diagnostic masking: the prior catch path tried to evaluate the page after Playwright’s 180-second lifecycle timeout had already closed it. That output cannot classify PATCH, UI refresh, or reload persistence.
- `managePageDiagnostics()` now first checks `isClosed()`, bounds its DOM inspection to one second, and returns only a small safe closed/timed-out/error object instead of throwing. The original cancellation failure message is retained.
- Cancellation checkpoints are now deterministic and separately labelled: `Cancel PATCH not observed` after a 15-second exact PATCH wait; `Cancel PATCH non-success` for non-200/non-cancelled response; `Cancel persisted but UI did not refresh` after a 15-second card wait; and `Cancelled status did not persist after reload`. They record only click booleans, badge states before/after PATCH/reload, path/method/status, response keys, returned status, and safe card diagnostics.
- Hosted confirmation must use a Netlify frontend deployed from commit `7991980` or later. No frontend commit marker exists in the current bundle, so the E2E cannot assert revision identity directly.

## Staging manage cancellation direct-write correction (2026-09-29)

- **Classification: C/G.** Confirm Cancel was wired, but it used generic full-collection booking synchronization. The managed UI entered its pending state while that indirect path could fall back or fail to reach a targeted authoritative write, leaving the server record `Booked` and producing no observed PATCH.
- Added `dataStore.updateBookingAsync()`, a direct `PATCH /api/bookings/:bookingId` adapter that validates the returned booking shape, updates the compatibility cache only after the API response, and honors `fallbackOnError: false`. `client-manage.js` now awaits this direct update and requires a returned `cancelled` status before it clears pending state or refreshes the card.
- The E2E continues to require exact PATCH/200/returned-cancelled status. Its no-PATCH diagnostic now also reports only authoritative-ID presence/UUID-shape booleans, intended method/path, badge state, button state, and scrubbed browser errors—never the ID, token, request body, or customer data. Hosted confirmation remains required against the deployed frontend.

## Staging manage cancellation mode-routing correction (2026-09-29)

- **Classification: A/other (no update request; pre-PATCH routing defects).** Confirm first awaited a redundant `getBookingsAsync()` outside its update `try`, so a failed or stalled reread prevented entry into the new direct updater and left the pending confirmation UI in place. The direct adapter also still sat behind `runAsync()`: `fallbackOnError: false` disables fallback only after an API attempt and does not prevent the wrapper from choosing its local branch before fetch.
- Confirm now uses the cache already hydrated by the manage page's successful authoritative GET for policy/details, then immediately invokes `updateBookingAsync(..., { requireApi: true })`; that option calls the targeted adapter directly and cannot choose local storage. The intended authoritative operation remains `PATCH /api/bookings/:bookingId`. On an update failure, the pending state is cleared, the server-backed card is rerendered as Booked, an error is shown, and Cancel remains available.
- The staging E2E now listens before Confirm Cancel for every booking-related request, response, and request failure. Diagnostics include only method, URL path without query, response status/failure text, booking-path and UUID-shape booleans, safe handler stage/mode/config-presence booleans, badge/action state, and manage-page console errors. The exact PATCH waiter was already installed before Confirm, so the prior hosted result was not a waiter race. Hosted confirmation remains required after this frontend change is deployed.

## Staging manage cancellation CORS preflight correction (2026-09-30)

- The hosted runtime reached `apiUpdateBooking()` and issued the correct `PATCH /api/bookings/:bookingId`, but the browser rejected its preflight because the server's explicit CORS header allowlist omitted `X-Slotzy-Notify-Mode`. The request therefore failed before the booking route ran.
- Production-like CORS now permits exactly `Content-Type`, `Authorization`, and `X-Slotzy-Notify-Mode`; the existing origin allowlist and `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` method list are unchanged. The notification header remains necessary because it tells the route to skip its automatic notification while the manage client performs the existing manual notification flow.
- The frontend and E2E contracts are unchanged: cancellation still requires the targeted PATCH, HTTP 200, returned `booking.status === "cancelled"`, exact card status/action changes, and persistence after reload. Render must redeploy this backend change before hosted confirmation.

## Hosted staging lifecycle pass and pilot cleanup (2026-09-30)

- Commit `3db01ac` passed all three guarded hosted tests against the Netlify staging frontend, Render staging API, and Supabase staging Postgres: focused owner-setup API chain, full synthetic owner-to-customer lifecycle, and synthetic negative checks.
- The passing lifecycle proves authoritative public booking persistence before receipt, manage-link access to the same synthetic booking, direct `PATCH /api/bookings/:bookingId` cancellation through the `X-Slotzy-Notify-Mode` CORS preflight, exact cancelled-card state without a Cancel action, and persistence after reload. These assertions and their scrubbed failure diagnostics remain intact.
- Normal-success diagnostic streams added during incident isolation were removed: registration contract success, `/api/auth/me`, shop/service contract success, and successful Supabase DNS probes. Safe failure-path registration/shop/storage logs remain, as do E2E-only path/method/status/response-key and synthetic-state diagnostics.
- Pilot readiness is improved but not production approval. Remaining recommended checks include phone-width visual flows, logout/session and invalid manage links, team/service edit paths, owner status actions, controlled email delivery, backup/restore and failure recovery, monitoring, and dependency/security review.

## Mobile-first pilot readiness audit (2026-09-30)

- Added a dedicated local Playwright mobile suite with iPhone SE (375×667), iPhone 15-style (393×852), Pixel/Android-style (412×915), and iPad Mini-style (768×1024) projects. Its 16 checks cover authentication, owner setup, the complete synthetic public booking/receipt/manage/cancel/reload path, invalid manage state, and critical dashboard/services/availability/appointments/settings controls without duplicating the guarded hosted staging lifecycle.
- Fixed focused mobile blockers: `#modalPanel` now has viewport-bounded scrolling; the live `#auth-form` receives full-width 44px controls instead of relying on obsolete `#login-form` selectors; public topbar/booking targets and mobile owner form controls now meet the same 44px minimum. No booking, auth, setup, cancellation, or persistence behavior changed.
- Automated checks verify no document-level horizontal overflow and no horizontal clipping of audited primary controls. All 16 mobile tests pass locally. The owner calendar keeps its intentional internal horizontal scroll at phone widths.
- A physical-device pass remains required for iOS Safari/Android Chrome native controls, virtual-keyboard resizing, sticky-header space, calendar gestures, modal scroll behavior, rotation/safe areas, messaging-app manage-link handoff, and real-world contrast/readability. The in-app interactive browser was unavailable for this audit, so no claim of manual visual-browser validation is made.

## Mobile Availability weekly-hours layout (2026-09-30)

- At widths up to 768px, the Availability weekly-hours table now presents each day as a two-column card: a non-wrapping full-width day label, a full-width labelled Enabled target, and labelled Start/End time controls. All interactive targets are at least 44px tall and stay inside their card and viewport. Desktop retains the existing table layout.
- The dashboard Availability renderer and owner-setup Step 4 renderer share the responsive row classes and accessible control labels. Existing `data-day`/`data-field` hooks and all persistence behavior remain unchanged. Mobile time-off rows stack so their actions do not clip.
- Mobile Playwright coverage now checks all seven weekly rows for readable day labels, horizontal containment, and tap size, and checks timezone, buffer, quick time-off, date/time-off, save, and add controls. The 16-test local mobile suite passes across iPhone SE, iPhone 15-style, Pixel 7, and iPad Mini projects.

## Logged-in barber Availability cache correction (2026-09-30)

- **Root cause: H, with test gap F.** The responsive dashboard markup and selectors from `beb77f0` were correct, but `owner-dashboard.css` was a cache-first PWA shell asset under an unchanged `slotzy-shell-v1`. A previously installed phone could keep the old table stylesheet after Netlify deployed the new code. The prior mobile test opened the dashboard with an owner seed and no installed service worker, so it could not expose this real barber/PWA cache path.
- The shell cache is now `slotzy-shell-v2`, which removes the old cache on activation. CSS and JavaScript shell requests use network-first delivery while online and retain cached fallback offline, preventing an installed phone from being pinned to an older dashboard layout on later deploys.
- A dedicated mobile test now installs and waits for the controlling service worker, signs in through the real local auth UI as a synthetic barber, lands on `business-owner.html`, and audits that exact dashboard Availability DOM. Safe assertion diagnostics include only viewport, path, Weekly Hours client/scroll widths, row count, synthetic visible text samples, and the tested surface. All 20 mobile checks pass across the four configured device projects.

## Manual mobile public-booking save diagnosis and fix (2026-10-01)

- **Root cause: application auth mismatch, with a test-isolation gap.** An anonymous public visitor had no JWT, but `public-book.js` delegated to an adapter that rejected before fetch when auth was missing, and `POST /api/bookings` was protected by `requireAuth`. The generic catch therefore displayed “Could not save…” without making the POST. The hosted test passed because its public page was created in the authenticated owner's browser context; the prior mobile case stayed in local fixture mode.
- Added a privacy-limited anonymous `/api/public/booking-context` read and optional-auth booking create path. Anonymous creates validate the real shop/provider/service relationship, use canonical service and deposit values, reject past/invalid times and known overlaps, and return safe error codes. Successful receipts still wait for HTTP 201 and use the returned authoritative booking ID.
- Added safe failure diagnostics containing endpoint/status/key names, sanitized code/message, selection/value-shape booleans, service-worker control, and frontend cache version only. Customer text now distinguishes a just-taken slot, server connectivity, invalid selection, and an unknown save failure.
- Bumped the installed shell to `slotzy-shell-v3`; public booking HTML, engine, adapter, and runtime config are cached for fallback but fetched network-first online.
- Strengthened mobile coverage to follow the dashboard-generated public link under a controlling service worker, switch to API mode with no auth token, require an unauthenticated POST/201, and verify receipt/manage link and mobile containment. All 28 mobile project checks pass.
- Strengthened hosted coverage so public booking runs in a separate anonymous browser context, requires the public context HTTP 200, asserts no local auth token/Authorization header, and retains the existing receipt, owner visibility, manage cancellation, PATCH, and reload-persistence requirements.
- The original physical phone was not available, so the exact device state was not reproduced. Remaining validation is a coordinated Render-then-Netlify staging deploy, guarded hosted run, and real iOS/Android checks for service-worker activation, stale/conflicting slots, offline/reconnect, duplicate-submit resistance, and manage cancellation.

## Public discovery synthetic-shop filtering (2026-10-01)

- **Root cause:** the unscoped `/api/public/booking-context` discovery request returned every accumulated staging shop, including persistent synthetic records intentionally created by guarded E2E runs. The chooser then rendered every active returned shop.
- Unscoped discovery now excludes shops whose name starts with `E2E `, whose name contains `e2e-`, or whose slug/ID contains an `e2e` segment delimited by `-` or `_`. The browser applies the same rule defensively for local fixtures and stale/mixed responses.
- Scoped context requests containing `shop` or `shopId` do not apply this filter. Dashboard-generated direct links to synthetic shops therefore remain valid and continue to exercise provider/service selection, authoritative booking, receipt, and manage flow.
- Tests now prove real shops remain discoverable, synthetic shops are absent from browsing/search, and a direct synthetic slug still loads. Hosted coverage checks the anonymous directory before opening the synthetic direct link used by the lifecycle.
- No database rows were deleted. Name matching is the minimal current option because the persisted shop model has no cross-adapter public-visibility/test marker. Long term, add an explicit `publiclyListed` or environment/test-data field and perform targeted staging cleanup through approved operational tooling.

## Owner appointment refresh after anonymous booking (2026-10-01)

- **Root cause: F, with a default-view interaction from E.** `manage-appointments.html` initialized from `dataStore.getBookings()` only. Before the anonymous-context correction, the public tab shared the owner's browser storage and accidentally populated that cache. Once public booking correctly moved to a separate context, the owner page retained stale local bookings even though the authoritative POST succeeded. After refresh, the new booking is tomorrow while the page defaults to Today, so the lifecycle must intentionally select All before requiring its card.
- The owner appointments page now awaits `getBookingsAsync({ fallbackOnError: false })` before its first render. API mode therefore refreshes the authenticated owner's `/api/bookings` collection and does not silently treat a stale local cache as authoritative; local mode keeps its existing local behavior. A failed refresh shows an explicit connection/retry message.
- Hosted diagnostics now record only POST/list status and response-key names, ID shapes, returned status, customer-field presence booleans, receipt/manage-link booleans, owner appointment count, synthetic match booleans, status values, and shop/provider shape/equality booleans. No credentials, request bodies, manage values, or customer values are emitted.
- Hosted coverage still requires HTTP 201, receipt/manage link, the exact authoritative booking ID/service/client markers in the owner API response, and a real owner appointment card containing the synthetic client and service with Booked/Confirmed status. Manage-link cancellation and reload persistence remain unchanged.
# Hosted write and endpoint hardening (2026-10-02)

- API-mode writes now reject on API failure or a missing API implementation; local/demo mode retains intentional browser persistence. Services and availability callers await persistence before showing success, and public booking/manage cancellation retain their authoritative-success gates.
- Development email outbox and manual notification endpoints are available only under `development` or `test`; staging/production receive `404` without email content. Hosted booking/cancel/reschedule notifications now originate from authoritative server mutation routes, and cancellation success is independent of optional notification delivery.
- Owner appointment status, reschedule, walk-in, and Today-card status controls now await direct API-backed mutations before success UI in API mode. Remaining work is durable notification idempotency/retry/monitoring and broader operational alerting.

## Owner dashboard and tablet polish (2026-10-03)

- Completed a frontend-only owner dashboard and Settings/Profile branding polish pass. Dashboard language now makes the booking link, service menu, full appointment view, and shop settings feel complementary to the retained top navigation.
- Tablet dashboard content is bounded and centered. Branding previews, controls, and status copy align consistently at iPad widths; JPG/PNG/WEBP 5 MB validation and all storage/save behavior are unchanged.
- Booking, manage-token, availability, cancellation/reschedule, and backend logic are unchanged. Future polish: richer dashboard mockup refinements based on pilot feedback.

## Pilot Round 1 complete; Round 2 scope (2026-10-03)

> Round 2 hosted follow-up (2026-10-03): live staging exposed a branding persistence mismatch that local/mobile coverage did not. Settings sent `logoDataUrl`/`coverDataUrl`, while the Postgres snapshot RPC reads `logo`/`cover` into `shops.logo_url`/`shops.cover_url`. The adapter now canonicalizes these aliases before the RPC and maps stored values back compatibly; the public API remains allowlisted. Hosted profile editing has no authoritative endpoint, so API mode now disables it with “Profile editing is not available during the pilot.” Render and Netlify staging deploys are required; no Supabase migration or data reset is required.

- **Pilot Round 1 is complete and stabilized.** Core flow passed: a client can book; the barber sees the appointment; barber availability correctly blocks customer booking; and both barber and client can cancel or reschedule.
- Round 1 found minor owner-side issues only: lunch/break delete confirmation did not remove the block, dashboard/navigation felt redundant, branding uploads were constrained to 1 MiB, and tablet dashboard/settings alignment needed polish. The delete behavior is fixed, JPG/PNG/WEBP branding uploads allow 5 MiB, and the dashboard/tablet/settings polish shipped.
- Evidence after the fixes: local mobile coverage passed **104/104** and guarded hosted staging passed **3/3**. No further functional-flow blocker was reported after the lunch/break correction.
- **Round 2 recommendation:** remain staging-only; invite only 1–2 trusted barbers/operators and 3–5 trusted customer testers; use no payments and minimum test-only customer data; provide one private support channel. Pause new activity and investigate immediately if booking, manage-link, cancellation, reschedule, or save behavior fails.
- This remains below production readiness. Manual owner recovery/session revocation, restore-target app validation, iPhone small-screen UAT, and broader production launch work remain open; Calendar overflow remains parked and non-blocking.
# Customer confirmation and recovery beta

- The public booking page now keeps an “Already booked but lost your private manage link?” entry point visible after either chooser or direct-shop context finishes loading. Its inline form uses the existing generic recovery API and never renders a token.
- Public booking receipts now make the private manage link prominent with copy, open, copy, and Web Share (copy fallback) controls. A receipt still appears only after authoritative booking success.
- Hosted customers can request a recovery link using booking email, shop name, and appointment date. The response is generic, rate-limited, and never exposes a booking or token; a match rotates the prior token and uses the server email/outbox path.
- SMTP is real delivery only when configured. Without SMTP, messages are safely stored in `email_outbox` for pilot operator handling; this is not customer-facing delivery. Full client accounts and appointment history remain post-beta.
