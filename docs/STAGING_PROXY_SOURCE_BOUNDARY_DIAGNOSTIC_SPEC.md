# Protected staging source-boundary diagnostic design — P0-F4b

**Status:** Design only; **not implemented**. This record authorizes no route, event, environment/configuration change, runtime behavior, proxy trust change, limiter source-key change, deployment, or hosted validation.

**Purpose:** Define the smallest future diagnostic that can supply category-only evidence for the [staging proxy/source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md). It must determine whether a forwarded source signal is ignored, overwritten, preserved, ambiguous, rejected, or unsafe without revealing raw network values or changing the current direct-socket limiter.

The current direct-socket source behavior remains required. This diagnostic would only observe and classify the boundary; it must not make a forwarded source eligible for rate-limit keys. A separate acceptance decision is still required before any trust or limiter change.

## Recommended access model

Use all of the following gates:

1. **Staging runtime only.** Non-staging and production-like runtimes must not register the route or emit this diagnostic event, even if any diagnostic flag is set.
2. **Disabled by default.** Registration requires one explicit staging-only environment flag, with a documented short expiry and named owner.
3. **Authenticated owner only.** Require the existing authenticated owner authorization path and an active owner role; do not accept customer, public, or anonymous requests.
4. **Fixed, synthetic test cases only.** The owner may select only a small allowlisted case label. No user-provided source/header value, URL, body, or free-text label is accepted.

An existing authenticated owner session is safer than a separate diagnostic secret: it reuses a bounded authorization path and avoids creating, transporting, retaining, rotating, or redacting another bearer credential. A separate secret is not recommended as the primary control. If the later implementation approval requires defense in depth, use a short-lived, deployment-scoped capability in addition to owner authorization—not instead of it—and do not place it in a URL or emit it to logs/events.

The diagnostic is never public, is not for normal beta traffic, and has no production enablement path. Disabled, unauthorized, wrong-role, and non-staging requests should all receive the same minimal `404` response, without explaining which gate failed.

## Proposed protected endpoint

**Suggested path:** `POST /api/internal/source-boundary-diagnostic`

The endpoint exists only while all runtime gates above are satisfied. A route is preferred over event-only instrumentation because the validation needs a deliberately authorized request that travels through the exact staging ingress path; the event is the audit output, not the trigger.

| Element | Proposed contract |
| --- | --- |
| Method | `POST` only. |
| Authentication | Existing authenticated owner session; reject all other callers with the uniform `404`. |
| Request body | Empty; reject any body/content type rather than parsing or echoing it. |
| Query/path parameters | None; reject query strings and alternate paths. |
| Test selector | A single fixed diagnostic-case label from an allowlist, conveyed through a dedicated bounded request field/header. It is a category label, never a source/header value. |
| Forwarding inputs | Only the pre-approved synthetic forwarding cases defined by the validation runbook may be sent. Their concrete values are transient request input and must never appear in code comments, responses, events, logs, metrics, test fixtures, or retained evidence. |
| Side effects | No limiter consumption or key creation, no rate-limit policy change, no database/storage writes, no customer/account lookup, no notification, and no proxy-setting mutation. |

The implementation must parse forwarding inputs only transiently to classify them. It must never echo, serialize, hash, HMAC, persist, or attach them to an error. It must also avoid generic request logging for this route if such logging could serialize headers or a URL.

### Category-only response

Return a fixed JSON schema containing only the following labels:

| Field | Allowed values |
| --- | --- |
| `environment` | `staging` only |
| `service` | fixed API service label |
| `diagnosticState` | `enabled` |
| `testCase` | fixed allowlisted synthetic case label |
| `directSocketSource` | `present`, `absent`, or `unknown` |
| `forwardedInput` | `none`, `single`, `multiple`, `malformed`, `private`, `ipv4`, `ipv6`, or `unknown` |
| `forwardedHandling` | `ignored`, `overwritten`, `preserved`, `ambiguous`, `rejected`, or `unsafe` |
| `sourceKeyDecision` | `direct_socket`, `future_forwarded`, or `not_approved` |
| `result` | `pass`, `fail`, `blocked`, or `ambiguous` |

`future_forwarded` is descriptive only: it cannot indicate current limiter use or approval. The current implementation should report `direct_socket` or `not_approved` until a separate accepted source-key decision exists. The response must omit source/header values, digest/HMAC/key material, request IDs derived from them, full URL/query/fragment, request body, identity/account data, tokens, and all secrets.

## Safe event contract

**Suggested event name:** `security.source_boundary_checked`

Existing safe-event allowlisting does not currently support the diagnostic fields below. A future implementation must extend it with fixed enum validation for each new field—never generic `safeText` or caller-selected values.

Allowed event fields:

- existing safe metadata: `event`, `environment`, `service`, `release`, bounded generated `requestId`, fixed route, method, and status;
- `operation=source_boundary_diagnostic`;
- `testCase` from the fixed allowlist;
- `diagnosticState=enabled`;
- `directSocketSource` category;
- `forwardedInput` category;
- `forwardedHandling` category;
- `sourceKeyDecision` category; and
- `outcome`/`result` from the fixed result allowlist.

Prohibited event fields include raw IPs, raw/full headers, header values/counts/chains, source strings, HMACs, digests, limiter keys, full URLs/query/fragment, request/response bodies, authorization data, tokens, passwords, customer/account/appointment data, user identifiers, provider credentials, and any identifier derived from source/header content. Event field names and values must be bounded low-cardinality enums. The event must be emitted once per authorized diagnostic request, including a safe blocked/ambiguous outcome; it must not emit on rejected/disabled/public probes.

## Required local test coverage for the future implementation

All tests must use synthetic fixtures and assert categories only. They must not depend on hosted traffic, secrets, customer data, or real network addresses.

- Disabled mode and wrong environment return the uniform safe `404` and emit no diagnostic event.
- Production-like `NODE_ENV` refuses to register/enable the diagnostic even if the staging flag is set.
- Anonymous, customer, and non-owner authenticated callers receive the same `404`; an authorized owner is required.
- Empty body/fixed input enforcement and unknown case labels are rejected without event emission or reflected input.
- Each category case: missing header, single forwarded header, multiple forwarded header, malformed forwarded header, private-looking forwarded input, IPv4-looking forwarded input, IPv6-looking forwarded input, and an explicit spoofed-header case.
- For each case, assert the expected `forwardedInput`, `forwardedHandling`, `sourceKeyDecision`, and result categories only.
- Assert no response/event contains any fixture source/header material, HMAC/digest/key material, full URL/body, authorization data, token, or customer/account fixture data.
- Assert the diagnostic neither calls the limiter nor changes the existing direct-socket source path.
- Assert event schema rejects unallowlisted diagnostic values and retains only approved enum fields.

Local tests can prove the diagnostic's classification contract and redaction behavior. They cannot prove Render's ingress behavior; that is the later staging validation's purpose.

## Later staging workflow

1. Obtain separate approval for implementation, exact access configuration, tests, and a short diagnostic expiry/removal decision.
2. Deploy only to the positively identified staging service; verify it remains disabled until the approved window.
3. Enable it only for that window, using the explicit staging flag and authenticated owner access.
4. Send the minimum paced synthetic requests needed for each approved case. Do not use production/customer traffic, customer accounts, customer data, or normal beta traffic.
5. Retain only the category-only response/event facts authorized by the validation plan; do not retain raw logs, headers, screenshots, traces, or full URLs.
6. Disable and preferably remove the route after validation. Keeping it behind a disabled-by-default flag requires a separate expiry, owner, and periodic-review decision.
7. Interpret `preserved`, `ambiguous`, `unsafe`, direct-path uncertainty, or topology variation as a stop: retain direct-socket behavior and do not trust forwarded inputs.

## Hard stops

Stop implementation or validation immediately if any of these would occur:

- a raw IP/source/header value, header chain/count, or raw network-derived value would be exposed or retained;
- an HMAC, digest, or limiter key would be emitted or returned;
- production could register or enable the diagnostic;
- the endpoint could be publicly, customer, or ordinary beta accessible;
- customer data, account context, booking data, or a real customer identity is needed;
- logs, metrics, exceptions, middleware, or test artifacts emit raw network data;
- a forwarded source appears accepted before a trusted boundary is independently proven;
- evidence would require screenshots, raw logs, traces, request/response bodies, or full URLs; or
- the diagnostic changes source-key selection, limiter behavior, thresholds, proxy trust, or traffic routing.

Record only a safe blocker category. Do not work around a hard stop by recording more diagnostic data.

## Open decisions

- Whether the final implementation needs a route at all, or whether an approved synthetic test hook can safely produce equivalent proof; route is currently recommended.
- Whether owner authorization alone is sufficient or a short-lived second capability is justified after threat/access review.
- Whether to remove the endpoint immediately after validation (preferred) or retain a disabled-by-default capability with a formally approved expiry and periodic review.
- Exact case-label and result taxonomy, including the definition of `overwritten` versus `ambiguous` for each intended Render path.
- Retention, access, and incident handling for the permitted category-only events.
- Whether to consult current Render documentation/support before implementation to refine expected topology; such consultation must not substitute for observed staging evidence.

## Infrastructure impact and boundary

| Question | Answer |
| --- | --- |
| Backend implementation authorized now? | **No.** This is a design specification only; implementation and all staging traffic require separate approval. |
| Netlify required? | **No.** Only relevant later if a Netlify/CDN path is explicitly included in the topology under validation. |
| Render required? | **Yes later.** A separately approved implementation would be deployed and exercised only on the actual Render staging path. No Render change is authorized here. |
| Supabase migration required? | **No.** The diagnostic requires no persistence or schema change. |

## Related records

- [Staging proxy/source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [P0-F4a evidence capability review](STAGING_PROXY_SOURCE_BOUNDARY_EVIDENCE_CAPABILITY.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
