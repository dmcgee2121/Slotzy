# Staging proxy/source-boundary evidence capability review — P0-F4a

**Status:** Complete documentation review; hosted validation is **blocked by evidence capability**. This record changes no code, limiter behavior, threshold, proxy trust setting, infrastructure, provider, or deployment.

**Question answered:** Can the present backend implementation, safe events, logs, and local tests establish the Render request-source/trusted-proxy boundary required by the [staging validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)?

## Result

**No.** Existing controls establish the current safe posture, but cannot produce the category-only evidence required to decide whether Render overwrites, strips, preserves, or ambiguously merges a client-supplied forwarding header. Do not run hosted source-boundary traffic validation using the current evidence surface. Keep the direct-socket source behavior unchanged until a later, separately approved diagnostic package is implemented and its validation is accepted.

## Evidence reviewed

| Area | Current behavior | Capability result |
| --- | --- | --- |
| Limiter source input | `coarseRequestSource()` reads `req.socket.remoteAddress`; all current coarse-source policies use that value. It does not read `X-Forwarded-For`, `Forwarded`, Express `req.ip`, or `req.ips`. | Current direct-socket behavior is clear; Render client-source behavior is not observable. |
| Limiter key handling | The source value is immediately included in an environment/route/key-type HMAC key. The key/digest is neither returned nor emitted. | Safe for present staging limiter; cannot evidence which source/header path was selected. |
| Safe events | `buildSafeEvent()` has a fixed allowlist. Rate-limit events contain only safe metadata such as route, method, status, category, outcome, error code, and key type. Unknown fields including `rawIp`, headers, authorization, body, passwords, tokens, contacts, and digests are dropped. | Events are privacy-safe for their allowed fields, but do not contain a source-boundary result. |
| Existing logs | The only limiter-specific event is emitted when a request is limited; normal source selection is silent. | Cannot show spoofed forwarding-header treatment or Render topology. |
| Local tests | Unit tests cover HMAC non-disclosure, limiter behavior, and safe-event allowlisting. API tests use a local loopback socket and check redaction. | They do not inject/evaluate missing, malformed, multiple, private, IPv4, or IPv6 forwarding/source cases against a source-boundary classifier. They cannot prove Render behavior. |

## Answers to the validation questions

1. **Current source input:** Direct socket peer only (`req.socket.remoteAddress`), with `unknown-source` only when absent. The value is HMACed into an internal limiter key. Forwarded headers are intentionally ignored.
2. **Safety of existing events:** The implemented safe-event builder drops unallowlisted input. Current limiter events reveal safe categories/metadata only and do not expose raw IPs, raw headers, HMACs/digests, full URL/body, tokens, or credentials. This is supported by existing observability and rate-limit API tests.
3. **Spoofed forwarded-header result in logs:** **No.** There is no event/field describing header presence, parsing, trusted-proxy decision, selected source class, overwrite/strip/preserve result, or ambiguity. Silence cannot prove ignored versus unobserved.
4. **Local case simulation:** **No, not as a source-boundary proof.** Existing tests can exercise limiter and safe-event primitives, but no exported/classified source-boundary function or relevant API fixture exists for missing/malformed/multiple/private/IPv4/IPv6 forwarded values. Local tests also cannot establish Render's actual proxy behavior.
5. **Proof from existing staging logs:** **No.** Current Render-safe events can prove rate-limit outcomes without sensitive values, but cannot prove the trusted hop count, direct-path access, custom-domain differences, or client-supplied forwarded-header handling.
6. **Hosted validation executable now:** **No.** The plan requires a safe category result for each case. Existing output supplies none, so hosted requests would create unanswerable evidence and must not be run.
7. **Diagnostic required later:** **Yes, if source-boundary validation remains desired.** It must be a separately approved backend code package; it is not authorized or implemented by this review.

## Smallest safe future diagnostic contract

Prefer a narrowly scoped, staging-only diagnostic **event emitted by an explicitly authorized synthetic test path**, rather than a public endpoint. The implementation package must decide authentication/authorization, environment guard, rate bounds, disable/remove plan, test matrix, and review owner before code is written. A protected endpoint is acceptable only if an event cannot be safely tied to that test path.

The diagnostic output must be category-only and allowlist-enforced. It may include only:

- environment and service labels;
- a fixed route category and fixed synthetic test-case label;
- topology/path category and approved trusted-hop decision category/count;
- forwarding-input state: `absent`, `malformed`, `multiple`, `private`, `ipv4`, `ipv6`, or `other`;
- forwarding treatment: `ignored`, `stripped_or_overwritten`, `preserved`, `accepted_from_trusted_boundary`, `rejected`, `fallback_direct_socket`, or `ambiguous`;
- selected source class: `direct_socket`, `validated_forwarded`, `fallback`, or `none`; and
- a final category-only result: `pass`, `fail`, `blocked`, or `ambiguous`.

It must emit **no** raw IP, raw/full header, header count/value, HMAC/digest, limiter key, URL/query/fragment, request/response body, token, JWT, credential, customer/account data, or correlation value derived from those inputs. The raw request values, if examined at all, must be transient in process and never be logged, returned, persisted, placed in metric labels, or included in test artifacts. Existing `buildSafeEvent()` would need an explicitly reviewed allowlist extension for any new labels.

## What remains blocked

- All hosted Render source-boundary traffic validation, because category-only evidence does not exist yet.
- Any trust of `X-Forwarded-For`, `Forwarded`, Express proxy settings, hop count, or source-key change.
- A decision that a forwarded source is trusted on Render, custom-domain, CDN, or direct-service paths.
- Production/broader-beta shared limiter work: provider/store, privacy/retention, ownership, route failure behavior, multi-instance/deploy/outage testing, and approval remain open.

The present direct-socket limiter remains the required behavior for solo-founder staging QA. The production shared limiter remains **no-go**.

## Safest next step

Seek separate approval for the smallest staging-only source-boundary diagnostic package above. First review its privacy contract, access boundary, fixed synthetic test cases, safe labels, and removal/disable plan; only after it is implemented and locally tested may the existing staging validation plan be executed against Render. This review itself requires no Netlify work, no Render change, and no Supabase migration.

## Related records

- [Staging proxy/source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
