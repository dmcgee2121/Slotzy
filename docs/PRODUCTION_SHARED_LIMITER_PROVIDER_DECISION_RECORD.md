# Shared limiter staging provider decision record — P0-F5m

**Status:** Docs-only provider decision record. Render Key Value / Valkey is selected for the future staging provider path; no instance exists, implementation is not approved, runtime behavior is unchanged, and production approval is not granted.

## Decision

| Decision | Status |
| --- | --- |
| Selected provider path | Render Key Value / Valkey |
| Scope | Future staging shared-limiter implementation only |
| Provider setup | Not approved by this record |
| Code implementation | Not approved by this record |
| Production shared limiter | Not approved |
| Production launch | No-go |

## Why Render Key Value / Valkey

- It is on the same platform as the current staging API, reducing a separate-vendor account surface for this staging path.
- Official Render documentation describes it as Redis-compatible with virtually all Redis clients, and says newly created instances run Valkey 8.
- An internal URL is available to Render services in the same workspace and region; Render recommends that private-network path where possible to minimize latency.
- Render offers a Free Key Value plan. Its in-memory limitation may be suitable only for temporary staging limiter counters, which are loss-tolerant by design.
- This is a staging operational-complexity decision, not evidence of production suitability.

Official facts should be rechecked before setup: [Render Key Value documentation](https://render.com/docs/key-value) and [Render Free limitations](https://render.com/docs/free).

## Important limitations

- Free Key Value is in-memory only; data is lost if the instance restarts.
- Render may restart a Free Key Value instance, and it may be temporarily unavailable during maintenance.
- Those limits are acceptable only for temporary staging limiter counters, not durable application data or a production decision.
- Production requires separate provider, cost/billing, reliability, privacy, rollout, and acceptance review.
- Exact plan and cost must be confirmed before any paid setup.
- Provider outage/failure behavior still needs validation.
- This decision does not approve TTL/window changes or response changes.

## Deferred alternatives

- Upstash Redis remains an alternate if Render Key Value becomes too costly or operationally awkward.
- Redis Cloud / Redis.com is deferred because the owner encountered a paid flow and the project is avoiding extra paid infrastructure unless necessary.
- No alternate provider is selected now.

## Setup guardrails for later

- Do not create an instance until a setup checklist is approved.
- Prefer a Free plan for staging if it is available and fits; if paid setup is required, stop and confirm cost before creation.
- Use the staging API region where possible and prefer the internal/private URL where possible.
- Keep external access disabled or restricted unless separately justified.
- Never place provider credentials in repository files, documents, tests, or logs; use only approved Render environment-secret storage when separately authorized.
- Send only opaque/derived limiter keys to the provider; never raw or private values.

## Implementation blockers remaining

- Render Key Value setup checklist is not complete.
- Exact plan/cost is not confirmed.
- Instance name, region, and access configuration are not selected.
- Environment-variable names are not finalized.
- Provider client/dependency is not selected.
- HMAC secret ownership and rotation remain unresolved.
- Provider outage behavior is not tested.
- Staging validation commands/window are not finalized.
- Operations/runbook ownership is not assigned.
- Production acceptance evidence is missing.

## Accelerated PM path

1. Create one docs-only Render Key Value setup checklist.
2. Owner manually creates a staging instance only after that checklist is approved.
3. Record sanitized setup facts without secrets.
4. Separately authorize one backend staging-provider adapter implementation slice.
5. Deploy to Render staging only after approved backend code changes.
6. Run guarded staging and record one rollout result after it passes.

## Decision outcome now

Render Key Value / Valkey is selected for the staging provider path. Provider setup remains blocked pending a setup checklist, provider implementation remains blocked, the production shared limiter remains **not approved**, and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No change now.** Render is the selected future staging provider path, but instance creation/configuration is blocked. |
| Supabase migration required? | **No.** |

## Related records

- [Candidate provider facts worksheet](PRODUCTION_SHARED_LIMITER_PROVIDER_FACTS_WORKSHEET.md)
- [Provider selection gate](PRODUCTION_SHARED_LIMITER_PROVIDER_SELECTION_GATE.md)
- [Shared limiter decision gate](PRODUCTION_SHARED_LIMITER_DECISION_GATE.md)
