# Shared limiter provider selection gate — P0-F5k

**Status:** Docs-only provider-selection gate. No provider is selected, no implementation is approved, no runtime behavior changes, and no production approval is granted.

## Provider-selection scope

This gate selects evaluation requirements for a future shared limiter store/provider only. It does not approve a provider client, credentials or environment variables, Render configuration, production enablement, trusted forwarded headers, TTL/window changes, or response changes.

The [P0-F5l candidate provider facts worksheet](PRODUCTION_SHARED_LIMITER_PROVIDER_FACTS_WORKSHEET.md) records limited official-source facts and owner follow-ups for initial candidates. It keeps the provider decision open.

## Non-negotiable requirements

- Ephemeral shared-counter support suitable for limiter windows.
- Atomic increment/check semantics, or a demonstrably safe equivalent.
- TTL/window expiration support.
- Bounded outage behavior compatible with the existing [failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md).
- Privacy-safe derived/opaque keys only; no raw/private limiter keys in provider logs, application logs, errors, metrics, or test evidence.
- No need to trust forwarded headers; `direct-socket-current` remains the current source boundary.
- A disable/rollback path to the in-process default.
- Staging-first rollout only; production requires separate accepted evidence.

## Security and privacy requirements

The provider must never receive raw IPs, emails, tokens, JWTs, names, phone numbers, booking details, manage links, customer data, or service-role keys. Keys must be opaque/derived before leaving the application process. HMAC or equivalent secret ownership and rotation must be decided before implementation.

Provider access must be restricted. Provider secrets belong only in approved environment-secret storage and must never appear in the repository, documents, tests, logs, or errors.

## Operational requirements

- Named owner for provider account/access, billing/cost monitoring, incident response, and rollback.
- Clear alerting and log-review expectations without private data.
- Quota, rate, and capacity visibility.
- Approved staging validation window and a tested rollback path to the in-process limiter.
- No ordinary health-check dependency on provider availability.

## Cost and access checklist

| Check | Current status |
| --- | --- |
| Free/trial tier suitability | Owner follow-up; do not assume. |
| Monthly cost ceiling | Owner to fill in. |
| Account ownership and billing owner | Owner follow-up. |
| Team access controls | Owner follow-up. |
| Secret rotation support | Owner follow-up. |
| Usage/quota visibility | Owner follow-up. |
| Region/latency considerations | Owner follow-up. |
| Export/delete/account-closure process | Owner follow-up. |
| Support/contact path | Owner follow-up. |

## Provider scorecard

Candidate scores are deliberately blank until owner/provider evidence is available.

| Requirement | Weight | Candidate A | Candidate B | Candidate C | Evidence needed | Decision notes |
| --- | --- | --- | --- | --- | --- |
| Atomic counter/window support | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Provider semantics and testability | Must meet non-negotiable requirement. |
| TTL support | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Expiry semantics and limits | Must suit limiter windows. |
| Low operational burden | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Setup, ownership, incident burden | Solo-founder fit. |
| Cost predictability | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Owner-reviewed plan/quota facts | No price assumptions. |
| Secret-management fit | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Approved secret-storage compatibility | No credentials in code or docs. |
| Privacy-safe key compatibility | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Logging, retention, and key restrictions | Opaque keys only. |
| Staging-only rollout support | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Account/project and enablement controls | Must remain disabled by default. |
| Rollback simplicity | High | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Disable and in-process fallback path | Must be prompt and testable. |
| Observability without private data | Medium | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Safe events, logs, retention controls | No raw keys/data. |
| Documentation/support quality | Medium | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Relevant documentation and support path | Evidence, not marketing claims. |
| Owner access/billing fit | Medium | TBD after owner/provider review | TBD after owner/provider review | TBD after owner/provider review | Access roles and billing controls | Named owner required. |

## Decision gate

| Level | Meaning |
| --- | --- |
| **Not reviewed** | No candidate evidence has been assessed. |
| **Candidate under review** | Owner is collecting evidence against this gate. |
| **Approved for staging implementation only** | A candidate meets documented requirements and may be considered in a separately authorized staging-only implementation slice. This does not approve production. |
| **Blocked** | A required prerequisite or evidence item is absent. |
| **Not approved** | The candidate or action is explicitly disallowed. |

Production approval always requires separate implementation, staging, rollback, privacy, operational, and acceptance evidence.

## Provider implementation blockers

- Vendor/provider is not selected.
- HMAC ownership and rotation are unresolved.
- Provider environment-variable names and secrets are not approved.
- Provider-outage behavior is not validated.
- Staging validation commands/window are not finalized.
- Owner/runbook responsibilities are not assigned.
- Cost/access unknowns are not reviewed.
- No acceptance evidence exists.

## Accelerated PM path

1. Owner compares one or two candidates with this checklist and scorecard.
2. Record provider facts in one decision record only after they are known.
3. Separately authorize one staging-only provider-adapter implementation slice.
4. Deploy to Render staging only after backend code changes are approved and committed.
5. Record one rollout result after staging passes.

## Decision outcome now

Provider requirements and scorecard are documented. No provider is selected, provider implementation remains blocked, the production shared limiter remains **not approved**, and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this gate; later staging implementation would require Render. |
| Supabase migration required? | **No.** |

## Related records

- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [Provider/store options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md)
- [Code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [Implementation-slice plan](PRODUCTION_SHARED_LIMITER_IMPLEMENTATION_SLICE_PLAN.md)
- [P0-F5l candidate provider facts worksheet](PRODUCTION_SHARED_LIMITER_PROVIDER_FACTS_WORKSHEET.md)
