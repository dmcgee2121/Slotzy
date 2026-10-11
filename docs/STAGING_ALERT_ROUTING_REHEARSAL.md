# Staging alert routing and rehearsal runbook

**Status:** The planning runbook is complete. Configuration verification and a tabletop rehearsal are recorded in [P0-F2a's result record](STAGING_ALERT_ROUTING_REHEARSAL_RESULT.md); a full delivered-alert rehearsal remains pending.

**Current framing:** Slotzy is staging-ready for solo-founder QA and **not production-ready**. This runbook does not authorize Render, Netlify, provider, dashboard, secret, code, schema, migration, or production-alert changes. It does not establish external-tester validation or payment-launch approval.

## Purpose and scope

This runbook defines the smallest safe operational package for routing one existing, redacted backend staging signal to the accountable owner and rehearsing the response. Its purpose is to prove a notification path for meaningful staging service failures without collecting customer data or creating production operations.

Scope is limited to existing allowlisted backend events and platform capabilities already approved for staging. Browser-local frontend diagnostics remain local; this runbook neither exports them nor adds frontend telemetry. Notification delivery signals may be used only if they are already observable in safe/redacted form; no notification provider, sender, or test message is authorized.

## Strict staging-only boundary

- Confirm the target is the dedicated **staging** service before any configuration or rehearsal activity. Stop on any ambiguity.
- Do not create, test, route, or page against production; do not reuse production destinations, senders, credentials, contacts, or customer data.
- Do not add an external alert provider, dashboard, monitoring SDK, package, secret, or platform resource under this runbook. Use only an approved existing platform-native mechanism if later separately authorized.
- Use a synthetic, non-customer-safe signal or platform-supported simulation. Do not deliberately cause a booking failure, authentication failure, data mismatch, privacy exposure, provider failure, or service outage merely to test alerting.

## Ownership and approved destinations

| Role | Assignment | Responsibility |
| --- | --- | --- |
| Alert owner | `[Solo-founder staging alert owner]` | Receives, acknowledges, triages, and records the rehearsal alert. |
| Backup owner | `[Named backup owner or explicitly documented unavailable]` | Receives/escalates only if the alert owner is unavailable; must be named before broader beta or production. |
| Staging operator | `[Authorized staging operator]` | Confirms environment, makes only approved platform-native routing changes when separately authorized, and preserves redacted evidence. |

Approved destinations must be private, access-controlled, staging-labelled, and owned by the alert owner/backup owner. Candidate types are a platform-native private notification destination or another separately approved restricted operational channel. Do not use a public channel, repository issue, customer/support inbox, shared unrestricted chat, personal contact list in this document, or a destination that could expose private event content.

Record the actual destination type and owner in restricted operational evidence, not this repository, and never record its address, webhook, token, invite, or credential here.

## Initial signal policy

| Signal | Initial staging action | Trigger / safe content |
| --- | --- | --- |
| API health/readiness failure | **Alert immediately** | Two consecutive failed health/readiness checks; environment, service, safe health outcome, time window, release, approved correlation ID if available. |
| Unexpected storage mode | **Alert immediately / stop condition** | Any safe event showing an unapproved storage mode or environment identity mismatch. |
| Elevated API 5xx | **Alert immediately** | Three safe 5xx events in 15 minutes, or a clearly broad service impact; safe route/category and aggregate count only. |
| Authoritative booking write failure or mismatch | **Alert immediately / stop condition** | Any confirmed failed authoritative write after user-facing success, or persistence mismatch. |
| Broad authentication failure | **Alert immediately** | Unexpected authentication-failure pattern meeting the existing staging threshold (five in 15 minutes) or a credible broad sign-in outage. |
| Notification all-sends-failing | **Alert immediately if observable** | All observed sends fail in a review window, represented only by notification type/channel and safe provider outcome category. Do not infer this signal if delivery tracking is absent. |
| Unsafe private-data/log exposure | **Alert immediately / stop condition** | Credible exposure of prohibited private data, secrets, tokens, private links, or unsafe logs; alert must state only `privacy_exposure_suspected`, never the exposed value. |
| Abuse/rate-limit spike | **Daily review first** | Review aggregate safe `abuse.rate_limited` / `abuse.limiter_degraded` counts and categories. Escalate immediately only when service-impacting, likely broad abuse, a limiter degradation affects protected routes, or an associated health/5xx/auth signal occurs. |
| Frontend runtime/cache symptom | **Daily review first** | Browser-local redacted diagnostic or support report; investigate urgently only if tied to authoritative-write integrity, privacy, or broad availability. |

Daily review should cover isolated notification failures, limited auth/rate-limit patterns, frontend diagnostics, and new low-volume error fingerprints. Weekly review should cover thresholds, false positives, routing access, evidence retention, and recurring patterns. These review categories are not silent dismissal: promote a pattern to immediate action when it becomes broad, safety-relevant, or service-impacting.

## Alert message contract

Every alert must be concise, redacted, and include only approved fields:

```text
environment: staging
service: [safe service label]
signal: [allowlisted event/signal name]
severity: [immediate / urgent investigation]
window: [safe timestamp or aggregate window]
release_or_build: [non-secret release/build identifier if available]
route_or_category: [safe route name or category, if relevant]
count_or_outcome: [aggregate count or safe outcome class]
correlation_or_request_id: [only an already-approved safe identifier, if available]
required_action: [triage / stop affected workflow / investigate]
```

Alerts must never contain raw logs, event bodies, stack traces, request/response bodies, or copied platform-console output. They must never contain passwords, password hashes, JWTs, authorization headers, manage tokens or hashes, private links, raw IPs, customer names/contact information, appointment details, raw request bodies, full URLs/query strings/fragments, provider credentials, service-role keys, secrets, or screenshots containing private data.

Use allowlisted route names, low-cardinality categories, aggregate counts, release/build IDs, and approved correlation/request IDs only. Do not encode private data into an alert title, label, fingerprint, URL, or identifier. If an unsafe value appears in a candidate alert, do not route it; stop, restrict access, and follow the privacy/incident path.

## Safe rehearsal plan

**P0-F2a result boundary:** the staging failure-notification configuration and tabletop health/readiness path were reviewed without inducing a failure. No safe built-in test notification was observed and no actual delivered alert was verified. Follow this runbook for the remaining delivered-alert rehearsal; do not treat the tabletop result as delivery evidence.

### Preconditions

1. The alert owner, backup-owner status, approved private staging destination type, and staging operator are recorded in restricted operational evidence.
2. The operator confirms the service/environment is staging and that the selected platform action cannot affect production or customers.
3. Select one existing safe, non-customer signal. Preferred first rehearsal: a platform-native **synthetic health/readiness alert test or simulation** that uses only a staging service label, timestamp, and safe health outcome. If the platform cannot safely simulate it, stop and use a documented non-delivery rehearsal/tabletop; do not induce an outage.
4. Confirm that no private logs, raw request data, customer data, private links, tokens, credentials, screenshots, or test artifacts will be collected.

### Procedure

1. Configure or invoke the approved staging-only platform-native test/simulation only after separate authorization. Do not configure production routing.
2. Produce or simulate the selected safe signal without a customer request, booking, message, or account action.
3. Verify the alert reaches the alert owner’s approved private destination.
4. Verify the content matches the alert message contract and contains only safe fields.
5. Have the owner acknowledge it, record the safe receipt/acknowledgement times, and take the stated action: confirm staging identity, inspect only allowlisted evidence, and classify/close the synthetic event.
6. Record the result as the redacted checklist below. Do not retain screenshots, raw logs, traces, destination addresses, message copies containing unsafe fields, or customer data.
7. Remove/disable any temporary staging test condition under the approved platform procedure and confirm no real customer notification, provider send, application write, or production change occurred.

### Rehearsal evidence checklist

```text
Date/time and timezone:
Environment confirmed: staging only
Service label (safe):
Selected safe signal/simulation:
Alert owner acknowledged: yes/no
Backup owner status: named / explicitly unavailable
Destination type approved and restricted: yes/no
Safe fields checked: environment, service, signal, window, release/build, route/category, count/outcome, approved ID
Prohibited-data check passed: yes/no
Owner acknowledgement time and response duration:
Owner action taken (safe summary):
Production/customer/provider send/app-write impact: none confirmed / stop and escalate
Pass/fail:
Gaps, owner, and due date:
Evidence location/retention (restricted; no private content):
```

## Pass, fail, and stop conditions

**Pass** requires a confirmed staging-only synthetic/simulated signal, delivery to the alert owner, safe-only message fields, a recorded owner acknowledgement/action, no customer or production impact, and the redacted checklist completed.

**Fail** includes an alert that does not route, routes late without an accepted explanation, reaches an unapproved destination, lacks environment/service identity, has an unsafe field, cannot be acknowledged/actioned, or has incomplete restricted evidence. A failed rehearsal is not a production gate pass.

Stop immediately and treat the result as an incident/escalation if environment identity is uncertain; an alert can reach production or a customer; a secret, private link/token, contact, appointment detail, raw IP, raw log/body, or credential appears; any real booking/auth/notification workflow is affected; storage mode is unexpected; or the rehearsal creates a credible service interruption. Preserve only safe evidence and use the existing privacy/support/incident process.

## Follow-up actions

- For a passed rehearsal, document routing owner, acknowledgement target, safe signal coverage, gaps, and the next re-test date in restricted evidence. The result validates only the rehearsed staging path.
- For a failed rehearsal, disable unsafe routing if necessary, correct the smallest approved configuration/process issue, and repeat with a safe synthetic/simulated signal.
- Add further immediate signals only after this first path is stable; prioritize authoritative booking-write mismatch, health/readiness, storage identity, and privacy exposure.
- Keep abuse/rate-limit patterns in daily review unless they meet the escalation conditions above.
- Before broader beta or production, separately approve backup ownership, alert escalation timing, provider/platform access/retention, production-specific thresholds and destinations, dashboard/log access, and a production alert rehearsal. This runbook is not that approval.

## Open decisions

- Alert owner, backup owner, acknowledgement target, and escalation schedule.
- Which existing platform-native staging alert mechanism/destination is approved and whether it can perform a safe simulation.
- Exact staging acknowledgement target and when an unacknowledged alert escalates.
- Safe aggregation queries/filters and retention/access rules for the restricted evidence.
- Production alert provider/platform choice, dashboard access, thresholds, destinations, and rehearsal; all remain outside this staging-only runbook.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** Frontend diagnostics remain browser-local; no Netlify configuration is authorized for the first backend alert rehearsal. |
| Render required? | **No for this documentation package.** A later separately authorized staging rehearsal is expected to use existing Render/platform-native backend alert capability. |
| Supabase migration required? | **No.** No schema or database change is part of alert routing/rehearsal planning. |

## Related records

- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production observability minimum](PRODUCTION_OBSERVABILITY_MINIMUM.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
- [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Notification reliability decision](NOTIFICATION_RELIABILITY_DECISION.md)
