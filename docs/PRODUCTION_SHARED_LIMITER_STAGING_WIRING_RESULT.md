# Shared limiter staging wiring result — P0-F5q

**Status:** Local implementation and test result only. Shared mode remains disabled by default and has not been activated, configured in Render, or tested against the hosted Key Value instance. Production shared limiting and production launch remain **no-go**.

## Implemented behavior

- Added the minimal `redis` client dependency and wired the existing Redis-compatible store through `server/src/index.js`, never through route handlers.
- Shared mode is requested only by `SLOTZY_STAGING_SHARED_LIMITER_ENABLED=true`, is effective only for actual `NODE_ENV=staging`, and is rejected in production.
- Disabled mode does not create or connect a Redis client and retains the existing in-memory limiter and HMAC behavior.
- Enabled staging mode requires `SLOTZY_STAGING_LIMITER_REDIS_URL` and an independent `RATE_LIMIT_STORE_HMAC_SECRET`; incomplete/invalid configuration stops startup rather than silently enabling an unprotected or fallback mode.
- The dedicated secret must be at least 32 bytes, must not equal `JWT_SECRET`, Supabase anon key, or Supabase service-role key, and remains a founder-controlled Render secret only. No value is present in source or documentation.
- `SLOTZY_STAGING_LIMITER_CONNECT_TIMEOUT_MS` is optional; when provided it must be a bounded integer. The client disables reconnect looping.
- Provider errors, timeouts, and malformed replies produce the approved fail-closed `503` envelope for every current category: `{ "error": "This action is temporarily unavailable. Please try again later.", "code": "limiter_temporarily_unavailable" }`.
- The current five categories, windows, limits, ordinary responses, rate-limited responses, direct-socket source behavior, forwarded-header distrust, and `/api/health` behavior are unchanged.

## Local test evidence

`npm run test:api` passed **32/32**. It includes existing API, observability, source-boundary, booking/manage, and limiter regressions, plus local shared-mode checks for opaque keys, unsafe-key rejection before client calls, atomic expiry, two adapters sharing a fake backend, concurrent requests, unavailable/malformed provider results, stable `503` failure envelope, incomplete staging configuration rejection, and production-enable rejection.

No hosted request, Render configuration change, provider connection, or secret was used.

## Disabled-mode safety and rollback

With the flag absent/false, no provider client is created or connected and the current in-memory limiter remains active. Recovery from an approved future staging outage is manual: set the flag false, redeploy/restart the Render API, verify the in-memory limiter and guarded staging suite, and retain no provider dependency in disabled mode.

## Remaining activation blockers

- Founder approval of the exact Render secret/configuration change and internal-access/cost pre-flight.
- Founder-controlled HMAC generation, storage, and rotation owner confirmation; rotation resets temporary counter continuity.
- A separately approved, short synthetic-only staging activation window.
- Render deployment of this backend commit with shared mode still disabled, followed by guarded staging validation.
- After explicit approval, controlled enablement evidence including real staging multi-worker/provider behavior and manual rollback verification.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** Backend rollout uses `[skip netlify]`. |
| Render required after commit? | **Yes, later** for a backend deployment with mode disabled; secret/configuration and activation require separate approval. |
| Supabase migration required? | **No.** |
