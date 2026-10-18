# QA-010 — Customer-to-Owner Verification

**Disposition:** **PASS CANDIDATE** — complete primary journey verified.

## Safety

`restore-source-files` at `7d41093` was retained with all existing work. Local health reported Postgres development storage. The existing appointment was found in the disposable local database before browser testing. No hosted access, SMTP delivery, migration, reset, deletion, commit, push, or deployment occurred.

## PostgreSQL record

Appointment `16485df7-463b-4641-9ef4-15a50a0fbf9f` exists with status `booked`, start `2026-10-19 14:00:00+00` and end `2026-10-19 14:30:00+00`, corresponding to 9:00–9:30 AM America/Chicago.

## Owner interface

The synthetic owner authenticated through the real local Chromium login interface using the supported flow, then opened `pages/manage-appointments.html`.

- The page issued `GET /api/bookings` and received **200**.
- The rendered owner page contained the customer `QA009 Customer`, matching the browser-created booking.
- After a full page refresh, the same customer appointment remained visible.

## Result

The complete primary journey is verified: public customer browser booking → local Express → PostgreSQL → authenticated owner appointment interface → refresh persistence.

No product changes were made in this assignment. Remaining lifecycle/security scenarios are outside this focused verification.
