# Controlled source-boundary diagnostic execution plan — P0-F4d

**Execution status:** Attempted and **blocked/failed**; see the [P0-F4e attempt result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ATTEMPT_RESULT.md) and [P0-F4f source/local review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_400_REVIEW.md). Retry remains blocked pending separately approved local test/runbook correction. This plan does not authorize a retry, flag enablement, source-key change, forwarded-header trust, or production change.

## Target and non-negotiable boundary

| Item | Value |
| --- | --- |
| Environment | Staging only |
| Service | `slotzy-staging-api` |
| Route | `POST /api/internal/source-boundary-diagnostic` |
| Temporary flag | `SLOTZY_SOURCE_BOUNDARY_DIAGNOSTIC_ENABLED=true` |
| Current flag state | Disabled |
| Access | Authenticated owner only |
| Test data | Fixed synthetic cases only; no customer accounts/data |
| Production/customer traffic | Prohibited |

Do not retain screenshots, raw logs, raw headers, raw IPs, request/response bodies, URLs, tokens, credentials, or customer/provider data. The current rate limiter must remain direct-socket based throughout. Forwarded-source trust remains unapproved regardless of diagnostic output unless a separate acceptance decision explicitly changes that status.

## Required approvals before execution

Before starting, obtain explicit approval for the bounded staging window, temporary flag enablement, owner operator, synthetic case set, evidence custodian/location, and flag-disable/redeploy deadline. This plan alone is **not** execution authorization.

## Execution phases

### 1. Preflight

- Positively identify the staging service, intended deployed release, and authorized operator.
- Confirm no production environment, customer identity, customer data, or normal beta traffic is in scope.
- Confirm the diagnostic flag is disabled and the endpoint is unavailable before enablement.
- Confirm the protected route, owner-only access boundary, fixed case-label list, and category-only response/event contract have not changed.
- Establish a short timestamp window and a prompt disable/redeploy deadline before the flag is changed.

### 2. Temporary flag enablement

- Enable only `SLOTZY_SOURCE_BOUNDARY_DIAGNOSTIC_ENABLED=true` on the identified staging service for the approved short window.
- Do not change proxy trust, CORS, limiter thresholds, source-key logic, domains, or any other runtime setting.

### 3. Render redeploy and live confirmation

- Redeploy the identified staging service and wait for the approved release to be live.
- Confirm deployment identity without retaining raw dashboard output, full URLs, or logs.
- If identity is uncertain, stop and disable the flag; do not send a diagnostic request.

### 4. Owner-authenticated synthetic diagnostic calls

Use one paced call per approved fixed case label, with the owner session and no request body/customer context:

- `missing-forwarded`
- `single-forwarded`
- `multiple-forwarded`
- `malformed-forwarded`
- `private-looking-forwarded`
- `ipv4-looking-forwarded`
- `ipv6-looking-forwarded`
- `mixed-forwarded`

Classification is observation only. Do not infer a trusted proxy boundary, change limiter behavior, or enable forwarding-derived keys during this phase.

### 5. Category-only evidence recording

For each call, retain only the fields in the next section. Record a safe blocker category instead of additional diagnostic detail if an expected category is missing, unsafe, or ambiguous.

### 6. Flag disablement

- Disable the diagnostic flag immediately after the final approved case, or sooner on any hard stop.
- Do not retain flag values beyond the allowed enabled/disabled status fact.

### 7. Render redeploy and post-disable verification

- Redeploy the staging service and wait for the approved disabled release to be live.
- Confirm the endpoint is again unavailable while disabled.
- Run the existing guarded staging suite after disablement. Do not treat its success as source-boundary proof.

### 8. Final result documentation

Create a later redacted result record containing only the safe evidence fields, pass/fail/blocker outcome, confirmation that the flag was disabled again, and whether the guarded suite passed. Do not store raw diagnostic output or logs.

## Allowed evidence fields

For the approved time window only, retain these categories:

- timestamp window;
- environment label;
- service label;
- route label;
- fixed case label;
- response-status category;
- forwarded-header category;
- handling classification; and
- source-key decision category.

No raw values may be retained: no network address, header/body contents, authorization/session value, token, HMAC/digest/key, full URL/query/fragment, customer/provider data, screenshot, raw log, trace, or dashboard export.

## Hard stops

Stop, disable the flag promptly, and record only a safe blocker category if:

- a raw IP, header, body, token, URL, digest, or other private value appears;
- the endpoint is accessible anonymously or to a non-owner;
- any production environment or traffic is involved;
- the flag cannot be disabled promptly;
- Render deployment identity is uncertain;
- the diagnostic returns raw values or digest/key material;
- the guarded staging suite fails after enablement or after disablement; or
- any customer, provider, application-write, notification, or availability impact occurs.

Do not compensate for a hard stop by expanding evidence collection, sending more requests, trusting a forwarded header, or changing limiter/proxy behavior.

## Pass criteria

Execution may be recorded as passed only when all of these hold:

- the endpoint is unavailable before enablement;
- it is owner-only while enabled;
- every fixed case returns category-only output;
- no raw network, header, authorization, customer, token, URL, or other private value is exposed or retained;
- the limiter remains direct-socket based;
- forwarded-source trust remains not approved unless separately accepted later;
- the flag is disabled after execution;
- the endpoint is unavailable after disablement; and
- the guarded staging suite passes after disablement.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Is diagnostic execution authorized now? | **No.** This plan requires a separate execution approval. |
| Netlify required? | **No.** The controlled diagnostic is API-only. |
| Render required? | **Yes, later.** It is needed only for the separately approved staging enable/redeploy/disable sequence. |
| Supabase migration required? | **No.** |

## Related records

- [P0-F4e blocked diagnostic attempt result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ATTEMPT_RESULT.md)
- [P0-F4f diagnostic 400 review](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_400_REVIEW.md)
- [P0-F4c diagnostic rollout](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ROLLOUT.md)
- [Protected diagnostic specification](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_SPEC.md)
- [Source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [P0-F4a evidence capability review](STAGING_PROXY_SOURCE_BOUNDARY_EVIDENCE_CAPABILITY.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
