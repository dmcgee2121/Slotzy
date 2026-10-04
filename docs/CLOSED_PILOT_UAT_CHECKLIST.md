# Closed-pilot real-device UAT checklist

Use a real staging account and synthetic test bookings only. Do not test production, reset staging, or share a customer manage link outside the tester group. Run the customer flow first, then use the same booking in the owner flow. Mark each line Pass, Fail, or Not available; add a short note for every failure.

## Pilot operations confirmation (2026-10-04)

- [x] Private direct-message/text support channel exists outside Git.
- [x] Founder/product owner is the authorized staging operator, named pilot operator, and incident decision maker for the first tiny staging round.
- [x] No private contact details or tester identities are stored in this repository.
- [x] The round remains staging-only and tiny/trusted, with no payments and no production activity.
- [x] Day-one lifecycle passed in a separately authorized guarded staging run: **3/3** (focused owner setup API chain, synthetic owner-to-customer lifecycle, and staging negative checks).

## Reliability/recovery follow-up (2026-10-04)

- [x] Local mobile matrix: logout removes session credentials and protected Settings requires sign-in.
- [x] Local mobile matrix: rapid duplicate booking and cancellation interactions each send one authoritative request.
- [x] Local mobile matrix: canceled manage view cannot cancel again; a failed cancellation returns a usable retry action without false success.
- [ ] Post-Netlify staging: rerun guarded **3/3**, then verify normal booking/manage/cancel and generic invalid-link behavior with synthetic data only.
- [ ] Real installed PWA: open the prior deployment, reconnect/relaunch after deployment, and confirm current booking/manage UI loads without stale assets.
- [ ] Isolated recovery environment: confirm a restored recurring block removes overlapping public slots while times before and after remain available. This was not part of the 2026-10-03 restore rehearsal.

## Beta gate — next trusted tester round (2026-10-04)

**Scope:** one to two named trusted operators and three to five named trusted customers, staging only. Use minimum synthetic/test contact data; no payments or production activity.

- [x] Before invitations, confirm the private support channel, named pilot operator, authorized staging operator, and incident decision maker outside Git.
- [x] Run the day-one synthetic booking → owner visibility → private manage link → cancellation persistence check through the guarded staging suite; **3/3 passed**.
- [ ] Tell testers that owner profile editing is read-only, owner recovery is operator-assisted, manage-link rescheduling is unavailable, and this is staging—not a live service.
- [ ] Ask testers to cover normal owner setup/services/hours, recurring and one-time blocks, chooser/direct booking, branding, receipt/manage/cancel/recovery, and owner appointment visibility.
- [ ] Stop immediately on an authoritative save discrepancy, unauthorized/private-link access, failed persisted cancellation, missing owner booking, or apparent data disclosure.
- [ ] Record only redacted observations through the private support channel; never collect passwords, private manage links, tokens, screenshots with customer data, or secrets.

**Non-blocking observations for this round:** Calendar overflow/tablet polish, iPhone-specific device coverage, adverse network/session/cache behavior, and restore-target app validation remain targeted follow-ups rather than reasons to withhold this tiny trusted staging round.

Use [tester instructions](CLOSED_PILOT_TESTER_INSTRUCTIONS.md) for the operator/customer scope and [feedback template](CLOSED_PILOT_FEEDBACK_TEMPLATE.md) for redacted private-channel observations.

## Pilot feedback triage 1 retest (2026-10-04)

- [x] Staging rerun passed **3/3** after the initial cancellation-observation flake: focused owner setup API chain, synthetic owner-to-customer lifecycle, and staging negative checks.
- [x] Manual UAT: owner mobile screens, calendar, and header improvements were acceptable; delete feedback polish was accepted.
- [x] Manual UAT: public shop logo alignment improved. It is not yet perfectly flush, but remaining alignment polish is a beta improvement rather than a blocker.
- [x] Keep service descriptions out of this retest: they need a separate end-to-end data-model/API/public-booking package.
- [x] Tiny trusted staging pilot remains active, staging-only, without payments or production activity.

## Owner account/profile/recovery cleanup — passed (2026-10-04)

- [x] Netlify deployed and guarded staging passed **3/3**; no Render deploy, Supabase migration, or production change was required.
- [x] Login modal shows “Need help accessing your owner account?”
- [x] Settings clearly separates account identity, personal profile, and public business/shop settings.
- [x] Hosted personal profile fields are intentionally read-only with clear wording; public business/shop settings remain editable.
- [x] Recovery/help copy makes no email or text delivery claim and retains operator-assisted private pilot support. Manual tester confirmation: “all of that looks right.”

## Recurring weekly scheduling blocks — passed (2026-10-04)

- [x] Staging migration and deployment completed; guarded staging suite passed **3/3**. Production was not touched.
- [x] Owner created a recurring lunch/break block and public booking respected it.
- [x] Available public times before and after the recurring block remained visible.
- [x] Deleting the recurring block worked as expected. Manual tester confirmation: “ok that worked as expected”.

## Recorded results — 2026-10-03

### Pilot Round 2 cover-rendering follow-up — 2026-10-04

- Branding persistence and logos: **Pass on hosted retest.** Owner logo/cover save succeeded; the saved logo appeared in the public chooser and on the selected booking page.
- Selected booking hero cover: **Failed on hosted retest; fixed locally.** The public contract already returned canonical `cover`, but the frontend hero did not reliably paint it. The hero now uses a contained decorative image layer, with the existing Slotzy fallback when cover is absent.
- Deployment status: **Pending Netlify deploy and hosted retest.** No Render deploy, Supabase migration, staging reset, or production change is required.

### Pilot Round 2 iPhone Safari/PWA feedback follow-up

- Core booking, actual available times, Sunday/Monday blocking, token manage-link opening, cancellation, and general barber/customer flow: **Pass**.
- Token manage-link rescheduling: **Not available in this pilot by design.** The token is restricted to read/cancel and cannot enter the staff-authenticated reschedule workflow. The misleading disabled button is removed; customers see: “Rescheduling is not available yet. Please cancel and rebook.”
- First-load chooser flash: **Fixed locally.** The loading state now hides shop and booking information until shop context resolves; direct booking links remain supported.
- Owner dashboard cramped top and long-scroll feedback: **Recorded for Owner Dashboard 2.0 polish.** No full dashboard redesign is included in this follow-up.

### Pilot Round 2 profile, branding, and team follow-up

- Shop profile save: **Fixed locally.** A 5 MiB source image expands when sent as a data URL; the former 5 MB server JSON ceiling rejected valid branding saves. The server now allows the documented logo/cover payload.
- Public branding: **Logo passed hosted Round 2 retest; cover failed and is fixed locally.** The selected hero now paints the canonical public cover through a contained image layer; default Slotzy branding remains the fallback.
- Team: **Clarified.** Only the shop owner can add team members during the pilot. A barber account cannot add members, and the larger multi-provider invite/onboarding workflow is not included.
- Time Off: **Clarified.** One-off blocks apply only to their selected date/time range. Recurring weekly lunch/break blocks are now complete for beta on staging.
- Future roadmap only: confirmation email/text carrying the private manage link, resend/recovery of that link, and optional client accounts/history.

- Environment: installed phone PWA; exact phone/browser was not recorded.
- Customer booking: **Pass**.
- Manage link: **Pass**.
- Cancellation: **Pass**.
- Owner appointment visibility: **Pass**.
- Booking-save issue: **No issue observed**; this clears the prior save-error candidate for this exercised hosted/device path.
- Page-wide horizontal scrolling: **None observed where it should not occur**.
- Screenshots/weird behavior: **None so far**.
- Remaining scope: this is one device-mode result only. Complete the unchecked device/browser and recovery/cache cases below before declaring full internal staged UAT complete.

### Owner-side UAT follow-up

- Availability lunch/break/time-off delete: **Pass** after commit `58dbe8e`; manual verification confirmed that accepting the prompt removes the block as expected.
- Branding upload: **Pass** for the updated limit; logo and cover uploads accept JPG, PNG, and WEBP up to 5 MB (raised from 1 MB).
- Dashboard/tablet/settings polish: **Pass**; the owner dashboard redundancy reduction, tablet centering, and branding upload alignment shipped without changing functional flow.
- Hosted post-commit evidence: focused owner-setup API chain, synthetic owner-to-customer booking lifecycle, and staging negative checks: **3 passed**.

### Android Chrome real-device UAT

- Environment: Android Chrome on a real device.
- Customer booking, manage link, cancellation, and owner appointment visibility: **Pass**.
- Owner Services, Availability, and Settings/Profile: **Pass**.
- Booking-save issue: **No issue observed**.
- Page-wide horizontal scrolling: **None observed**.
- Keyboard or browser back-button issues: **None observed**.
- Minor observation: on the first opening of the “I'm a client” page, services briefly appeared before a barbershop was selected, then quickly corrected itself. Code inspection found `populateServices()` requires both selected shop and barber state, so this is non-blocking unless it reproduces as a persistent incorrect state.
- Remaining scope: installed Android PWA core flow is already recorded above; iPhone Safari, installed iOS home-screen app, and the unchecked recovery/cache cases remain open.

### iPad Safari and iPad home-screen app real-device UAT

- Environment: iPad Safari and iPad home-screen app.
- Customer booking, manage link, cancellation, and owner appointment visibility: **Pass** in both modes.
- Owner Services, Availability, and Settings/Profile: **Pass** in both modes.
- Booking-save issue: **No issue observed**.
- Page-wide horizontal scrolling: **None observed** in either mode.
- Keyboard or browser/back-button issues: **None observed**; behavior worked better than expected.
- Non-blocking tablet visual polish follow-ups: owner dashboard is slightly off-center on iPad/tablet layout; Settings/Profile branding upload previews and controls have alignment issues. Neither issue blocked booking, manage link, cancellation, owner visibility, saving, or navigation.
- Remaining scope: iPad covers the Apple/Safari browser and home-screen paths. Retain iPhone-specific Safari/home-screen coverage only if required for the pilot; unchecked recovery/cache cases remain open.

## Devices to cover

- [x] Android Chrome — core booking/manage/cancel/owner visibility passed on 2026-10-03; Services, Availability, and Settings/Profile were also usable.
- [x] Installed Android PWA/app shortcut — core booking/manage/cancel/owner visibility passed in the recorded installed-phone PWA run.
- [x] iPad Safari — core booking/manage/cancel/owner visibility, Services, Availability, and Settings/Profile passed on 2026-10-03; no save issue or page-wide horizontal scrolling observed.
- [x] iPad home-screen app — same core and owner-page results as iPad Safari on 2026-10-03; no page-wide horizontal scrolling observed.
- [ ] iPhone Safari, if available
- [ ] Installed iOS home-screen app, if available

## Customer flow

- [ ] Public shop chooser shows only real shops; no synthetic/E2E-looking shops appear.
- [ ] A direct booking link opens the correct shop.
- [ ] Service selection is understandable and usable.
- [ ] Date and time selection work with the device's native controls.
- [ ] Customer detail fields remain visible and usable with the keyboard open.
- [ ] Confirm booking creates one booking; the button/status does not imply success while saving.
- [ ] Receipt appears only after the booking saves; a failed/slow request does not create a fake receipt.
- [ ] The receipt's manage link opens the token-based manage page for that booking.
- [ ] Cancellation works, shows a clear saved result, and remains cancelled after refresh.
- [ ] An invalid or expired manage link shows a clear, safe message and a useful next step.

## Owner flow

- [ ] Owner can log in and the dashboard loads without stale or misleading data.
- [ ] Copying and opening the booking link work and open the correct public shop.
- [ ] Appointments show the customer booking after refresh.
- [ ] All and Today filters make sense for the booking date and do not hide data unexpectedly.
- [x] Services page is usable on exercised real devices (Android Chrome, iPad Safari, and iPad home-screen app pass; long-name and save-feedback edge cases remain part of broader coverage).
- [x] Availability/hours page is usable on exercised real devices (Android Chrome, iPad Safari, and iPad home-screen app pass; native-time-control and save/error edge cases remain part of broader coverage).
- [x] Settings/profile is usable on exercised real devices (Android Chrome, iPad Safari, and iPad home-screen app pass; full save-feedback edge cases remain part of broader coverage; branding-upload alignment is a non-blocking tablet polish follow-up).
- [ ] Team page clearly explains the one-provider pilot limitation; it does not imply additional providers are bookable.
- [ ] Logout works; logging in again restores only the expected authenticated experience.

## Device and browser behavior

- [x] The keyboard did not cover important fields, errors, or primary actions in the Android Chrome run.
- [ ] Native date, time, and select controls are usable.
- [ ] Long booking/manage links wrap safely.
- [x] No page-wide horizontal scrolling was observed in the Android Chrome, iPad Safari, or iPad home-screen app runs.
- [ ] An installed app refreshes to the latest deployed version without retaining an obvious stale shell or stylesheet.
- [ ] Slow connection, refresh, or reconnect does not create a fake success or duplicate booking.
- [x] Browser/back behavior had no issue in the Android Chrome or iPad runs; continue to cover the remaining listed paths and iPhone-specific coverage only if required for the pilot.
- [ ] No obvious stale-cache issue appears after reload or reopening the installed app.

## Pass/fail report template

Copy this into ChatGPT after each device run:

```text
Phone/device:
Browser/app:
Customer booking:
Manage link:
Cancellation:
Owner appointments:
Services:
Availability:
Settings:
Biggest issue:
Screenshots attached:
```

## Exit rule

Internal staged UAT core flow is complete: the critical customer booking, manage/cancel, and owner-appointment flows passed on Android Chrome, the installed Android app shortcut, iPad Safari, and the iPad home-screen app. iPad covers the Apple/Safari browser and home-screen paths; include iPhone Safari and installed iOS home-screen results only if required for the pilot. A failure that risks lost bookings, unauthorized manage access, false success, inability to recover an owner account, or unclear support/recovery handling is a no-go for the trusted pilot.

Known parked/non-gate work: mobile Calendar overflow; richer multi-provider invite/account workflow; and future dashboard mockup refinements beyond the completed iPad/tablet dashboard-centering and Settings/Profile branding-upload-alignment polish. Owner password recovery is available only through the manual, operator-mediated runbook and does not immediately revoke issued JWTs. The database-level isolated backup/restore rehearsal is complete, but app-level validation against the restore target was not performed. Privacy/support documentation is complete, while its named operating roles still need to be recorded outside the repository.

## Pilot Round 1 closeout and Round 2 checklist (2026-10-03)

Round 2 branding/profile follow-up:

- [ ] After Render and Netlify staging deploys, save a test logo and cover and verify both survive reload.
- [x] As an anonymous client, verify the custom logo in the chooser and on the direct booking page.
- [ ] After the cover-fix Netlify deploy, verify the custom cover on the direct booking page.
- [ ] Verify unbranded shops retain default Slotzy branding.
- [ ] Verify hosted Profile Settings clearly reports that editing is unavailable and never shows the generic retry error.
- [ ] Keep invitations paused if branding or any booking/manage/availability path regresses.

Round 1 is complete and stabilized. Its core client booking, owner/barber appointment visibility, availability blocking, and barber/client cancel-reschedule paths passed. The lunch/break delete defect, 1 MiB branding limit, and owner dashboard/tablet/settings polish findings were resolved. Mobile automation passed 104/104 and hosted staging passed 3/3; no further functional-flow blocker was reported after the delete fix.

- [ ] Before invitations, rerun the guarded staging suite and confirm 3/3 pass.
- [ ] Confirm the private support channel, incident contact, and named Round 2 tester list.
- [ ] Keep Round 2 staging-only: 1–2 barbers/operators, 3–5 trusted customers, no payments, and minimum test-only customer data.
- [ ] Test the booking link, confirm the owner sees the booking, and verify the client manage link.
- [ ] Collect feedback on clarity, layout, trust, and ease of use.
- [ ] Pause and investigate before new activity if booking, manage-link, cancellation, reschedule, or save behavior fails.
# Customer confirmation and recovery beta

- [ ] Refresh the public booking chooser and a direct shop link; after loading finishes, the lost-link recovery entry point remains visible and opens its form.
- [ ] Customer can save the private manage link from the completed booking receipt using Copy, Open, or Share.
- [ ] Lost-link recovery requests always show the same generic result and never reveal booking details in the browser.
- [ ] Pilot operator verifies the booking email and recovery context before handling any outbox-only recovery; never share a token publicly or through an unverified contact.
- [ ] Full customer accounts/history are not part of this pilot beta.
