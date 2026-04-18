# Beta Checklist

## Purpose
Use this checklist for daily self-beta testing and for deciding when a shop is ready for a small pilot.

## Daily Workflow Test
Run this once per day before sharing the app with pilot users.

1. Reset to a clean state if needed:
   `index.html?reset=1&demo=1`
2. Open the home page:
   `/pages/index.html`
3. Log in as owner:
   `owner_demo` / `demo`
4. Open `Settings` and confirm:
   - public booking link renders
   - QR renders
   - branding previews load
5. Open the public booking link:
   `/pages/book.html?shop=demo-fade-studio`
6. Complete one public booking with:
   - name: `Beta Tester`
   - contact: `demo@test.com`
7. Confirm the booking receipt shows:
   - confirmation code
   - manage link
   - copy button
   - calendar action
8. Open the manage link from the receipt.
9. Reschedule the appointment once.
10. Confirm the owner sees the reschedule in `Manage Appointments`.
11. Re-open the manage link and cancel the appointment.
12. Confirm the owner sees the cancellation immediately.
13. Export appointments CSV from the filtered list.
14. Export clients CSV from the clients page.
15. If backend is running, open:
   `/pages/dev-emails.html`
16. Confirm booking lifecycle emails appear in Dev Outbox for `demo@test.com`.

## Bug Logging Template
Copy this block for every issue:

```md
Title:
Date:
Tester:
Environment:
Frontend URL:
Backend running: yes/no
Demo mode: yes/no

Steps to reproduce:
1.
2.
3.

Expected:

Actual:

Severity:
- blocker
- major
- minor

Screenshot / recording:

Notes:
```

## Pilot Ready Acceptance
Mark the build as pilot ready only when all of these are true:

- Owner can log in and land on a usable first screen.
- New shop owners are redirected into setup instead of an empty dashboard.
- Public clients can book without creating accounts.
- Receipt always shows a working manage link.
- Manage page can cancel and reschedule within policy rules.
- Owner views update immediately after booking, cancel, and reschedule.
- Public and owner pages both render correctly on phone-sized screens.
- CSV exports open cleanly in Excel or Google Sheets.
- Dev Outbox captures booking emails when backend is running without SMTP.
- Backup export and restore work on at least one real browser session.
- There are no blocker bugs and no unresolved data-loss bugs.

## Release Guardrails
- Do not start a pilot if booking creation fails on a clean demo reset.
- Do not start a pilot if manage-link cancel or reschedule is broken.
- Do not start a pilot if backup restore has not been verified this week.
- Do not start a pilot if smoke tests are red or unrun.
