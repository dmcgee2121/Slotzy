# Shared limiter implementation slice plan — P0-F5f

**Status:** Docs-only implementation-slice plan. No code, provider/vendor selection, configuration, or production approval is authorized.

## Why the slice is narrow

The code-readiness checklist blocks a full Redis-compatible shared-limiter implementation: provider strategy, key ownership, policy constants, failure behavior, and staging validation remain unresolved. The first future code slice should reduce design risk locally without adding an external dependency, changing runtime behavior, or requiring hosted traffic.

## Proposed first future code slice

The smallest future package may:

- Introduce a limiter-store adapter interface/contract.
- Preserve the current in-process adapter and behavior as the default.
- Add a fake shared-store adapter for local tests only.
- Consolidate planned route/category constants in one place.
- Add privacy-safe key-derivation helper tests or scaffolding with no provider secrets.
- Add adapter-contract tests while retaining current endpoint behavior.

It must add no external dependencies, provider credentials, environment variables, Render deployment, hosted validation, or production behavior.

## Out of scope for the first code slice

- Real Redis-compatible provider client, account, configuration, URL, token, or environment variable.
- Production enablement or provider configuration.
- Trusted forwarded headers or any source behavior other than `direct-socket-current`.
- Changes to limiter decisions, endpoint user-facing behavior, staging/production deployments, or migrations.

## Required invariants

- Current in-process behavior remains the default and fallback.
- Forwarded headers remain untrusted.
- No raw/private values appear in limiter keys exposed to code consumers, logs, errors, metrics, or tests.
- No route directly imports a provider client.
- Store adapter, route policy, and source-key derivation remain isolated.
- Existing tests continue to pass.

## Planned files for the future code slice

These are proposed only; no files are changed by this document.

| Future file | Proposed responsibility |
| --- | --- |
| `server/src/rateLimiter.js` or a new limiter-store module | Adapter contract and preserved in-process adapter boundary |
| `server/test/rate-limiter.test.js` | In-process behavior and adapter contract tests |
| `server/test/rate-limit-api.test.js` | Regression coverage that existing enforced routes keep current behavior |
| `server/test/rate-limiter-store.test.js` | New local fake-shared-store contract/TTL/atomicity tests |
| Relevant limiter policy module | Central route/category constants, only after exact names are approved |
| Related docs | Record local test evidence and retain all production gates |

## Local test matrix for the future slice

- In-process adapter preserves current behavior.
- Fake shared-store adapter supports atomic increment/window semantics in memory.
- Simulated TTL/window expiration behaves correctly.
- Adapter failure result is bounded and category-only.
- Route/category constants cover known mapped categories or explicit exclusions.
- Key helper tests prove no raw/private data is emitted.
- Current login, manage, recovery, and booking limit tests retain their behavior.
- Existing related tests pass without secrets or hosted traffic.

## Hard stops before code

Do not start the slice if it requires an external provider dependency, environment variable or secret, source behavior other than `direct-socket-current`, trusted forwarded headers, a current limiter behavior change, hosted traffic, production-approval language, or logging/storing raw/private key evidence.

## Remaining decisions after the first slice

- Provider/vendor selection and real shared adapter.
- HMAC secret ownership and rotation.
- Final TTL/window values.
- Exact generic store-outage response codes/messages.
- Booking-write fail-closed versus bounded fallback.
- Staff-write fallback scope and public-read enforcement.
- Staging validation commands/hard stops and operational ownership/runbook.

## PM recommendation

After this plan is committed, approve only a future narrow, local, providerless code slice that meets every invariant and hard stop above. Do not approve a real shared Redis/provider implementation, Render/provider configuration, or production use.

## Decision outcome now

The implementation-slice plan is documented. The full shared limiter remains blocked. A first future code slice may be considered only if it remains local, providerless, default-preserving, and test-backed. The production shared limiter remains **not approved** and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No.** |
| Supabase migration required? | **No.** |

## Related records

- [Code-readiness checklist](PRODUCTION_SHARED_LIMITER_CODE_READINESS_CHECKLIST.md)
- [Staging implementation spec](PRODUCTION_SHARED_LIMITER_STAGING_IMPLEMENTATION_SPEC.md)
- [Route-to-category map](PRODUCTION_SHARED_LIMITER_ROUTE_CATEGORY_MAP.md)
- [Failure-mode policy](PRODUCTION_SHARED_LIMITER_FAILURE_MODE_POLICY.md)
