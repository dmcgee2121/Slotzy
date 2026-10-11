# Production launch and rollback gate

**Status:** Planning only; no launch is approved.
**Current framing:** Slotzy remains staging-ready for solo-founder QA, not production-ready; there is no external-tester validation and payments remain disabled unless explicitly approved.

## Go/no-go rule

Production launch requires an explicit documented **go** decision by the assigned launch owner after every required item below has evidence. Any missing, stale, contradictory, or privacy-unsafe evidence is a **no-go**. Do not substitute an intention, a successful local check, or a staging deployment for production evidence.

## Required launch evidence

| Gate | Required evidence |
| --- | --- |
| Guarded staging | Current guarded staging checks pass for the proposed revision, with known failures resolved or explicitly accepted. |
| Environment separation | The approved separation checklist is complete: separate production projects/services/site or context, origins, secrets, storage, access, and sender/provider boundaries. |
| Backup and restore | Backup/PITR readiness, a restore owner, recovery targets (RPO/RTO), and the [staging restore-target application smoke plan](STAGING_RESTORE_TARGET_APP_SMOKE_PLAN.md) plus a production-equivalent rehearsal are documented and accepted. |
| Observability and alerts | Redacted backend/frontend signals, production deploy/runtime visibility, alert routing, dashboard/log access, and a tested alert response path are ready. |
| Rate limits | The shared-store/provider and source-key decision is approved and tested before broader beta or production; P0-B2a in-process limits alone are insufficient. |
| Privacy and retention | Data inventory, retention/deletion posture, log redaction, provider retention/access, and support handling are approved. |
| Notification reliability | Promised channels, sender/provider configuration, authoritative-write behavior, delivery failure handling, and observability are approved and tested. |
| Payments | Payments remain disabled unless a separate explicit payment-launch decision approves them. |
| Change record | Release revision, scope, known risks, owners, rollout window, stop conditions, rollback target, and communication plan are recorded. |

## Stop conditions and write freeze

The launch owner may declare a write freeze before deploy and may pause all non-essential writes/configuration while verifying launch or rollback. Stop immediately and hold/revert the launch for authentication/authorization failure; booking write integrity failure; data loss/corruption risk; unexpected customer-data exposure; unsafe logs or secrets; notification amplification or incorrect delivery; failed health/readiness; unbounded error/latency; missing rollback/restore capability; or any evidence gate becoming invalid.

The launch owner controls go/no-go, write freeze, and resumption. A backup authority must be named before production. No one may bypass a freeze to add scope, change secrets, alter schema, or enable payments without explicit incident/launch authorization.

## Rollback decision tree

1. Detect a stop condition through a health check, alert, guarded verification, or credible support report. Preserve only redacted evidence.
2. Freeze non-essential writes and configuration. Identify the affected revision, environment, severity, customer impact, and whether authoritative writes may be incorrect.
3. **Rollback immediately** when the prior known-good revision can safely restore service and the issue affects confidentiality, integrity, authorization, booking writes, widespread availability, or cannot be bounded quickly.
4. **Forward-fix only** when the issue is narrow, reversible, understood, does not endanger data/confidentiality, has a tested fix, and rolling back would create greater risk. The launch owner records why forward-fix is safer.
5. If data may be corrupted or lost, stop writes and follow the approved restore decision; never restore or delete data solely to make dashboards look healthy.
6. Communicate through the assigned customer/support owner, then validate the selected remedy before resuming normal changes.

## Rollback execution and validation

Use only the pre-identified rollback target and platform procedures. Do not make unreviewed production configuration changes during an incident. After rollback or forward-fix, verify: correct deployed revision and environment identity; health/readiness; authenticated and public critical paths; safe booking read/write behavior under the approved test approach; CORS/origin behavior; alert/event visibility; rate-limit availability; notification safety; and absence of new private data in logs. Keep the write freeze until the launch owner accepts the result.

## Customer, support, and incident evidence

Assign a customer/support communication owner before launch, with an approved status/update channel and escalation path. Communications should state impact, current action, and next update timing without exposing another customer's information or internal secrets.

Incident evidence must be minimal and redacted. Never include passwords, JWTs, authorization headers, tokens, private links, customer contacts, raw IPs, raw bodies, full URLs/query strings/fragments, secrets, or customer data. Use release IDs, timestamps, safe route/category, aggregate counts, and correlation IDs only where already approved. Restrict evidence access and apply short retention consistent with the privacy decision.

## Rehearsal checklist

Before production approval, rehearse in staging or an approved non-customer environment:

1. Read the go/no-go record, assign launch, rollback, support, and backup authorities.
2. Run guarded staging for the candidate revision and confirm expected deploy/runtime visibility.
3. Simulate a stop condition and write freeze.
4. Exercise the documented Render and Netlify rollback path without customer data.
5. Validate the resulting revision, health, critical flows, safe events/alerts, and no-private-data evidence rule.
6. Walk through backup/restore escalation without altering production data.
7. Record gaps, update the plan, and repeat if a gate or owner is unclear.

## Open decisions

- Named launch, backup, rollback, support, privacy, and restore authorities.
- Approved production RPO/RTO and the restore-target application rehearsal evidence.
- Approved alert route, dashboard/log access, and incident escalation timing.
- Shared rate-limit control, Render source-key validation, and tested store-outage behavior.
- Notification promise, delivery reliability design, and payment-launch decision (payments default to disabled).

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **Yes for frontend production deployment and rollback rehearsal**, but this plan authorizes no configuration. |
| Render required? | **Yes for API production deployment, rollback, source-key, and runtime validation**, but this plan authorizes no configuration. |
| Supabase migration required? | **No.** Backup/restore readiness and environment separation require operational review, not a schema migration. |
