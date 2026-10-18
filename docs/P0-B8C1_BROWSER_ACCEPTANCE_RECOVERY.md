# P0-B8C.1 — Local Browser Acceptance Recovery

**Disposition:** **BLOCKED** — local browser tooling is installed, but the attempted Playwright Chrome page automation stalled before the booking UI became testable. No API-only substitute was used.

## Tooling findings

- Playwright 1.58.2 is installed in the repository.
- Installed local executables were found for Google Chrome and Microsoft Edge.
- A direct Playwright launch of the installed Chrome executable succeeded (`chrome-ok`, Chrome 155.0.8059.82).
- The local frontend (`127.0.0.1:5173`) and PostgreSQL API health endpoint (`127.0.0.1:3001/api/health`) both responded successfully.
- A real Playwright navigation to the local public booking page then stalled before `#barberSelect` was available. No appointment, token, or owner session was created by this recovery run.

## Founder-operated acceptance plan

1. Start the local stack from `C:\Dev\Slotzy` with `npm run local:e2e`; wait for the loopback-ready message.
2. In desktop Chrome or Edge, open `http://127.0.0.1:5173/pages/book.html?shop=qa006-shop-qa006-mvdcccem`.
3. Select the visible provider/service, choose a future available slot, and book a uniquely labelled synthetic customer. Save the receipt’s booking ID, but do not copy the raw management-link token into notes/screenshots.
4. Use the receipt’s **Manage appointment** link in an incognito/private browser window. Confirm the synthetic appointment details display.
5. Choose **Reschedule**, a different available time, and **Confirm Reschedule**. Expected visible result: “Appointment rescheduled.” Refresh the page and confirm the changed time remains.
6. In DevTools Network, filter `manage/reschedule`. Capture only sanitized metadata: method `PATCH`, local `127.0.0.1:3001` origin, and HTTP status. Do not capture request headers, URLs containing fragments, or response/customer data.
7. Log in normally as the synthetic owner, open `http://127.0.0.1:5173/pages/manage-appointments.html`, verify the same booking displays at the new time, and refresh.
8. For conflict coverage, create a second synthetic booking in the target interval, then attempt the first customer’s move to that interval. Expected visible result: unavailable/conflict message; original time remains unchanged after refresh.
9. Verify invalid/missing management links in a private window show the generic invalid-link message and reveal no appointment data.

## Read-only database verification

Using only the verified local `supabase_db_Slotzy` instance, query the synthetic booking ID for `id`, `start_at`, `end_at`, `reschedule_count`, and `rescheduled_at`; query `booking_events` for one `rescheduled` event. Confirm no duplicate booking ID, the old interval is no longer attached to the booking, and a conflicting insertion at the new active range is rejected by normal scheduling rules. Never include token hashes or customer contact values in the evidence.

## Unverified scenarios

All end-to-end customer/owner browser steps remain unverified pending a functioning Playwright page-automation run or founder-operated browser run. No application defect was demonstrated; frontend/API loopback health and Chrome launch both succeeded.

## Final Git status

Existing changes/reports were preserved. This report is new and uncommitted. No hosted access, reset, migration, deletion, real email, commit, push, or deployment occurred.
