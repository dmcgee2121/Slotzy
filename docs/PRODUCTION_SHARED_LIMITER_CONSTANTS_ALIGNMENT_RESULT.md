# Shared limiter constants alignment result — P0-F5j

**Status:** Completed tiny backend constants-alignment slice. This result does not approve a production shared limiter or production launch.

## Completed alignment

`server/src/rateLimiter.js` centrally exports these existing live categories with their exact prior runtime string values:

| Constant | Preserved runtime value |
| --- | --- |
| `AUTH_LOGIN` | `login` |
| `BOOKING_CREATE` | `booking_create` |
| `MANAGE_LOOKUP` | `manage_lookup` |
| `MANAGE_CANCEL` | `manage_cancel` |
| `MANAGE_RECOVERY` | `manage_recovery` |

The existing policy objects and enforced routes now reference those constants. No unresolved category was added, and health exclusion naming was not added because it was unnecessary to this minimal slice.

## Preserved boundaries

- Runtime limiter behavior is unchanged.
- No TTL/window or maximum-attempt value changed.
- No response envelope, route, or enforcement decision changed.
- Direct-socket-current source behavior remains unchanged; forwarded headers remain untrusted.
- No provider/client, dependency, environment variable, configuration, or migration was added.
- Production shared limiter approval was not granted; production launch remains **no-go**.

## Validation

Local limiter and API regression tests cover the exact constants, policy keys, and current response behavior. Run the guarded staging suite only after this backend source change is committed and deployed.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required after commit? | **Yes**, for the required guarded staging suite after backend deployment. |
| Supabase migration required? | **No.** |

## Related records

- [Policy approval gate](PRODUCTION_SHARED_LIMITER_POLICY_APPROVAL_GATE.md)
- [Policy constants draft](PRODUCTION_SHARED_LIMITER_POLICY_CONSTANTS_DRAFT.md)
- [Local adapter foundation result](PRODUCTION_SHARED_LIMITER_LOCAL_ADAPTER_FOUNDATION_RESULT.md)
