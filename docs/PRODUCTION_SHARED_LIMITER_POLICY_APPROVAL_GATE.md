# Shared limiter policy approval gate — P0-F5i

**Status:** Docs-only approval gate. It authorizes no backend implementation, runtime behavior change, provider/vendor selection, configuration, or production approval.

## Approval meaning

| Level | Meaning |
| --- | --- |
| **Approved for local code alignment only** | Planning input for a separately authorized, tiny local code slice that preserves current runtime behavior exactly. It is not production-ready or provider approval. |
| **Open review** | A policy or implementation decision still needs an explicit decision before code. |
| **Blocked** | A prerequisite for real provider implementation is absent. |
| **Not approved** | This gate expressly does not authorize the action. |

An approval here does **not** approve production, Render configuration, provider setup, a real shared Redis/provider limiter, or trust in forwarded headers. Current direct-socket source behavior remains unchanged.

## Items approved for future local code alignment only

| Item | Approval level | Reason | Allowed next action | Limits |
| --- | --- | --- | --- | --- |
| `AUTH_LOGIN` → `login` | Approved for local code alignment only | This is an existing enforced category. | Define an alias/constant that maps to `login`; test the mapping. | Keep all current behavior, policy values, response, and source key unchanged. |
| `BOOKING_CREATE` → `booking_create` | Approved for local code alignment only | This is an existing enforced category. | Define an alias/constant that maps to `booking_create`; test the mapping. | No threshold, TTL/window, fallback, route, or response change. |
| `MANAGE_LOOKUP` → `manage_lookup` | Approved for local code alignment only | This is an existing enforced category. | Define an alias/constant that maps to `manage_lookup`; test the mapping. | No behavior or keying change. |
| `MANAGE_CANCEL` → `manage_cancel` | Approved for local code alignment only | This is an existing enforced category. | Define an alias/constant that maps to `manage_cancel`; test the mapping. | No behavior or keying change. |
| `MANAGE_RECOVERY` → `manage_recovery` | Approved for local code alignment only | This is an existing enforced category. | Define an alias/constant that maps to `manage_recovery`; test the mapping. | No behavior or keying change. |
| `HEALTH_EXCLUDED` exclusion concept | Approved for local code alignment only | Health is already outside limiter enforcement intent. | Optionally centralize a non-enforced exclusion name. | Do not add enforcement, health behavior, or dependency checks. |
| Direct-socket-current source behavior | Approved for local code alignment only | It is the accepted current staging boundary. | Preserve and regression-test the existing source selection. | Do not trust or consume forwarded headers. |
| No raw/private values in limiter logs, errors, metrics, or test evidence | Approved for local code alignment only | It matches existing privacy constraints. | Preserve redaction assertions/documentation. | Never add raw IPs, headers, tokens, JWTs, contacts, credentials, or provider secrets. |

## Items still open review

| Item | Status | Why it remains open | What must be decided before code |
| --- | --- | --- | --- |
| `AUTH_PASSWORD_CHANGE` enforcement | Open review | Not currently enforced. | Route scope, key basis, threshold, outage behavior, and generic response. |
| `AUTH_REGISTER` enforcement | Open review | Not currently enforced. | Public availability, onboarding impact, key basis, threshold, and outage behavior. |
| `CUSTOMER_BOOKING_MODIFY` enforcement | Open review | Route family and current coverage are unresolved. | Exact routes, identity/key basis, threshold, and failure mode. |
| `STAFF_WRITE` enforcement | Open review | No current category covers this broad family. | Included routes, identity/shop keying, bounds, and fallback scope. |
| `ADMIN_AUTH` enforcement | Open review | Not currently enforced. | Routes, non-enumerating contract, keying, bounds, and failure mode. |
| `ADMIN_DESTRUCTIVE` enforcement | Open review | Route availability and risk scope are unresolved. | Exact actions, authorization boundary, bounds, and fail-closed policy. |
| `INTERNAL_DIAGNOSTIC` limiter need | Open review | Existing access/flag controls may be sufficient. | Need, route scope, concealment, and failure behavior. |
| `PUBLIC_READ` enforcement | Open review | Enforcement value versus availability impact is unresolved. | Whether to enforce, included reads, bounds, and outage behavior. |
| TTL/window values | Open review | P0-F5h values are starting values only. | Per-category limits, windows, key basis, and tuning evidence. |
| Generic response envelopes | Open review | Draft codes/messages could alter user-facing contracts. | Exact route-safe statuses, stable codes, wording, and non-disclosure behavior. |
| Bounded fallback rules | Open review | No bounds or route eligibility are approved. | Eligibility, capacity, TTL/window, events, reset/fragmentation tests, and stop conditions. |
| Booking-write fail-closed vs bounded fallback | Open review | Abuse cost and availability tradeoff is unresolved. | Final route-risk decision and tested behavior. |
| Staff-write fallback scope | Open review | Authentication does not determine safe fallback alone. | Explicit eligible routes and tested conservative bounds. |
| Admin destructive policy | Open review | Destructive routes require a separate risk decision. | Route inventory and fail-closed/unavailable contract. |
| Public-read enforcement | Open review | The category may not need enforcement. | Benefit, route inventory, and fail-open/fallback decision. |
| Staging validation commands and hard stops | Open review | Provider validation has no approved execution window. | Redacted commands, authority, duration, metrics, rollback, and hard stops. |

## Items blocked before real provider implementation

- Provider/vendor selection.
- Provider account, access, and cost review.
- HMAC secret ownership and rotation procedure.
- Real shared-adapter implementation.
- Provider environment variables and secrets.
- Provider failure-mode evidence.
- Hosted staging validation window.
- Operational runbook ownership.
- Production acceptance evidence.

## Explicitly not approved

- A real Redis, KV, or database provider client.
- Any external dependency addition.
- Render provider environment-variable setup.
- Trusting forwarded headers.
- Changing current source-boundary behavior.
- Changing user-facing limiter responses from this draft alone.
- Changing current runtime TTL/window policy from this draft alone.
- Production shared-limiter approval.
- Production launch approval.

## Future tiny code slice allowed by this gate

If separately authorized, the next slice may align code constants for the five existing enforced categories only, preserving their current string values and backward behavior. It may optionally centralize health-exclusion naming as a non-enforced constant and add tests proving the mappings.

It must not change policies, thresholds, TTLs, responses, routes, source-key behavior, provider logic, environment variables, or dependencies.

## Required tests for any next tiny code slice

- Current rate-limiter tests still pass.
- API limiter regression tests still pass.
- Constants-mapping tests pass.
- Assertions demonstrate no behavior change.
- `git diff --check` passes.
- Run a guarded staging suite only if committed/deployed backend runtime source changes.

## PM recommendation

Approve only consideration of a separately authorized tiny constants-alignment code slice. Do not approve TTL/window changes, response-envelope changes, provider work, or production.

## Decision outcome now

The policy approval gate is documented. The allowed tiny alignment was completed in the [P0-F5j constants-alignment result](PRODUCTION_SHARED_LIMITER_CONSTANTS_ALIGNMENT_RESULT.md) without a behavior change. The full shared provider limiter remains blocked, the production shared limiter remains **not approved**, and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No.** |
| Supabase migration required? | **No.** |

## Related records

- [Policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md)
- [Code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [Implementation-slice plan](PRODUCTION_SHARED_LIMITER_IMPLEMENTATION_SLICE_PLAN.md)
- [P0-F5j constants-alignment result](PRODUCTION_SHARED_LIMITER_CONSTANTS_ALIGNMENT_RESULT.md)
- [Production shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
