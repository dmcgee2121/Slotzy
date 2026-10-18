# FIX-009 — Public Booking Frontend Initialization

**Outcome:** repaired local-E2E configuration defect.

## Root cause

A fresh unauthenticated browser initializes `dataStore` from `Slotzy_api_mode`. The isolated launcher supplied a loopback `apiBaseUrl` but did not set that storage flag, so public booking selected localStorage mode and never requested `/api/public/booking-context`.

## Repair

- The loopback-only served local E2E configuration now includes `forceApiMode: true`.
- `dataStore` treats only that explicit configuration flag as an API-mode override; standalone mode still respects `Slotzy_api_mode`, and checked-in hosted configuration is unchanged.

## Verification

Fresh Chromium, with no `Slotzy_api_mode` value, loaded the verified QA-006 public link and received `GET /api/public/booking-context` **200**. The service selector became enabled with three options (placeholder plus two persisted services). This proves public context initialization uses local Express rather than browser storage.

`npm run test:local-e2e-config`: 4/4 passed.

## Remaining work

The public booking readiness blocker is cleared. The first customer appointment and owner visibility still need a dedicated browser run; they were not claimed here.
