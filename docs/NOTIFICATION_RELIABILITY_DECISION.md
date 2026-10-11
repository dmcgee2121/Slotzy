# Notification reliability and delivery-failure decision record

**Status:** Planning record only. Notification-reliability implementation, provider selection/configuration, sender approval, and production delivery approval remain pending.

**Current framing:** Slotzy is staging-ready for solo-founder QA and **not production-ready**. There is no external-tester validation and no payment-launch approval. This record authorizes no code, provider account, provider setting, secret, sender, test message, or production change.

## Decision summary

The application action is authoritative only when its database write succeeds. A notification is a separate, non-authoritative side effect. Existing planning states that booking/cancellation messages are initiated after authoritative writes and are currently **best-effort**; safe notification-outcome events exist in the observability foundation, and limited booking-event/outbox records may exist *where enabled*. This record does not establish that a durable outbox, provider acceptance record, delivery receipt, retry worker, idempotency key, or provider webhook is implemented.

Until the required design is approved and implemented, no UI, support script, or product claim may treat a message as proof that a booking, cancellation, reschedule, or recovery request succeeded. The persisted application action is the source of truth.

## Current known behavior and scope boundaries

| Communication | Known current position | Safe conclusion today |
| --- | --- | --- |
| Booking confirmation/customer message | Initiated after the authoritative booking write; delivery is best-effort. | A successful booking may exist even if no message arrives. |
| Owner/provider notification | Channel, recipient selection, and delivery durability are not approved here. | Do not promise that staff receive a real-time alert. |
| Manage-link recovery message | Current recovery-help controls are generic informational entry points and do not query accounts, send messages, or create reset credentials. | Do not imply self-service recovery-message delivery. |
| Cancellation/reschedule message | The persisted action is authoritative; notification delivery is best-effort. | A completed cancellation/reschedule must be verified in the app, not by message receipt. |
| Outbox/delivery record | Limited booking-event/outbox records are described only “where enabled.” | Durable enqueue, status tracking, and redelivery cannot be assumed. |

The approved product/channel scope (email, SMS, or otherwise), templates, sender identity, recipient rules, and any provider capabilities remain open decisions. Marketing, bulk, and unsolicited messaging are out of scope.

## Notification promise levels

### What the UI may safely promise today

- “Your booking/cancellation/reschedule was saved” only after the authoritative application write succeeds.
- “Check the booking/manage page for the current status.”
- If a message feature is shown, phrase it as: “We may send a confirmation message; delivery is not guaranteed. Your booking status in Slotzy is authoritative.”
- For recovery, use generic language such as “If you need account help, contact approved support”; do not promise a sent reset or recovery message.

### What must not be promised yet

- Guaranteed, immediate, once-only, or delivered confirmation/alert messages.
- That message receipt proves an action succeeded, that no message means an action failed, or that a message reaches every owner/provider.
- A specific channel, sender, delivery time, resend behavior, recovery link, opt-out behavior, or provider status until separately approved and implemented.

### Authoritative events versus delivery outcomes

| Event class | Meaning | Source of truth |
| --- | --- | --- |
| `booking_created`, `booking_cancelled`, `booking_rescheduled` | The intended application mutation committed or failed. | Authoritative application/database outcome. |
| `recovery_requested` | A generic request was accepted without revealing account existence. | Authoritative request acceptance only; not a message-delivery claim. |
| `notification_enqueued` | Intended future delivery work was durably accepted, if/when implemented. | Queue/outbox acceptance; not provider acceptance or recipient delivery. |
| `notification_provider_accepted` | Provider accepted a submission, if safely recorded. | Provider submission outcome; not inbox/device delivery. |
| `notification_delivered`, `notification_bounced`, `notification_failed` | Provider-reported terminal outcome, if supported and verified. | Delivery-provider outcome, scoped to its evidence; never changes the application action. |

## Required failure behavior

| Condition | Required user/support behavior | Reliability rule |
| --- | --- | --- |
| Booking write succeeds but notification fails | Keep the booking. Show/return booking success without claiming message delivery; create a safe failure record and route support through the authoritative booking state. | Never roll back or duplicate the booking merely to retry messaging. |
| Cancellation/reschedule succeeds but notification fails | Keep the persisted cancellation/reschedule. Direct parties to the authoritative status and safely queue/escalate communication follow-up. | Never restore or repeat the mutation because a message failed. |
| Generic recovery request succeeds but delivery fails | Preserve generic external response and do not disclose whether an account/message exists. Support uses the approved verified, operator-assisted recovery path. | Do not expose provider failure, recipient identity, or account existence. |
| Provider unavailable | Accept authoritative app actions independently where safe; mark notification work retryable or failed according to approved classification. Escalate broad outage and pause any UI claim stronger than best effort. | Provider availability must not make a persisted booking action ambiguous. |
| Duplicate retry risk | Suppress duplicate submission with a stable idempotency/dedupe key and atomic state transition; support verifies the authoritative action before any manual resend. | At-least-once transport must not become uncontrolled duplicate sends. |
| Message delayed | Do not create a second action/message solely because a message is late. Display/support uses the app status; alert on sustained delay once delivery timing is observable. | Delay is a delivery outcome, not an app-state reversal. |
| Unsafe private-link exposure risk | Stop the affected send/retry and treat it as a privacy/security incident. Do not paste, log, ticket, screenshot, or resend raw private URLs/tokens. | Private manage links and recovery material require explicit template, access, and retention approval before use. |

## Reliability requirements before broader beta or production

1. **Durable intent and dedupe.** Commit an immutable notification intent/outbox record with a stable idempotency key tied to one authoritative action, notification purpose, recipient version, and template/version reference. Define an atomic claim/lease strategy so concurrent workers cannot send the same intent.
2. **Outcome tracking.** Track safe states such as queued, processing, provider accepted, retryable failure, terminal failure, and provider-reported delivery/bounce where available. Retain only opaque references and approved timestamps/error categories; no bodies, recipients, private links, or credentials.
3. **Bounded retry and backoff.** Define retryable versus terminal provider/application classes, a capped attempt count, exponential backoff with jitter, a maximum delivery age, and a dead-letter/manual-review path. Never automatically retry unsafe-recipient or private-link-template failures.
4. **Safe provider errors.** Map provider responses to low-cardinality safe categories (for example: unavailable, timeout, throttled, invalid-config, rejected-recipient, permanent-provider-rejection, unknown). Do not store raw provider response bodies or headers by default.
5. **Redacted observability.** Emit allowlisted events with notification type/channel, lifecycle outcome, safe provider category, retry count, opaque booking/notification reference, correlation ID, release, and environment. Never emit recipient address/phone, message body, template variables, private link/token, credentials, raw IP, or raw provider payload.
6. **Environment-safe routing.** Use distinct staging and production provider credentials, approved senders/domains/templates, and explicit environment labels. Staging/rehearsal must use disabled/mock delivery or an approved synthetic test destination only; no customer destination or production sender.
7. **Production sender approval.** Confirm ownership/verification, sender identity, reply/support handling, approved channels/templates, recipient policy, access roles, webhook authenticity if used, and a rollback/disable procedure before customer sends.
8. **Support and escalation.** Provide a restricted, verified workflow to reconcile failed, delayed, or duplicate messages against authoritative booking status; define severity, owner, customer update wording, manual resend approval, and broad-provider-outage escalation.
9. **Privacy retention and access.** Approve outbox, provider-log, webhook, failure-record, support-evidence, backup, deletion/export, retention, and access-control rules. Provider access and copies must be included in the privacy inventory decision.

## Support workflow for delivery complaints

1. Verify the requester through the approved private process without asking for passwords, full private links, raw tokens, or a message body.
2. Confirm the authoritative booking/cancellation/reschedule state using the smallest necessary record.
3. Inspect only safe notification metadata: opaque reference, type/channel, lifecycle state, safe failure category, attempt count, and timestamps.
4. Explain the authoritative result and the approved next action. Do not claim delivery, disclose another recipient, or share provider details.
5. A manual resend requires an approved dedupe check, verified recipient authority, approved template, and restricted evidence. It must create a distinct auditable notification intent rather than re-running the business action.
6. Escalate suspected duplicate sends, private-link exposure, broad provider outage, or repeated failures under the privacy/support incident runbook. Preserve only redacted evidence.

## Privacy and provider-log rules

Message bodies, recipients, template variables, confirmation details, recovery material, and private manage links are high-sensitivity data. Provider dashboards/logs and outbox records are restricted operational systems, not support artifacts or analytics sources.

- Never commit or place in ordinary logs, metrics, tickets, screenshots, traces, or chat: recipient email/phone, message body, raw provider response, provider credential, full private URL, URL fragment, manage token, recovery material, or customer appointment details.
- Use opaque references, approved outcome classes, and aggregate counts. Allowlisted capture is required; post-capture redaction is insufficient.
- Do not use production customer data or a real customer destination for staging, preview, local, restore, or rehearsal validation.
- Grant least-privilege provider/outbox/log access; record roles, not credentials. Define retention, export, deletion limitations, backup copies, and access review before production.

## Go/no-go decision

**Production is no-go** until the requirements above are approved, implemented, and evidenced: supported channels and sender/provider separation; safe test routing; durable idempotency/dedupe; bounded retry/failure handling; delivery-outcome tracking; redacted observability and alert response; privacy retention/access controls; and a tested support escalation workflow. This is a separate gate from authoritative booking-write correctness.

Related records: [Production observability minimum](PRODUCTION_OBSERVABILITY_MINIMUM.md), [Privacy and data retention inventory](PRIVACY_DATA_RETENTION_INVENTORY.md), [Production environment separation](PRODUCTION_ENVIRONMENT_SEPARATION.md), [Production launch and rollback gate](PRODUCTION_LAUNCH_ROLLBACK_GATE.md), and [Closed-pilot privacy/support/incident runbook](CLOSED_PILOT_PRIVACY_SUPPORT_INCIDENT_RUNBOOK.md).

## Remaining open decisions

- Which transactional channels, provider(s), sender/domain identities, templates, reply paths, and recipient rules are approved.
- Whether provider acceptance, webhooks, and/or inbox/device delivery status can be safely and reliably tracked for each channel.
- The durable outbox schema/location, idempotency-key contract, worker ownership, retry schedule, maximum message age, dead-letter path, and manual-resend controls.
- Provider-specific privacy terms, logging/retention/deletion/export capabilities, webhook verification, access roles, and incident contact path.
- Delivery SLOs/thresholds, alert owners, customer communication expectations, and whether notifications remain best effort for each approved channel.

## Infrastructure impact

| Question | Answer for this documentation package |
| --- | --- |
| Netlify required? | **No.** No frontend change or deployment is authorized. A later production-site review may be needed only if UI messaging changes. |
| Render required? | **No.** No API deployment, runtime configuration, provider secret, or worker change is authorized. A later implementation will likely require backend runtime review. |
| Supabase migration required? | **No.** This decision record changes no schema. A future durable outbox/idempotency design may require separately approved data work or a migration. |
