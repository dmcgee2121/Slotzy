# Shared limiter code-readiness checklist — P0-F5e

**Status:** Docs-only readiness checklist. No implementation or production approval is authorized.

The [P0-F5i policy approval gate](PRODUCTION_SHARED_LIMITER_POLICY_APPROVAL_GATE.md) permits consideration only of a tiny local constants-alignment slice for the five existing enforced categories. It does not unblock provider implementation or any runtime-policy change.

The [P0-F5k provider selection gate](PRODUCTION_SHARED_LIMITER_PROVIDER_SELECTION_GATE.md) records the evidence required for provider selection and setup. Render Key Value / Valkey is now selected for the staging path only; setup and implementation remain blocked.

The [P0-F5m provider decision record](PRODUCTION_SHARED_LIMITER_PROVIDER_DECISION_RECORD.md) selects Render Key Value / Valkey for the staging path only. Full code implementation remains blocked pending the required setup checklist and other prerequisites.

## Current completed prerequisites

- Accepted staging source-boundary diagnostic evidence for `direct-socket-current` behavior.
- Shared limiter decision gate created.
- Provider/store options reviewed.
- Managed Redis-compatible store category recommended for future staging only.
- Staging implementation design spec created; providerless local adapter foundation completed and staging-smoked.
- Endpoint failure-mode policy created.
- Route-to-category map created.

## Readiness checklist

| Readiness item | Status | Evidence document | Notes |
| --- | --- | --- | --- |
| Source-boundary evidence | Complete | [Accepted diagnostic result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ACCEPTED_RESULT.md) | Direct-socket behavior only; forwarded headers remain untrusted. |
| Provider/store category | Complete | [Options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md) | Redis-compatible category recommended for future staging only. |
| Staging provider path | Complete, staging only | [Provider decision record](PRODUCTION_SHARED_LIMITER_PROVIDER_DECISION_RECORD.md) | Render Key Value / Valkey selected; no account, plan, access, setup, or implementation approval. |
| Limiter-store abstraction design | Complete | [P0-F5g foundation result](PRODUCTION_SHARED_LIMITER_LOCAL_ADAPTER_FOUNDATION_RESULT.md) | Providerless local adapter foundation is complete; full shared-provider integration remains blocked. |
| Privacy-safe key design | Open review | [Implementation spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md) | Concept is defined; HMAC ownership/rotation remains unresolved. |
| HMAC/key ownership and rotation plan | Blocked | [Decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md) | Needs owner, access boundary, and rotation procedure. |
| Route-to-category mapping | Complete | [Route map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md) | Several routes still require final implementation choices. |
| Endpoint failure-mode policy | Complete | [Failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md) | Direction is documented; booking/staff/read decisions remain open. |
| Exact route constants/category names | Open review | [Route map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md) | Must be settled before code. |
| Exact TTL/window values | Blocked | [Rate limits plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md) | Starting bounds exist, but shared-store values need explicit approval. |
| Exact generic response codes/messages | Open review | [Failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md) | Current envelopes guide the work; final store-outage messages are unresolved. |
| Observability event contract | Partially complete | [Observability plan](PRODUCTION_OBSERVABILITY_MINIMUM.md) | Redaction basis exists; shared-store/fallback event fields need final contract. |
| Rollback/disable plan | Partially complete | [Implementation spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md) | Flag rollback direction exists; final operator runbook is pending. |
| Local test plan | Partially complete | [Implementation spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md) | Adapter/fake-store tests specified; final implementation test matrix pending. |
| Staging validation plan | Blocked | [Decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md) | Exact commands, hard stops, window, and evidence plan remain unresolved. |
| Cost/plan review | Blocked | [Options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md) | Requires provider selection; no pricing claims or review performed. |
| Operational ownership/runbook | Blocked | [Production limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md) | Access, incidents, alerts, quotas, rotation, and rollback owner need assignment. |
| Production gate criteria | Partially complete | [Decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md) | Criteria are documented but cannot be accepted before implementation evidence. |

## Go / no-go decision for coding

**No-go for a full shared Redis-compatible implementation.** The design is sufficiently mature to prepare a narrow implementation plan, but code must not start until the provider/vendor placeholder strategy, HMAC/key ownership, TTL/window values, route constants, generic responses, and staging validation plan are settled.

## Smallest safe next package

The [P0-F5f implementation-slice plan](PRODUCTION_SHARED_LIMITER_IMPLEMENTATION_SLICE_PLAN.md) now narrows the first future code slice to an adapter interface, in-memory adapter contract tests, fake shared-store adapter tests, and no external provider, Render, environment, or production work. A narrow local-code slice may be considered only after this plan; full implementation remains blocked.

## Open decisions before code

- [P0-F5h policy constants, TTL/window, and response-envelope draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md) is available for review; its values remain drafts and do not unblock provider implementation.
- Provider/vendor selection or an approved placeholder strategy.
- HMAC secret ownership and rotation.
- TTL/window values by category.
- Exact route-category constants.
- Exact generic response codes/messages.
- Booking-write failure-mode choice.
- Staff-write fallback scope.
- Lower-risk public-read enforcement decision.
- Staging validation commands and hard stops.
- Owner and runbook responsibilities.

## Code guardrails when implementation is eventually approved

- Feature flag disabled by default; in-process adapter remains fallback.
- No route directly imports a provider client.
- Source behavior stays `direct-socket-current`; forwarded headers remain untrusted.
- No raw/private limiter keys in logs, errors, metrics, or test evidence.
- Required tests pass before any Render deployment.
- Hosted validation includes a post-disable public check and guarded staging suite.

## Decision outcome now

Code readiness is **blocked for full implementation** and only narrowly ready for the next docs-only implementation-slice plan. The production shared limiter remains **not approved** and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this readiness review. |
| Supabase migration required? | **No.** |

## Related records

- [Route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md)
- [Failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
- [Staging implementation spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [P0-F5f implementation-slice plan](PRODUCTION_SHARED_LIMITER_IMPLEMENTATION_SLICE_PLAN.md)
- [P0-F5h policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md)
