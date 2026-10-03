# Mobile pilot polish checklist

This checklist is the working UI gate for the **Mobile Pilot Polish** phase. It is planning-only: check an item only after it has been exercised on a physical iPhone and Android phone, or after a specifically named automated check covers it. The next milestone is closed pilot readiness; Play Store packaging is not part of this gate.

## Evidence already available

- The mobile Playwright suite covers 375x667, 393x852, 412x915, and 768x1024 Chromium viewports.
- Automated coverage checks document-level overflow, selected 44px tap targets, setup and invalid-manage states, booking through receipt/manage cancellation, cancellation persistence after reload, and owner controls on dashboard, services, appointments, availability, and settings.
- Smoke coverage exercises setup resume, public booking, receipt/manage access, policy-aware cancellation and rescheduling, owner appointment actions, availability effects, branding, and the dashboard Today card.
- These checks do not replace physical-device review of keyboard behavior, native controls, browser chrome, safe areas, installed mode, visual hierarchy, wording, or thumb reach.

## Loading, empty, error, saved, and retry pass (2026-10-01)

- [x] Added shared compact state panels, readable inline notices, 44px retry actions, and pending button labels without changing persistence behavior.
- [x] Public booking covers shop-context loading/failure/retry, no services, no times, pending authoritative save, known conflict/network wording, and receipt-only-after-save behavior.
- [x] Private manage booking covers loading, invalid-link error, retryable load failure, pending cancellation, and cancel success/failure wording.
- [x] Owner appointments covers authoritative loading, refresh failure with retained stale data, retry, and a consistent empty state for Today, All, and filtered views.
- [x] Owner setup covers pending shop/team/hours saves, finish progress, contained validation, `Saved.`, and retryable availability-save failure.
- [x] Dashboard upcoming appointments uses the shared empty-state language. A synthetic loading state was intentionally not added to dashboard modules that render already-hydrated data.
- [x] Validation completed locally: 44 mobile checks passed across four viewports, smoke discovery listed 25 tests in 7 files, and `git diff --check` passed. Hosted staging did not mutate because its explicit opt-in guard was not enabled.
- [ ] On physical iPhone Safari and Android Chrome, throttle or interrupt connectivity and verify load/retry announcements, scroll position, duplicate-tap protection, and recovery after reconnecting.
- [ ] In an installed PWA, verify the newly deployed HTML/JS/CSS state UI replaces the previous cached shell and that offline fallback does not imply a save succeeded.
- [ ] Later polish: consider focus-to-error/retry and a non-blocking stale timestamp only if pilot observation shows the current notices are missed.

## Dashboard hierarchy pass (2026-10-01)

- [x] Added a mobile-only, two-column dashboard jump bar with 44px targets for Today, Booking Link, Appointments, Services, Availability, and Settings.
- [x] Added focusable section targets and automated checks that the in-page links focus and scroll Today, Booking Link, Appointments, Services, and Availability into view without document-level horizontal overflow.
- [x] Reordered the existing dashboard presentation at widths up to 768px so the daily path is hero/status, quick navigation, Today, booking-link controls, appointments, services/settings shortcuts, Availability, then secondary Insights and Reports. Desktop retains its existing document order.
- [x] Preserved all booking-link, appointment, service, availability, settings, authentication, and persistence behavior; no dashboard JavaScript was changed.
- [ ] Validate the hierarchy, browser chrome, focus landing, thumb reach, and installed-PWA scroll behavior on physical iPhone and Android devices.
- [ ] Consider collapsing or moving secondary Insights/Reports only if real pilot use still shows excessive scanning; this pass keeps all existing information available.

## Owner header and calendar control pass (2026-10-02)

- [x] Removed the duplicate signed-in welcome pill from the owner dashboard's mobile navigation; the dashboard hero remains the single welcome context.
- [x] Made the dashboard's Dashboard, Appointments, Services, Team, and Settings links a two-column 44px mobile grid and kept Logout as a full-width 44px final action.
- [x] Reflowed the owner Appointments calendar toolbar into a month/year row followed by grouped previous/next and Today controls; the calendar no longer forces a wide mobile minimum width.
- [x] Added and passed mobile assertions across iPhone SE, iPhone 15, Pixel 7, and iPad Mini projects (48 checks total) for dashboard-nav containment/no duplicate badge, calendar toolbar containment, 44px controls, and previous/next/Today interaction.
- [ ] Confirm the revised header and calendar toolbar in Android Chrome and installed mode on physical phones, including month navigation and calendar day readability.
- [x] No backend, booking persistence, appointment filtering/refresh, walk-in, export, cancellation, Supabase, or staging-data behavior changed.

## Owner calendar containment follow-up (2026-10-02)

- [x] Removed the remaining mobile calendar nested border and horizontal-scroll surface reported on Android Chrome/installed mode.
- [x] Added padded month/year, a full-width Today row, and equal previous/next controls below it without changing calendar behavior.
- [x] Extended mobile coverage to require the Calendar card and calendar control container to have no horizontal overflow, require a visible/unclipped padded month label, and retain 44px tappable controls.
- [ ] Confirm the deployed layout on Android Chrome and installed mode with the month view populated by real appointments.

## Manage Appointments non-calendar mobile polish (2026-10-02)

- [x] Tightened the Appointment Manager hero and section spacing while retaining its month summary and Add Walk-in action.
- [x] Replaced the mobile filter-chip scroll strip with wrapped rows of 44px targets; search and scope controls remain contained and readable.
- [x] Improved appointment-list and empty-state spacing, with contained/tappable Add Walk-in and Open Public Booking actions and contained appointment cards.
- [x] Added mobile coverage for filter-chip containment, search/scope controls, empty-state actions, and a populated appointment card across all configured device projects.
- [ ] Calendar mobile overflow is intentionally parked for a later focused task; do not treat this pass as Calendar validation or a Calendar fix.
- [x] No appointment fetch/refresh, filters, search, scope, status updates, walk-ins, export, booking, cancellation, backend, or Supabase behavior changed.

## Customer public booking pass (2026-10-01)

- [x] Reframed the public page as a four-step guided flow: barber, service, date/time, and customer details, while preserving every existing form ID and booking behavior.
- [x] Replaced the repeated speed promise and internal slot-generation language with customer-facing guidance about available times, booking rules, confirmation, and the private manage link.
- [x] Strengthened the booking submit area, inline error/success presentation, no-times recovery, receipt confirmation copy, and manage-link handoff.
- [x] Added mobile assertions for shop identity, guided-flow heading, initial empty state, single- and multi-provider behavior, key 44px controls, receipt actions, manage link, and document-level overflow.
- [ ] Validate native date/select controls, virtual-keyboard scrolling, visual density, browser back behavior, copy/open handoff, and the receipt on physical iPhone Safari and Android Chrome.
- [ ] Consider a live step/progress state only if pilot observation shows customers lose their place; this pass deliberately avoids adding navigation logic.

## Owner setup pass (2026-10-01)

- [x] Reworked the existing five-step setup presentation into a clearer Shop, Team, Services, Hours, and Ready path without changing any setup fields, completion rules, storage adapters, or backend requests.
- [x] Replaced wizard/demo and internal scheduling language with short owner-facing explanations, including a clear note in every step about what can be changed later.
- [x] Made the progress indicator compact at phone widths, strengthened the solo choice and primary actions, added comfortable section spacing, and made inline success/error messages readable as contained notices.
- [x] Made `Finish and Open Dashboard` the completion action while retaining copy, open, and QR actions for the existing public booking link.
- [x] Expanded automated mobile coverage to walk through all five steps, exercise validation messages, verify Back/Continue and final actions, check fields and controls for clipping/44px targets, and recheck the seven-card Hours layout.
- [ ] On physical iPhone Safari and Android Chrome, verify virtual-keyboard resize/scroll, native file/time/select controls, focus after validation, thumb reach on long steps, rotation/safe areas, and resumed-setup transitions.
- [ ] Later polish: consider explicit save-in-progress button states and focus/scroll-to-first-error only if real-phone observation shows owners missing feedback; do not add more setup fields unless pilot feedback requires them.

Separate pilot-blocker candidate: a manual mobile customer booking save error remains logged for reproduction and diagnosis. This owner-setup task did not change public booking persistence and does not resolve or downgrade that risk.

## Must fix before closed pilot

### Customer public booking

- [ ] Complete booking on current iPhone Safari and Android Chrome at narrow phone widths with the keyboard open.
- [ ] Confirm provider, service, date, time, and customer-detail progression is obvious without relying on the introductory instructions.
- [ ] Confirm native date/select controls, validation, stale-slot recovery, and no-times/unavailable-date states remain visible and actionable.
- [ ] Confirm the primary booking action stays easy to reach and cannot be mistaken for an already-submitted state.
- [ ] Confirm loading and backend-error states say what happened and offer a safe retry without risking a duplicate booking.

### Customer receipt and manage link

- [ ] Confirm the successful booking state clearly distinguishes the appointment details, confirmation code, and next action.
- [ ] Verify Open Manage Page, Copy Link, Add to Calendar, and confirmation-copy actions on iOS and Android.
- [ ] Verify the manage link opens correctly when pasted into text/email and when opened in another browser tab or installed PWA.
- [ ] Make the privacy implication clear: anyone with the private manage link/contact context may be able to manage the appointment.
- [ ] Confirm copy/calendar failures leave the confirmed appointment intact and provide a useful fallback.

### Customer cancel flow

- [ ] Verify the deliberate Cancel -> Confirm Cancel sequence is visually unmistakable and easy to back out of.
- [ ] Confirm policy-blocked cancellation/rescheduling explains the limit and the customer's next option.
- [ ] Confirm cancelled state removes destructive controls, survives refresh, and cannot be confused with a pending request.
- [ ] Verify invalid, missing, and stale manage links offer a safe route back to the shop/booking page rather than a dead end.
- [ ] Verify reschedule loading, no-slot, conflict, retry, and success states on physical phones.

### Owner setup

- [x] Automated mobile coverage completes a controlled new-owner Shop-to-Ready path at all four configured viewports and verifies the compact five-step indicator.
- [x] Automated checks cover visible/tappable step actions, overflow-safe fields, readable shop/team/service/hours validation, the mobile Hours cards, and the final dashboard/link actions.
- [ ] Complete both a genuinely new-owner path and a resumed incomplete setup path on iPhone and Android.
- [ ] Confirm the five-step progress, saved/resumed state, Back/Continue actions, and optional team step are unambiguous.
- [ ] Check keyboard type, focus, scroll-to-error, and button reach for shop, team, service, price, duration, and hours fields.
- [ ] Confirm every empty/error state names the next action and preserves prior valid input.
- [ ] Confirm the Ready screen makes sharing/testing the booking link the obvious finish and provides a clear dashboard handoff.

### Owner dashboard

- [ ] Reduce the default mobile dashboard to the daily essentials: next/today appointments, add walk-in or service as appropriate, and share booking link.
- [ ] Move or collapse secondary editors and reports so Availability and Reports do not require a long daily scroll past repeated navigation cards.
- [ ] Confirm Today at a Glance and Insights do not duplicate or contradict each other when data is empty, loading, or stale.
- [ ] Confirm owner versus barber scope is clear everywhere appointment/revenue data differs.
- [x] Provide a thumb-friendly dashboard quick-jump path to Today, Booking Link, Appointments, Services, Availability, and Settings without depending on the wide wrapping header.

### Appointments

- [ ] Verify Today is the immediately useful default and that active filters remain obvious after scrolling.
- [ ] Confirm appointment cards expose customer, service, time, provider, and status in a useful scan order before actions.
- [ ] Verify Confirm, Complete, No-show, Reschedule, Cancel, Add Walk-in, calendar, search, and empty-result paths with one thumb.
- [ ] Confirm destructive actions identify the customer/time and make cancellation versus no-show impossible to confuse.
- [ ] Verify calendar gestures and its internal horizontal scrolling do not trap page scrolling or hide the list-based path.

### Services

- [x] Automated coverage verifies no overflow, 44px add/edit/save/cancel/delete controls, contained validation, an empty-state Add Service path, a saved service card, and public booking selection across iPhone SE, iPhone 15, Pixel 7, and iPad Mini.
- [x] Service cards now expose price, appointment length, and Active/Inactive status in a clear scan order; removal confirmation explains the public-booking consequence in plain language.
- [x] Add/edit now use clear labels plus visible Saving, Saved, and save/remove-failure messages without changing persistence behavior.
- [ ] On physical iPhone Safari and Android Chrome, verify add/edit/remove flows with the keyboard open and long realistic names/prices. Calendar mobile overflow remains a separately parked issue.

### Availability

- [x] Automated coverage verifies all seven day cards, explicit Open/Closed state, 44px toggle/time controls, timezone/buffer controls, contained validation, saved-hour refresh, and public-booking time selection across the configured mobile viewports.
- [x] Weekly Hours now provides visible Saving, Saved, and friendly failure feedback near Save Availability; missing and invalid time ranges use plain inline wording.
- [ ] Verify quick breaks, custom breaks, full-day blocks, overlapping/invalid ranges, and deletion consequences.
- [ ] Confirm the same concepts and wording are used in setup and the dashboard editor.
- [ ] On physical iPhone Safari and Android Chrome, verify native time pickers, keyboard/browser chrome, and save feedback. Calendar mobile overflow remains separately parked.

### Settings and policies

- [ ] Verify booking-link/QR actions, shop details, cancellation/reschedule policy, booking limits, and branding at narrow widths.
- [ ] Break the long Settings surface into clearly navigable groups or collapsible sections so the save scope is obvious.
- [ ] Replace pilot/developer-facing wording visible to ordinary owners with concise shop language.
- [ ] Confirm each policy explains its customer-facing effect and whether it applies to booking, cancellation, or rescheduling.
- [ ] Verify dirty, saving, saved, validation-error, and load-error states; ensure owners know which settings were applied.

### Installed browser and PWA behavior

- [ ] Install from Android Chrome and use Add to Home Screen on iPhone; verify launch URL, icon, name, theme color, and standalone layout.
- [ ] Verify safe-area spacing, keyboard/modal scrolling, back navigation, rotation, and external-link/tab handoff in browser and installed modes.
- [ ] Confirm an updated deployment replaces stale shell/CSS/JavaScript while retaining an explicit offline fallback.
- [ ] Define the current offline promise. Do not allow a cached shell to imply that booking or saving succeeded while the backend is unavailable.
- [ ] Verify manage links and authentication redirects opened from messages land on the intended page in browser and installed modes.

## Should fix before closed pilot

- [ ] Standardize loading, empty, success, error, offline, and retry presentation across customer and owner pages.
- [ ] Normalize owner navigation labels/order and show the active destination on every owner page.
- [ ] Remove repeated headings and generic phrases such as `Business Control Center`, `Pilot Settings`, and `Appointment Manager` where they consume phone space without helping the task.
- [ ] Tighten vertical spacing on nested cards, headings, helper copy, and action groups while preserving 44px targets.
- [ ] Verify long shop, customer, service, provider, confirmation-code, URL, and error text wraps without obscuring actions.
- [ ] Add manual checks for focus visibility, screen-reader names, zoom/text scaling, contrast, reduced motion, and bright-light readability.
- [ ] Record device/browser/version, orientation, route, data state, severity, and reproduction steps for every defect found.

## Nice to polish later

- [ ] Refine visual hierarchy, iconography, transitions, and success moments after pilot feedback identifies the most-used paths.
- [ ] Consolidate secondary analytics and reporting presentation.
- [ ] Tune branding previews, QR-print presentation, and nonessential helper copy.
- [ ] Consider richer dashboard personalization only after daily owner behavior is observed.

## Play Store and app packaging later

- [ ] Decide from pilot evidence whether a PWA alone, Trusted Web Activity, or native wrapper is justified.
- [ ] Define deep links, offline/sync semantics, push notifications, permissions, credential storage, updates, and rollback.
- [ ] Prepare store listing assets, privacy disclosures, data-safety declarations, signing, release tracks, and expanded device coverage.
- [ ] Do not begin packaging until Mobile Pilot Polish, Pilot Hardening, and the closed pilot feedback loop are complete.

## Top five highest-impact polish items

1. **Restructure the mobile owner dashboard around daily work.** The current page repeats Today data and navigation cards before placing Upcoming Appointments, the full Availability editor, and Reports in one long scroll. Keep Today, the next appointment, share link, and primary actions near the top; move editing/reporting behind clear destinations or collapsed secondary sections.
2. **Add a consistent mobile owner navigation pattern.** Owner pages rely on dense header link rows whose membership differs by page. Introduce one thumb-friendly, persistent pattern with Dashboard, Appointments, Services, Availability, and Settings, plus a clear active state and access to Team/logout.
3. **Make loading, failure, offline, and retry states trustworthy end to end.** Cover booking submission, receipt utilities, manage-link load/cancel/reschedule, setup saves, appointment updates, availability, services, and settings. A pilot user must know whether data saved and whether retrying is safe.
4. **Simplify the mobile Appointments surface for today's work.** The page leads with a hero, filters, and a month calendar before the appointment list. Prioritize Today's list and high-frequency actions; make calendar/export secondary and keep filter state/action consequences obvious.
5. **Tighten language and vertical density in setup/settings/customer recovery states.** Remove demo/pilot/control-center language, clarify policy effects and invalid-link recovery, and reduce nested-card/helper-copy spacing without shrinking tap targets.

## Recommended very next task

Implement a focused **mobile owner dashboard hierarchy and navigation pass**. Scope it to `pages/business-owner.html`, the shared owner header/navigation used by owner pages, and responsive styles; preserve booking, availability, and persistence behavior. The acceptance target is a short daily-use dashboard at 375px with Today/next appointment, primary daily actions, and share booking link visible early, while Services, Availability, Settings, Team, and Reports remain easy to reach through a consistent mobile navigation pattern. Add or update tests only for the resulting presentation contract after the UI direction is chosen.

## Public booking save diagnosis (2026-10-01)

- [x] The manual phone's exact failure was not reproduced on a physical device in this workspace, but its deterministic application path was reproduced in code: a public visitor without an owner JWT reached an API adapter that required authentication before fetch, so `POST /api/bookings` was never attempted and the generic save message was shown.
- [x] The public page now loads a privacy-limited booking context and creates bookings through anonymous server endpoints. A receipt is still rendered only after HTTP 201 and the authoritative booking response is available.
- [x] The server validates the selected shop/provider/service relationship, canonical service duration/price/deposit fields, future time, and overlap conflicts. Known conflict, connection, and invalid-selection failures now have customer-safe messages.
- [x] Failure diagnostics contain only POST-attempt state, endpoint path, HTTP status, response-key names, sanitized code/message, selection booleans/value shapes, service-worker control state, and frontend cache version. They exclude customer details, bodies, credentials, headers, and manage-link values.
- [x] `slotzy-shell-v3` adds the public booking HTML/JavaScript/configuration to the installed shell and keeps HTML/JavaScript network-first, removing the old shell during activation.
- [x] Mobile coverage now opens the dashboard's real booking link in API mode without an auth token, under service-worker control, and requires anonymous `POST /api/bookings` HTTP 201, receipt, manage link, no document overflow, and no Authorization header across all four configured viewports.
- [ ] After coordinated Render then Netlify staging deploys, rerun the guarded hosted lifecycle. Its customer booking page now uses a separate anonymous browser context rather than inheriting the owner's storage.
- [ ] Repeat the original flow on the affected phone after the new service worker activates; verify the old cache is removed, try a genuinely fresh slot, test a deliberate same-slot conflict, and test an offline/reconnect retry without double submission.

## Public shop discovery cleanup (2026-10-01)

- [x] Hide accumulated E2E shops from unscoped public discovery/search using the established `E2E ` name and `e2e` identifier markers.
- [x] Keep scoped `?shop=` and `?shopId=` direct booking links available, including the synthetic links required by hosted lifecycle tests.
- [x] Verify a normal shop remains visible, a synthetic shop is absent from discovery, and its direct link still opens the booking flow.
- [ ] Replace name-pattern filtering with an explicit persisted public-visibility/test-data marker when the shop schema supports it.
- [ ] Plan targeted staging-only synthetic data cleanup separately; do not use a broad database reset.
