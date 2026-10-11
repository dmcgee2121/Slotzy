# Production observability minimum plan

**Scope:** documentation and event taxonomy only. No logging, monitoring SDK, alert provider, database change, or production configuration is authorized by this plan.

**Current position:** Slotzy is staging-ready for solo-founder QA and **not production-ready**. This plan does not imply external-tester validation or approve payments.

## Minimum signal set

| Signal | Why it matters | Log or count (safe minimum) | Never log | Suggested alert threshold | First implementation idea |
| --- | --- | --- | --- | --- | --- |
| API health | Detects an unavailable API before users encounter broad failure. | Health/readiness result, timestamp, deployment/version, storage mode, dependency status, correlation ID. | Secrets, connection strings, customer data, raw requests. | **Staging:** 2 consecutive failed checks. **Wider beta:** any 2 failures in 5 min. **Production:** any 2 failures in 2 min. | Add a safe health/readiness event and platform uptime check. |
| API 5xx rate | Measures server failures that may affect every workflow. | Route name, method, status, duration bucket, error class/code, correlation ID, release version. | Stack values containing data, raw body, credentials/tokens, full query strings. | **Staging:** investigate 3 in 15 min. **Wider beta:** alert at 3% or 5 in 10 min. **Production:** page at 2% or 10 in 5 min. | Emit one structured completion/error event per request. |
| Auth/login and revoked-session failures | Finds broken sign-in, token validation regressions, or session-revocation effects without exposing credentials. | Event type (`login_failed`, `login_succeeded`, `session_revoked`, `token_invalid`), outcome code, route, redacted account reference, correlation ID. | Passwords, hashes, JWTs, `jti` values, authorization headers, email/phone. | **Staging:** investigate 5 unexpected failures in 15 min. **Wider beta:** alert on 10 failures/15 min or 3 revoked-session failures after a release. **Production:** alert on 20/15 min or a sustained 5x baseline. | Classify expected versus unexpected auth failure reasons with a stable safe error code. |
| Booking creation failures | Booking is core product value; failures must be visible separately from general API errors. | Attempt/outcome, route, safe validation/error class, shop/provider opaque reference, correlation ID, version. | Customer name/contact, appointment details, manage token, raw payload. | **Staging:** immediate investigate any authoritative failure. **Wider beta:** alert at 2 in 15 min. **Production:** alert at 3 in 10 min or >1% of attempts. | Emit a `booking_create` event at authoritative outcome only. |
| Booking persistence/authoritative-save failures | A receipt or UI success without durable save is an immediate integrity incident. | Authoritative-write attempted/succeeded/failed, storage mode, transaction/result class, correlation ID, opaque booking/shop reference after success. | Full booking record, contacts, tokens, raw database errors. | **All phases:** immediate stop condition on any confirmed mismatch or failed authoritative save after user-facing success. | Instrument the authoritative mutation boundary; use a distinct integrity event. |
| Cancellation/reschedule failures | Prevents customers and staff relying on an action that did not persist. | Action, authoritative outcome, status/error class, correlation ID, opaque booking reference. | Manage links/tokens, customer contact, full appointment data. | **Staging:** immediate investigate any persistence mismatch. **Wider beta:** alert at 2/15 min. **Production:** alert at 3/10 min or >1% of actions. | Emit outcome events after persistence, including token-scoped route type only. |
| Notification send failures | Missing/duplicate booking communication creates support load and mistrust. | Notification type/channel, provider outcome category, retry count, opaque booking/event reference, correlation ID. | Recipient address/phone, message body, provider credentials, private links. | **Staging:** daily review; immediate if all sends fail. **Wider beta:** alert at 3/30 min. **Production:** alert at 5/15 min or >2% failure. | Record safe post-send outcome events; do not log message payloads. |
| Frontend deploy/version visibility | Connects incidents to the frontend release users actually received. | Build/version identifier, deploy time, environment, asset/cache version, API base origin class. | Build-time secrets, full URLs with private parameters, user data. | **Staging:** verify on every deploy. **Wider beta:** alert on unknown/mismatched version. **Production:** alert if release metadata is absent or rollback target unavailable. | Expose a non-secret build identifier in a diagnostic/version surface. |
| Frontend runtime errors | Detects browser-side breakage that API metrics miss. | Error category/fingerprint, route name, browser family/version bucket, app version, correlation ID when available. | Raw user-entered values, full URL fragments/query, tokens, contacts, stack data containing private fields. | **Staging:** investigate any new fingerprint after deploy. **Wider beta:** alert at 3 matching errors/15 min. **Production:** alert at 10/10 min or a new high-volume fingerprint. | Add a redacted client error boundary/reporter after taxonomy review. |
| Stale PWA/cache symptoms | Stale assets can make fixed flows appear broken or mix incompatible versions. | Cache/app version, service-worker lifecycle state, safe mismatch/error category, route name. | URL fragments, tokens, private navigation targets, local storage contents. | **Staging:** investigate any confirmed stale-version symptom. **Wider beta:** daily review and alert at 2 reports/24 h. **Production:** alert at 3/30 min after deployment. | Define cache-version events and a support triage checklist before changing service-worker behavior. |
| Database connectivity/storage mode | Detects loss of persistence or an unsafe environment/storage-mode mismatch. | Storage mode, connection/readiness result, timeout/error category, migration/schema version only if non-sensitive, correlation ID. | Database URLs, service-role keys, SQL containing customer data, raw driver errors. | **Staging:** immediate stop on unexpected mode or failed connectivity. **Wider beta:** alert on any mode mismatch or 2 failures/5 min. **Production:** immediate page on any mode mismatch or connectivity failure. | Include storage mode and dependency state in the safe readiness event. |
| Suspicious abuse/rate-limit signals (later) | Identifies brute force, enumeration, spam, and resource exhaustion once rate limits exist. | Route, limit outcome, coarse source/network bucket or privacy-reviewed hash, safe account/shop reference, correlation ID. | Raw IP unless policy approves it, credentials, tokens, customer contact, raw payload. | **Staging:** daily review. **Wider beta:** alert on sustained limit hits (for example 20/10 min per route). **Production:** tune to baseline; page only for service-impacting attack patterns. | Add after P0-B2 route-specific rate-limit design; do not collect extra identifiers first. |

Thresholds are starting points, not service-level objectives. Set production baselines from a controlled beta, then adjust with an explicit owner and dated decision record.

## Redaction rules

Never log passwords, password hashes, JWTs, `jti` values, reset tokens, manage tokens, private links, service-role keys, customer private data, raw request bodies, or full email/phone values. Do not place these values in error messages, query strings, log labels, alert titles, screenshots, traces, or support tickets.

Prefer opaque IDs or approved redacted account/shop references, event types, status codes, route names, correlation IDs, release versions, duration buckets, and safe error classes. Treat URL fragments as sensitive because manage credentials may appear there. Logs must use allowlisted fields; redaction after arbitrary raw capture is not sufficient.

## Alert ownership and response

During solo-founder QA, the founder is the single alert recipient and incident owner. Alerts must identify the environment, signal, release/version, time window, and safe correlation IDs—not private user data.

| Response level | Conditions | Action |
| --- | --- | --- |
| Immediate stop condition | Confirmed authoritative-save mismatch; unexpected storage-mode change; health outage; private-data/secret exposure; wrong booking access; broad authentication failure. | Stop affected workflow, freeze writes where applicable, preserve only safe evidence, assess rollback/restore, and document the incident. |
| Urgent same-session investigation | New post-deploy frontend error fingerprint, elevated 5xx, repeated booking/cancel/reschedule failure, all notifications failing, or suspected abuse affecting service. | Halt rollout, compare release/version, run guarded safe checks, and roll back if the release is implicated. |
| Daily review | Isolated notification failure, limited auth failures, individual runtime-error fingerprints, cache reports, and rate-limit signals once available. | Review trends and safe samples; create a bounded follow-up if repeated. |
| Weekly review | Threshold tuning, dashboard quality, retention/access review, and recurring low-severity patterns. | Record adjustments, owners, and due dates. |

Trigger rollback or a write freeze when a new release is plausibly tied to an integrity failure, authentication outage, unavailable API, sustained elevated 5xx, or unsafe data exposure. Prefer a forward fix over rollback only when compatibility and booking-data integrity are demonstrably preserved; otherwise freeze writes and use the incident/restore path.

## Rollout phases

1. **Phase 1 — docs and event taxonomy:** approve safe event names, allowlisted fields, error classes, correlation-ID handling, thresholds, and ownership. This document completes only this phase.
2. **Phase 2 — backend structured safe events:** implement allowlisted server events for API, auth, authoritative booking mutations, notification outcomes, health, and storage mode; add focused tests that prove sensitive values are absent.
3. **Phase 3 — frontend error and deploy visibility:** add non-secret version visibility plus redacted client runtime/cache events and test release identification.
4. **Phase 4 — external alert provider or platform-native alerts:** choose configured platform-native alerts or a provider, set recipients/escalation, and rehearse at least one alert without customer data.
5. **Phase 5 — production dashboards:** create role-limited dashboards for health, failures, integrity, auth, notifications, versions, and alert history; document retention and access review.

## Next implementation package

The next implementation package should be **P0-B1a: backend structured safe observability events**. Keep it constrained to event taxonomy, allowlisted server fields, correlation IDs, health/storage-mode events, authoritative mutation outcomes, and tests that ensure redaction. It must not add customer analytics, raw-body capture, or a monitoring SDK until the alert destination decision is separately approved.

## Platform implications

Render will be required for API runtime logs, health checks, runtime configuration, and eventual alert routing. Netlify will be required for frontend deploy/version visibility and frontend error rollout. No Supabase migration is required for this plan or P0-B1a; database readiness may be observed through the application without changing schema.
