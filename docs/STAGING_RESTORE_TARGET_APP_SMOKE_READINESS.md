# Isolated staging restore-target application smoke readiness — P0-F3

**Status:** Preflight complete; **execution blocked until an isolated restore-target API exists**. No restore or application smoke has been executed. This checklist authorizes no restore, resource creation, migration, configuration change, secret/environment-variable change, provider send, or production access.

**Purpose:** Make the entry criteria for the isolated staging restore-target application smoke explicit before an authorized operator performs the separate restore procedure in [the smoke plan](STAGING_RESTORE_TARGET_APP_SMOKE_PLAN.md). This is operational preparation for solo-founder staging QA, not production approval. Production remains **no-go** until this smoke and a separately accepted production-equivalent restore rehearsal are complete.

**Current preflight result:** [P0-F3a preflight result](STAGING_RESTORE_TARGET_APP_SMOKE_PREFLIGHT_RESULT.md) found a possible disposable database label but no isolated Render restore-target API, no isolated frontend context, and no approved notification-safe mode. Do not repoint normal staging API; the app smoke is blocked.

## Non-negotiable boundary

- Use no production or customer data. The target and every smoke fixture must be synthetic/non-customer.
- Do not record or paste dumps, row contents, screenshots, raw logs, private links, tokens, JWTs, passwords, raw IPs, provider credentials, service-role keys, connection strings, or secrets in Git, chat, or ordinary notes.
- Store operational evidence outside Git with restricted access, a short approved retention period, and only redacted labels, aggregate results, and pass/fail facts.
- Notifications must be disabled, mocked, or limited solely to an approved safe synthetic test destination. A persisted booking action is authoritative; message delivery is not.

## Required preflight answers

Every item needs a safe affirmative answer in restricted operational evidence before execution. Use labels and roles, never credentials or private identifiers.

| Required answer | Preflight confirmation |
| --- | --- |
| Is there an isolated restore-target Supabase project/database? | `[Yes/No; safe label]` |
| What is its safe label? | `[Non-secret target label]` |
| Is it positively separate from production and normal staging? | `[Yes/No; independent verification method]` |
| Is there an isolated Render API service for the smoke? | `[Yes/No; safe API target label]` |
| If no isolated API exists, is API-only/manual smoke blocked? | `[Yes/No; blocker/owner]` |
| Is there an isolated frontend context, or will this be API-only? | `[Isolated frontend/API-only; safe label if applicable]` |
| Are notifications disabled, mocked, or safe-test-only? | `[Mode; approved synthetic destination type only]` |
| What synthetic owner/shop/service/booking data is approved? | `[Fixture labels and scope only]` |
| Who is the restore owner? | `[Named authorized role/person in restricted record]` |
| Who is backup authority? | `[Named authorized role/person in restricted record]` |
| What RPO/RTO draft values are being tested? | `[Draft RPO; draft RTO; approval status]` |
| Where will restricted redacted evidence be stored? | `[Restricted evidence location/type; retention/expiry]` |
| What is the cleanup/expiry plan for the restore target? | `[Owner; target expiry; approved cleanup procedure/reference]` |

## Positive identity and routing verification

- [ ] The source is dedicated staging and its provenance is approved; it is not production.
- [ ] The restore target has a distinct safe label and is independently verified as neither production nor normal staging.
- [ ] The target is approved for replacement/expiry; normal staging cannot be overwritten by the operation.
- [ ] The API, if used, is an isolated target-only service and its database/storage identity is verified without exposing configuration values.
- [ ] `/api/health` can safely identify the expected non-production storage/environment mode; it must not disclose secrets.
- [ ] Any frontend context is isolated and points only to the target API; otherwise the test is explicitly API-only.
- [ ] CORS/origin configuration admits only the intended isolated caller(s), not production, normal staging, previews, or other unintended environments.
- [ ] Notification behavior is verified as disabled, mocked, or approved-safe-test-only before a mutation is attempted.
- [ ] Synthetic fixtures and test credentials are approved and available without recording authentication material.
- [ ] Restore owner, backup authority, reviewer/smoke owner, RPO/RTO draft, safe evidence location, and target cleanup expiry are confirmed.

## Hard stop conditions

Stop. Do not restore, connect an application, run a smoke mutation, or work around the condition if any of the following is true:

- Target identity is uncertain.
- A production project, database, storage target, service, frontend, sender, or credential is involved.
- Normal staging could be overwritten, reset, or otherwise affected.
- Production customer data is present or may be present.
- A notification provider could send to a real customer.
- An environment variable, secret, credential boundary, or storage mode is unclear.
- A service-role key, database dump, or other secret/private material would need to be pasted into notes, Git, or chat.
- The API points to the wrong database, storage target, or environment.
- CORS/origin configuration allows an unintended environment.
- The smoke requires private data, screenshots, raw logs, dumps, raw request bodies, or private URLs/tokens as evidence.

Record only a redacted blocked result, blocker category, responsible owner, and due date in restricted evidence. Escalate; do not guess or repoint a service.

## Recommended first execution mode

Use **API-only smoke** if an isolated target-only API exists. Do not require Netlify or a frontend context for the first proof.

1. Confirm the isolated target/API labels and verify `/api/health` reports the expected non-production storage/environment identity.
2. Log in only with the approved synthetic owner account.
3. Read the synthetic shop, profile, services, and availability.
4. Create one synthetic booking only after notification handling is confirmed disabled, mocked, or safe-test-only.
5. Cancel that synthetic booking only if the manage flow is confirmed safe; otherwise mark it skipped with the reason.
6. Record only redacted pass/fail evidence and aggregate/safe identifiers. Do not capture private content or credentials.

An isolated frontend smoke may follow only when its origin and API routing are proven target-only. It is not a substitute for API/storage identity verification.

## Result template

Use this template in restricted evidence after authorization. Keep the Git record at this readiness status; do not paste completed restricted evidence here.

| Field | Result |
| --- | --- |
| Execution status | Blocked pending isolated restore-target API / executed |
| Environment identity | `[Redacted safe label and verification result]` |
| Restore target label | `[Safe label]` |
| API target label | `[Safe label or not applicable]` |
| Storage mode | `[Expected non-secret mode and pass/fail]` |
| Synthetic data used | `[Approved fixture labels/scope only]` |
| Tests attempted | `[Health, login, reads, booking, cancellation as applicable]` |
| Tests skipped and why | `[Safe reason]` |
| Pass/fail | `[Pass/fail/blocked; safe summary]` |
| Cleanup confirmation | `[Target cleanup/expiry owner and confirmation]` |
| Gaps / owner / due date | `[Remaining safe categories]` |

## Open decisions before execution

- Safe labels and independent identity proof for the restore target and any isolated API/frontend.
- Whether an isolated Render API already exists; if not, whether API-only/manual smoke is blocked until one is authorized.
- Whether a frontend context is needed after API-only proof.
- Approved synthetic fixture scope, notification-safe mode/destination, restore owner, backup authority, reviewer, and RPO/RTO draft values.
- Restricted evidence location, retention/expiry, and authorized restore-target cleanup/expiry procedure.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No** for recommended API-only smoke. It is needed only if a separately isolated frontend context is used. |
| Render required? | **Yes, only if API smoke is to run through an isolated API service.** If no isolated API exists, API-only/manual smoke is blocked until that prerequisite is authorized and available. This checklist creates or changes no service. |
| Supabase migration required? | **No.** This is restore-target operational validation; no schema change or migration is authorized. |

## Related records

- [Staging restore-target application smoke plan](STAGING_RESTORE_TARGET_APP_SMOKE_PLAN.md)
- [Staging restore-target application smoke preflight result](STAGING_RESTORE_TARGET_APP_SMOKE_PREFLIGHT_RESULT.md)
- [Production gate status](PRODUCTION_GATE_STATUS.md)
- [Production gap review](PRODUCTION_GAP_REVIEW.md)
- [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md)
- [Staging alert routing tabletop result](STAGING_ALERT_ROUTING_REHEARSAL_RESULT.md)
- [Privacy and data retention inventory](PRIVACY_DATA_RETENTION_INVENTORY.md)
- [Notification reliability decision](NOTIFICATION_RELIABILITY_DECISION.md)
