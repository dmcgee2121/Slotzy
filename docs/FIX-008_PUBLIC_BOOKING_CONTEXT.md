# FIX-008 — Public Booking Context Diagnosis

**Disposition:** Direct API works; browser public-page initialization remains blocked.

## Safety

The local API health reported Postgres development storage. The local database was `postgres` with its disposable marker true. Existing loopback launcher isolation and Dev Outbox/blank SMTP configuration were preserved; no hosted service, reset, migration, real email, commit, or deployment occurred.

## Direct API evidence

Exact request from `dataStore.getPublicBookingContextAsync`:

`GET http://127.0.0.1:3001/api/public/booking-context?shop=qa006-shop-qa006-mvdcccem`

Result: **200 in 235 ms**, with one shop, one provider, two services, and one availability-map entry. Read-only PostgreSQL confirmed the same shop slug. This rules out the public Express route, local adapter, shop slug, provider membership, service association, and availability persistence as the cause of the earlier disabled selector.

## Browser trace

Evidence: `%TEMP%/fix008-1792299065214.ndjson`.

Listeners and the `/api/public/booking-context` response waiter were installed *before* navigation to the real local public URL. The waiter still timed out after 12 seconds and recorded no API lifecycle. This is distinct from the earlier late-listener hypothesis.

## Classification

**B — direct API works, browser public-page initialization fails to emit observable API traffic.** No backend repair is justified. The remaining missing evidence is browser console/page-error and served-module state at navigation time; this focused run did not capture them, so no speculative frontend change was made.

## Booking result

No browser booking was attempted because the public context did not initialize in Chromium. PostgreSQL booking count remains unchanged; owner appointment visibility was not exercised.

## Recommendation

Keep P0-B6 blocked at public booking. The next narrow diagnostic should capture console/page errors and confirm execution/loading of `../js/public-book.js` and its `dataStore` API-mode decision in the fresh unauthenticated page. Do not alter Express/Postgres based on this evidence.
