# Staging proxy/source-boundary validation plan — P0-F4

**Status:** Planning only; validation pending and currently **blocked by evidence capability**. This record changes no code, limiter threshold, proxy trust setting, infrastructure, environment variable, secret, or provider configuration.

**Scope:** Define a safe staging-only manual/API validation of the request-source boundary used by the current backend rate limiter. The purpose is to determine whether any forwarded source signal can ever be trusted and what evidence is needed before a production source-key decision. It does not approve a shared limiter, production launch, or broader beta.

## Current position and purpose

The staging-safe limiter uses privacy-safe HMAC-derived keys and currently takes its source input from the direct socket. Forwarded headers such as `X-Forwarded-For` and `Forwarded` are deliberately not trusted: their mere presence does not prove that an upstream proxy overwrites, strips, or otherwise protects client-supplied values. Trusting an unverified header could let a client choose its own source identity and evade source-based limits, or could misclassify unrelated clients.

Validation must establish the actual Render request path, trusted proxy boundary, and source-signal behavior before any forwarded value may replace the current direct-socket input. Until then, retain current behavior; do not add an ad-hoc proxy trust setting or change the limiter source key.

The [P0-F4a evidence capability review](STAGING_PROXY_SOURCE_BOUNDARY_EVIDENCE_CAPABILITY.md) found that current safe events, logs, and tests cannot yield the category-only proof required here. The [P0-F4c protected diagnostic implementation/specification](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_SPEC.md) is deployed to staging, but the flag remained disabled during the passed guarded suite and the endpoint was not exercised. See the [rollout result](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ROLLOUT.md). Controlled diagnostic validation remains separately approval-gated; retain direct-socket behavior and do not execute it yet.

## Staging-only boundary and safe test approach

- Use only the positively identified staging service and synthetic requests. Never test production endpoints, customer accounts, customer data, or customer traffic.
- Do not conduct public attack testing, scanning, traffic amplification, or tests intended to bypass limits. Use only paced, minimal manual/API requests within the existing staging safety bounds.
- Do not change limiter thresholds, code, headers, proxy settings, CORS, domains, environment variables, or service configuration while validating.
- Do not store raw IPs, full forwarding headers, request/response bodies, URLs, tokens, credentials, screenshots, raw logs, traces, or dashboard exports in Git or ordinary notes.
- Record only coarse pass/fail facts and safe categories. If a safe existing diagnostic/event cannot answer a question, stop and decide separately whether a narrowly scoped diagnostic endpoint/event is required; no code change is implied or authorized by this plan.

## Validation questions and required answers

| Question | Required safe conclusion/evidence |
| --- | --- |
| Does Render provide a stable trusted proxy chain for this service? | Confirm service topology and whether the observed chain is stable for the staging path, using labels and pass/fail only. |
| Can a direct client-supplied `X-Forwarded-For` be spoofed? | Establish whether an attacker-supplied value is stripped/overwritten, preserved, or ambiguously merged; retain only the category, not the value. |
| Which header, if any, is safe to use? | Name a header only after overwrite/strip behavior and topology are positively proven for every intended path. “None” is an acceptable outcome. |
| How many trusted hops exist? | Record the approved hop-count decision as a number/category and its applicable topology; do not record addresses or header chains. |
| What happens with missing, malformed, multiple, private, IPv4, and IPv6 source values? | For each labelled case, record accepted/rejected/ignored/fallback/ambiguous behavior and whether it preserves the expected source-key category. |
| Can direct service access bypass an expected proxy/CDN? | Determine whether the service can be reached through a path that does not have the proposed trust boundary; if yes or uncertain, forwarded headers remain untrusted. |
| Does custom domain/CDN behavior differ from `onrender.com` behavior? | Compare safe topology/result categories for each authorized staging path. A difference requires separate boundaries or continued direct-socket behavior. |
| Can validation be done without storing raw IPs? | Confirm that only request-time processing plus safe category outcomes are necessary; otherwise stop. |
| What source-key format is acceptable for production? | Specify only a future approved format: environment- and route-scoped HMAC of a validated source signal, or an approved coarse source bucket before HMAC. Never raw IP, raw header, or emitted digest. |
| What evidence is safe to retain? | Retain only the allowed fields below in restricted redacted operational evidence. |

## Acceptable evidence and privacy rules

Restricted evidence may contain only:

- environment label;
- service label;
- route category;
- test-case label;
- safe result category;
- whether a spoofed header was ignored, accepted, overwritten, or ambiguous;
- whether the source-key category remained expected; and
- approved topology/hop-count decision without raw addresses or header contents.

Never retain raw IPs, raw/full headers, request or response bodies, tokens, JWTs, passwords, customer/account data, HMAC/digest values, service-role keys, provider credentials, private links, full URLs/query strings/fragments, screenshots with private values, raw Render logs, or test traces. IP-derived values are privacy-sensitive: they may only be processed transiently for an approved rate-limit source key, must remain internal/TTL-bound, and must not be used for analytics, support lookup, profiling, metric labels, or correlation IDs.

## Hard stop conditions

Stop the validation and record only a safe blocker category if:

- raw IP or raw header values would need to be recorded to answer a question;
- the test would touch production, customer data, customer traffic, or a production endpoint;
- service/environment identity is unclear;
- a rate-limit source-key, threshold, proxy trust setting, or other behavior change would be required before planning is complete;
- forwarded headers appear accepted without proof of the trusted-proxy boundary;
- evidence would expose private client/network data, credentials, tokens, URLs, logs, screenshots, or traces;
- direct service access or a topology difference makes the proposed trust boundary uncertain; or
- paced synthetic requests would create a material availability, notification, or data-write risk.

Do not infer a safe header, guess a hop count, or compensate by repointing traffic. Escalate the unresolved boundary for a separately authorized decision.

## Pass/fail criteria

**Pass for this planning validation** requires a positively identified staging service; synthetic-only paced testing; a documented topology/hop-count decision; an answer for every labelled source-value/path case; proof that the chosen source signal cannot be client-spoofed on every intended path; redacted evidence only; and an approved privacy-safe source-key recommendation.

**Fail or blocked** includes an unknown/variable chain, spoofed or ambiguous forwarded values, direct-path bypass, differing unbounded custom-domain/CDN behavior, need for unsafe evidence, or any hard stop. “Keep direct socket input” is the required safe outcome when no forwarded signal is proven trustworthy.

## Production no-go conditions

Production and broader beta remain **no-go** while any source boundary is unproven, while source-key privacy/retention is unapproved, or while the shared-store/provider, route-level failure behavior, ownership, multi-instance/deploy/outage tests, and operational access controls are unapproved or untested. The current instance-local staging limiter alone is insufficient.

## Recommended next execution mode

Conduct a docs-approved, staging-only manual/API smoke later using synthetic requests and safe category evidence only. Keep current direct-socket behavior until the validation is complete. Make no code change unless this plan identifies a separately approved need for a minimal safe diagnostic endpoint/event. The production shared limiter remains blocked until both source-boundary and shared-store decisions are accepted.

## Remaining open decisions

- Render staging proxy topology, approved trusted hop count, and whether any forwarded header is trustworthy for each path.
- Direct-service access and custom-domain/CDN differences, including whether distinct source-boundary policies are needed.
- The production source-key format, key rotation procedure, TTL/buffer, and privacy/access/retention approval.
- Shared store/provider versus edge/WAF choice, route-level fail behavior, cost/quota ownership, and rollout/rollback controls.
- Whether existing safe observability is sufficient or a separately approved diagnostic is necessary.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No** for the staging backend source-boundary validation. It is relevant later only if a Netlify/CDN path is intentionally part of the topology under review. |
| Render required? | **Yes later.** The staging validation must observe the actual Render service path; this plan makes no Render change. |
| Supabase migration required? | **No.** Source-boundary validation requires no schema change or migration. |

## Related records

- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [P0-F4b protected source-boundary diagnostic design](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_SPEC.md)
- [P0-F4c protected source-boundary diagnostic rollout](STAGING_PROXY_SOURCE_BOUNDARY_DIAGNOSTIC_ROLLOUT.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
- [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md)
- [Privacy and data retention inventory](PRIVACY_DATA_RETENTION_INVENTORY.md)
