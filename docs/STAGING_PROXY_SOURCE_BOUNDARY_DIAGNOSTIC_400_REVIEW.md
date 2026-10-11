# Source-boundary diagnostic 400 review — P0-F4f

**Status:** Source/local review only. No code, environment, infrastructure, or hosted request was changed or run for this review.

## Conclusion

The likely cause of every hosted `400` response is a request-contract mismatch: the endpoint deliberately rejects every nonempty request body, while the stated hosted shape used a JSON body containing `caseLabel`. The valid case-label value was supplied in the wrong location. The endpoint expects an empty request body and one exact allowlisted `X-Slotzy-Source-Boundary-Case` request header.

This is a blocked/failed attempt, not source-boundary evidence. No source-boundary proof is accepted, forwarded-source trust remains unapproved, the limiter remains direct-socket based, and the production shared limiter remains no-go.

## Local source and test evidence

| Question | Source/local finding |
| --- | --- |
| Exact request contract | `POST /api/internal/source-boundary-diagnostic`; diagnostic flag enabled in staging; valid authenticated owner session; empty body; exact allowlisted `X-Slotzy-Source-Boundary-Case` header. `X-Forwarded-For` is optional observation input only. |
| Why a `400` is returned | The handler returns `400` if a body is present, transfer encoding is present, parsed body fields exist, or the diagnostic-case header is missing/unsupported. The safe response is only `ok=false` and `caseLabel=unknown`. |
| Hosted JSON body shape | `{ "caseLabel": "missing-forwarded" }` has a nonempty body and therefore deterministically triggers the body-rejection branch. `caseLabel` is not an accepted JSON property. The exact PowerShell command was not supplied, so this review evaluates only the stated body shape. |
| Correct case location | The value must be one of the fixed labels in `X-Slotzy-Source-Boundary-Case`; it is not read from the body. |
| Supported labels | `missing-forwarded`, `single-forwarded`, `multiple-forwarded`, `malformed-forwarded`, `private-looking-forwarded`, `ipv4-looking-forwarded`, `ipv6-looking-forwarded`, and `mixed-forwarded`. |
| Role/auth/shop cause? | Unlikely and inconsistent with `400`. Authentication, current-session, and owner-role failures return uniform `404` before the handler. No shop lookup or ownership check appears in the diagnostic route. |
| Synthetic owner without a shop? | No. The route checks only the authenticated current owner role; it does not require or inspect a shop. |
| Header/case pairing cause? | A supported case header plus any forwarding-input shape reaches classification and returns category-only `200`; malformed/multiple/private/mixed inputs are classifications, not `400` causes. A missing/unsupported case header does cause `400`. |
| Content type/body parsing cause? | Yes. A JSON body supplies content length and parsed fields, both independently treated as a body-present rejection. The header-only local test path sends no body. |

## Test coverage assessment

`server/test/source-boundary-diagnostic-api.test.js` covers owner-only access, disabled/production refusal, each fixed case sent through `X-Slotzy-Source-Boundary-Case`, category-only results, and redaction. It does **not** cover the same JSON-body request shape used in the hosted PowerShell attempt.

The focused local suite passed 9/9 on this review. That verifies the implemented header-only contract, not the incorrect hosted body contract.

## Recommended correction and retry posture

- **Code fix:** Not recommended from the present evidence. Rejecting a body is an intentional protection in the implemented contract.
- **Runbook/script correction:** Recommended. Any later approved invocation must send no body and must use the exact allowlisted case label in `X-Slotzy-Source-Boundary-Case`; it must continue to use owner authentication and category-only evidence rules.
- **Local test expansion:** Recommended in a separately approved test-only/code package: assert that a known case label in a JSON body returns the safe `400`, and that the same label in the required header with no body returns category-only `200`. This locks the runbook contract against regression.
- **Hosted retry:** Blocked until the runbook correction and the proposed local coverage are reviewed/approved. Do not enable the flag or retry as part of this review.

## Safest next step

Approve a minimal local test/runbook-correction package only. It should add the two contract assertions above and update the controlled execution instructions to state “empty body; case label header.” After that package passes locally, require a separate approval before another temporary staging enablement and retry.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this source/local review or local test expansion; **yes later** only for a separately approved retry. |
| Supabase migration required? | **No.** |

## Related records

- [P0-F4e blocked diagnostic attempt result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ATTEMPT_RESULT.md)
- [P0-F4d controlled execution plan](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_EXECUTION_PLAN.md)
- [Protected diagnostic specification](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_SPEC.md)
- [Source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
