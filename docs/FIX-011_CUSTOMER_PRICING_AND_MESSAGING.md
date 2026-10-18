# FIX-011 — Customer Booking Price and Rescheduling Messaging

**Date:** 2026-10-18
**Branch:** `restore-source-files`
**Baseline:** `0c247038c8f651eb5cd0a7b232f3de265bc192a1`
**Disposition:** **PASS CANDIDATE** — focused source, storage, and API/frontend regression coverage pass. Founder visual acceptance remains required.

## Confirmed root causes

### Private management price showed `$0.00`

The founder's booking data was correct. Read-only verification against the explicitly disposable local PostgreSQL database found one `test1234` booking whose linked `Classic Cut` service has `price_cents = 3000` and whose immutable `service_snapshot.price` is `30`.

The PostgreSQL adapter already persisted that snapshot price when a booking was created, but both booking-to-legacy/client mappings omitted it. Consequently, `GET /api/public/manage` returned a booking without `price`. `js/client-manage.js` then coerced the missing field through `Number(booking?.price ?? 0)`, rendering `$0.00`.

This was a projection and display-fallback defect, not a stored-price, booking-total, authorization, or appointment-persistence defect.

### Receipt stated rescheduling was unavailable

`js/booking-engine.js` contained a stale private-link receipt sentence: it said token-link rescheduling was unavailable and instructed customers to cancel and rebook. That contradicted the founder-verified `PATCH /api/public/manage/reschedule` workflow and the management-page Reschedule control.

## Files modified

- `server/src/storage/postgresStore.js`
- `js/client-manage.js`
- `js/booking-engine.js`
- `server/test/storage-contract.test.js`
- `server/test/customer-pricing-messaging.test.js`
- `server/package.json`
- `docs/FIX-011_CUSTOMER_PRICING_AND_MESSAGING.md`

## Pricing correction and contract findings

- Booking creation continues to write the booked price to `service_snapshot.price`; no booking row, historical monetary value, or database schema was changed.
- The PostgreSQL `readStore()` and authenticated booking mapping now project that historical snapshot price as `booking.price`.
- The public management endpoint continues to remove only `manageTokenHash`; it now receives the correctly projected price through the existing safe booking shape.
- The management page preserves an explicit numeric zero as `$0.00`.
- A missing, blank, or non-numeric historical snapshot price now renders as **“Price unavailable”**. It does not substitute the current service price, avoiding invention of a historical amount.
- Token hashing, token-only public authorization, service-role-only RPC access, conflict/availability checks, cancellation behavior, staff-only routes, and rescheduling persistence are unchanged.

## Messaging correction

The booking receipt now says that the private link can be used to view, cancel, or reschedule an appointment. It correctly limits rescheduling to eligible future appointments and the shop's change policy. Ineligible, cancelled, expired, or policy-restricted appointment behavior and warnings were not broadened or removed.

## Regression results

Only non-destructive suites were run.

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | **PASS — 4/4** |
| `npm --prefix server run test:storage` | **PASS — 35/35**; includes snapshot-price preservation/missing-price regression coverage. |
| `npm --prefix server run test:api` | **PASS — 47/47**; includes focused customer-management price and receipt-copy frontend-source coverage. |

The local database check was read-only and selected no management token, password hash, customer contact, or other sensitive customer value.

## Remaining limitations and founder retest

Browser automation remains unavailable/unreliable for this local workflow, so no visual claim is made from the automated suite. The founder should perform this Chrome retest against the local disposable environment:

1. Open a public booking page for a nonzero-priced service (for example, `$30.00`) and complete a synthetic booking.
2. Confirm the receipt displays the selected price and the updated private-link wording; it should not say to cancel and rebook because rescheduling is unavailable.
3. Open that booking's private management link and confirm the card shows the same booked price, not `$0.00`.
4. Click **Reschedule**, choose an eligible different slot, and confirm the normal success message.
5. Refresh the management page and owner dashboard; confirm the changed time persists and the displayed price remains unchanged.
6. Optionally inspect a legacy booking with no snapshot price: it should say **“Price unavailable”**, never `$0.00` unless its stored price is explicitly zero.

## Final Git status

This task intentionally leaves the narrow source/test/report changes uncommitted. No hosted Supabase/API access, database migration/reset, data deletion, real email, commit, push, deployment, or browser-driven booking mutation occurred.
