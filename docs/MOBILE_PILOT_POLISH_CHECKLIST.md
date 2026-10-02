# Mobile pilot polish checklist

This checklist is the working UI gate for the **Mobile Pilot Polish** phase. It is planning-only: check an item only after it has been exercised on a physical iPhone and Android phone, or after a specifically named automated check covers it. The next milestone is closed pilot readiness; Play Store packaging is not part of this gate.

## Evidence already available

- The mobile Playwright suite covers 375x667, 393x852, 412x915, and 768x1024 Chromium viewports.
- Automated coverage checks document-level overflow, selected 44px tap targets, setup and invalid-manage states, booking through receipt/manage cancellation, cancellation persistence after reload, and owner controls on dashboard, services, appointments, availability, and settings.
- Smoke coverage exercises setup resume, public booking, receipt/manage access, policy-aware cancellation and rescheduling, owner appointment actions, availability effects, branding, and the dashboard Today card.
- These checks do not replace physical-device review of keyboard behavior, native controls, browser chrome, safe areas, installed mode, visual hierarchy, wording, or thumb reach.

## Dashboard hierarchy pass (2026-10-01)

- [x] Added a mobile-only, two-column dashboard jump bar with 44px targets for Today, Booking Link, Appointments, Services, Availability, and Settings.
- [x] Added focusable section targets and automated checks that the in-page links focus and scroll Today, Booking Link, Appointments, Services, and Availability into view without document-level horizontal overflow.
- [x] Reordered the existing dashboard presentation at widths up to 768px so the daily path is hero/status, quick navigation, Today, booking-link controls, appointments, services/settings shortcuts, Availability, then secondary Insights and Reports. Desktop retains its existing document order.
- [x] Preserved all booking-link, appointment, service, availability, settings, authentication, and persistence behavior; no dashboard JavaScript was changed.
- [ ] Validate the hierarchy, browser chrome, focus landing, thumb reach, and installed-PWA scroll behavior on physical iPhone and Android devices.
- [ ] Consider collapsing or moving secondary Insights/Reports only if real pilot use still shows excessive scanning; this pass keeps all existing information available.

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

- [ ] Verify add/edit/activate/deactivate/remove flows with the phone keyboard and long realistic names/prices.
- [ ] Confirm service state and customer-booking impact are understandable without internal terminology.
- [ ] Confirm the empty state leads directly to adding the first bookable service.
- [ ] Verify save/remove errors preserve entered data and provide a clear retry.

### Availability

- [ ] Verify all seven mobile day cards, enabled toggles, native time controls, timezone, and buffer on iOS and Android.
- [ ] Confirm save success/failure is visible near the action and unsaved changes cannot be mistaken for published hours.
- [ ] Verify quick breaks, custom breaks, full-day blocks, overlapping/invalid ranges, and deletion consequences.
- [ ] Confirm the same concepts and wording are used in setup and the dashboard editor.

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
