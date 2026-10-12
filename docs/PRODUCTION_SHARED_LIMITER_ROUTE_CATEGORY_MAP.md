# Shared limiter route-to-category map — P0-F5d

**Status:** Docs-only route/category mapping for future staging implementation. No limiter is implemented and no production approval is granted.

## Mapping basis

This planning map is based on the current Express route definitions in `server/src/index.js`, current rate-limit policies in `server/src/rateLimiter.js`, and the existing shared-limiter failure-mode policy. It is not an implementation contract yet: entries marked **open review** need explicit implementation review before enforcement is added.

## Category definitions

- Auth/login and password-change paths
- Account recovery / manage-link recovery paths
- Diagnostic/internal endpoints
- Sensitive unauthenticated writes
- Customer booking creation/modification paths
- Owner/staff authenticated write paths
- Lower-risk public reads
- Health checks

## Route-to-category table

| Method | Current route pattern | Current auth posture from source | Proposed category | Failure-mode family | Notes / open questions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | Public | Health checks | Fail open | Do not couple ordinary health availability to store health. |
| GET | `/api/admin/status` | No middleware in route definition | Lower-risk public reads — open review | Fail open / open review | Confirm intended exposure and whether any limiter is useful. |
| POST | `/api/admin/login` | Admin secret authentication in handler | Auth/login and password-change paths | Fail safely/closed | Existing plan treats admin auth as sensitive. |
| GET | `/api/dev/emails` | Development endpoints gate | Diagnostic/internal endpoints — open review | Fail closed/unavailable | Confirm whether this remains development-only and whether it should be excluded rather than limited. |
| DELETE | `/api/dev/emails` | Development endpoints gate | Diagnostic/internal endpoints — open review | Fail closed/unavailable | Destructive development route; implementation review required. |
| POST | `/api/notify/booking` | Development endpoints gate | Diagnostic/internal endpoints — open review | Fail closed/unavailable | Manual notification route; do not broaden availability. |
| POST | `/api/notify/cancel` | Development endpoints gate | Diagnostic/internal endpoints — open review | Fail closed/unavailable | Manual notification route; do not broaden availability. |
| POST | `/api/notify/reschedule` | Development endpoints gate | Diagnostic/internal endpoints — open review | Fail closed/unavailable | Manual notification route; do not broaden availability. |
| POST | `/api/internal/source-boundary-diagnostic` | Diagnostic flag plus authenticated current owner | Diagnostic/internal endpoints | Fail closed/unavailable | Preserve owner-only/flag controls; no fallback may broaden access. |
| POST | `/api/auth/register` | Public | Sensitive unauthenticated writes | Fail safely/closed | Not in current implementation policy set; exact category/limit remains open review. |
| POST | `/api/auth/login` | Public | Auth/login and password-change paths | Fail safely/closed | Current enforced category: `login`. |
| GET | `/api/public/booking-context` | Public | Lower-risk public reads | Fail open / bounded fallback | Exact enforcement decision remains open. |
| GET | `/api/auth/me` | Session authentication | Lower-risk public reads | Fail open / bounded fallback | Authenticated identity read; exact enforcement remains open. |
| POST | `/api/auth/logout-all` | Session authentication | Owner/staff authenticated write paths — open review | Bounded fallback / open review | Security-sensitive action; determine whether it should use stricter policy. |
| POST | `/api/auth/change-password` | Session authentication | Auth/login and password-change paths | Fail safely/closed | Not currently in enforced policy set; exact category/limit remains open review. |
| GET | `/api/shops` | Authenticated | Lower-risk public reads | Fail open / bounded fallback | Protected dashboard/read route. |
| POST | `/api/shops` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Confirm route risk and role ownership at implementation. |
| PATCH | `/api/shops/:shopId` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Confirm destructive/profile-update handling. |
| GET | `/api/services` | Authenticated | Lower-risk public reads | Fail open / bounded fallback | Protected dashboard/read route. |
| POST | `/api/services` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Confirm owner/staff permissions in implementation review. |
| PATCH | `/api/services/:serviceId` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Confirm update risk. |
| DELETE | `/api/services/:serviceId` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Destructive route; determine whether stricter behavior is needed. |
| GET | `/api/availability` | Authenticated | Lower-risk public reads | Fail open / bounded fallback | Protected dashboard/read route. |
| PUT | `/api/availability` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Availability changes affect booking; fallback scope requires review. |
| GET | `/api/bookings` | Authenticated | Lower-risk public reads | Fail open / bounded fallback | Protected booking read. |
| GET | `/api/public/manage` | Public manage token/header handling in handler | Account recovery / manage-link recovery paths | Fail safely/closed | Current enforced category: `manage_lookup`. |
| PATCH | `/api/public/manage/cancel` | Public manage token/header handling in handler | Customer booking creation/modification paths | Fail safely/closed | Current enforced category: `manage_cancel`; retains token non-enumeration requirements. |
| POST | `/api/public/manage/recover` | Public | Account recovery / manage-link recovery paths | Fail safely/closed | Current enforced category: `manage_recovery`. |
| POST | `/api/bookings` | Optional authentication | Customer booking creation/modification paths | Open review: conservative fallback or fail safely/closed | Current enforced category: `booking_create`; distinguish anonymous and authenticated behavior. |
| PATCH | `/api/bookings/:bookingId` | Authenticated | Owner/staff authenticated write paths | Bounded fallback / open review | Booking modification risk may warrant a stricter final policy. |
| GET | `/api/admin/shops` | Admin authentication | Lower-risk public reads — open review | Bounded fallback / open review | Restricted admin read; exact policy pending. |
| GET | `/api/admin/shops/:shopId/export` | Admin authentication | Lower-risk public reads — open review | Bounded fallback / open review | Export sensitivity may justify separate category. |
| POST | `/api/admin/shops/:shopId/reset` | Admin authentication | Owner/staff authenticated write paths — open review | Fail safely/closed / open review | Destructive administration requires explicit final policy. |
| POST | `/api/admin/seed-demo-shop` | Admin authentication | Owner/staff authenticated write paths — open review | Fail safely/closed / open review | Administrative write; confirm production availability. |
| POST | `/api/admin/clear-all` | Admin authentication | Owner/staff authenticated write paths — open review | Fail safely/closed / open review | Destructive administration requires explicit final policy. |

## Special handling notes

- **Auth:** login is currently enforced; registration and password change require explicit future category constants and tests.
- **Recovery/manage:** manage lookup, cancellation, and recovery already have separate current categories and must keep generic, non-enumerating responses.
- **Booking:** public/optional-auth creation is currently `booking_create`; cancellation is `manage_cancel`. Update/modification behavior remains an implementation decision.
- **Owner/staff setup/settings:** shops, services, availability, and authenticated booking operations need route-level fallback decisions; do not infer that authenticated means low risk.
- **Public reads:** booking context is a lower-risk public read; enforcement itself remains an explicit future decision.
- **Internal diagnostic:** keep existing flag and owner controls; no limiter fallback may expose the endpoint.
- **Health:** should remain available independently of shared-store failure, while safe dependency state can be observed separately.

## Open decisions before code

- Exact code-level category names and endpoint-to-category constants.
- Booking-write choice: fail closed or bounded fallback.
- Staff-write routes that qualify for bounded fallback.
- Exact generic response codes/messages.
- Whether and where lower-risk reads receive enforcement.
- How tests lock the map against route changes.

## Testing requirements before implementation acceptance

- Unit test that every mapped protected route has a category or explicit exclusion.
- Endpoint tests for auth, recovery, write, and read categories.
- Failure-mode tests per category and generic-response tests.
- Tests proving no raw/private limiter keys are emitted.
- Route-map regression test or documented static assertion.
- Controlled staging smoke and guarded suite after every enable/disable window.

## Decision outcome now

The route mapping is documented for future staging implementation only. Implementation remains blocked, the production shared limiter remains **not approved**, and production launch remains **no-go**.

See the [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md) for the remaining prerequisites before code.
The [P0-F5h policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md) proposes names and starting values only; open-review entries remain unresolved.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this map; later staging implementation would require Render. |
| Supabase migration required? | **No.** |

## Related records

- [Shared limiter failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
- [Staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [P0-F5e code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [P0-F5h policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md)
