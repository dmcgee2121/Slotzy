# Closed-pilot privacy, support, and incident readiness runbook

## Purpose, scope, and limits

This runbook supports a small, named, trusted Slotzy pilot in the dedicated **staging** environment. It gives the pilot owner and named operators a practical way to handle customer questions, data requests, and incidents without exposing private data. It is not a production privacy policy, security certification, breach-notification plan, service-level agreement, or authorization to use production.

Use only the approved pilot contact channel and the staging environment. Before inviting anyone, the pilot owner must name the support contact, incident decision maker, and authorized staging operator in a restricted location outside this repository. Do not place their personal contact details, credentials, or customer records in this file.

The runbook closes the **documentation/process** privacy-support-incident readiness gap for the trusted pilot. It does not remove the separate real-device UAT, isolated restore-rehearsal, or password/session limitations described below.

## Pilot data and access

### Data Slotzy may collect during this pilot

Collect only what the current workflow requires:

| Area | Data |
| --- | --- |
| Owner/provider account | Username, display name, role, bcrypt password hash, shop/provider relationship, and sign-in session data. |
| Shop setup | Shop name/slug, business contact details or branding entered by the owner, services, hours, booking policies, and availability/time-off settings. |
| Customer booking | Customer name and contact details entered for the appointment, selected provider/service, appointment date/time, booking status, and confirmation information. |
| Private manage access | A high-entropy manage bearer token is shown once in the private URL fragment; the server stores only its hash, expiry, and revocation state. |
| Operations | Limited health/error and booking-event/outbox records where enabled. Logs and support notes must be redacted and must not contain passwords, JWTs, raw manage tokens, or unnecessary contact data. |

Slotzy is not production-ready for a broad retention, analytics, marketing-consent, payment, or self-service account-management program. Do not represent the pilot as providing any of those capabilities unless separately implemented and approved.

### Who may access staging data

- Named pilot owners may access only their own authenticated shop/provider views.
- A customer who possesses a private manage link may access only the booking authorized by that bearer token. Treat the link as sensitive.
- Named staging operators with approved Render/Supabase access may access data only to perform support, recovery, backup rehearsal, or incident work, using least privilege.
- The pilot owner/incident decision maker may receive redacted status and decision information; they do not need raw database records by default.
- No public user, developer, or support requester receives direct database, hosting, log, export, dev-email, or admin access.

### Never share publicly or in ordinary support channels

Never paste, upload, or include in screenshots, tickets, chat, browser recordings, commits, or public issue trackers:

- Passwords, password hashes, JWTs, API keys, service-role keys, SMTP credentials, database URLs, or admin secrets.
- A full customer manage URL, raw manage token, Authorization header, session storage, or confirmation details that could identify a booking.
- Customer/owner contact details, appointment details, database exports/dumps, email/outbox content, or unredacted logs.
- Staging project identifiers or access details that would help an unauthorized person reach hosting, database, or operational tooling.

Use redacted identifiers and minimal facts: for example, "pilot booking on 2026-10-02, cancellation failed" rather than names, contacts, tokens, or URLs.

## Support intake and ordinary requests

### Intake process

1. Receive the request through the pre-approved private pilot support channel.
2. Create a restricted support record with date/time, reporter role, environment (`staging` only), issue category, minimal affected reference, impact, and operator. Do not copy private links or secrets.
3. Verify identity before discussing account or booking details. For a customer, use the previously supplied booking contact through a pre-existing channel and a minimal appointment fact. For an owner, follow the verification rules in the owner recovery runbook.
4. Acknowledge receipt, state the next update time, and classify: ordinary support, defect, correction/deletion request, account lockout, or incident.
5. Reproduce only with synthetic data where possible. If real pilot data is necessary, inspect the smallest possible record and do not export it.
6. Resolve, escalate, or pause the affected pilot workflow. Record the outcome and close only after the requester receives a safe confirmation.

### Bug report template

```text
Date/time and reporter role:
Environment: staging closed pilot
Device/browser/app mode:
What the reporter was trying to do:
What happened and visible safe error text:
Expected result:
Minimal affected reference (redacted; no private link/token/contact):
Can it be reproduced with synthetic data? yes/no/result
Impact and suspected severity:
Attachments reviewed/redacted:
Owner/operator and next update time:
```

### Customer cancellation and support

- Direct the customer to the private manage link they already possess for cancellation where the shown policy permits it. Do not ask them to send the full link or token to support.
- If the link is missing, invalid, or expired, verify identity through the pre-existing booking contact and a minimal appointment fact. A named operator may then inspect the exact booking through approved staging tooling and explain the available cancellation/support path.
- Do not promise a reschedule, refund, notification, or immediate deletion unless the current pilot workflow and owner have actually approved it. Notification delivery is best-effort; a persisted cancellation is the source of truth.
- Record the result without customer details. Escalate repeated failure, apparent unauthorized access, or any suspected disclosure as an incident.

### Owner lockout

For forgotten credentials or owner/barber lockout, use [the owner recovery runbook](CLOSED_PILOT_OWNER_RECOVERY_RUNBOOK.md). It requires out-of-band identity verification and a targeted operator action. Do not use a booking link, a username alone, or a newly supplied email address as proof of ownership.

Current limitation: a password change does not revoke an already-issued JWT, which can remain valid for up to seven days. Treat suspected compromise as an incident; the recovery runbook describes the limited, coordinated escalation option.

### Data correction or deletion request

1. Log the request in the restricted support record and verify the requester before acknowledging any data exists.
2. Identify whether the request concerns account/profile, shop configuration, or a booking. Confirm the exact requested correction/deletion and any operational consequence (for example, cancelling a future appointment is separate from deleting a record).
3. Use a named authorized staging operator to make the smallest targeted change through the approved application or audited operator path. Never reset staging, run broad cleanup, or rewrite a snapshot to satisfy one request.
4. For deletion, first assess whether an active booking, recovery need, audit/event record, or provider backup prevents immediate erasure. The current pilot has no automated retention/deletion workflow. Remove or minimize the live record only when approved; do not claim that backup copies are instantly erased.
5. Verify the result without exposing record contents, tell the requester what was changed and any limitation, and record the decision, operator, and completion date. Escalate uncertainty, cross-user scope, or suspected misuse to the incident decision maker.

## Incident response

### Severity and initial target

| Severity | Examples | Initial action / update target |
| --- | --- | --- |
| SEV-1 critical | Suspected credential/secret exposure, unauthorized access to multiple records, active data loss, staging may point to production, or a broad booking outage. | Pause affected pilot activity immediately; notify pilot owner and authorized operator immediately; update affected testers as soon as safe. |
| SEV-2 high | Suspected access to one customer/owner record, account compromise, persisted booking/cancellation failure with material impact, or restore/recovery failure. | Stop the affected workflow/account; triage promptly; give the pilot owner a same-day status update. |
| SEV-3 moderate | Reproducible defect, isolated incorrect display, or temporary non-sensitive availability problem with a workaround. | Log, prioritize, provide a next-update time, and avoid expanding pilot use until risk is understood. |
| SEV-4 low | Cosmetic issue, question, or improvement request with no privacy, security, or booking-integrity impact. | Log as support/product feedback and schedule normally. |

When unsure, classify upward until evidence supports lowering severity.

### Response steps

1. **Make it safe.** Confirm the environment is staging. Pause invitations and, if needed, tell affected testers to stop using the affected flow. Do not reset staging or alter production.
2. **Preserve minimal evidence.** Open a restricted incident note. Record time, reporter, impact, environment, affected function, and safe/redacted observations. Do not collect secrets, raw tokens, contact lists, or database dumps.
3. **Contain.** For a specific account or booking, pause that workflow and restrict operator access to the smallest necessary set. For suspected owner compromise, follow the owner-recovery escalation. For suspected data loss, use the backup/restore runbook; restore only into an isolated rehearsal target unless a separately authorized incident decision says otherwise.
4. **Notify decision makers.** Notify the named pilot owner and authorized staging operator. For SEV-1/SEV-2, decide whether to pause the entire pilot before further diagnosis.
5. **Diagnose safely.** Prefer synthetic reproduction, health checks, redacted request IDs/statuses, and approved operator tooling. Never post raw records, manage URLs, JWTs, secrets, or unredacted logs.
6. **Recover and verify.** Apply only an approved, targeted correction or operational recovery. Verify against staging without creating unnecessary real-data changes. A code/deploy change is a separate reviewed task; this runbook does not authorize one.
7. **Communicate and close.** Send the appropriate tester update, document impact and remediation, identify follow-up work, and obtain pilot-owner acceptance before resuming a paused flow.

### Pilot-tester communication template

```text
Subject: Slotzy closed-pilot update

We identified an issue affecting [feature/workflow] in the staging closed pilot on [date/time and timezone].

What you should do now: [stop using this flow / use this approved workaround / no action required].
What we know: [plain, minimal description; do not include another person's data or technical secrets].
What we are doing: [containment and next check].
Next update: [time and support channel].

If you believe your appointment or account is affected, contact [approved private pilot support channel]. Please do not send passwords or private manage links.
```

### Post-incident notes template

```text
Incident ID/title:
Date/time detected and timezone:
Environment confirmed (staging only):
Severity and decision maker:
Reporter / operator (restricted names or roles):
Affected workflow and scope (minimal/redacted):
Customer/owner impact:
Containment taken and time:
Evidence retained (redacted; no secrets/tokens/contacts):
Root cause or current hypothesis:
Recovery/verification result:
Tester communication sent and next update:
Follow-up owner and due date:
Pilot resume/pause decision:
Lessons / runbook changes:
```

## Not production-ready

- Real-device UAT on target Android Chrome/installed PWA and iPhone Safari/installed home-screen modes has not passed.
- The staging backup/restore procedure is documented, but no actual isolated export/restore rehearsal has been completed.
- Self-service password recovery, verified recovery-email enrollment, per-user session/JWT revocation, and a full password-rotation experience are not implemented. Existing JWTs can survive a recovery action for up to seven days.
- Automated retention, deletion, data export, consent/disclosure, monitoring/alerting, and broad incident-notification capabilities are not implemented or approved for production.
- The mobile Calendar overflow/mobile booking-save candidate remains parked only if it is still listed in the current readiness documents; it is not cleared by this runbook. Do not invite testers until its current status is explicitly reviewed.
- This staging pilot is not production. Do not import production data, make production changes, or describe the pilot as a production service.

## Related runbooks

- [Closed-pilot UAT checklist](CLOSED_PILOT_UAT_CHECKLIST.md)
- [Closed-pilot owner recovery runbook](CLOSED_PILOT_OWNER_RECOVERY_RUNBOOK.md)
- [Closed-pilot backup and restore runbook](CLOSED_PILOT_BACKUP_RESTORE_RUNBOOK.md)
- [Pilot readiness](PILOT_READINESS.md)
