# Closed-pilot real-device UAT checklist

Use a real staging account and synthetic test bookings only. Do not test production, reset staging, or share a customer manage link outside the tester group. Run the customer flow first, then use the same booking in the owner flow. Mark each line Pass, Fail, or Not available; add a short note for every failure.

## Devices to cover

- [ ] Android Chrome
- [ ] Installed Android PWA/app shortcut
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
- [ ] Services page is usable on the phone, including long names and save feedback.
- [ ] Availability/hours page is usable on the phone, including native time controls and save/error feedback.
- [ ] Settings/profile save gives clear saving, success, validation, and failure feedback.
- [ ] Team page clearly explains the one-provider pilot limitation; it does not imply additional providers are bookable.
- [ ] Logout works; logging in again restores only the expected authenticated experience.

## Device and browser behavior

- [ ] The keyboard does not cover important fields, errors, or primary actions.
- [ ] Native date, time, and select controls are usable.
- [ ] Long booking/manage links wrap safely.
- [ ] No page has page-wide horizontal scrolling.
- [ ] An installed app refreshes to the latest deployed version without retaining an obvious stale shell or stylesheet.
- [ ] Slow connection, refresh, or reconnect does not create a fake success or duplicate booking.
- [ ] Browser/app back behavior is acceptable through booking, receipt, manage, login, and owner pages.
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
