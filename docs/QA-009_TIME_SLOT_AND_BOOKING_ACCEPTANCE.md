# QA-009 — Available Time Slots and First Customer Booking

**Disposition:** **PASS CANDIDATE** for the public customer booking milestone.

## Root cause of QA-008

The minimum selectable date was Sunday, while the synthetic provider's Sunday availability was disabled. The provider is enabled Monday through Saturday, 09:00–17:00 America/Chicago. No slot control is rendered for an unavailable day; the public page renders an empty-state instead. This is expected scheduling behavior.

## Executed booking

Using the real unauthenticated Chromium public page for `qa006-shop-qa006-mvdcccem`:

- Public context loaded through local Express.
- A persisted service was selected.
- Monday 2026-10-19 produced 15-minute slot options from 09:00 through 16:30 for the 30-minute service.
- The first slot was selected and synthetic customer `QA009 Customer` submitted through the UI.
- `POST /api/bookings` returned **201** with appointment ID `16485df7-463b-4641-9ef4-15a50a0fbf9f`.
- Read-only local PostgreSQL count changed to one booking.

No direct API or SQL booking fixture was used. Local health remained Postgres development mode with the disposable marker; no hosted service, SMTP delivery, reset, migration, deletion, commit, or deployment occurred.

## Remaining verification

Owner dashboard visibility and refresh persistence were not completed in this focused time-slot run, so the full customer-to-owner milestone remains pending that final owner-interface check. No application change was made.
