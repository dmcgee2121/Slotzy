# QA-007 — Public Booking Readiness

**Disposition:** **BLOCKED** before public booking context load.

## Intended workflow

The public page loads `getPublicBookingContextAsync` against `/api/public/booking-context` using the shop slug. `booking-engine.js` then selects the sole provider automatically when one exists, populates services, and enables `#serviceSelect`. A customer should not attempt service selection until that public context response and resulting options are present.

## Evidence

QA-006's owner setup remains persisted: shop creation 201, two service creations 201, and availability PUT 200. The public link was `http://127.0.0.1:5173/pages/book.html?shop=qa006-shop-qa006-mvdcccem`.

Persistent public-browser trace: `%TEMP%/qa007-1792298864896.ndjson`.

The controlled unauthenticated Chromium page navigated to that link before registering any selector interaction. It waited specifically for a `/api/public/booking-context` response; none was observed within the 12-second bounded window. Consequently provider/service options and availability slots were not accepted as loaded evidence, and no booking mutation was attempted.

## Classification

The QA-006 disabled service selector was a symptom, not a prerequisite that the test skipped. The required public context response was absent in this focused trace. This is still not classified as a backend defect because server-side request receipt and public-page visible error state were not captured in this short run.

## Acceptance result

| Item | Result |
| --- | --- |
| Owner shop/services/availability | PASS (carried forward, browser/API/Postgres) |
| Public context readiness | BLOCKED |
| Customer booking | BLOCKED — no POST attempted |
| PostgreSQL booking / owner visibility | BLOCKED |

No application code changed; no hosted service, migration, reset, email, commit, or deployment was used. The next focused task should capture public page console/error/loading state plus Express request logs for `/api/public/booking-context` before deciding whether the failure is routing, browser cache/initialization, or endpoint behavior.
