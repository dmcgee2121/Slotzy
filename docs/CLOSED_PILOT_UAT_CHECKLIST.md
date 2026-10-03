# Closed-pilot real-device UAT checklist

Use a real staging account and synthetic test bookings only. Do not test production, reset staging, or share a customer manage link outside the tester group. Run the customer flow first, then use the same booking in the owner flow. Mark each line Pass, Fail, or Not available; add a short note for every failure.

## Recorded results — 2026-10-03

- Environment: installed phone PWA; exact phone/browser was not recorded.
- Customer booking: **Pass**.
- Manage link: **Pass**.
- Cancellation: **Pass**.
- Owner appointment visibility: **Pass**.
- Booking-save issue: **No issue observed**; this clears the prior save-error candidate for this exercised hosted/device path.
- Page-wide horizontal scrolling: **None observed where it should not occur**.
- Screenshots/weird behavior: **None so far**.
- Remaining scope: this is one device-mode result only. Complete the unchecked device/browser and recovery/cache cases below before declaring full internal staged UAT complete.

### Android Chrome real-device UAT

- Environment: Android Chrome on a real device.
- Customer booking, manage link, cancellation, and owner appointment visibility: **Pass**.
- Owner Services, Availability, and Settings/Profile: **Pass**.
- Booking-save issue: **No issue observed**.
- Page-wide horizontal scrolling: **None observed**.
- Keyboard or browser back-button issues: **None observed**.
- Minor observation: on the first opening of the “I'm a client” page, services briefly appeared before a barbershop was selected, then quickly corrected itself. Code inspection found `populateServices()` requires both selected shop and barber state, so this is non-blocking unless it reproduces as a persistent incorrect state.
- Remaining scope: installed Android PWA core flow is already recorded above; iPhone Safari, installed iOS home-screen app, and the unchecked recovery/cache cases remain open.

## Devices to cover

- [x] Android Chrome — core booking/manage/cancel/owner visibility passed on 2026-10-03; Services, Availability, and Settings/Profile were also usable.
- [x] Installed Android PWA/app shortcut — core booking/manage/cancel/owner visibility passed in the recorded installed-phone PWA run.
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
- [x] Services page is usable on the phone (Android Chrome pass; long-name and save-feedback edge cases remain part of broader coverage).
- [x] Availability/hours page is usable on the phone (Android Chrome pass; native-time-control and save/error edge cases remain part of broader coverage).
- [x] Settings/profile is usable on the phone (Android Chrome pass; full save-feedback edge cases remain part of broader coverage).
- [ ] Team page clearly explains the one-provider pilot limitation; it does not imply additional providers are bookable.
- [ ] Logout works; logging in again restores only the expected authenticated experience.

## Device and browser behavior

- [x] The keyboard did not cover important fields, errors, or primary actions in the Android Chrome run.
- [ ] Native date, time, and select controls are usable.
- [ ] Long booking/manage links wrap safely.
- [x] No page-wide horizontal scrolling was observed in the Android Chrome run.
- [ ] An installed app refreshes to the latest deployed version without retaining an obvious stale shell or stylesheet.
- [ ] Slow connection, refresh, or reconnect does not create a fake success or duplicate booking.
- [x] Browser back behavior had no issue in the Android Chrome run; continue to cover the remaining listed paths and iOS.
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

Internal staged UAT is complete only when the critical customer booking, manage/cancel, and owner-appointment flows pass on Android Chrome and the installed Android app shortcut. Include iPhone Safari and installed iOS home-screen app results when available. A failure that risks lost bookings, unauthorized manage access, false success, inability to recover an owner account, or unclear support/recovery handling is a no-go for the trusted pilot.

Known parked/non-gate work: mobile Calendar overflow; richer multi-provider invite/account workflow. Owner password recovery, privacy/support readiness, and backup/restore rehearsal remain pilot blockers until closed.
