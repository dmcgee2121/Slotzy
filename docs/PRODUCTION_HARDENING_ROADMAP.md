# Production-hardening roadmap

**Current position:** Slotzy is staging-ready for solo-founder QA. Founder-led multi-device UAT and guarded staging checks cover the core owner, barber, and customer loop. Slotzy is **not production-ready**. This roadmap does not approve a production launch, payments, app-store distribution, or claim external tester validation.

## Gate definitions

| Gate | Meaning |
| --- | --- |
| Solo-founder staging QA | Required to keep the current controlled staging workflow safe and repeatable. |
| Wider beta | Required before expanding beyond founder-led QA into a structured real-user beta. |
| Production | Required before accepting production data or representing Slotzy as a live service. |
| App-store readiness | Required before packaging/distributing an app-store build; production gates still apply. |

## Hardening workstreams

### Authentication and account recovery

**Why it matters:** Account recovery must verify ownership without exposing account existence or granting access to the wrong person.

**Current status:** Recovery is operator-assisted and documented for staging. Self-service reset, verified recovery enrollment, and a full password-rotation flow are not implemented.

**Required work:** Define verified recovery factors, implement a secure reset and recovery enrollment flow, prevent enumeration, audit recovery actions, and test compromised-account handling.

**Required for:** Production and app-store readiness. Operator-assisted recovery remains acceptable only for solo-founder staging QA.

### Session management and logout/session revocation

**Why it matters:** Logout and recovery must promptly remove access when a device or account is compromised.

**Current status:** The durable per-user JWT revocation foundation is implemented on staging. The `auth_version` migration is applied in staging, and staff tokens use a stable subject plus version, issuer, and audience validation. Protected routes reload the user and enforce the current auth version and invalid-after time. A server-side logout-all action is available. Password-change UI/API and self-service recovery are not implemented, so password changes cannot yet invalidate existing sessions through a supported user flow.

**Required work:** Implement password change with invalidation of existing sessions as the next account-security package. Then define bounded session lifetime and refresh rules, device/session visibility where appropriate, self-service recovery, and regression coverage for logout, expiry, recovery, and compromise.

**Required for:** Wider beta at minimum; production and app-store readiness required.

### Privacy and data retention

**Why it matters:** Production use requires clear collection, retention, deletion, export, consent, and disclosure practices.

**Current status:** Staging support/incident guidance exists, but automated retention, deletion, export, consent/disclosure, and production privacy approval are not complete.

**Required work:** Publish approved privacy and retention policies, implement data-subject workflows, define backup-retention treatment, minimize data collection, and verify support procedures against production responsibilities.

**Required for:** Production and app-store readiness.

### Production database, backups, and restore

**Why it matters:** Data loss, corruption, or a bad deployment must be recoverable without improvisation.

**Current status:** An isolated staging database restore rehearsal passed. Application/API smoke against the restore target and recurring-block verification are still open; no production recovery rehearsal exists.

**Required work:** Establish a separate production database and access model, automated encrypted backups, retention and recovery objectives, point-in-time restore where supported, restore-target application smoke, and a documented production restore drill.

**Required for:** Production. Restore-target application smoke is also needed before wider beta.

### Monitoring, logging, and alerting

**Why it matters:** Production incidents need detection and diagnosis without exposing tokens, private links, or customer data.

**Current status:** Safe staging diagnostics and manual review exist; production-grade monitoring, alerting, and operational dashboards are not approved.

**Required work:** Define health, error, latency, authorization, booking-persistence, and notification-delivery signals; redact sensitive fields; set alert ownership and escalation paths; test alerts and log access controls.

**Required for:** Wider beta and production.

### Error handling and incident response

**Why it matters:** Users need safe, truthful failure states, and operators need a repeatable way to contain and recover from incidents.

**Current status:** The staging incident runbook and authoritative-save failure handling exist. Production severity, communication, evidence retention, and recovery procedures are incomplete.

**Required work:** Extend the runbook for production contacts, on-call/escalation, customer communication, incident timelines, evidence handling, post-incident review, and rollback authority; rehearse a booking and privacy incident.

**Required for:** Wider beta and production.

### Rate limiting and abuse prevention

**Why it matters:** Public booking, authentication, recovery, and manage-link endpoints need protection from enumeration, spam, brute force, and resource exhaustion.

**Current status:** Production rate-limit and abuse decisions are explicitly deferred.

**Required work:** Threat-model public and authenticated endpoints; add rate limits, abuse detection, retry/backoff rules, bot/spam controls where warranted, and privacy-safe audit signals; test legitimate recovery from rate limits.

**Required for:** Production; define the approach before wider beta.

### Security review and dependency review

**Why it matters:** Authorization, manage-token handling, secrets, dependencies, and deployment configuration need independent scrutiny before handling production data.

**Current status:** Manage-token cancellation fails closed and staging boundaries are documented, but a focused production security/privacy and dependency review remains open.

**Required work:** Review authorization by role and route, token lifecycle and leakage risks, secrets management, CORS/origins, dependency vulnerabilities, build provenance, and least-privilege provider access. Resolve critical findings and record accepted risks.

**Required for:** Production and app-store readiness.

### Email, SMS, and notification reliability

**Why it matters:** Booking and cancellation communication must match what the UI promises and must not create duplicate or misleading messages.

**Current status:** Authoritative mutation routes initiate notifications after persistence; delivery is best-effort. Durable delivery, idempotency, and operational monitoring are not complete.

**Required work:** Define supported channels and delivery expectations, provider failure/retry policy, idempotency and deduplication, opt-in/consent requirements, deliverability monitoring, and user-visible fallback/support behavior.

**Required for:** Wider beta when notifications are relied on; production required. SMS additionally requires its own consent and compliance review.

### Payments readiness

**Why it matters:** Payments introduce financial, security, support, reconciliation, tax, refund, and compliance obligations.

**Current status:** No payments are enabled or approved.

**Required work:** Treat payments as a separate program: choose a compliant provider, define merchant-of-record and refund/dispute ownership, prevent storage of payment data, add reconciliation and failure handling, obtain legal/privacy review, and conduct payment-specific testing.

**Required for:** Any payment launch. Not required for the current staging QA mode.

### Production environment separation

**Why it matters:** Staging mistakes, test data, and credentials must never affect live customers.

**Current status:** Staging uses separate data and credentials. Production infrastructure, secrets, origins, deployment controls, and access review are not approved.

**Required work:** Create isolated production projects/accounts, secrets and key rotation, strict environment-specific origins and configuration, least-privilege access, deployment promotion controls, and a verified no-test-data migration plan.

**Required for:** Production and app-store readiness.

### Real-user testing requirements

**Why it matters:** Founder-led UAT verifies core workflows but does not substitute for independent real-user usability and reliability evidence.

**Current status:** External testers are deferred; no external tester validation is implied.

**Required work:** Before app-store or production readiness, conduct a small, structured, consented real-user beta with redacted feedback, defined support, representative devices/networks, and stop conditions. Keep findings separate from founder-led UAT.

**Required for:** Wider beta, production, and app-store readiness. Not a blocker for solo-founder staging QA.

### App-store/PWA packaging readiness

**Why it matters:** Packaging creates distribution, update, deep-link, offline, permissions, privacy-disclosure, support, and store-policy obligations.

**Current status:** Installed-PWA paths have been exercised, but cache rollover, iPhone-specific coverage, offline/reconnect behavior, and packaging decisions remain incomplete.

**Required work:** Define update and cache strategy, offline boundaries, deep/manage-link behavior, permissions, native credential storage, store assets/listings, device matrix, accessibility review, privacy disclosures, and release rollback process.

**Required for:** App-store readiness; production gates still apply.

### Launch gates and rollback plan

**Why it matters:** A launch must have explicit evidence, ownership, pause criteria, and a way to stop harm quickly.

**Current status:** Staging has guarded tests, stop conditions, and a limited incident process. There is no approved production launch gate or rollback rehearsal.

**Required work:** Define go/no-go criteria, accountable launch owner, production smoke suite, deploy and rollback mechanics, database migration rollback/forward strategy, feature-disable options, customer/support communications, and a staged rollout plan. Rehearse failure and rollback before launch.

**Required for:** Production and app-store readiness.

## Prioritized next steps

### P0 — must complete before production

1. Production environment separation, secrets/access review, and deployment controls.
2. Password-change invalidation and secure self-service recovery, building on the completed staging session-revocation foundation.
3. Production privacy, retention, deletion/export, and disclosure decisions.
4. Production backup, restore-target app smoke, recovery objectives, and a restore drill.
5. Monitoring, alerting, incident response, security review, dependency review, and rate-limit/abuse controls.
6. Launch gates, rollback rehearsal, and full automated/manual production regression.

### P1 — needed before wider beta

1. Restore-target application smoke, including recurring-block data.
2. Password-change/session invalidation, logout, recovery, adverse-network, duplicate-submit, expired-link, and installed-PWA update coverage.
3. Notification reliability expectations, idempotency, and monitoring if notifications are relied on.
4. Structured, consented real-user testing when feasible, with redacted feedback and defined support.

### P2 — app-store and product polish

1. iPhone-specific and broader device/network validation.
2. PWA update/offline/deep-link behavior, packaging decision, store assets, accessibility, and disclosures.
3. Calendar/dashboard/tablet polish after reliability gates are satisfied.

### Later roadmap and feature work

- Client accounts and history.
- Barber reviews, photos, and richer profiles.
- Full multi-provider invitation, onboarding, permissions, and schedule assignment.
- Expanded notification channels.
- Payments, only as a separately approved program.

## Operating rule

Continue solo-founder staging QA with guarded staging checks after deployments, mobile automation, and repeatable multi-device spot checks. Do not represent that work as external validation or production approval. Pause the affected workflow immediately for any authoritative-save discrepancy, wrong manage-link appointment, failed cancellation/reschedule persistence, missing owner/barber appointment, unauthorized private-data exposure, or data-disclosure concern.
