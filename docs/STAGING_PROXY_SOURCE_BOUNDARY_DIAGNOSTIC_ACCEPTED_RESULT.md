# Accepted hosted source-boundary diagnostic evidence — P0-F4j

**Status:** Final controlled hosted retry completed with accepted category evidence for current staging direct-socket behavior only. This result does not approve forwarded-source trust, change limiter behavior, or approve a production shared limiter.

## Accepted safe evidence record

| Item | Result |
| --- | --- |
| Route | `POST /api/internal/source-boundary-diagnostic` |
| Temporary diagnostic flag enablement | Performed for the approved controlled window, then disabled/removed afterward |
| Corrected request contract | Fixed case label in `X-Slotzy-Source-Boundary-Case`; no JSON body |
| Corrected response fields used | `directSocketSource`, `forwardedInput`, `forwardedHandling`, and `sourceKeyDecision` |
| Synthetic owner authorization | Kept local/in memory |
| Diagnostic request reachability | All eight requests returned `ok=True` |
| Environment | `staging` |
| Diagnostic enabled during retry | `True` |
| Direct socket source | `present` for all eight cases |
| Source-key decision | `direct-socket-current` for all eight cases |
| Forwarded handling | Observed-only or rejected category handling; never trusted as the limiter key source |
| Category-only evidence accepted | **Yes**, for current staging source-boundary behavior |
| Source-boundary proof accepted | **Yes**, for current staging direct-socket behavior only |
| Forwarded-source trust approved | **No** |
| Limiter behavior changed | **No** — remains direct-socket based |
| Post-retry public/anonymous check | `404` |
| Post-retry guarded staging suite | **3/3 passed** in about 2.0 minutes |
| Production shared limiter | Still requires a separate documented decision and gate update |

The accepted evidence is category-only. It establishes that the staging limiter currently remains on the direct-socket source decision and that forwarded header inputs are observed or rejected, not trusted.

## PM conclusion

Accept the evidence that staging currently keeps the limiter source decision at `direct-socket-current`. Keep forwarded headers untrusted and keep limiter behavior unchanged. Do not treat this staging evidence as production shared-limiter approval; that decision remains subject to its separate provider, failure-mode, privacy, ownership, implementation, and acceptance gates.

## Post-disable validation

The diagnostic flag was disabled/removed after the window. The public/anonymous diagnostic check returned `404`. The guarded staging suite then passed all three covered checks: focused staging owner setup API chain, synthetic owner-to-customer booking lifecycle, and synthetic-context negative checks.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this result record. The completed controlled staging window used Render, but no further Render action is authorized by this document. |
| Supabase migration required? | **No.** |

## Related records

- [P0-F4h incomplete corrected retry](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_RETRY_RESULT.md)
- [P0-F4i blank-fields review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_BLANK_FIELDS_REVIEW.md)
- [P0-F4d execution plan](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_EXECUTION_PLAN.md)
- [Source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
