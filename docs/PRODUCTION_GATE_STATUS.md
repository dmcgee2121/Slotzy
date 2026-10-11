# Production gate status matrix and next-package decision

**Status:** Planning/status record only. It authorizes no code, configuration, provider, production resource, secret, schema, migration, or payment change.

**Current framing:** Slotzy is **staging-ready for solo-founder QA** and **not production-ready**. Founder-led guarded staging checks and multi-device UAT are useful risk reduction, not production evidence. No external-tester validation exists, and no payment launch is approved. Current staging safeguards reduce risk but do not satisfy the production gates below.

## Status legend

| Status | Meaning |
| --- | --- |
| **Staging foundation complete** | Implemented and/or validated for controlled solo-founder staging QA; not production approval. |
| **Decision/plan complete** | Scope and requirements are recorded, but implementation, operational approval, or evidence is pending. |
| **Pending** | Material work and/or approval remains. |
| **Out of scope** | Not required for the current staging QA scope; a separate approval is required before it can launch. |

## Production gate matrix

| Gate/lane | Current status | Completed evidence | Remaining blocker | Next recommended package | Infrastructure needed | Production readiness |
| --- | --- | --- | --- | --- | --- | --- |
| Account security | **Staging foundation complete** | Durable JWT invalidation/logout-all; owner/barber password change refreshes the current session and revokes older sessions; staging API/UI checks completed. | Self-service recovery/reset, verified recovery enrollment, bounded session/device policy, and production regression/security review remain. | Define and implement secure self-service recovery only after its verification, enumeration, privacy, and support contract is approved. | Future backend/API work; likely Render and potentially Supabase data work; no change authorized now. | **No-go** |
| Operator recovery | **Staging foundation complete** | Operator-assisted recovery runbook is hardened for controlled staging; generic recovery-help controls do not disclose account existence or send recovery messages. | Named production roles, verified recovery factors, production support/escalation and self-service recovery decision are incomplete. | Keep operator-assisted process bounded in staging; complete recovery design before broader beta/production. | Docs/process now; future backend and support operations. | **No-go** |
| Observability | **Staging foundation complete** | Backend allowlisted safe events are deployed on Render staging; guarded staging passed 3/3. Notification outcome taxonomy and authoritative booking events are defined. | Production alert route, dashboard/log access, thresholds, retention/access approval, and rehearsed response are absent. | **1. Configure and rehearse a minimal staging alert path** for existing safe backend signals; document owner, escalation, and evidence. | Render/platform alert capability; no Netlify or Supabase migration required for the first slice. | **No-go** |
| Alert routing | **Decision/plan complete** | Thresholds, event taxonomy, response levels, the [staging alert routing/rehearsal runbook](STAGING_ALERT_ROUTING_REHEARSAL.md), and [P0-F2a configuration/tabletop result](STAGING_ALERT_ROUTING_REHEARSAL_RESULT.md) are documented. The staging service's failure-notification settings were manually verified. | Full delivered-alert rehearsal, backup owner, escalation timing, delivery evidence, and production routing/access/retention remain pending. | Identify an approved safe delivery simulation and complete the full staging delivered-alert rehearsal; defer production routing until operational evidence is accepted. | Render/platform capability; optional approved alert provider later. | **No-go** |
| Frontend/runtime visibility | **Staging foundation complete** | Netlify staging exposes non-secret version/build/cache/API-mode data; browser diagnostics remain local/redacted; guarded staging passed 3/3. | Production deploy visibility, alerting for missing/mismatched metadata, stale-cache rehearsal, and production access/retention decisions remain. | Include deploy/runtime verification in alert-routing package; rehearse a controlled stale-cache symptom later without customer data. | Netlify for later deploy/visibility review; no migration. | **No-go** |
| Rate limiting and abuse controls | **Staging foundation complete** | Bounded in-process HMAC-keyed limiter, generic responses, safe events, focused tests, guarded Render staging validation, and the [P0-F4 source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md) exist. | Counters are instance-local, reset on deploy, and direct-socket source keys await proxy validation; coverage is not distributed enforcement. | **3. Execute the staging proxy/source-boundary validation, then select a shared-control implementation plan** without deploying production infrastructure prematurely. | Render staging for source validation; provider/store decision later; no Netlify or migration for the decision slice. | **No-go** |
| Production shared limiter/store | **Decision/plan complete** | Shared-store/source-key decision record identifies ephemeral shared store or edge controls as likely paths and defines privacy/failure requirements. | Store/provider choice, source trust boundary, ownership, retention, fail mode, implementation, multi-instance/outage tests, and approval are pending. | After package 3 decision evidence, implement the smallest approved shared limiter with redacted observability and failure tests. | Likely Render plus approved Redis/edge provider; Supabase migration only if a separately approved database fallback is chosen. | **No-go** |
| Environment separation | **Decision/plan complete** | Production separation requirements cover separate projects/services/site/context, origins, secrets, access, storage, and sender/provider boundaries. | Production resources, access review, secret inventory, origin verification, sender/provider separation, and evidence are not approved. | Complete only when production launch scope is approved; do not create production resources during solo-founder QA. | Later Netlify, Render, Supabase, and applicable provider configuration. | **No-go** |
| Launch/rollback rehearsal | **Decision/plan complete** | Written go/no-go, stop conditions, write-freeze rules, rollback decision tree, and rehearsal checklist exist. | Named authorities, production evidence, Render/Netlify rollback rehearsal, and accepted restore/communication paths are missing. | Rehearse after alert routing, restore validation, and production-environment approval—not before. | Later Render and Netlify; Supabase operational restore review, no inherent migration. | **No-go** |
| Backup/restore validation | **Pending / blocked** | Isolated staging database restore rehearsal passed; synthetic-only restore-target app smoke plan, evidence rules, [P0-F3 readiness checklist](STAGING_RESTORE_TARGET_APP_SMOKE_READINESS.md), and [P0-F3a preflight result](STAGING_RESTORE_TARGET_APP_SMOKE_PREFLIGHT_RESULT.md) exist. | No isolated restore-target API was observed; restore-target application smoke, approved RPO/RTO/owners, and production-equivalent restore rehearsal are unperformed. | **2. Authorize and positively verify an isolated restore-target API path, complete remaining readiness answers, then run the smoke** with approved synthetic data and safe notification handling; record redacted pass/fail evidence. Do not repoint normal staging API. | Supabase restore target/access; isolated Render API required for app smoke; Netlify only if an isolated frontend context is used. No migration. | **No-go** |
| Privacy/data retention | **Decision/plan complete** | Inventory documents application, log, provider/outbox, backup, and support data categories plus redaction rules. | Approved retention schedule, legal/privacy review, deletion/export process, provider terms/log handling, access ownership, and support workflow are pending. | Assign owners and approve retention/access/request decisions before any production data or provider activation. | Docs/governance first; later platform/provider review; possible future data automation. | **No-go** |
| Notification reliability | **Decision/plan complete** | Best-effort/current promise, authoritative-action boundary, failure behavior, privacy rules, and requirements for durable delivery are documented. | Approved channel/provider/sender, safe test routing, durable outbox/idempotency, retry/outcome tracking, provider privacy, observability, and support escalation are unimplemented. | After privacy and provider decisions, design/implement the smallest durable notification path for one approved channel. | Likely Render plus provider; possible Supabase migration/data design; no Netlify required unless UI wording changes. | **No-go** |
| Payment readiness | **Out of scope / pending** | Payments are disabled; no payment launch is approved. | Separate payments program: provider, merchant/refund/dispute ownership, reconciliation, legal/privacy, failure handling, and testing. | Do not start until a separate payment-launch decision explicitly authorizes it. | Separate provider and likely backend/configuration work; no current requirement. | **No-go** |
| External tester/broader beta validation | **Pending** | Founder-led multi-device UAT and guarded staging validation cover the owner/barber/customer loop. | No independent, structured, consented external tester evidence; broader-beta safeguards (including shared limiting and notification reliability if relied on) remain incomplete. | Continue repeatable founder staging QA; plan a small structured external test only after relevant safeguards/support controls are ready. | No production infrastructure required to plan; later approved staging support/test routing. | **No-go** |

## Top three next packages

1. **P0-F2 — minimal staging alert routing and rehearsal.**
   - **Why first:** The highest current operational risk is that an authoritative booking, authentication, or broad API failure remains undetected despite the existing safe-event foundation.
   - **Smallest safe scope:** Configure one approved staging-only alert path for existing redacted backend health, 5xx, authoritative-write, and broad notification-failure signals; assign an owner; rehearse one safe alert; record no customer data. Avoid a new monitoring SDK, dashboards, production configuration, or frontend feature work.
   - **Type:** Configuration/operational documentation; no code or migration expected.

2. **P0-F3 — isolated staging restore-target application smoke.**
   - **Why second:** Restore capability is the highest irreversible-data risk. A database restore rehearsal exists, but Slotzy has not proven that the restored application path works safely.
   - **Smallest safe scope:** Execute the existing synthetic-only smoke plan against a positively identified isolated restore target, with notifications disabled/mocked or routed only to an approved safe test destination. Set draft/approved RPO/RTO and authorities as required for the exercise; preserve only redacted evidence.
   - **Type:** Operational validation; no feature code or migration expected.

3. **P0-F4 — shared limiter decision validation, then smallest approved implementation.**
   - **Why third:** The staging limiter reduces present risk but cannot defend a multi-instance or production deployment. This package should begin with the prerequisite Render proxy/source-boundary validation and a cost/privacy/failure-mode decision—not premature provider provisioning.
   - **Smallest safe scope:** Validate source behavior in controlled staging, confirm the trusted-proxy boundary, choose the least-complex approved shared/edge control, and define route-level outage behavior, retention, ownership, and tests. Only then authorize a separate implementation package.
   - **Type:** Staging validation and decision work first; later backend/configuration work. No Supabase migration is expected unless the separately discouraged database fallback is explicitly chosen.

Notification durability and privacy retention are still production gates, but they should follow their remaining provider/privacy decisions rather than introducing a provider or feature during this narrow next-package sequence. Environment separation and launch/rollback rehearsal likewise remain required, but creating production resources before the prerequisites above would be premature.

## Highest remaining blocker

**No rehearsed, owner-routed alert path for the safe signals already emitted** is the highest immediate operational blocker: a persisted booking failure, authentication outage, or broad service failure can still be discovered late. The closely related highest irreversible-data blocker is the unperformed restore-target application smoke. Neither staging safeguard is a substitute for the production gates.

## Infrastructure impact for this status package

| Question | Answer |
| --- | --- |
| Netlify required? | **No** for this documentation/status package or the first backend alert-routing slice. It is later needed for frontend production deployment/rollback and production runtime-visibility review. |
| Render required? | **No** for this documentation/status package. **Yes later** for the recommended staging alert-routing rehearsal and limiter source-boundary validation; potentially for an isolated restore-target API. |
| Supabase migration required? | **No.** The status package, alert-routing rehearsal, and restore-target smoke need no migration. Future notification outbox or a chosen database limiter fallback may require separately approved data work. |

## Related records

- [Production gap review](PRODUCTION_GAP_REVIEW.md)
- [Production hardening roadmap](PRODUCTION_HARDENING_ROADMAP.md)
- [Production observability minimum](PRODUCTION_OBSERVABILITY_MINIMUM.md)
- [Rate limits and abuse controls plan](RATE_LIMIT_ABUSE_CONTROLS_PLAN.md)
- [Production rate limiter decision](PRODUCTION_RATE_LIMITER_DECISION.md)
- [Staging proxy/source-boundary validation plan](STAGING_PROXY_SOURCE_BOUNDARY_VALIDATION.md)
- [Production environment separation](PRODUCTION_ENVIRONMENT_SEPARATION.md)
- [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md)
- [Staging restore-target app smoke plan](STAGING_RESTORE_TARGET_APP_SMOKE_PLAN.md)
- [Staging restore-target app smoke readiness checklist](STAGING_RESTORE_TARGET_APP_SMOKE_READINESS.md)
- [Staging restore-target app smoke preflight result](STAGING_RESTORE_TARGET_APP_SMOKE_PREFLIGHT_RESULT.md)
- [Privacy and data retention inventory](PRIVACY_DATA_RETENTION_INVENTORY.md)
- [Notification reliability decision](NOTIFICATION_RELIABILITY_DECISION.md)
- [Beta readiness summary](BETA_READINESS_SUMMARY.md)
