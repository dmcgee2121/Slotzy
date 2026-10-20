# FIX-015: Provider Names and Solo-Provider Booking

## Disposition

**PASS CANDIDATE.** A current solo-provider UI defect was confirmed and corrected. Founder browser acceptance remains required.

## Safety preflight

- Branch `restore-source-files`, baseline `367320017170ef2c33b16fcbedcee40da08e7d65`, initially clean.
- Local Supabase API and PostgreSQL were verified at `127.0.0.1:54321` and `127.0.0.1:54322`; disposable marker returned true.
- Local Express health reported PostgreSQL storage in development mode. The local E2E configuration test preserves loopback routing and Dev Outbox/disabled SMTP isolation.
- No hosted access, migration, reset, data deletion, real email, commit, push, deployment, or Netlify change occurred.

## Architecture and evidence

The public booking API returns public-safe providers with canonical `username`, human-readable `displayName`, role, and shop ID. Services retain canonical provider usernames; the booking engine uses that value for availability and booking submission while rendering `displayName` in customer text.

The current local `test1234` public context contains one provider with a nonempty display name, one availability key, and two active eligible services (Classic Cut and Fade) assigned to the canonical provider. FAT008 is inactive and absent. No private staff contact data is projected.

## Confirmed root cause and correction

The booking engine already auto-selected a sole provider and hid the `<select>`, but it left the surrounding “Choose your barber” step visually empty. This matched the founder-reported confusing solo-shop behavior.

- Added an accessible solo-provider notice: `Your appointment will be with [display name].`
- The canonical username remains the option value and selected booking identity.
- Multi-provider shops retain the select control, friendly display labels, and canonical values.
- No API, authorization, availability, conflict, provider-service, or booking contract changed.

Focused regression coverage verifies sole-provider canonical auto-selection, friendly notice, and canonical option values.

## Regression results

| Suite | Result |
| --- | --- |
| Local E2E configuration | 4/4 passed |
| Storage | 36/36 passed |
| API/frontend | 52/52 passed |

## Founder retest

1. Restart `npm run local:e2e`, then open `http://127.0.0.1:5173/pages/book.html?shop=test1234` in Chrome.
2. Confirm Classic Cut and Fade are available and FAT008 is unavailable.
3. Confirm the page states the eligible barber’s human-readable name rather than leaving an empty picker or exposing a technical identifier.
4. Select each active service, choose an available slot, and confirm the booking flow is not blocked by provider selection. Do not create an unnecessary booking if visual verification is sufficient.
5. Confirm existing private management/rescheduling paths remain unchanged.

## Remaining risks

- Browser visual acceptance is founder work; no browser automation claim is made.
- Multi-provider UI behavior is preserved by source/contract review, not a full browser exercise in this assignment.

## Changed files and Git status

- `pages/book.html`
- `js/booking-engine.js`
- `server/package.json`
- `server/test/solo-provider-booking-contract.test.js`
- `docs/FIX-015_PROVIDER_NAMES_AND_SOLO_BOOKING.md`

All changes remain uncommitted.
