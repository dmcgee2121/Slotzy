# Closed-pilot final go/no-go review

Date: 2026-10-03

## Decision

**Readiness category: Ready for tiny trusted closed pilot with strict limits.**

**Recommendation: Go** for one trusted barber/operator and one to three trusted customer testers after the day-one gate in `STAGING_QA_CHECKLIST.md` passes. The pilot is staging-only, not a production launch or a broader pilot.

## Completed readiness

- Guarded hosted staging passes 3/3: focused owner setup API chain, synthetic owner-to-customer lifecycle, and negative checks.
- Customer manage links use opaque tokens whose hashes are stored; token-scoped cancellation is verified.
- Hosted API-mode writes cannot silently fall back to local success, and development email/legacy notification endpoints return 404 outside development/test.
- Critical real-device paths passed on installed Android PWA, Android Chrome, iPad Safari, and iPad home-screen mode: booking, manage/cancel, owner visibility, and exercised owner pages.
- An isolated database-level staging restore rehearsal completed with recorded counts and integrity checks. Staging and production were not changed.
- Manual, identity-verified owner recovery; privacy, support, incident, and safe pilot-pause procedures are documented.

## Limits and stop conditions

- One trusted barber/operator; one to three trusted customer testers.
- Staging only; no production launch or payment processing.
- Use only the minimum real customer information needed to test a booking.
- Support is private and uses the named channel; never share credentials, tokens, manage URLs, or private tester data.
- Owner recovery is manual/operator-mediated only.
- Stop the pilot and pause new bookings immediately if booking, manage, cancel, or save issues appear.

## Remaining limitations

- Password recovery is manual only; password changes do not immediately revoke already-issued JWTs.
- App-level health/UI validation against the isolated restore target was not performed.
- iPhone-specific small-screen Safari/home-screen UAT was not performed; iPad covers the Apple/Safari path.
- Slow/offline/reconnect, invalid/expired manage-link recovery, logout/session behavior, duplicate-submit resistance, and installed-app cache refresh remain open.
- Mobile Calendar overflow and tablet dashboard/branding-upload alignment remain parked non-blocking polish.
- The private support channel and named operating roles must be recorded outside the repository before invitations.
- This does not close broader-pilot requirements such as rate limiting/abuse controls, monitoring/alerting, production privacy/retention, payment, or self-service recovery.

## Invitation scripts

### Trusted barber/operator

> I’m inviting you to a very small Slotzy staging pilot. This is early testing, not production. You’ll try the owner flow and help us verify bookings. Please use test-only/minimal information, report issues privately, and do not rely on it for real appointments or payments. Account recovery is handled manually by the pilot operator.

### Trusted customer/tester

> Would you test an early Slotzy booking flow in staging? This is not a production service. Please create only a test booking using minimal information, keep your private manage link private, and report any issue through the private support channel. Do not use it for a real appointment or payment.
