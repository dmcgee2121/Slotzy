# Shared limiter endpoint failure-mode policy — P0-F5c

**Status:** Docs-only policy for a future staging shared limiter. No implementation, current-limiter change, production approval, or launch approval is authorized.

## Policy scope

This policy applies to shared-store outage and error behavior in a future staging implementation. It does not change the current in-process limiter or approve production. It retains the accepted `direct-socket-current` source behavior; forwarded headers remain untrusted.

The [P0-F5d route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md) applies these policy families to current source routes and marks unresolved enforcement choices as open review. Implementation remains blocked.

## Endpoint categories and proposed behavior

| Endpoint category | Normal limiter behavior when store is available | Shared-store failure behavior | User-facing response style | Allowed observability category | Rationale |
| --- | --- | --- | --- | --- | --- |
| Auth/login and password change | Enforce configured category limit and generic `429` when exceeded. | Fail safely/closed, or use only a separately tested, very tightly bounded in-process fallback. | Generic rate-limited or temporary-unavailable response; never reveal account state. | `auth`, store type, decision/failure/fallback category, request ID | Resists credential attacks and password-hash exhaustion. |
| Account and manage-link recovery | Enforce configured recovery limit with non-enumerating responses. | Fail safely/closed, or tightly bounded tested fallback. | Generic recovery/temporary-unavailable outcome regardless of account/contact/token state. | `recovery`, store type, decision/failure/fallback category, request ID | Limits enumeration and notification amplification. |
| Diagnostic/internal endpoints | Keep access controls and normal category limit. | Fail closed/unavailable; no fallback that broadens diagnostic access. | Generic unavailable/not-found style consistent with route policy. | `internal_diagnostic`, store type, failure category, request ID | Diagnostic surfaces must not become a bypass or availability disclosure. |
| Sensitive unauthenticated writes | Enforce configured category limit. | Fail safely/closed, or tightly bounded tested fallback. | Generic rate-limited or temporary-unavailable response. | `sensitive_public_write`, store type, decision/failure/fallback category, request ID | Protects writes, storage, and notification paths from abuse. |
| Customer booking creation or modification | Enforce configured category limit. | Open decision: conservative bounded fallback or fail safely based on the final route-risk review. | Generic rate-limited or temporary-unavailable response; no booking/slot validity detail. | `booking_write`, store type, decision/failure/fallback category, request ID | Balances spam/notification risk against legitimate booking availability. |
| Owner/staff authenticated writes | Enforce configured category limit. | A bounded fallback may be acceptable only for explicitly approved lower-abuse routes with known identity. | Generic temporary-unavailable or rate-limited response; no provider detail. | `staff_write`, store type, decision/failure/fallback category, request ID | Authentication reduces some risk but does not eliminate compromised-session or loop risk. |
| Lower-risk public reads | Enforce configured category limit when available. | Fail open or use a bounded fallback after explicit route approval. | Normal read response if allowed; generic `429` only for an actual applied limit. | `public_read`, store type, decision/failure/fallback category, request ID | Avoids turning non-sensitive availability reads into an outage solely through limiter dependency loss. |
| Health checks | Do not make ordinary health availability depend on the limiter store. | Fail open for health response; report dependency state separately only through safe observability. | Normal minimal health response under the health contract. | `health`, dependency/failure category, request ID | Prevents limiter dependency failure from creating false platform restart/outage behavior. |

## Generic response constraints

An applied limit returns a generic `429`. A fail-closed store outage uses a generic temporary-unavailable or rate-limited envelope appropriate to the route. Responses must not disclose provider details, limiter keys, raw sources, account existence, token validity, booking state, internal topology, or fallback choice.

## Observability constraints

Allowed fields are endpoint category, limiter store type, decision category, failure category, fallback category, and request ID. Never emit raw keys, IPs, headers, tokens, JWTs, emails, names, phone numbers, booking details, provider URLs, or provider secrets.

## Bounded fallback constraints

Where a bounded in-process fallback is approved, it must use a short TTL/window, conservative limits, a clear safe fallback event category, and explicit tests. It remains process-local: restarts reset it and multiple processes fragment it. Its existence is not production approval or a substitute for shared enforcement.

## Tests required before implementation acceptance

- Store-available tests for every mapped category.
- Store-unavailable tests for each category, including fallback or fail-closed behavior.
- Generic response and non-enumeration tests.
- Tests proving no raw/private data is emitted.
- Tests/documentation covering fallback reset and fragmentation limits.
- Flag rollback/disable tests, controlled staging smoke, and post-window guarded suite.

## Open decisions before code

- Exact endpoint-to-category route mapping.
- Exact status codes and generic message codes.
- Exact fallback limits and windows.
- Booking-write choice: fail closed or bounded fallback.
- Owner/staff write fallback scope.
- Dependency-health visibility contract.
- Final production-gate acceptance criteria.

## Decision outcome now

Failure-mode direction is documented for a future staging implementation. Implementation remains blocked pending the open decisions and provider selection. The production shared limiter remains **not approved**, and production launch remains **no-go**.

The [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md) records this policy's unresolved prerequisites before code.

The [P0-F5h policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md) provides draft category names and response envelopes; unresolved failure decisions remain open.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this policy; later staging implementation would require Render. |
| Supabase migration required? | **No.** |

## Related records

- [Staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [P0-F5d route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md)
- [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [P0-F5h policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md)
- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
