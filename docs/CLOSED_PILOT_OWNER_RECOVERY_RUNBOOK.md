# Closed-pilot operator-assisted recovery runbook

## Scope and policy

This is the temporary recovery process for a named Slotzy owner or barber in **solo-founder staging QA**. It is operator-assisted only. It does not authorize production access, a browser-facing account lookup, self-service reset links, email/SMS reset delivery, or any recovery code change.

Use the same generic public guidance for every requester. Do not confirm whether an account exists until the requester has been verified through the approved private channel. The login and Settings recovery-help controls are informational only and must not perform account lookup or issue credentials.

Never put passwords, password hashes, JWTs, `jti` values, private manage links, customer data, reset tokens, raw database rows, or secret values in support notes, tickets, screenshots, chat, source control, or logs. Do not use public shop information, booking links, a phone number, or a newly supplied email address as proof of ownership by itself.

## Identity verification

Start a restricted, redacted recovery record with: date/time, staging environment, operator, requester role, a minimal account reference, reason category, verification outcome, action outcome, and follow-up needed. The record must not contain any secret or customer/private data.

Before discussing an account or taking action, verify the requester through a contact method recorded before the recovery request and obtain at least one additional pilot-specific fact already known to the operator. Appropriate evidence can include a pre-established out-of-band contact plus a previously recorded owner/barber relationship, shop context, or other non-public pilot fact. Require two independent factors when the request is unexpected, the prior contact record is weak, or an account compromise is suspected.

The following are not sufficient evidence, alone or together without a pre-existing verified channel: a username, public shop name or details, public booking URL or QR code, booking confirmation details, caller-provided phone number, a newly supplied email address, social-media profile, or urgency claim.

Pause and refuse recovery when identity remains ambiguous, ownership is disputed, verification repeatedly fails, the requester pressures the operator to bypass the process, or the account may be compromised. Escalate to the named pilot owner/incident decision maker and do not disclose whether the account exists. Treat a suspicious, rushed, or conflicting request as a security incident until resolved.

## Staging recovery procedure

1. Confirm the request is for the dedicated staging environment and that the requester is an owner or barber. Stop on any environment or account ambiguity.
2. Complete identity verification and record only the redacted result. Do not reveal account details before this step.
3. Use the approved, audited operator path to rotate the password for exactly the verified account. It must make a targeted credential change only, bcrypt-hash the replacement password, and invalidate that account's sessions by incrementing `auth_version` and updating the invalid-after time. Do not use broad snapshot writes, staging resets, secret rotation, or changes to shops, memberships, bookings, services, availability, or customer data.
4. Verify the outcome with the smallest safe check: the old session is no longer accepted and the account can sign in through the intended owner/barber flow. Do not create or inspect customer bookings as part of this check.
5. Tell the verified user, through the pre-established private channel, to sign in and immediately choose a new password in **Settings → Account and profile → Account security**. The password-change UI keeps that browser signed in with a fresh token and revokes older sessions through `auth_version`.
6. Avoid sending a password in plain text. The preferred future replacement is verified self-service recovery. If a temporary password must be delivered during staging, use the pre-verified out-of-band channel, minimize its lifetime and exposure, never record it, and require an immediate user-selected password change. This is an accepted staging risk, not a production-safe mechanism.
7. Close the restricted record only after the verified user confirms access, the operator records the redacted outcome, and any incident follow-up is assigned.

If the approved targeted operator path is unavailable or cannot prove session invalidation, do not improvise with manual database edits. Pause the request and escalate.

## Incident and stop conditions

Stop the recovery and escalate immediately for:

- possible impersonation, disputed ownership, or wrong-account recovery;
- repeated failed or contradictory verification;
- suspected account compromise or unexpected password-change request;
- a request that would disclose whether an account exists;
- any possible exposure of customer data, private links, tokens, hashes, or passwords; or
- uncertainty about the environment, target account, or session-revocation outcome.

For a suspected compromise, pause the affected account workflow, preserve only redacted evidence, notify the incident decision maker, and follow the privacy/support incident runbook. Do not treat ordinary recovery as sufficient containment.

## Future self-service recovery requirements

Self-service recovery remains future work and is required before production or app-store readiness. Its design must include:

- verified recovery-contact enrollment and change controls;
- generic, non-enumerating request and completion responses;
- high-entropy, single-use reset tokens or one-time codes;
- hashed reset-token storage only, with short expiry and single-use enforcement;
- rate limits, abuse detection, retry rules, and safe lockout handling;
- privacy-safe audit events for request, delivery, verification, reset, and revocation outcomes;
- password policy validation and recovery/compromise regression tests; and
- per-user session revocation after a successful reset.

## Readiness boundary

Operator-assisted recovery is acceptable only for solo-founder staging QA. It does not make Slotzy production-ready. Production readiness still requires self-service recovery or an approved equivalent, privacy and retention controls, monitoring and alerting, rate limiting and abuse prevention, backup/restore validation, and tested launch and rollback gates.
