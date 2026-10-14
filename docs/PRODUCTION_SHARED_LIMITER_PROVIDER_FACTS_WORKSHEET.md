# Shared limiter candidate provider facts worksheet — P0-F5l

**Status:** Docs-only provider facts worksheet. No provider is selected, no implementation is approved, no runtime behavior changes, and no production approval is granted.

**Decision update:** Render Key Value / Valkey is selected as the future **staging provider path only** in the [P0-F5m decision record](PRODUCTION_SHARED_LIMITER_PROVIDER_DECISION_RECORD.md). Unknowns remain open; this does not approve setup, implementation, or production.

The [P0-F5n Render Key Value staging setup checklist](PRODUCTION_SHARED_LIMITER_RENDER_KEY_VALUE_SETUP_CHECKLIST.md) documents a manual-only future setup path. Plan, cost, region, access, and instance facts remain unknown until separately approved setup is completed.

## Candidate providers under review

- Upstash Redis
- Render Key Value / Valkey

## Evidence rules

Facts in this worksheet must come from official provider documentation/pricing pages or owner-confirmed dashboard review. Unknowns remain **TBD**. Recheck pricing before any purchase or setup. Do not commit provider credentials, URLs, tokens, account IDs, or screenshots. This worksheet does not approve implementation.

Official sources used for the limited facts below: [Upstash Redis pricing](https://upstash.com/pricing/redis) and [Render Key Value documentation](https://render.com/docs/key-value). Provider facts and plan terms can change.

## Candidate facts

| Fact | Upstash Redis | Render Key Value / Valkey |
| --- | --- | --- |
| Provider/product name | Upstash Redis | Render Key Value |
| Product type | Redis product; detailed runtime characteristics TBD | Redis-compatible in-memory storage for shared caches and job queues. |
| Redis-compatible? | TBD: validate protocol/client fit during owner review. | Yes; official docs say it is compatible with virtually all Redis® clients. |
| Underlying engine/runtime | TBD | Newly created instances run Valkey 8; legacy instances may run Redis 6. |
| Free tier or entry plan | Official pricing currently lists Free: $0, 256 MB, 500K monthly commands, 10 GB monthly bandwidth. | TBD: owner must review current plan/pricing. |
| Pay-as-you-go or fixed pricing model | Official pricing lists pay-as-you-go at $0.20/100K commands, $0.25/GB storage after the first 1 GB, and bandwidth free through 200 GB/month before additional charges; fixed plans are also listed. | TBD: owner must review current plan/pricing. |
| Budget cap/spend control | TBD | TBD |
| TTL support | TBD: validate required command/expiry semantics. | TBD: validate required command/expiry semantics. |
| Atomic increment/window suitability | TBD: validate required command semantics and failure behavior. | TBD: validate required command semantics and failure behavior. |
| Same-region/private-network support | TBD | Internal URL is available for Render services in the same workspace and region; docs recommend it where possible for private-network, lower-latency communication. |
| External access restrictions | TBD | Newly created instances are not externally reachable by default; external access requires enablement and can be restricted with an IP allow list. |
| Auth/secret handling | TBD | External connections always require authentication. Internal connections are unauthenticated by default but can require authentication; validate setup implications. |
| Observability/metrics | TBD | TBD |
| Usage/quota visibility | TBD | TBD |
| Data persistence behavior | TBD | Paid instances support disk-backed persistence and enable it by default. |
| Region/latency considerations | TBD | Internal connectivity requires same workspace and region; owner must confirm staging-region fit. |
| Owner billing/account access needs | TBD | TBD |
| Setup complexity | TBD | TBD |
| Rollback simplicity | TBD; must retain in-process-default rollback. | TBD; must retain in-process-default rollback. |
| Open concerns | Cost controls, client/protocol fit, TTL/atomic semantics, privacy/logging, access, rotation, and staging validation are TBD. | Plan/cost, internal-auth choice, TTL/atomic semantics, privacy/logging, access, rotation, and staging validation are TBD. |

## Security and privacy checklist

| Check | Upstash Redis | Render Key Value / Valkey |
| --- | --- | --- |
| Can use opaque/derived keys only | Likely from application design; validate provider logging/retention. | Likely from application design; validate provider logging/retention. |
| Raw IP/email/token/customer data stays in app process | Application design requirement, not a provider promise. | Application design requirement, not a provider promise. |
| Provider secret-storage approach | TBD until a separately approved setup plan. | TBD until a separately approved setup plan. |
| Account-access owner | Owner follow-up. | Owner follow-up. |
| Secret-rotation path | TBD. | TBD. |
| External-access restrictions | TBD. | Official docs: external access is disabled by default and can use IP allow lists; confirm final configuration later. |
| Logging/privacy concerns | TBD unless owner verifies official retention/logging controls. | TBD unless owner verifies official retention/logging controls. |

## Cost and access owner worksheet

| Field | Owner entry |
| --- | --- |
| Selected candidate | Render Key Value / Valkey for staging path only; setup/implementation TBD |
| Monthly budget ceiling | TBD |
| Credit/debit-card owner | TBD |
| Account owner | TBD |
| Billing email | TBD |
| Backup admin | TBD |
| Cancellation/closure path verified? | Yes / No / TBD |
| Free tier acceptable for staging? | Yes / No / TBD |
| Paid plan acceptable for staging? | Yes / No / TBD |
| Production budget reviewed? | Yes / No / TBD |

## Scorecard placeholder

| Requirement | Weight | Upstash Redis | Render Key Value / Valkey | Evidence needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Atomic counter/window support | High | TBD | TBD | Official command semantics plus local adapter tests | Required before implementation. |
| TTL support | High | TBD | TBD | Official expiry semantics plus tests | Required before implementation. |
| Low operational burden | High | TBD | TBD | Owner setup/incident assessment | Solo-founder fit. |
| Cost predictability | High | TBD | TBD | Current official pricing plus owner budget | Recheck before purchase. |
| Secret-management fit | High | TBD | TBD | Approved environment-secret plan | No credentials in repo/docs. |
| Privacy-safe key compatibility | High | TBD | TBD | Logging/retention/access review | Opaque keys only. |
| Staging-only rollout support | High | TBD | TBD | Disable/enable and account controls | Disabled by default. |
| Rollback simplicity | High | TBD | TBD | Tested fallback to in-process limiter | Required before staging enablement. |
| Observability without private data | Medium | TBD | TBD | Safe metrics/logging review | No raw key/data. |
| Documentation/support quality | Medium | TBD | TBD | Owner review of official materials/support path | Evidence, not assumptions. |
| Owner access/billing fit | Medium | TBD | TBD | Owner access and billing review | Named owners required. |

## Preliminary PM read — not a decision

Upstash may be attractive for low-cost, serverless/pay-as-you-go evaluation if the current pricing and required controls are verified. Render Key Value may be attractive for same-platform/private-network simplicity if the current plan, internal-auth choice, and required controls are verified. There is no winner: the owner must still confirm account access, budget, setup path, secret rotation, and staging validation.

## Owner manual checks

- Current pricing page and account-creation requirements.
- Free-tier limits, budget/spend cap, and billing method.
- Region options and staging-region fit.
- Secret-rotation process, dashboard metrics, and usage visibility.
- Cancellation/account-closure process and support/contact path.
- Whether external access can remain disabled or be restricted.
- Whether staging use fits a free or low-cost tier.

## Decision gate outcome now

The candidate worksheet is created. Render Key Value / Valkey is selected for the staging path only; provider setup and implementation are not approved. The production shared limiter remains **not approved**, and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this worksheet. |
| Supabase migration required? | **No.** |

## Related records

- [Provider selection gate](PRODUCTION_SHARED_LIMITER_PROVIDER_SELECTION_GATE.md)
- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [Provider/store options review](PRODUCTION_SHARED_LIMITER_OPTIONS_REVIEW.md)
