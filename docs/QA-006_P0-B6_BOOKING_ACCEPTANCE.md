# QA-006 — P0-B6 Booking Acceptance

**Disposition:** **BLOCKED** — owner setup passed; first customer booking did not reach a request.

## Safety and synchronization

Branch/HEAD remained `restore-source-files` / `7d41093`; all existing work was preserved. Local health reported Postgres development mode, served configuration used only `http://127.0.0.1:3001/api`, and local `postgres` had a true disposable marker. The existing launcher forced Dev Outbox and blank SMTP. No hosted endpoint, reset, migration, deployment, commit, push, or real email was used.

The browser waited for setup initialization, then waited 800 ms and verified the shop name still had its intended value immediately before clicking. This corrected the FIX-007 race.

## Owner setup: PASS

Persistent evidence: `%TEMP%/qa006-mvdcccem.ndjson`.

- Owner registration: `POST /api/auth/register` **201**.
- Shop creation: `POST /api/shops` **201**.
- Services: two separate `POST /api/services` responses, both **201**.
- Hours: `PUT /api/availability` **200**.
- Wizard reached the ready step and produced the local public link `pages/book.html?shop=qa006-shop-qa006-mvdcccem`.
- Local PostgreSQL immediately contained one QA-006 shop and two QA-006 services.

This proves corrected browser → Express → PostgreSQL owner setup.

## Customer booking: BLOCKED

A fresh unauthenticated Chromium context opened the generated public link. The automation then found `#serviceSelect` still disabled and could not select a service; its bounded action timed out after 30 seconds. The persistent log has no customer-side API response or `POST /api/bookings`, and PostgreSQL booking count remained zero.

This is not classified as a product defect: the trace does not yet capture the public-page initialization state, enabled/option state, or customer-side network requests needed to distinguish a public-page readiness race from a real loading defect. Dependent owner-visibility, lifecycle, conflict, management, and outbox scenarios were not run.

## QA matrix

| Scenario | Result |
| --- | --- |
| QA-01 registration/authentication | PASS |
| QA-02 shop, services, availability | PASS |
| QA-03 public booking readiness | BLOCKED |
| QA-04 customer booking | BLOCKED |
| QA-05 owner visibility | BLOCKED |
| QA-06–QA-10 | UNVERIFIED/BLOCKED (depend on booking) |

## Remaining risk

Owner setup’s initialization can overwrite early user input; the corrected stabilization procedure avoids it. The next narrow task should instrument the unauthenticated public booking page before selecting controls, recording `barberSelect`/`serviceSelect` enabled state, options, page status, and public API lifecycle. API regression follow-up was not run to completion during this blocked booking attempt.
