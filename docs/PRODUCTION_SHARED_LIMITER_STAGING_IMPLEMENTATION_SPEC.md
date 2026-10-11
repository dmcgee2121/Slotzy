# Shared limiter staging implementation design spec — P0-F5b

**Status:** Docs-only design spec. No implementation, provider/vendor selection, configuration, or production approval is authorized.

## Scope

This design describes a future **staging-only** shared-limiter implementation using a managed Redis-compatible store category. Provider-specific details are intentionally deferred. The existing in-process limiter remains the current and rollback behavior; this spec does not alter it.

## Non-negotiable constraints

- `direct-socket-current` remains the approved source behavior; forwarded headers remain untrusted.
- Never use raw IPs, headers, tokens, JWTs, emails, names, phone numbers, booking details, or customer data as limiter keys.
- Persisted/shared identifiers must use privacy-preserving keyed/HMAC or equivalent opaque derivation, TTL expiry, and no indefinite retention.
- Logs and events remain redacted and category-only.
- The shared path requires a feature/environment flag and rollback must restore in-process behavior.

## Proposed architecture

Introduce a limiter-store abstraction with a small adapter contract for an atomic increment/check with expiry and a bounded failure result. Keep the current in-process limiter as one adapter; add a future Redis-compatible adapter behind approved flag/config selection. Route/category policy remains independent of the store adapter, and source-key derivation remains independent of both. No endpoint may call a provider client directly.

This separation permits local adapter tests, a fake shared-store implementation, and a flag-based return to the current in-process adapter without changing route policy or source-boundary behavior.

The [P0-F5d route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md) is the planning input for route policy wiring; unresolved entries require implementation review before code.

## Environment and configuration design

These are proposed names only; no variables are created or configured by this document.

| Setting | Proposed safe default / purpose |
| --- | --- |
| `SLOTZY_LIMITER_STORE` | `in_memory`; future values: `in_memory` or `shared_redis` |
| `SLOTZY_SHARED_LIMITER_ENABLED` | `false`; separate explicit enablement guard |
| Provider connection placeholders | `SLOTZY_SHARED_LIMITER_URL` and `SLOTZY_SHARED_LIMITER_TOKEN`; names only, never values in docs/logs/tests |
| Key version placeholder | `SLOTZY_LIMITER_KEY_VERSION`; used only under a future approved rotation design |

Staging remains safe/off until separately approved. Production enablement is blocked regardless of these proposed names.

## Privacy-safe key design

A conceptual shared key contains an environment, route/action category, privacy-safe source identifier, and optional authenticated account category when policy requires it. Persisted source identifiers must be generated through keyed/HMAC derivation from the approved direct socket source, with a version prefix for future rotation. Keys, raw source values, input identifiers, and derived digests must never appear in key names exposed to users, logs, errors, metrics, or diagnostic output.

## Endpoint and failure-mode policy

Keep the existing endpoint categories and generic response contracts. The existing [production limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md) proposes stricter handling for auth, recovery, and sensitive unauthenticated writes, while lower-risk reads may use different availability behavior. This spec does not finalize a new policy: before code, approve the exact per-endpoint store-outage behavior, local-fallback bounds, and generic response envelopes.

The [P0-F5c failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md) documents the proposed category direction and its remaining open decisions. Implementation remains blocked.

Open policy decisions include whether any category can fail open, which categories use a bounded in-process fallback, and how to distinguish a store failure from an ordinary rate-limit decision without exposing provider detail.

## Observability

Permit category-level events only: limiter store type, endpoint category, decision category, failure category, and rollback/flag state. Do not emit raw keys, source values, tokens, payloads, customer details, provider URLs, or provider secrets. Existing redaction and allowlist rules continue to apply.

## Testing requirements before implementation acceptance

- Local unit tests for the limiter-store adapter contract.
- Fake shared-store tests for atomic increment/window/TTL semantics.
- Key-privacy tests proving no raw or private value is emitted.
- Endpoint tests for auth/login limiting and generic non-enumerating responses.
- Per-endpoint failure-mode and bounded-fallback tests.
- Flag disable/rollback tests returning to in-process behavior.
- Controlled staging smoke followed by the guarded staging suite.

## Rollout and rollback plan

Implement disabled by default, deploy to staging only, and enable only in a separately approved controlled validation window. Record safe category evidence, disable immediately after validation or a hard stop, then run public and guarded post-disable checks. A flag/config rollback must restore the current in-process behavior. Production enablement requires a separate gate update and approval.

## Open decisions before code

- Provider/vendor selection and plan/cost review.
- Final endpoint-specific failure-mode behavior and fallback bounds.
- HMAC secret ownership and rotation procedure.
- TTL and window values.
- Operational ownership, alerting, and runbook responsibilities.
- Production gate acceptance criteria after staging implementation evidence.

## Decision outcome now

The staging implementation design direction is documented, but implementation remains blocked pending the open decisions. The production shared limiter remains **not approved** and production launch remains **no-go**.

The [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md) concludes that a full implementation is not yet ready to start.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this design; later staging implementation would require Render. |
| Supabase migration required? | **No.** |

## Related records

- [Shared limiter options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md)
- [P0-F5c endpoint failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
- [P0-F5d route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md)
- [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
