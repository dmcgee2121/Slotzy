# Beta readiness summary

**Audience:** founder/product owner  
**Current checkpoint:** `571f04b`  
**Scope:** staging only

## Current status

Slotzy is staging-ready for a small, controlled beta round. Founder-led multi-device full-flow UAT passed on a Samsung Galaxy S26 Ultra, desktop PC, and iPad using Chrome, Edge, the installed PWA, and Safari. The owner, barber, and customer roles were exercised.

The guarded staging suite passed after the latest application and test-harness fixes. The owner/barber/customer core loop is working, and no current beta blocker is known from the founder-led UAT. This is founder-led validation, not external tester validation, and it is not production readiness.

## What works in the current beta

- Owner account creation and shop setup.
- Owner service creation; during beta, barbers are clearly informed that services are owner-managed and do not receive a broken Add Service form.
- Weekly availability and recurring lunch/break blocks.
- Logo and cover upload.
- Booking-link and QR/link sharing flow.
- Customer booking and receipt creation.
- Private manage-link access and customer cancellation, with refresh persistence checks.
- Appointment Manager, including the compact mobile Upcoming appointments view.
- Staff confirmation, rescheduling, and cancellation; rescheduled and cancelled states persist after refresh.
- Owner and barber visibility of booked appointments in the exercised flows.

## Current beta limitations

- This is staging-only. There is no production launch or payment processing.
- Client accounts/history are not available yet.
- Barber reviews and photos are not available yet.
- Broad team/provider invitation, onboarding, and permissions workflows are deferred.
- Owner recovery remains operator-assisted; self-service recovery and immediate session revocation are not available.
- Stale browser tabs, cached frontend assets, and installed-PWA update behavior remain monitoring items.
- External real-user testing is still needed before any app-store readiness decision.

## Solo-founder QA mode

External tester recruitment is deferred for now and is not a beta blocker by itself. Founder-led UAT remains distinct from external tester feedback. Until real testers are feasible, use this repeatable staging QA routine:

- Complete a founder-led smoke pass weekly and after each deployment.
- Run the guarded staging suite after deployments.
- Run the mobile automation and perform mobile/PWA spot checks on the supported devices and browsers.
- Document only repeatable blockers or meaningful workflow friction; keep notes redacted and free of private links or tester data.
- Defer ad hoc or uncommitted testers. Revisit a small, structured real-tester round later, before app-store or production readiness decisions.

## Immediate stop conditions

Pause the affected workflow and new invitations, then investigate, if any of these occur:

- A saved booking, cancellation, reschedule, or other authoritative update disappears.
- A manage link opens the wrong appointment or unauthorized private data appears.
- A cancellation or reschedule does not persist after refresh.
- The owner or assigned barber cannot see a booked appointment.
- Any possible data disclosure concern arises.

## Recommended next steps

1. Hold feature/code changes briefly and preserve this stable staging checkpoint.
2. Continue founder-led spot checks after deployments, especially booking, manage-link, cancellation, reschedule, and refresh persistence.
3. Revisit a structured, trusted real-tester round only when it is feasible; it remains recommended before app-store or production readiness.
4. Keep feedback structured, redacted, and separate from founder-led UAT notes.
5. Prioritize production hardening before any public launch: recovery/session controls, privacy and retention, observability, rate limiting, production backup/restore, and broader adverse-network coverage.
6. Keep later roadmap work separate from beta reliability: client accounts, barber reviews/photos, richer profiles, notifications, payments, and app packaging.

## Monitoring

Treat stale-tab/cache and installed-PWA behavior as non-blocking monitoring items unless they reproduce an authoritative-save discrepancy or another stop condition. Re-run the guarded staging suite after deployments.
