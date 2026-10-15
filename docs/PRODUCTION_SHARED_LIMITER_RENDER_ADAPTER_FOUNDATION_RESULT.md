# Render Key Value staging adapter foundation result — P0-F5o

**Status:** Disabled-by-default, local-tested backend groundwork only. The current in-process limiter remains the active runtime adapter. No Render API configuration, provider connection, hosted request, environment variable, frontend, Supabase, or production change was made.

## Sanitized staging setup facts

| Fact | Recorded value |
| --- | --- |
| Instance | `slotzy-staging-limiter` |
| Provider | Render Key Value / Valkey |
| Plan | Free |
| Region | Virginia (US East) |
| Status | Available |
| Persistence | Off |
| Internal connection option | Available |
| API connection configured | No |

No connection string, credential, private URL, account identifier, raw IP, or customer data is recorded.

## Foundation implemented

- `server/src/rateLimiter.js` now exports an injected Redis-compatible store adapter that uses one server-side `EVAL` operation to increment a counter and set expiry only on its first write.
- The adapter accepts only lowercase 64-character hexadecimal HMAC-SHA-256 digests and a constrained, non-secret Redis namespace prefix. It rejects raw or malformed inputs before a client call, and does not derive, log, return, or persist raw request values.
- A provider error becomes the category-only `store_unavailable` result. It does not choose an API fail-open, fail-closed, or fallback response.
- `SLOTZY_STAGING_SHARED_LIMITER_ENABLED` is the proposed future flag name. The helper permits it only for `staging` and defaults to disabled; its injected-client factory is not called when disabled or in production. This package does not read it in the application runtime or create a provider client.
- The existing in-process limiter, its five category strings, policies, response envelopes, direct-socket source handling, and ordinary health check are unchanged.

## Local evidence

The focused local suite covers the existing limiter and API regressions plus:

- atomic Redis-compatible increment/first-write expiry semantics;
- expiry/window reset behavior;
- simulated provider outage with no key/provider-detail exposure;
- opaque HMAC key derivation with no raw private material in the adapter call;
- staging-only, disabled-by-default future flag behavior; and
- the five unchanged current limiter category strings.

No hosted instance was contacted.

## Activation blockers

Staging activation is **blocked**. Before an approved activation package can connect the API, the owner must resolve and explicitly approve:

- external-access restriction verification and internal/private connection selection;
- provider secret ownership, storage, and rotation (without reusing `JWT_SECRET`);
- exact environment-variable contract and access boundary;
- route-specific store-outage behavior, especially booking-write fail-closed versus bounded fallback;
- final TTL/window, response-envelope, observability, and validation decisions;
- a redacted staging validation window, stop criteria, rollback owner, and outage test plan.

## Proposed configuration names only

These names are proposals, not configured variables: `SLOTZY_STAGING_SHARED_LIMITER_ENABLED`, `SLOTZY_STAGING_LIMITER_REDIS_URL`, and `RATE_LIMIT_STORE_HMAC_SECRET`. The latter must be independently owned and rotated; it must not reuse `JWT_SECRET`.

## Rollback

Any later integration must default the shared-store flag off. Disabling it or removing provider configuration must select the current in-process limiter without making a provider connection. Health checks must remain independent of Key Value availability.

## Decision outcome

The adapter foundation is ready for local review only, not staging activation. Provider integration, production shared-limiter approval, and production launch remain **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify needed? | **No.** |
| Render needed after commit? | **No immediate change.** A later approved staging activation would require Render API secret/configuration work. |
| Supabase migration needed? | **No.** |
