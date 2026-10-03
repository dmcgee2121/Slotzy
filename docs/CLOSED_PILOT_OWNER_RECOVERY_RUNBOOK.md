# Closed-pilot owner account recovery

This is the temporary, operator-mediated recovery process for a named Slotzy closed-pilot owner or barber. It applies to the staging/closed-pilot environment only. It is not a self-service password-reset feature and must not be used for production.

## Why recovery is manual for this pilot

Owner registration currently uses a username and password; it does not collect or verify a recovery email. Hosted passwords are bcrypt hashes, while local/demo browser storage is not an account-recovery system. There is no password-reset token endpoint, mail-delivery flow, single-use token store, or per-user session revocation.

The Supabase schema reserves a unique active-user email field, but the current hosted registration flow does not populate it. Do not assume a profile or shop email is verified ownership proof.

## Before changing anything

1. Open an incident record with the date/time, requesting username, affected environment, operator, and a short reason. Do not include passwords, JWTs, reset values, raw database rows, or customer data.
2. Confirm this is the dedicated staging/closed-pilot environment, never production.
3. Verify the requester out of band using the contact method recorded before the incident and at least one second pilot-specific fact known to the operator. Do not rely on an email address supplied in the recovery request, a booking link, or a username alone.
4. If identity cannot be verified, do not reset the password. Escalate to the named pilot owner and pause access for that account until resolved.
5. Confirm the exact username and that its role is `owner` or `barber`. Do not disclose whether an arbitrary username exists to an unverified requester.

## Operator recovery procedure

1. Generate a unique temporary password in the approved password manager. Never place it in source control, a ticket body, browser storage, logs, screenshots, or chat history.
2. In the approved, audited staging operator path, replace the `password_hash` for exactly that user with a bcrypt hash using the application's current cost factor (10). For the hosted Postgres adapter this is the matching `users.password_hash` row; do not change shop, membership, bookings, services, availability, or email records. Do not use a broad data reset or snapshot rewrite.
3. Independently verify that exactly one account was changed, then perform one login with the temporary password in a private browser context. Confirm the expected owner/barber landing page only; do not create or alter customer bookings during this check.
4. Deliver the generated password only through the pre-verified out-of-band contact method and instruct the owner to store it in an approved password manager. The current app has no owner password-change screen, so any later rotation uses this same verified, operator-mediated process. Do not ask an owner to send a chosen password to an operator.
5. Record completion, verifier, environment, username, and the fact that login was checked. Never record any password, hash, JWT, email body, or token.

## Session limitation and escalation

Existing owner JWTs remain valid for up to seven days because the current authentication model has no per-user token/session revocation. A password rotation does not invalidate a previously issued JWT.

If account compromise is suspected, do not treat the normal recovery procedure as sufficient. Immediately pause the affected account's pilot access and escalate to the pilot owner. The only currently available broad invalidation is controlled JWT-secret rotation, which signs out every owner and requires a coordinated staging redeploy; use it only under an approved incident decision. Do not rotate secrets casually and do not change them through this runbook.

## Closure and future replacement

Close the incident only after the owner confirms access through the verified channel and the pilot owner accepts any session-revocation limitation. Repeated recovery requests, failed identity verification, suspected compromise, or an unverified contact record are no-go conditions for expanding the pilot.

Replace this temporary process before a broader pilot with a designed account-recovery feature: verified owner email enrollment, generic anti-enumeration responses, high-entropy single-use hashed reset tokens with expiry, rate limits, audited delivery, password-policy validation, tests, and per-user session revocation.
