# Privacy and data retention inventory decision record

**Status:** Planning record; production privacy, legal, retention, deletion/export, and support-workflow decisions remain pending.  
**Current framing:** Slotzy is staging-ready for solo-founder QA, not production-ready. This record authorizes neither data deletion nor any implementation, provider, configuration, or production change.

## Decision summary and principles

Slotzy should collect and retain only the minimum data necessary to operate approved booking, account, support, safety, and recovery workflows. This inventory records known data classes and proposed defaults; it is not a privacy notice, legal advice, or an approved retention schedule.

- Never place production customer data in staging, preview, local, restore rehearsal, or other lower environments.
- Never include secrets, private links, raw tokens, passwords, JWTs, raw IPs, customer data, raw bodies, or full URLs/query strings/fragments in logs, tickets, evidence, screenshots, exports, or Git.
- Keep logs redacted, allowlisted, and low-cardinality. Metric labels must not carry customer, account, token, IP, URL, or other private identifiers.
- Do not retain raw IP addresses unless a separate privacy decision approves a defined purpose, access control, and retention period.
- Backups/restores require their own retention, access, encryption, target-isolation, and deletion/expiry review.
- Customer/support access, correction, deletion, and export requests need a named owner, verified intake process, response target, restricted record, and approved workflow.
- Deletion and export automation are future work unless separately implemented and approved. Do not promise immediate or complete backup deletion.

## Inventory and decision matrix

| Category | Purpose and sensitivity | Known location today / intended access | Default retention recommendation | Deletion/export and logging rules | Production status |
| --- | --- | --- | --- | --- | --- |
| Staff account data | Authentication, authorization, shop membership; **high** sensitivity for password hashes/session state. | Application database for staging; authorized account holder and least-privilege operators only. | Retain while account is active plus an approved security/support period; define inactive-account policy before production. | Support verified correction/deletion/export requests; preserve only approved security/audit need. Never log passwords, hashes, JWTs, authorization headers, or account contact data. | **Pending** |
| Shop profile data | Operate public shop profile/configuration; **moderate**, potentially personal/business contact data. | Application database; shop members and approved operators. | Retain while service/shop is active plus approved operational/legal period. | Define owner-verified correction/export/deletion and impact on bookings. Never log private contact fields, profile payloads, or raw bodies. | **Pending** |
| Services, pricing, duration | Booking setup and availability; **low/moderate** commercial data. | Application database; authorized shop members/operators; some fields may be public through booking context. | Retain while active plus approved historical/booking-support period. | Export/deletion may require preserving booking history or anonymized references; define policy. Never log full mutation payloads or non-public pricing/configuration. | **Pending** |
| Availability and schedule data | Display/book available time and enforce scheduling; **moderate** because it can reveal staff patterns. | Application database; authorized staff, with approved public booking exposure. | Retain current schedule; define retention for time-off/recurring history before production. | Define how deletion affects existing bookings and audit needs. Never log full calendars, private notes, or query-rich URLs. | **Pending** |
| Booking and customer data | Create/manage appointments and service communication; **high** sensitivity. | Application database; booking parties through authorized flows and least-privilege operators. | Retain only for approved operational, dispute, accounting/legal, and support duration; exact period pending. | Verified customer request workflow must distinguish cancellation, correction, deletion, export, and backup limitations. Never log names, contacts, appointment details, receipts, or raw booking bodies. | **Pending** |
| Manage-token/private-link data | Authorize customer self-service booking view/change; **high** bearer-secret sensitivity. | Server stores hash/expiry/revocation data; bearer link is client-held/private. Access only through the authorized flow and limited operators when necessary. | Keep hash/state only through token/booking lifecycle plus approved short operational period; exact policy pending. | Revoke/expire safely; do not claim bearer-token recovery. Never log or export bearer tokens, hashes, private links, fragments, or token-bearing URLs. | **Approved for current staging safeguards; production retention pending** |
| Recovery, outbox, notification data | Support recovery and send booking communications; **high** due to contacts/message content/links. | Application/outbox where enabled and provider systems if used; restricted operators/provider roles only. | Minimize queued and delivery records; expire completed/failed payloads under approved short operational policy. | Define request handling, provider deletion limits, sender logs, retries, and exports. Never log recipients, message bodies, recovery material, or private links. | **Pending** |
| Logs and observability events | Diagnose reliability/security; **moderate/high** if unsafe fields leak. | Render/Netlify and approved local diagnostics today; least-privilege operators. | Short, approved platform-specific retention; aggregate metrics preferred for longer trend use. | Support/incident evidence must be redacted and restricted. Never log secrets, contacts, raw IPs, tokens, JWTs, bodies, full URLs/query/fragments, or high-cardinality identifiers. | **Approved staging redaction baseline; production retention/access pending** |
| Rate-limit/abuse identifiers | Limit abuse and diagnose limiter degradation; **high** re-identification risk if network/account-derived. | Current bounded in-process limiter; future shared/edge store pending. Limiter-only access. | Active window plus short approved buffer, enforced by TTL where possible. | Do not repurpose for analytics/support profiling. Never log raw IPs, HMAC/digest keys, account/contact/token identifiers, or metric labels derived from them. | **Pending production decision** |
| Backup and restore copies | Recover service/data after loss or corruption; **high** because copies may contain many categories. | Provider backups and restricted restore evidence; authorized backup/restore roles only. | Approved snapshot/PITR period aligned to RPO/RTO; expire exports and rehearsal targets promptly. | Define backup deletion limitations, access review, encryption, target isolation, and request handling. Never place dumps, rows, credentials, or private evidence in Git/tickets. | **Pending** |
| Uploaded branding images, if applicable | Shop presentation/branding; **low/moderate**, may embed personal data or metadata. | Storage mode/location is pending confirmation; shop owner and limited operators. | Retain while used plus approved cleanup window; define orphaned-upload cleanup. | Define owner deletion/export, derivative/cache handling, metadata stripping, and backup behavior. Never log file contents, signed URLs, or storage credentials. | **Future/pending applicability** |
| Support and incident evidence | Resolve requests/incidents and prove safe operational actions; **high** if mishandled. | Restricted support/incident records outside Git; named support/incident roles only. | Minimum time needed for follow-up and approved incident/support retention; exact period pending. | Verify requester before discussing data; use redacted summaries and a deletion/export workflow once approved. Never include secrets, private links, contacts, tokens, raw logs, dumps, or screenshots with private data. | **Pending** |

## Access, request, and retention governance

Before production, assign a privacy/support owner and backup authority; document who may access each system, approve exceptions, answer verified requests, export data, make targeted corrections, approve deletions, and access backups/logs. Use least privilege and periodic access review. Keep a restricted request record with environment, request type, verification result, scope, decision, operator, limitations, and response date, but no unnecessary customer content.

Every category needs an approved retention period, trigger, deletion method, backup/replica limitation, access owner, and evidence location. Until then, minimize collection and restrict access; do not infer that application deletion removes platform backups, provider records, browser data, or incident evidence.

## Highest-risk gaps

1. No approved production retention schedule, data inventory owner, or verified deletion/export workflow exists for customer booking/contact data and provider copies.
2. Backup, outbox/notification, support, and incident copies have no final cross-system retention/deletion/access decision.
3. Production provider logs, observability access, raw-IP posture, and rate-limit shared-store privacy controls remain pending.
4. No automated deletion/export capability is approved; manual targeted handling requires an explicit, verified, auditable process.

## Remaining open decisions

- Exact retention periods and legal/operational basis for each category, including booking history and backups.
- Privacy/legal review, required disclosures, consent/marketing posture, and request response targets.
- Named privacy/support owner, verification process, escalation path, and restricted evidence retention.
- Provider-specific data locations, data-processing terms, logs, exports, geographic/access controls, and deletion capabilities.
- Production storage/image applicability and retention; notification/outbox design and provider retention.
- Final raw-IP policy, rate-limit store/privacy design, and retention for redacted observability data.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No for this decision record.** Later review is required for frontend/browser diagnostics, deploy logs, and any production site data handling. |
| Render required? | **No for this decision record.** Later review is required for API logs, runtime access, and retention controls. |
| Supabase migration required? | **No.** The inventory itself requires no schema change; future retention/deletion automation may need separately approved work. |
