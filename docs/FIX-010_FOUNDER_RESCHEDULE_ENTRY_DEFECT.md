# FIX-010 — Customer Reschedule Entry Defect

**Date:** 2026-10-18
**Disposition:** **PASS CANDIDATE** — confirmed client-side authorization-model mismatch fixed; founder visual retest remains required.

## Reproduction evidence

Founder Chrome acceptance showed a valid private manage link displaying the booked appointment, then immediately showed **“Appointment not found.”** when its Reschedule control was clicked. The appointment card remaining visible is consistent with a client-side lookup failure, not a missing PostgreSQL appointment.

## Confirmed root cause

`renderClientManagePage()` correctly resolves a valid private token through `GET /api/public/manage` and saves the returned single booking in `currentPublicBooking`.

When **Reschedule** was clicked, `openRescheduleModal()` then called `findAccessibleBooking()`. That helper applied the legacy shop/contact query-string authorization filter. Token management links deliberately do not carry customer contact in the URL, so `currentQuery.contact` was empty. The valid token-resolved booking was therefore filtered out and the UI emitted “Appointment not found.” before opening the modal. No reschedule API request occurred at that point.

## Fix

Updated `js/client-manage.js` so API-backed private-token management uses a strict identity check against the single booking returned by the token lookup. It bypasses only the obsolete contact filter for that one matching booking. The legacy contact-based management path is unchanged.

This preserves the established security boundary:

- `GET /api/public/manage` remains the token authority.
- The client cannot widen scope beyond `currentPublicBooking.id`.
- `PATCH /api/public/manage/reschedule` still receives only the management token and `startISO`; it never accepts a client booking ID.
- Server token hashing, PostgreSQL RPC access, staff-only scheduling routes, conflict checks, and availability checks are unchanged.

No remaining “cancel and rebook” rescheduling wording was found in the current management/receipt source path; the page already presents the Reschedule control and policy language.

## Regression coverage

Added `server/test/client-manage-token-scope.test.js`, which verifies that the token-scoped source is limited to `currentPublicBooking` while retaining the legacy contact comparison for non-token paths.

| Command | Result |
| --- | --- |
| `npm --prefix server run test:storage` | PASS — 34/34 |
| `npm --prefix server run test:api` | PASS — 45/45 |

## Remaining risk and retest

The unavailable interactive browser automation was not retried. The founder should reopen the existing private management link, click **Reschedule**, and confirm that the modal appears with date/time controls instead of “Appointment not found.” Then select a different available time and confirm the normal local browser-to-PostgreSQL acceptance steps from P0-B8C.

## Final Git status

All existing modified/untracked work was preserved; this report and the focused test are new and uncommitted. No hosted access, database reset/migration, deletion, real email, commit, push, or deployment occurred.
