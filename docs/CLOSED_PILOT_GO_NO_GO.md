# Closed-pilot go/no-go decision

Decision date: 2026-10-04

## Pilot operations confirmation

- Private support uses a direct-message/text channel maintained outside Git.
- The founder/product owner is the authorized staging operator, named pilot operator, and incident decision maker for this first tiny round.
- No private phone numbers, email addresses, tester names, or private contact details are recorded in the repository.
- Scope is staging-only, with a tiny trusted group, no payments, and no production activity.

## Day-one synthetic check

1. Create or use a synthetic staging owner/shop.
2. Confirm the owner can access the dashboard.
3. Confirm services and availability are present.
4. Book a synthetic customer appointment from the public booking page.
5. Confirm the owner sees the appointment.
6. Confirm the receipt shows the private manage link.
7. Open the private manage link.
8. Cancel the appointment.
9. Refresh the owner appointment view.
10. Confirm cancellation persisted.
11. Stop pilot invitations if any step fails.

Immediate stop conditions remain an authoritative-save discrepancy, unauthorized private-link access, failed persisted cancellation, missing owner appointment, or possible data disclosure.

**Current check result: passed.** A separately authorized guarded staging run passed **3/3**: focused staging owner setup API chain, synthetic owner-to-customer booking lifecycle, and staging negative checks. Operational roles and the day-one gate are complete; the tiny trusted staging pilot is cleared for invitations within the stated limits.

## Reliability validation addendum

Local mobile coverage now proves logout cleanup, one-request duplicate booking/cancel behavior, canceled-link safety, and cancellation-failure recovery. The failed-cancel UI received a small frontend hardening so it returns to an enabled Cancel action. Invalid links remain generic and token-safe. This does not broaden the gate: the decision remains **conditional go for the tiny trusted staging round**, after the named support/incident roles and day-one checks are confirmed.

Installed-PWA cache rollover on a physical phone, a true time-expired link fixture, isolated restore-target app smoke, and a refreshed recurring-block restore rehearsal are beta improvements. They are not evidence for production readiness and must not be represented as completed.

## Recommendation

**Conditional go — Ready for the next tiny trusted closed-pilot staging round with strict limits.**

Core product evidence is sufficient for a controlled next staging round with one to two trusted barbers/operators and three to five trusted customer testers. Operational roles and the private channel are confirmed outside Git, and the day-one synthetic lifecycle check passed. Invitations are cleared for this cohort only. This is not production readiness, approval for a broader/open beta, or authorization to process payments.

## Release-candidate checkpoint (2026-10-08)

**Status: ready to reopen to the documented tiny trusted staging cohort.** The release-candidate baseline is commit `c6be2da`; the guarded hosted lifecycle is stable and the focused owner-setup chain, synthetic owner-to-customer lifecycle, and negative checks remain the required 3/3 gate.

- Public private-link cancellation is now an API-backed, atomic token-hash operation. It fails closed: a cancelled state is shown only after authoritative persistence, and the private token is neither returned nor logged.
- Hosted owner dashboard quick-add and owner cancellation actions either receive authoritative API success or retain a retryable error state; they do not claim a local-only save.
- Owner and customer mobile layout passes improve presentation only. They do not alter booking, cancellation, authentication, or manage-token behavior.
- No true closed-beta blocker is known for the limited staging scope. Pause invitations immediately if any existing stop condition occurs; a new authoritative-save, private-link, cancellation, or owner-visibility failure is a blocker until investigated.

Accepted, non-blocking follow-up: physical iPhone installed-PWA cache rollover, a true time-expired-link fixture, isolated restore-target application smoke, broader adverse-network/session coverage, and the parked dashboard/calendar refinements. These do not authorize production or a broader pilot.

## 2026-10-04 gate review update

- Recurring weekly scheduling is deployed, migrated on staging, staging-tested 3/3, and manually accepted.
- Owner account/profile/recovery cleanup is deployed, staging-tested 3/3, and manually accepted. Hosted personal profile editing intentionally remains read-only, while public Shop settings remain editable.
- Customer manage-link recovery is generic and preserves private-token boundaries.
- No new core product blocker was found. The remaining blocker is the operational role/support-channel confirmation above.
- Recommended next package is **Beta Reliability and Recovery Validation**, covering adverse session/network/cache cases, iPhone-size testing where available, and application smoke against the isolated restore target including recurring scheduling data.

## Readiness completed

- Guarded hosted staging passed 3/3: owner-setup API chain, synthetic owner-to-customer booking lifecycle, and negative checks.
- Customer manage links use opaque token authorization; token-scoped cancellation is covered, and only token hashes are persisted.
- Hosted API-mode writes cannot present a browser-local fallback as a successful authoritative save.
- Development email and legacy notification endpoints are restricted outside development/test.
- Critical real-device flows passed on installed Android PWA, Android Chrome, iPad Safari, and the iPad home-screen app: booking, manage link, cancellation, and owner booking visibility. Exercised owner Services, Availability, and Settings/Profile paths also passed.
- The isolated database restore rehearsal completed and validated. The staging snapshot was restored only into the isolated target; table counts and relationship checks are recorded in the backup/restore runbook.
- Manual, operator-mediated owner recovery and privacy/support/incident procedures are documented.

## Limits and stop conditions

- Invite only one to two named trusted barbers/operators and three to five named trusted customer testers.
- Use staging only. Do not launch production, change production, or process payments.
- Use no sensitive real customer information beyond what is needed to test a booking.
- Handle support only through the approved private channel. Do not share passwords, raw manage links/tokens, secrets, or private tester data.
- Owner recovery is manual and operator-mediated only.
- Stop the pilot, pause new invitations, and investigate if any authoritative booking save, manage-link, cancellation, or owner-visibility issue appears.

## Known limitations accepted for this tiny pilot

- Owner password recovery is not self-service. A password change does not immediately revoke already-issued JWTs, which can remain valid for up to seven days.
- Restore validation was database-level only. No app/API health or synthetic UI smoke test ran against the isolated restore target.
- iPhone-specific small-screen Safari and home-screen UAT was not performed. iPad provides Apple/Safari browser and home-screen coverage, but not iPhone-size coverage.
- Logout/session expiry, invalid/expired manage-link recovery, slow/offline/reconnect behavior, duplicate-submit resistance, and installed-app cache rollover remain open coverage.
- Mobile Calendar overflow and future dashboard mockup refinements are parked and non-blocking for this scope; the Round 1 iPad/tablet alignment and dashboard/settings polish shipped.
- The private support channel, incident decision maker, authorized staging operator, and named pilot operator are confirmed outside the repository for this first tiny round.
- Broader-pilot gaps remain, including production privacy/retention/monitoring, rate limiting/abuse decisions, and fuller account-recovery/session-revocation capability.
- The isolated restore rehearsal predates final recurring-block rollout evidence; application/API smoke and explicit recurring-block verification against the restore target remain unperformed.

## Post-beta backlog

- Verified self-service owner recovery, password change, and per-user session/JWT revocation.
- Full multi-provider invitation, onboarding, permissions, and schedule assignment.
- Customer accounts/history and token-authorized rescheduling.
- Production privacy/retention/monitoring, abuse/rate-limit controls, and production backup/restore readiness.
- Payments, Calendar/dashboard/tablet polish, app-store packaging, and production launch planning.

## Day-one checklist

1. Record that the guarded staging suite passed 3/3 and the operational roles are confirmed outside Git.
2. Record issues in the restricted, redacted support record. Do not store or share secrets, raw manage links/tokens, or private tester data.
3. Send invitations only to the stated tiny trusted staging cohort; pause new invitations immediately if a stop condition occurs.

## Invitation scripts

Send the relevant script together with [tester instructions](CLOSED_PILOT_TESTER_INSTRUCTIONS.md). Use the [feedback template](CLOSED_PILOT_FEEDBACK_TEMPLATE.md) only in the private support process; never commit completed records.

### Trusted barber/operator

> Hi [name] — I’m inviting you to a very small, early Slotzy staging pilot. This is testing, not production: please use only test bookings and do not enter sensitive customer information. You’ll be the single operator for this round. If booking, saving, manage links, cancellations, or owner views behave unexpectedly, stop and send details through [private support channel]. Account recovery is handled manually by the pilot operator. Please do not share passwords, private manage links, or screenshots containing customer details.

### Trusted customer/tester

> Hi [name] — would you help test an early Slotzy staging booking experience? This is not the live service and no payment is involved. Please use only the minimum test contact details needed to make a booking, save your private manage link, and report any booking, manage-link, or cancellation issue through [private support channel]. Please do not share the link or screenshots containing private details.

## Evidence and operating references

- [Pilot readiness](PILOT_READINESS.md)
- [Staging QA checklist](STAGING_QA_CHECKLIST.md)
- [Real-device UAT checklist](CLOSED_PILOT_UAT_CHECKLIST.md)
- [Owner recovery runbook](CLOSED_PILOT_OWNER_RECOVERY_RUNBOOK.md)
- [Backup and restore runbook](CLOSED_PILOT_BACKUP_RESTORE_RUNBOOK.md)
- [Privacy, support, and incident runbook](CLOSED_PILOT_PRIVACY_SUPPORT_INCIDENT_RUNBOOK.md)
- [Tester instructions](CLOSED_PILOT_TESTER_INSTRUCTIONS.md)
- [Feedback template](CLOSED_PILOT_FEEDBACK_TEMPLATE.md)
