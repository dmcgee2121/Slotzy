# Production shared limiter decision gate — P0-F5

**Status:** Docs-only decision gate. No shared limiter is implemented, no runtime behavior changes, and no production or launch approval is granted.

## Current accepted facts

- The in-process, direct-socket limiter is acceptable only for controlled staging and solo-founder QA.
- Accepted staging diagnostic evidence confirms current `direct-socket-current` behavior; it does not approve forwarded-source trust.
- Forwarded headers remain untrusted, and a future shared limiter must not silently change that source decision.
- The current limiter behavior remains unchanged.

## Production risk statement

The in-process limiter is not sufficient if the API restarts, scales horizontally, runs multiple instances, or receives traffic distributed across processes. Counters can reset on restart/deploy and enforcement can fragment by instance, allowing an abuse budget to be effectively multiplied across processes. This is a normal limitation of process-local state, not evidence of a current staging failure.

## Provider/store options to evaluate

No option is selected by this gate.

The [P0-F5a options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md) recommends a managed Redis-compatible store category for a future staging implementation package only. It does not select a vendor or approve production use.

The [P0-F5b staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md) defines a disabled-by-default staging adapter and rollback approach only; production approval remains blocked.

The [P0-F5c endpoint failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md) documents the future staging outage-direction by endpoint category; production approval remains blocked.

| Category | Evaluation criteria |
| --- | --- |
| Managed Redis-compatible store | Reliability, latency, TTL support, atomic increment/expiry, observability, cost, operational ownership, privacy posture, rollback simplicity |
| Managed key-value or edge-rate-limit provider | Reliability, latency, rule/key expressiveness, TTL/atomic behavior, provider observability and retention, cost, ownership, privacy, rollback simplicity |
| Database-backed limiter | Atomicity and TTL/cleanup behavior, contention with booking data, reliability, latency, observability, cost, ownership, privacy, migration burden, rollback simplicity |
| Temporary in-process scope restriction | Explicit single-instance/staging-only boundary, restart risk, observability, operational ownership, and prohibition on treating it as production enforcement |

## Privacy and source-boundary constraints

Never use raw IPs, raw headers, JWTs, tokens, emails, customer names, phone numbers, or booking details as externally persisted limiter keys. A selected shared design must use privacy-preserving keyed/HMAC or equivalent identifiers, clear TTLs, no indefinite retention, and category-only/redacted events and logs.

Forwarded headers remain untrusted unless a separate trusted-proxy design is approved. Current evidence supports direct-socket-current behavior only. A shared limiter must retain that source decision unless separate accepted evidence and an explicit design decision authorize a change.

## Failure-mode decision required before implementation

Production must explicitly confirm fail-open, fail-closed, or endpoint-specific behavior before implementation. Existing [production limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md) proposes endpoint-specific handling: stricter failure behavior for auth, recovery, and other sensitive or unauthenticated write paths; safer availability behavior for lower-risk reads. This gate does not newly approve those policies; the selected implementation must document and test its exact behavior.

## Rollout and rollback requirements

1. Implement in staging first behind a dedicated feature/environment flag.
2. Add privacy-safe observability and an approved load/abuse smoke plan.
3. Document an immediate rollback/disable path with owner authority.
4. Run the guarded staging suite after disablement or rollback.
5. Require an explicit production gate approval before enabling production enforcement.

## Acceptance criteria before production approval

- Local tests cover shared-store limiter behavior, atomic window/TTL semantics, and route/key isolation.
- Staging tests cover auth/login limiting and generic non-enumerating responses.
- Staging evidence confirms no raw or private limiter key disclosure.
- Restart/process-boundary behavior is covered where the selected topology permits it.
- The selected failure-mode smoke, rollback, and post-rollback validation pass.
- Privacy, retention, operational ownership, observability, and runbook documentation are updated.
- The production gate is explicitly updated after accepted evidence; this document alone is insufficient.

## Decision outcome now

The production shared limiter is **not approved**. Implementation remains blocked pending provider/store selection, confirmed failure-mode policy, privacy/retention and operational ownership approval, rollout/rollback planning, and acceptance evidence. Production launch remains **no-go** for this item.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No** for this decision gate. Edge controls are only an option to evaluate later. |
| Render required? | **No** for this document. Later staging implementation/topology validation would require Render. |
| Supabase migration required? | **No.** A database-backed fallback would require a separately approved design and migration. |

## Related records

- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [P0-F5a provider/store options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md)
- [P0-F5b staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [P0-F5c endpoint failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Accepted staging source-boundary evidence](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ACCEPTED_RESULT.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md)
