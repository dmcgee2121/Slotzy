# QA-008 — First Customer Booking

**Disposition:** **BLOCKED** at available-time rendering.

## Safety and public initialization

Local health reported Postgres development mode; the QA-006 shop retained two persisted services. The repaired local E2E configuration forced API mode for the fresh unauthenticated customer. No hosted access, SMTP delivery, reset, migration, deletion, commit, or deployment occurred.

## Executed browser evidence

Persistent evidence: `%TEMP%/qa008-1792299434300.ndjson`.

The real public customer page received `GET /api/public/booking-context` **200**. The service selector became enabled, and the browser selected a persisted service. This confirms FIX-009's API-backed public context behavior in the actual booking page.

After the test filled the page's advertised minimum booking date, `#time-slot-select` did not render within the bounded 30-second wait. Consequently no customer details were submitted, no `POST /api/bookings` occurred, and PostgreSQL booking count remained zero.

## Result matrix

| Milestone | Result |
| --- | --- |
| Fresh public API context | PASS |
| Persisted service selection | PASS |
| Available slot display | BLOCKED |
| Browser booking submission | BLOCKED |
| PostgreSQL appointment | BLOCKED |
| Owner appointment visibility | BLOCKED |

## Next diagnostic

Inspect the booked shop's availability weekday versus the selected minimum date, plus public-page slot/status output after date selection. The current evidence does not establish an application defect; it may be a valid date/availability prerequisite. Do not claim the customer-to-owner milestone passed.
