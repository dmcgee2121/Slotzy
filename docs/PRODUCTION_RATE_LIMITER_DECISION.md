# Production rate limiter shared-store and source-key decision

**Status:** Pending approval and implementation.  
**Scope:** Production decision record for P0-B2a; this record implements no limiter.

## Decision summary

P0-B2a's bounded in-process limiter remains appropriate for controlled, solo-founder staging QA. It is not a production control: counters are per instance, reset on deploy, and can be bypassed when traffic is distributed across instances.

Before production or a broader beta, Slotzy must validate Render's proxy/source behavior and adopt shared enforcement. The preferred future direction is an ephemeral shared limiter store (Redis or an Upstash-style equivalent), or provider-native edge/CDN/WAF controls where they provide needed coverage, privacy, and access at lower operational cost. A hybrid may combine edge volumetric protection with an application shared store for account, manage-token, and recovery controls. Do not use core booking database tables for high-churn limiter counters unless no better option is available and the design is separately approved.

This does not block controlled staging QA: P0-B2a already reduces risk in that scope. It is required before production or broader beta because instance-local state cannot provide consistent enforcement or durable abuse resistance.

## Shared-store options

| Option | Pros | Cons | Production readiness / fit | Privacy impact | Operational burden and likely cost | Failure mode |
| --- | --- | --- | --- | --- | --- | --- |
| Render/service-instance local memory | Already deployed; no provider, schema, or network dependency; low latency and bounded cleanup. | Per-instance, reset by deploy/restart, inconsistent with horizontal scale, bypassable through distribution. | **Staging now only; not production-ready.** | Keys stay process-local but remain sensitive and must never be logged. | Lowest cost/burden. | Restart clears counters; one instance cannot protect another. |
| Supabase/Postgres limiter tables | Existing platform; transactions and durable audit can be designed if truly needed. | High-write churn, cleanup/index contention, hot keys, connection pressure, and coupling to the booking database; durability is unnecessary for windows. | **Later fallback only; not recommended by default.** | Persistent identifiers require retention, access, deletion, and privacy review. | Moderate/high schema and query-tuning cost; requires migration. | Limiter contention can degrade core booking traffic. |
| Redis or Upstash-style ephemeral store | Atomic counters/TTL, shared across instances, short-window fit, fast cleanup, separate from booking data. | New provider/access/secrets, network dependency, usage limits/cost, implementation/testing. | **Likely preferred production application store**, pending approval. | TTL-bound HMAC/coarse identifiers only; never raw IPs or logged keys. | Moderate burden and usually modest usage cost. | Store outage follows the approved route-specific fail policy. |
| Provider-native edge/CDN/WAF controls | Stops volumetric traffic before app; good for assets/coarse source controls. | Product/plan/rule expressiveness varies; may not safely key account/manage/recovery semantics; provider logs need review. | **Conditional later recommendation** for broad public/asset protection. | Provider processes network metadata; confirm retention/logging/geography. | Low/moderate app burden; plan cost/access varies. | Rules may be unavailable, misconfigured, or unable to enforce app-specific keys. |
| Hybrid edge controls plus shared ephemeral app store | Edge handles volumetric source pressure; app store handles privacy-safe account, manage-token, recovery keys. | Two controls to configure, observe, tune, troubleshoot. | **Best long-term fit** if cost/access justify it. | Minimize data at both layers; do not duplicate raw identifiers/logs. | Highest complexity and potentially two bills. | Either layer can degrade independently; test explicit fail modes. |

## Source keys and Render proxy verification

P0-B2a currently uses the direct socket address as its source key. Forwarded headers are deliberately untrusted until proven safe. Before trusting a forwarded source signal on Render, verify and document:

- the exact request path and Render proxy/load-balancer headers that reach the service;
- whether Render overwrites or strips client-supplied forwarding headers;
- the trusted-proxy boundary and hop count for every topology, including custom domains and any CDN/WAF;
- direct service access, health checks, IPv4/IPv6, malformed/multiple forwarded values, and attacker-supplied headers; and
- a controlled staging test that confirms the chosen signal is stable and cannot be client-spoofed.

Only then may an explicitly allowlisted, validated source signal replace the direct socket input. Do not broadly trust `X-Forwarded-For`, `Forwarded`, or a configurable proxy chain merely because it is present.

Raw IP addresses must not be logged or persisted without separate privacy approval. They can identify or single out people, increase breach/support exposure, and are unnecessary for routine limiter observability. Derive a request-time, environment-scoped HMAC from an approved source value, or use an approved coarse network bucket before HMACing. Keep the limiter identifier internal, TTL-bound, and out of events. Rotate its secret only under an approved procedure; rotation may reset source continuity.

## Privacy and observability posture

- Never log raw IPs unless separately approved; never log limiter keys or digests.
- Never log passwords, JWTs, manage tokens, private links, customer contacts, raw bodies, full URLs, query strings, or fragments.
- Retain abuse/rate-limit identifiers only for the active window plus a short, approved operational buffer; use TTL deletion. Do not repurpose them for analytics, profiling, or support lookup.
- Events may contain only allowlisted low-cardinality fields: safe route, method, category, outcome, environment, release, correlation ID, and approved key type. Metric labels must not contain IPs, HMACs/digests, accounts, shops, tokens, contacts, URLs, or user input.
- Review provider logs, dashboards, exports, roles, and retention before enabling an external store or edge service.

## Shared-store failure behavior

Using P0-B2 terminology: **fail closed** means return the same generic temporary-unavailable/rate-limited envelope when neither shared limiter nor approved bounded fallback can protect the route. **Fail open** means permit the otherwise authorized request and emit an allowlisted `abuse.limiter_degraded` event without private data.

Fail closed for high-abuse or confidentiality-sensitive unauthenticated/security routes: login, registration (if public), password change, anonymous booking creation, public manage lookup, public manage cancellation, manage-link recovery, future self-service recovery/reset, and admin login/destructive administration. Responses must remain non-enumerating.

Fail open, with safe limiter-degraded events, for availability/public lookup reads, protected dashboard/read routes, health/readiness, static assets, and ordinary authenticated staff mutations where authentication and authorization still apply. Reassess new bulk/destructive staff operations independently. A bounded local fallback may be used only if its capacity, bounds, and route policy are tested; it does not make enforcement distributed.

## Operational ownership and rollout

The solo founder owns current staging review. Before production, assign named ownership for provider/store access, secret rotation, quotas/billing, dashboards and alerts, privacy retention/access review, incidents, and rollback. Document who may tune limits or disable a broken rule, with auditable changes that expose no identifiers.

1. Keep the in-process limiter for controlled staging QA; this record changes neither thresholds nor behavior.
2. Validate Render source-key/proxy behavior in controlled staging and record the approved trust boundary.
3. Choose the production control after cost/access review: likely Redis/ephemeral store, provider-native controls, or hybrid. Avoid core booking tables unless no better option exists.
4. Implement and test atomic windows, TTL, multi-instance/deploy behavior, outages, generic responses, redacted events, and false-positive/support handling.
5. Complete privacy/operational approvals, tune from safe aggregate counts, and promote only with explicit production/broader-beta approval.

## Remaining open decisions

- Which validated Render source signal and trusted-proxy boundary will production use?
- Is a Redis/Upstash-style service approved, or do provider-native controls meet requirements and budget?
- Which routes receive bounded local fallback, and what is its tested outage capacity?
- What TTL/buffer, access roles, secret rotation, alert thresholds, and incident owner are approved?
- Does broader beta need a hybrid edge/application design, or is one shared control sufficient?

## Infrastructure impact

| Question | Decision for this record |
| --- | --- |
| Netlify required? | **No.** It may later provide CDN/edge controls, but no Netlify work is required now. |
| Render required? | **Yes, later.** Render staging must validate source/proxy behavior and future backend topology; this docs-only change needs no Render action. |
| Supabase migration required? | **No.** None for this record or preferred ephemeral/provider-native path. A Postgres fallback needs separately approved schema work. |
