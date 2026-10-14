# Shared limiter policy constants and TTL/window decision draft — P0-F5h

**Status:** Docs-only policy-constants, TTL/window, and response-envelope draft. No backend implementation, provider/vendor selection, or production approval is authorized. See the [P0-F5i policy approval gate](PRODUCTION_SHARED_LIMITER_POLICY_APPROVAL_GATE.md): draft values are not final unless that gate explicitly approves them, and gate approval is limited to its stated scope.

## Current enforced categories

Only these categories are currently enforced by `server/src/rateLimiter.js` and covered by the existing limiter tests.

| Current category | Purpose | Current behavior source | Safe to carry forward? |
| --- | --- | --- |
| `login` | Public authentication login | `STAGING_POLICIES` / `TEST_POLICIES`; API regression tests | Yes, subject to shared-store design review |
| `booking_create` | Public/optional-auth booking creation | `STAGING_POLICIES` / `TEST_POLICIES`; API regression tests | Yes, with final outage-policy decision |
| `manage_lookup` | Public manage-token lookup | `STAGING_POLICIES` / `TEST_POLICIES`; API regression tests | Yes |
| `manage_cancel` | Public manage-token cancellation | `STAGING_POLICIES` / `TEST_POLICIES`; API regression tests | Yes |
| `manage_recovery` | Public manage-link recovery | `STAGING_POLICIES` / `TEST_POLICIES`; API regression tests | Yes |

## Proposed future category constants

All entries below are drafts. “Not enforced” and “open review” entries must not be added to runtime policy without separate approval.

| Proposed constant | Route family | Current status | Proposed failure-mode family | Notes / open questions |
| --- | --- | --- | --- | --- |
| `AUTH_LOGIN` | Login | Enforced | Fail safely/closed | Maps current `login`. |
| `AUTH_PASSWORD_CHANGE` | Password change | Not enforced | Fail safely/closed | Exact key basis and response pending. |
| `AUTH_REGISTER` | Registration | Not enforced | Fail safely/closed | Confirm public availability and onboarding impact. |
| `MANAGE_LOOKUP` | Public manage lookup | Enforced | Fail safely/closed | Maps current `manage_lookup`. |
| `MANAGE_CANCEL` | Public manage cancellation | Enforced | Fail safely/closed | Maps current `manage_cancel`. |
| `MANAGE_RECOVERY` | Public manage recovery | Enforced | Fail safely/closed | Maps current `manage_recovery`. |
| `BOOKING_CREATE` | Booking creation | Enforced | Open review: bounded fallback or fail safely/closed | Maps current `booking_create`; distinguish optional-auth use. |
| `CUSTOMER_BOOKING_MODIFY` | Customer booking modification | Not enforced / open review | Open review | Confirm actual public/customer route scope. |
| `STAFF_WRITE` | Authenticated shop, service, availability, booking writes | Not enforced | Bounded fallback / open review | Define which writes qualify. |
| `ADMIN_AUTH` | Admin login | Not enforced | Fail safely/closed | Preserve non-enumerating behavior. |
| `ADMIN_DESTRUCTIVE` | Admin reset/clear/destructive actions | Not enforced | Fail safely/closed / open review | Confirm production availability and route scope. |
| `INTERNAL_DIAGNOSTIC` | Internal diagnostic/development endpoints | Not enforced | Fail closed/unavailable | Must not broaden flag/access controls. |
| `PUBLIC_READ` | Lower-risk public reads | Not enforced / open review | Fail open or bounded fallback | Decide whether to enforce at all. |
| `HEALTH_EXCLUDED` | Health checks | Excluded | Fail open / excluded | Health must not depend on limiter-store availability. |

## Proposed TTL/window draft

Starting values only; these are not final approvals and do not change current runtime policy.

| Category constant | Draft window / max actions | Keying basis concept | Reason | Open question |
| --- | --- | --- | --- | --- |
| `AUTH_LOGIN` | 15 minutes; 5 per privacy-safe account key and 20 per opaque source bucket | Account category + opaque source bucket + route | Bounds credential attempts while accounting for shared networks. | Whether staging begins at current higher bounds before production tuning. |
| `AUTH_PASSWORD_CHANGE` | 15 minutes; 5 per authenticated account, 10 secondary source/session bound | Authenticated account + route | Limits password-hash pressure. | Session/source basis and fallback policy. |
| `AUTH_REGISTER` | 1 hour; 5 per opaque source bucket | Opaque source bucket + route | Limits automated account creation. | Whether registration remains public. |
| `MANAGE_LOOKUP` | 15 minutes; 20 per privacy-safe manage key, 30 per opaque source bucket | Opaque manage identifier + source bucket + route | Reduces token guessing without revealing validity. | Final balance for legitimate retrieval. |
| `MANAGE_CANCEL` | 15 minutes; 5 per privacy-safe manage key, 15 per opaque source bucket | Opaque manage identifier + source bucket + route | Limits cancellation abuse. | Idempotent-repeat treatment. |
| `MANAGE_RECOVERY` | 15 minutes; 3 per privacy-safe contact-derived key, 10 per opaque source bucket | Opaque contact-derived key + source bucket + route | Limits notification amplification and enumeration. | Support/recovery fallback behavior. |
| `BOOKING_CREATE` | 1 hour; 20 per opaque source bucket, 120 per opaque shop reference | Opaque source bucket + opaque shop reference + route | Limits spam writes and notification costs. | Fail-closed versus bounded fallback. |
| `CUSTOMER_BOOKING_MODIFY` | 15 minutes; 10 per opaque customer/manage context | Opaque authorized context + route | Limits repeated state changes. | Confirm implemented route family. |
| `STAFF_WRITE` | 5 minutes; 60 per authenticated account, 180 per opaque shop reference | Authenticated account + opaque shop reference + route | Bounds loops while allowing normal operations. | Which writes may use fallback. |
| `ADMIN_AUTH` | 15 minutes; 5 per opaque source bucket | Opaque source bucket + route | Limits admin credential attempts. | Exact admin identity key constraints. |
| `ADMIN_DESTRUCTIVE` | 5 minutes; 10 per authenticated admin context | Opaque admin context + route | Bounds destructive loops. | Production route availability and fallback. |
| `INTERNAL_DIAGNOSTIC` | 15 minutes; 10 per authenticated owner context | Authenticated owner context + route | Adds defense without weakening existing access gate. | Whether separate limiter is needed while flag-gated. |
| `PUBLIC_READ` | 5 minutes; 180 per opaque source bucket | Opaque source bucket + route | Limits scraping/load without excessive availability impact. | Whether enforcement is justified. |
| `HEALTH_EXCLUDED` | Excluded | None | Preserve health availability. | Separate safe dependency observation only. |

## Generic response envelope draft

| Situation | HTTP status | Stable code | Generic user-facing message | Safe event? | Privacy notes |
| --- | --- | --- | --- | --- | --- |
| Applied rate limit | `429` | Route-specific existing or approved `*_temporarily_limited` code | “Please try again later.” | Yes: `rate_limited` category | No key, source, account, token, or threshold detail. |
| Shared store unavailable on fail-closed category | `503` | `limiter_temporarily_unavailable` | “This action is temporarily unavailable. Please try again later.” | Yes: `limiter_degraded` failure category | No provider, fallback, topology, or identity detail. |
| Bounded fallback active on approved lower-risk category | Normal route response if application action succeeds | No new user-facing limiter code | No limiter-specific message | Yes: `limiter_fallback_active` category | Event must not expose the key or raw source. |
| Internal/diagnostic unavailable | Existing concealment/unavailable status appropriate to route, normally `404` when disabled or unauthorized | Existing route-safe envelope | Existing generic route-safe message | Optional safe internal category | Do not reveal flag state or diagnostic access. |
| Excluded health path | `200` when health contract succeeds | Existing health response | Existing minimal health response | Safe dependency category only if needed | Do not expose limiter-store/provider detail. |

## Carry-forward behavior

Current in-process limiter behavior remains unchanged. This draft changes no runtime behavior, does not authorize a real shared provider, and does not trust forwarded headers.

## Open decisions before provider implementation

- Provider/vendor selection.
- HMAC secret ownership and rotation.
- Final TTL/window approval and final constant names.
- Final generic response codes/messages.
- Booking-write fail-closed versus bounded fallback.
- Staff-write fallback scope and public-read enforcement.
- Admin destructive-route policy.
- Staging validation plan and operations/runbook ownership.

## Testing requirements before implementation

- Constants coverage and route-to-category regression tests.
- TTL/window unit tests and generic response tests.
- Store-failure behavior and privacy-safe key tests.
- Existing limiter behavior regression tests.
- Guarded staging suite after any backend behavior change.

## PM recommendation

Review and edit this draft before finalizing code constants. Do not implement a real shared provider or deploy new limiter behavior from this draft alone. The next safe step is a docs-only approval record, or a tiny code-only constants-alignment package only after every affected draft item is explicitly approved.

## Decision outcome now

Policy constants, TTL/window, and response-envelope drafts are documented. No runtime behavior changed. The full shared-provider limiter remains blocked, the production shared limiter remains **not approved**, and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No.** |
| Supabase migration required? | **No.** |

## Related records

- [Local adapter foundation result](PRODUCTION_SHARED_LIMITER_LOCAL_ADAPTER_FOUNDATION_RESULT.md)
- [Route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md)
- [Failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
- [Implementation-slice plan](PRODUCTION_SHARED_LIMITER_IMPLEMENTATION_SLICE_PLAN.md)
