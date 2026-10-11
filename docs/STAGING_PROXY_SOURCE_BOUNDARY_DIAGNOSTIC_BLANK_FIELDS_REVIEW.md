# Source-boundary diagnostic blank-fields review — P0-F4i

**Status:** Source/local review only. No hosted request, environment change, infrastructure action, or production behavior change was made.

## Conclusion

The likely root cause is a hosted PowerShell output-field mismatch, not an endpoint response failure. The corrected hosted calls reached the endpoint and returned `ok=True`, but the script read four property names that the endpoint does not return. The endpoint intentionally returns a safe, flat, category-only summary using different names.

The hosted retry remains blocked pending a separately approved field/runbook correction. No source-boundary proof is accepted, forwarded-source trust remains unapproved, the limiter remains direct-socket based, and the production shared limiter remains no-go.

## Source and test evidence

| Review question | Local finding |
| --- | --- |
| Exact successful response fields | `ok`, `environment`, `service`, `diagnosticEnabled`, `directSocketSource`, `caseLabel`, `forwardedInput`, `forwardedHandling`, and `sourceKeyDecision` |
| Did the hosted script read the correct names? | **No.** It printed nonexistent `directSocketSourcePresent`, `forwardedHeaderCategory`, `forwardedHandlingClassification`, and `sourceKeyDecisionCategory` properties. PowerShell therefore printed blank values despite a valid response. |
| Are the desired categories nested? | **No.** They are top-level properties: `directSocketSource`, `forwardedInput`, `forwardedHandling`, and `sourceKeyDecision`. |
| What does the endpoint return? | `server/src/index.js` builds a flat, deliberately redacted category-only response. The actual names also match the safe-event fields in `server/src/observability.js`. |
| Do local tests assert the response shape? | **Yes.** `server/test/source-boundary-diagnostic-api.test.js` asserts the complete top-level key set and asserts `forwardedInput`, `forwardedHandling`, and `sourceKeyDecision` values for all eight cases. |
| Did tests pass only because they checked broad status/`ok`? | **No.** They check status, exact top-level property names, the corrected header-only/no-body request contract, classification values, and redaction. |
| Endpoint code fix needed? | **No.** The response is intentionally a privacy-safe summary and is consistent with local tests. |
| Runbook/script correction needed? | **Yes.** A future approved script must read the four actual top-level fields listed above. |
| Test expansion needed? | No endpoint-test expansion is required for this mismatch: the exact response schema is already covered. If a reusable hosted script is later committed, add a test-only assertion that its field mapping uses the existing response names. |

## Field mapping for any future approved runbook

| Incorrect hosted output property | Actual endpoint top-level property |
| --- | --- |
| `directSocketSourcePresent` | `directSocketSource` |
| `forwardedHeaderCategory` | `forwardedInput` |
| `forwardedHandlingClassification` | `forwardedHandling` |
| `sourceKeyDecisionCategory` | `sourceKeyDecision` |

The actual names are safe category labels only; they do not authorize retaining raw headers, raw IPs, tokens, or request bodies.

## Smallest safe correction and retry posture

Correct the field mapping in the controlled invocation/runbook only. Do not change endpoint code, diagnostic access controls, environment variables, proxy trust, forwarded-header handling, or limiter behavior. Keep the existing header-only/no-body request contract.

Any further hosted retry remains blocked until the corrected field mapping is locally reviewed, the bounded execution package is separately approved, and the normal flag-disable/post-check safeguards are retained. Successful reachability alone remains insufficient; accepted category evidence is still required.

## Local validation

- `node --test test/source-boundary-diagnostic-api.test.js` — passed, 2/2.
- `node --test test/observability.test.js test/rate-limiter.test.js test/rate-limit-api.test.js test/source-boundary-diagnostic-api.test.js` — passed, 9/9.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this local review or runbook correction. Any future separately approved hosted retry would require Render staging operations. |
| Supabase migration required? | **No.** |

## Related records

- [P0-F4h corrected hosted retry result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_RETRY_RESULT.md)
- [P0-F4d execution plan](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_EXECUTION_PLAN.md)
- [P0-F4f request-contract review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_400_REVIEW.md)
- [Source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
