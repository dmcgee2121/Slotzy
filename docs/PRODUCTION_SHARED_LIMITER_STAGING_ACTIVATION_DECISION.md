# Shared limiter staging activation decision — P0-F5p

**Status:** Owner-approved for P0-F5q local implementation and testing only. It does not approve provider configuration, hosted activation, production shared limiting, or production launch. See the [P0-F5q wiring result](PRODUCTION_SHARED_LIMITER_STAGING_WIRING_RESULT.md).

## 1. Current status

| State | Confirmed fact |
| --- | --- |
| Implemented | `rateLimiter.js` contains an injected Redis/Valkey-compatible adapter foundation, opaque-key validation, and a staging-only flag helper. It is not wired into `index.js`. |
| Deployed | Render backend commit `86f85ac` is reported Live; the guarded staging suite passed 3/3. This is not evidence that shared limiting is active. |
| Locally tested | Foundation tests cover opaque HMAC keys, unsafe-key rejection, atomic counter/first-write expiry, simulated outage, disabled mode, and existing limiter regressions. |
| Hosted staging tested | Existing in-memory limiter behavior was guarded-staging tested. No hosted Key Value connection, shared-counter, or multi-instance test has occurred. |
| Not implemented | Provider client selection/wiring, configuration loading, route-specific outage responses, fallback, provider observability, and activation/rollback code. |
| Pending approval | HMAC ownership/rotation, access/cost pre-flight, configuration contract, outage policy, validation window, operational ownership, and acceptance evidence. |

The Key Value instance is `slotzy-staging-limiter`, Free, Virginia (US East), Available, with persistence Off and an internal connection option visible. The current in-memory limiter is active. Production shared limiting and launch remain **no-go**.

## 2. Proposed HMAC secret decision

For staging only, propose one dedicated limiter HMAC secret with at least 32 cryptographically random bytes. The Slotzy founder/operator generates it in an approved local secret-generation workflow and places it only in approved Render environment-secret storage. It must never reuse `JWT_SECRET`, Supabase credentials, or any provider credential, and must never be committed, pasted into documents/tests/chat, or logged.

The future adapter must derive the same opaque HMAC-SHA-256 digest from the same normalized inputs across every application worker. It may send only those digests to Key Value—never raw IPs, emails, names, tokens, JWTs, manage links, booking details, or customer data. Source input remains `direct-socket-current`; forwarded headers remain untrusted.

### Proposed rotation procedure — owner approval required

1. The Slotzy founder/operator authorizes and initiates rotation in a defined staging window.
2. Generate new independent random material; do not reveal it in evidence.
3. Replace the staging Render secret and coordinate a restart/redeploy so every worker receives the same new value before shared mode is re-enabled.
4. Treat the old counter namespace as abandoned: changing the HMAC changes keys, so counter continuity resets. This foundation does **not** support seamless dual-key rotation.
5. In-flight requests may use either process generation during the restart window; accept that temporary staging counter fragmentation/reset occurs. Do not claim stronger continuity.
6. If validation fails, disable shared mode, redeploy/restart into the approved in-memory mode, and restore the prior secret only if the owner determines it is still safe.
7. Verify success using synthetic traffic and category-only evidence: expected limiting, no raw key material, matching worker configuration, and guarded-suite success.

## 3. Proposed shared-store outage policy

The following is a staging proposal, not an approved runtime decision. It adds no categories and preserves present thresholds, windows, normal-operation response codes/messages, and generic non-enumerating public responses. `/api/health` remains independent of Key Value.

| Live category | Healthy shared store | Unreachable/malformed/timeout proposal | Generic outage envelope | Fallback allowed initially? | Rollback |
| --- | --- | --- | --- | --- | --- |
| `login` | Existing policy/normal response | Fail closed | `503` with `{ "error": "temporarily unavailable", "code": "rate_limit_unavailable" }` | No | Disable shared mode manually if outage persists. |
| `booking_create` | Existing policy/normal response | Fail closed for the first controlled activation | `503` generic temporary-unavailable envelope | No; reassess only after evidence | Disable shared mode manually; this may temporarily block staging bookings. |
| `manage_lookup` | Existing policy/normal response | Fail closed | `503` generic temporary-unavailable envelope | No | Disable shared mode manually. |
| `manage_cancel` | Existing policy/normal response | Fail closed | `503` generic temporary-unavailable envelope | No | Disable shared mode manually. |
| `manage_recovery` | Existing policy/normal response | Fail closed | `503` generic temporary-unavailable envelope | No | Disable shared mode manually. |

The intentional availability tradeoff is that a Key Value outage can temporarily prevent staging booking, login, manage, cancellation, and recovery operations while shared mode is enabled. That is preferred initially to silently permitting unlimited security-sensitive or notification-amplifying traffic. A manual feature-flag rollback restores the approved in-memory limiter; no automatic fallback is proposed until separately designed, bounded, and tested.

Privacy for every row: log only category, store/decision/failure category, request ID, route/method/status, and safe rollout state. Never log provider URLs/credentials, raw source data, HMAC material, opaque digest values, tokens, contacts, or booking data.

## 4. Proposed configuration contract

These are descriptive names only; no variables are configured by this decision.

| Variable | Purpose | Required disabled? | Required enabled? | Classification | Validation rule |
| --- | --- | --- | --- | --- | --- |
| `SLOTZY_STAGING_SHARED_LIMITER_ENABLED` | Staging-only activation flag | No; defaults false | Yes, exactly `true` | Non-secret control | Reject/ignore outside actual `staging`; production must reject enablement. |
| `SLOTZY_STAGING_LIMITER_REDIS_URL` | Internal Render Key Value endpoint | No | Yes | Secret connection value | Must be non-empty only when enabled; never log it; internal/private path only. |
| `RATE_LIMIT_STORE_HMAC_SECRET` | Independent opaque-key derivation secret | No | Yes | Secret | At least 32 random bytes; must differ from JWT/Supabase/provider credentials. |
| `SLOTZY_STAGING_LIMITER_CONNECT_TIMEOUT_MS` | Bounded connection timeout | No | Optional, with conservative reviewed default | Non-secret control | Positive bounded integer; invalid/missing value must not silently activate shared mode. |

Future wiring must keep disabled mode as the normal in-memory default and must make no provider connection attempt when disabled. Incomplete configuration must prevent activation, not fall through to a partially configured shared mode. Route handlers must depend on the isolated store abstraction rather than import provider clients. Actual `NODE_ENV`/runtime environment must be verified independently of Render's project-environment label. Health remains independent.

## 5. Render access and cost pre-flight

Before integration, the founder/operator must verify all of the following without recording credentials or private URLs:

- `slotzy-staging-api` can use the instance's internal connection in an appropriately aligned region.
- External access is disabled or explicitly restricted.
- Free-plan capacity/command limits are suitable for synthetic staging tests and no paid upgrade is required.
- Existing Render API configuration is preserved, no production service is selected, and no credential appears in logs, files, documentation, or test output.

This package performs no connectivity test or Render configuration change.

## 6. Future staging activation sequence

Every phase requires an explicit owner go-ahead and stops immediately on a hard stop below.

1. **Phase A — local integration.** Wire the existing adapter behind the staging-only flag, keep it disabled by default, preserve the five categories/policies, add proposed failure handling, and test disabled/enabled/outage/rollback/production rejection locally.
2. **Phase B — deploy disabled.** Commit reviewed backend/docs files only with `[skip netlify]`; deploy Render staging, wait for **Deploy succeeded | Live**, run the guarded suite, and confirm present in-memory behavior. Stop on any regression.
3. **Phase C — controlled configuration.** After approval, add only the internal connection and independent HMAC secret in Render; keep the flag off and verify configuration presence without exposing values. Stop if access, scope, or cost differs from this decision.
4. **Phase D — controlled enablement.** Approve a short synthetic-only window, enable staging shared mode, redeploy/restart if required, validate counters across independently created clients/workers, safe failure behavior via controlled local simulations, privacy-safe logs, and category-only results. Stop on any connection failure, unexpected response, secret exposure, or unavailable rollback.
5. **Phase E — disable/rollback verification.** Turn the flag off, redeploy/restart if necessary, verify in-memory limiting, rerun the guarded suite, and show disabled mode has no Key Value dependency. Stop if the prior default cannot be restored.

## 7. Test and acceptance matrix

| Evidence | Pass criterion |
| --- | --- |
| Five live categories and exact policies | `login`, `booking_create`, `manage_lookup`, `manage_cancel`, and `manage_recovery` retain their current strings, maxima, and windows. |
| Privacy-safe key contract | Valid HMAC digests accepted; raw email/IP/malformed/empty keys rejected before provider calls; no raw source/digest/secret in output. |
| Store semantics | Atomic increment plus first-write expiry, shared backend across two independently created adapters, and concurrent requests produce no over-limit bypass. |
| Failure behavior | Timeout, unavailable, and malformed responses reach the approved generic fail-closed route behavior; no unapproved fallback. |
| Activation boundaries | Disabled means no client connection; incomplete config cannot enable; production enablement is rejected. |
| Health | `/api/health` stays successful without provider availability. |
| Rotation | Key reset/fragmentation behavior documented and tested; rollback returns to the selected prior mode. |
| Regression and hosted evidence | Existing API tests pass; full guarded staging suite passes before and after enable/disable. |

No single-service staging result is evidence of real multi-instance enforcement. Acceptance requires deliberate multi-adapter test evidence plus the approved staging window.

## 8. Rollback and operational ownership

Proposed owner for all roles, pending confirmation: **Slotzy founder/operator**. That owner alone authorizes staging enable/disable, controls Render secrets, monitors safe provider availability signals, responds to an outage, executes rollback, and confirms recovery using the guarded suite.

Permitted evidence is redacted category-only status: deployment state, environment classification, enabled/disabled state, route/category, HTTP status, decision/failure category, request ID, test-window timestamps, and guarded-suite result. Preserve no secrets, connection values, raw keys, customer data, raw IPs, logs containing sensitive values, or screenshots with connection details.

## 9. Hard stops

Do not implement or activate when HMAC ownership/rotation, connection restrictions, or route-specific outage behavior is unresolved; unit/integration tests fail; rollback is not proven; testing needs real customer data; credentials could enter logs/files; production could be targeted; Netlify deployment or unexpected Supabase migration is required; or a paid upgrade/unexpected cost appears.

## 10. Final PM decision and next package

The HMAC, outage, configuration, and rollout proposals are sufficiently specific for owner review, but they require explicit owner signoff on the dedicated secret/rotation owner, proposed fail-closed outage policy, variable contract, access/cost pre-flight, short staging window, rollback authority, and acceptance criteria.

**Staging activation is not approved. Provider-backed implementation is not approved by this documentation task. Production is not approved.**

After those decisions are accepted, authorize one consolidated code package only: **P0-F5q — Staging-only shared limiter wiring and local failure-mode integration.** It must remain disabled by default and require local tests plus Render staging validation.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required now? | **No.** Future backend rollout uses `[skip netlify]`. |
| Render required now? | **No change now.** A future approved staging activation would use Render backend/secret configuration. |
| Supabase migration required? | **No.** |
