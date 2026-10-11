# Production shared limiter provider/store options review — P0-F5a

**Status:** Docs-only options review. No implementation, provider account, configuration, runtime behavior change, production approval, or launch approval is created by this record.

## Required constraints from prior gates

- `direct-socket-current` remains the approved source behavior; forwarded headers remain untrusted.
- Limiter keys must never retain raw IPs, raw headers, tokens, JWTs, emails, names, phone numbers, booking details, or other private customer data.
- Shared or persisted identifiers require a privacy-preserving keyed/HMAC or equivalent design, explicit TTLs, and no indefinite retention.
- Logs and events must remain category-only or redacted.
- Production enablement requires a separate explicit approval after implementation and acceptance evidence.

## Options matrix

| Option | Operational simplicity / implementation complexity | Atomic windows and TTL | Latency / reliability / cost risk | Privacy and observability | Rollback and testability | Fit for current Slotzy scale |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Managed Redis-compatible store** | Moderate setup and application integration; a focused limiter abstraction can keep the change bounded. | Strong fit for atomic increment/window patterns and TTL-based expiry. | Adds a network dependency and provider ownership; cost must be evaluated without assuming a plan. | Use HMAC/coarse identifiers only, TTLs, and redacted events; provider access/log retention require review. | A flag can return enforcement to the existing in-process staging mode; local fake/adapter tests plus staging failure smokes are practical. | **Recommended direction for later staging implementation.** Low enough operational burden while supporting required limiter semantics. |
| **B. Managed key-value or edge-rate-limit provider** | Potentially simple for broad rules, but provider-specific policy/key semantics can increase integration complexity. | Must verify atomic window and TTL behavior for needed application-level keys. | Edge/path coverage and service availability must be understood; plan and usage costs need later review. | Provider handling of network metadata, logs, retention, and geography needs explicit review. | Rule rollback may be simple, but application-specific behavior and local emulation can be limited. | Conditional later complement for volumetric/public-edge protection, not the first application limiter choice. |
| **C. Database-backed limiter** | Higher implementation and operational complexity because limiter traffic couples to core booking storage. | Can be designed, but atomicity, cleanup, contention, and hot-key behavior need deliberate design. | Risks adding load or failure coupling to booking data; costs include schema, tuning, and operational review. | Persistent identifiers increase retention/access/deletion obligations even when HMACed. | Rollback and local testing are possible but require a migration and production-like database behavior tests. | Later fallback only; not preferred for a small high-churn limiter. |
| **D. In-process only with explicit staging/single-instance restriction** | Simplest because already implemented. | Atomic only within one process; TTL exists only in that process. | No provider dependency, but restart/deploy resets and multi-instance fragmentation make the risk unsuitable for production. | Keys stay local but still require existing redaction rules. | Easy rollback because it is current behavior; local/staging tests already exist. | Appropriate only for controlled solo-founder staging QA, not production. |

## Recommendation for later staging implementation

Recommend a **managed Redis-compatible ephemeral store category** for a later, separately approved staging implementation package. This is a provider category, not a vendor selection or procurement decision. It best balances a solo founder's operational burden with atomic counters, native TTL-style expiry, privacy-safe opaque keys, bounded application integration, and a simple flag-based rollback to the existing staging limiter.

This recommendation does not approve production use. A managed key-value or edge control may later complement public/volumetric protection, but it should not replace application-level assessment without separate source-boundary and privacy review.

## Non-recommendations

Keeping only process-local state is insufficient for production because restarts clear counters and multiple instances fragment enforcement. A database-backed limiter is less attractive as a first choice because abusive traffic could contend with or couple failure to booking storage. Edge/provider-specific controls require careful source-boundary, logging, retention, and rule-semantics review before any trust decision; they must not cause an implicit switch to forwarded-header trust.

## Future implementation requirements

- Staging-only implementation first, behind a feature/environment flag.
- Privacy-safe key derivation with no raw source persistence.
- Endpoint-specific limits and explicitly tested endpoint-specific failure behavior.
- Safe, redacted observability and an owner-approved rollback path.
- Local behavior tests, staging abuse/failure smoke, and post-disable/post-rollback guarded staging suite.
- Documentation and production-gate updates before any production consideration.

## Decision outcome now

The managed Redis-compatible store category is the recommended direction for a future staging implementation package only. The production shared limiter remains **not approved**, and production launch remains **no-go** for this item. Provider selection, implementation, failure-mode confirmation, privacy/retention, ownership, rollback, and acceptance evidence remain blocked.

The [P0-F5b staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md) documents the proposed adapter, key, flag, testing, and rollback boundaries without selecting a vendor or authorizing implementation.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No** for this review; later staging implementation would require Render. |
| Supabase migration required? | **No.** A database option would require separately approved schema work. |

## Related records

- [Production shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
- [P0-F5b staging implementation design spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
