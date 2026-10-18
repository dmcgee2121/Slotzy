# P0-B7 — Booking Lifecycle Acceptance

**Date:** 2026-10-18
**Disposition:** **FAIL** — customer cancellation and conflict prevention were verified locally, but customer management-token rescheduling is explicitly unsupported. Dependent customer-reschedule and owner-refresh verification was not bypassed.

## Safety preflight

- Repository/branch/HEAD: `C:\Dev\Slotzy`, `restore-source-files`, `19aeef610edd9640e9a288d37d1b85dad9b84bc2`; working tree was clean before this report.
- `origin/restore-source-files` contained the approved CP-002 checkpoint.
- Local API health was `ok: true`, `storage: postgres`, `environment: development`.
- The served local runtime configuration contained only `http://127.0.0.1:3001/api` and `forceApiMode: true`; no hosted/staging URL was present.
- Local Supabase identity was the required loopback API/database target (`127.0.0.1:54321`, `127.0.0.1:54322/postgres`). `public.slotzy_test_control.is_disposable` was `true`.
- The controlled local launcher configuration pins PostgreSQL, removes inherited SMTP variables, and forces Dev Outbox. No hosted Supabase, hosted API, real email, reset, migration, deletion, commit, or push was used.

## Actual supported booking rules

- Public booking accepts an active service belonging to the selected provider/shop. The server derives canonical duration from that service.
- Availability requires an enabled weekly interval, no applicable time-off/recurring block, a future start, and an appointment entirely within the provider's business hours.
- `booked` and `confirmed` records block overlap for the same provider. The conflict check includes the shop buffer. A cancelled record no longer blocks the interval.
- Public booking creates a private management token once. The receipt stores it only in a fragment link; the server stores/uses a hash.
- A token authorizes public read/cancellation only. `PATCH /api/public/manage/cancel` invokes the atomic PostgreSQL cancellation path.
- Customer rescheduling is **not supported**: the public receipt and management page state “Rescheduling is not available yet. Please cancel and rebook.” The only schedule-update endpoint, `PATCH /api/bookings/:bookingId`, requires authenticated owner/barber authority.

## Conflict prevention — PASS

Using the real public booking interface for `qa006-shop-qa006-mvdcccem`:

1. A synthetic customer `P0B7 Conflict Primary` created an appointment at `2026-10-26T14:30:00.000Z` through `POST /api/bookings` (**201**), ID `a2b2452c-caab-4b18-8766-363290eb6004`.
2. A fresh public browser selected the same service/date. The reserved 9:30 AM slot was absent. The duration-overlapping 9:45 AM slot was also absent; the 10:00 AM boundary slot remained available.
3. PostgreSQL confirmed no active booking overlapped the tested 9:30–10:00 AM interval apart from the allowed reservation.

An earlier timeout-bound temporary browser diagnostic also created a separate synthetic booking at 9:00 AM on that date. It is preserved, is outside the 9:30–10:00 interval, and was not used as conflict evidence.

## Customer cancellation — PASS

1. The public browser created `P0B7 Cancellation Customer` at `2026-10-27T14:00:00.000Z` through `POST /api/bookings` (**201**), ID `dd13e78e-410e-45cc-a74c-99505a322331`.
2. The generated private management fragment link opened in a separate unauthenticated browser. `GET /api/public/manage` returned **200** and displayed the appointment.
3. The customer clicked **Cancel**, then **Confirm Cancel**. The browser sent `PATCH /api/public/manage/cancel`; Express returned **200** and the page displayed “Appointment cancelled. Your appointment list has been updated.”
4. PostgreSQL showed the booking as `cancelled` with `cancelled_at` set, and `booking_events` contained both `created` and `cancelled` events.

No raw management token was retained in this report or diagnostic evidence.

## Authorization checks — PASS (supported token surface)

- Opening the management page without a token displayed the generic missing/incomplete-link message.
- Browser-context `PATCH /api/public/manage/cancel` with a missing token returned **404** / `invalid_manage_token`.
- The same request with a synthetic invalid 48-character token returned the identical **404** / `invalid_manage_token` response.
- The cancelled synthetic booking remained `cancelled` after those attempts.
- The public endpoint has no booking-ID parameter: its token hash resolves the sole booking atomically. Consequently, a token cannot name or update an unrelated booking. The staff schedule-update route is separately authenticated and scope-checked.

## Customer rescheduling — FAIL (confirmed product gap)

The real token management page rendered the explicit message: “Rescheduling is not available yet. Please cancel and rebook.” Source inspection confirms this is intentional: token holders are kept out of the staff-authenticated reschedule workflow, and no public token reschedule API exists.

Therefore the requested customer actions—select a new slot, persist an updated schedule, reject an occupied reschedule target, verify original/new availability, and confirm in owner UI—cannot be exercised through a supported customer workflow. No unsupported direct API update or authentication bypass was attempted.

**Severity:** P0 for this acceptance objective / beta lifecycle readiness.

## Owner interface

**UNVERIFIED for the new cancellation.** The owner appointment dashboard was previously proven for a created appointment in QA-010, but this assignment had no approved owner credential/session for a new dashboard login. Once customer rescheduling was confirmed unsupported, dependent owner-side lifecycle verification was stopped to avoid fabricating a substitute path. PostgreSQL cancellation evidence is authoritative but is not represented as owner-UI proof.

## Regression tests

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | PASS — 4/4 |
| `npm --prefix server run test:storage` | PASS — 33/33 |
| `npm --prefix server run test:api` | PASS — 42/42 |

## Remaining risks / required follow-up

- Implement and test a token-authorized public reschedule endpoint/workflow, including conflict recheck and atomic PostgreSQL persistence, before re-running P0-B7.
- Re-run owner dashboard verification and refresh for the cancellation and eventual reschedule with an approved synthetic owner session.
- A timeout-bound temporary browser diagnostic left one additional synthetic 9:00 AM booking on 2026-10-26. It was not deleted per the assignment restrictions.

## Final Git status

Only this report is untracked. No source code was changed, and no commit or push was made.
