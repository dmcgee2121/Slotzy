# Staging restore-target application smoke plan

**Status:** Planning only; rehearsal pending.  
**Boundary:** Staging-only, isolated restore target, synthetic/non-customer data only. This plan authorizes no restore, project/service creation, configuration change, or production access.

## Purpose and scope

The prior isolated staging database restore rehearsal validated database-level restore steps, but did not validate an application deployment or smoke path against the restore target. This plan defines the next proof: after an authorized operator restores a staging snapshot into an isolated non-customer target, verify that the Slotzy application can safely read and perform limited synthetic workflows against that target only.

This is not a production restore plan and does not make Slotzy production-ready. Production remains a no-go until this smoke and a separately accepted production-equivalent restore rehearsal are complete.

## Restore-target requirements and data boundary

The target must be independently identified from active staging and production; use separate credentials, a distinct project/branch/target label, no public routing, and no active staging API or frontend pointing to it. A temporary isolated API may be used only with target-only configuration and an explicit non-production guard. A frontend test context is optional; if used, its API configuration must point to the isolated target only.

Use approved synthetic test accounts, shops, services, availability, bookings, and test recipients only. Count-only/aggregate restore checks may be recorded. Never copy production customer data into staging, rehearsal, local, preview, or other lower environments. Do not copy private customer contacts, message payloads, passwords, JWTs, bearer manage links/tokens, secrets, raw IPs, raw request bodies, or full private URLs/query strings/fragments into the target or evidence. Do not use a real customer account to smoke owner login, booking, manage, cancellation, or notifications.

## Draft recovery objectives and authorities

| Field | Draft / placeholder |
| --- | --- |
| RPO | `[To approve: maximum acceptable snapshot age/data loss]` |
| RTO | `[To approve: maximum acceptable time to restore and complete smoke]` |
| Restore owner | `[Named authorized operator]` |
| Backup authority | `[Named approval authority]` |
| Reviewer | `[Independent target/source verifier]` |
| Smoke owner | `[Named test executor]` |
| Escalation owner | `[Named incident/launch owner]` |

No restore proceeds without a named restore owner, backup authority, and reviewer. Record names only in restricted operational evidence, not public documentation if that is inappropriate.

## Safe evidence rules

Evidence may include date/time, release/revision, source and target environment labels, approved snapshot identifier, high-level restore result, aggregate table counts, health status, safe storage/environment indicator, smoke pass/fail checklist, and redacted event category/correlation ID where already approved. It must never contain secrets, credentials, connection strings, tokens, private links, contacts, raw IPs, passwords, JWTs, raw bodies, full URLs/query strings/fragments, database exports, row contents, screenshots containing private data, or generated test artifacts. Store restricted operator evidence outside Git with limited access and short approved retention.

## Pre-restore checklist

- [ ] Confirm the source is dedicated staging, never production; stop on any ambiguity.
- [ ] Confirm the restore target is empty or approved for replacement, isolated, non-customer, and distinct from staging/production.
- [ ] Confirm target credentials, API configuration, storage configuration, and optional frontend context are target-only.
- [ ] Record approved snapshot/export provenance, timestamp, retention, source/target labels, and draft RPO/RTO without secrets.
- [ ] Confirm only approved synthetic data will be used for app checks and safe test notification routing is available or notifications can be disabled/mocked.
- [ ] Confirm named restore owner, backup authority, reviewer, smoke owner, and stop/escalation path.
- [ ] Establish pre-restore aggregate/schema baselines using the read-only approach in [CLOSED_PILOT_BACKUP_RESTORE_RUNBOOK.md](CLOSED_PILOT_BACKUP_RESTORE_RUNBOOK.md).

## Restore execution checklist

- [ ] Use the provider-supported restore/import workflow only against the confirmed isolated target.
- [ ] Do not run destructive SQL, reset active staging, modify production, or repoint any live service.
- [ ] Compare target schema/table inventory, aggregate counts, relationship checks, and relevant recurring-block data to the recorded baseline.
- [ ] Confirm the target has no staging/production database, storage, frontend, provider sender, or public-routing connection.
- [ ] Configure/start an isolated API only if target-only environment checks pass; never alter the active staging API database URL.
- [ ] Stop and record a safe failure if any mismatch, target ambiguity, credential exposure, or cross-environment connection appears.

## Application smoke checklist

Run only against the positively identified restore target and approved synthetic records.

- [ ] API health/readiness reports healthy and identifies the expected non-production environment and storage adapter without exposing configuration values.
- [ ] Storage mode is the expected target mode; no staging or production storage access is possible.
- [ ] If an isolated frontend test context exists, its API configuration points only at the restore target; otherwise perform API-only smoke and record that no frontend validation occurred.
- [ ] An approved synthetic owner account can log in; do not record credentials or authentication material.
- [ ] Synthetic shop, services, hours/availability, time-off, and recurring-block behavior can be read as expected.
- [ ] A synthetic booking can be created only if the target workflow is safe; verify through non-sensitive status/aggregate evidence.
- [ ] Manage-link behavior is exercised only with an approved synthetic flow. Do not display, copy, or preserve the bearer link/token in evidence; record only pass/fail and safe correlation data.
- [ ] Synthetic cancellation or reschedule is exercised only if safe and within the approved test fixture; otherwise mark it deferred with a reason.
- [ ] Notifications are disabled, mocked, or routed solely to an approved safe test destination. No customer delivery or production sender is permitted.
- [ ] Existing rate limits do not unintentionally block the paced smoke. Do not alter thresholds; if limited, record category/time safely and stop or wait according to the existing policy.
- [ ] Observability events are present only in approved safe/redacted form and contain no prohibited data.
- [ ] Verify no staging/prod cross-environment access occurred through database, storage, origins, providers, or logs.

## Cleanup, rollback, and stop conditions

For a failed rehearsal, stop/disconnect the isolated API/frontend test context, revoke temporary access under the approved procedure, and preserve only safe evidence. Do not overwrite, reset, or "roll back" active staging. Target cleanup is an authorized operational action outside this plan; never delete a target without confirming its identity and evidence-retention needs.

Stop immediately if the source or target could be production; target isolation is uncertain; a secret or private data appears; a service points across environments; destructive confirmation refers to active staging; notification could reach a customer; restore provenance is unclear; health/storage identity is wrong; data integrity checks fail; or a smoke operation risks real data. Escalate to the named owner rather than guessing.

## Pass/fail criteria

**Pass** requires all preconditions, successful database-level comparisons, target-only API/storage identity, all applicable smoke checks passing with synthetic data, safe notification handling, redacted observability, no cross-environment access, and complete restricted evidence.

**Fail** includes any stop condition, unexplained count/schema/integrity mismatch, inability to prove target identity, critical smoke failure, notification escape risk, unsafe evidence, or missing authority. A partial result is not production evidence; document deferred checks and repeat after remediation.

## Known gaps before production

- This smoke remains unperformed.
- Production-equivalent backup/PITR, restore target, approved RPO/RTO, and accepted rehearsal are still required.
- Restore ownership, access roles, retention, and incident escalation need explicit production approval.
- Notification reliability, privacy/retention, observability/alert routing, production environment separation, and shared production rate limiting remain separate launch gates.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No for API-only smoke.** It is required only if an isolated frontend restore-target context is used. |
| Render required? | **Potentially.** An isolated target-only API may be needed for app smoke; no service creation/configuration is authorized here. |
| Supabase migration required? | **No.** This is restore validation and operational planning, not schema work. |
