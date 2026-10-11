# Controlled source-boundary diagnostic attempt result — P0-F4e

**Status:** Attempted; **blocked/failed**. This is not partial source-boundary validation and authorizes no retry, trust decision, limiter change, or production action.

## Safe result record

| Item | Result |
| --- | --- |
| Route attempted | `POST /api/internal/source-boundary-diagnostic` |
| Temporary flag enablement | Performed for the controlled staging attempt, then disabled/removed afterward |
| Synthetic owner setup | Succeeded far enough to enter the diagnostic loop |
| Owner-authenticated diagnostic requests | Every request returned HTTP `400` / bad-request category |
| Diagnostic output | Blank; no category-only result table was produced |
| Category-only evidence accepted | No |
| Source-boundary proof accepted | No |
| Forwarded-source trust approved | No |
| Limiter behavior changed | No — remains direct-socket based |
| Post-attempt public/anonymous check | `404` |
| Post-attempt guarded staging suite | **3/3 passed** in approximately 2.3 minutes |
| Production shared limiter | **No-go** |

The post-attempt guarded suite covered the focused synthetic owner setup API chain, synthetic owner-to-customer booking lifecycle, and synthetic-context negative checks. It confirms the flag was removed/disabled without disturbing those covered flows; it does not repair or replace the failed diagnostic evidence.

## PM conclusion

Treat this attempt as **blocked/failed**, not partial success. Do not retry the diagnostic until the root cause of the `400` responses is inspected locally and in source, then corrected and locally validated in a separately approved package. Do not infer anything from the blank output table.

The [P0-F4f source/local review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_400_REVIEW.md) identifies the likely request-contract mismatch: a nonempty JSON body is rejected, while the fixed case label must be sent through the required header. The result remains blocked/failed pending separately approved local test/runbook work.

Keep the limiter direct-socket based. Keep forwarded headers untrusted. Forwarded-source trust remains unapproved, and the production shared limiter remains no-go.

## Remaining blocker

The diagnostic request contract did not produce its required category-only output. Root-cause inspection must determine why owner-authenticated synthetic calls returned the bad-request category while preserving the endpoint's privacy and access constraints. Only after a separately approved fix and local tests may a new controlled staging attempt be planned.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this result record or local/source inspection; **yes later** only for a separately approved redeployment and retry. |
| Supabase migration required? | **No.** |

## Related records

- [P0-F4d controlled execution plan](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_EXECUTION_PLAN.md)
- [P0-F4f diagnostic 400 review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_400_REVIEW.md)
- [P0-F4c diagnostic rollout](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ROLLOUT.md)
- [Protected diagnostic specification](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_SPEC.md)
- [Source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
