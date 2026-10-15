# Render Key Value staging setup checklist — P0-F5n

## Status

This is a **docs-only setup checklist** for the staging setup path. The owner has manually created the approved staging-only instance; no API connection or environment variables have been configured, the provider adapter remains disabled, runtime behavior has not changed, and production approval has not been granted.

## Setup scope

| Item | Boundary |
| --- | --- |
| Target provider | Render Key Value / Valkey |
| Target environment | Staging only |
| Intended use | Temporary shared limiter counters |
| Production use | Not approved |
| Provider code implementation | Not approved by this checklist |

## Pre-setup hard stops

The owner must stop before creating anything if any of the following is true:

- Render requires a paid plan and cost has not been reviewed.
- The plan is not clearly Free or otherwise explicitly approved.
- The region cannot be matched or reasonably aligned with `slotzy-staging-api`.
- An internal/private URL is unavailable or unclear.
- External access cannot be disabled or restricted.
- Credentials or secrets would need to be pasted into documentation, Git, chat, screenshots, or tests.
- Provider setup requires trusting forwarded headers.
- Setup would affect production services.
- Setup would require a frontend deployment.
- Setup would require a Supabase migration.

## Manual setup checklist — not yet authorized

The owner has completed only the manually confirmed, non-secret setup facts below. The remaining actions, including API wiring, remain unapproved.

- [x] Confirm the selected plan is Free.
- [x] Choose the staging-only instance name `slotzy-staging-limiter`.
- [x] Create the Render Key Value instance after owner approval.
- [ ] Verify the selected region is the same as, or acceptably aligned with, `slotzy-staging-api`.
- [ ] Prefer the internal/private URL.
- [ ] Keep external access disabled unless explicitly justified and restricted.
- [ ] Record only sanitized facts after creation.
- [ ] Do not copy credentials into the repository, chat, or documentation.
- [ ] Store the provider secret only in approved Render environment-secret storage later.
- [ ] Do not wire the instance to the API until backend adapter code is separately approved.

## Recommended staging instance naming

Suggested name: `slotzy-staging-limiter`.

The name is not a secret. Do not include customer data, tokens, URLs, or credentials in any instance name.

## Region checklist

- [ ] Identify the current `slotzy-staging-api` Render region.
- [ ] Choose the same region when possible.
- [ ] If the same region is unavailable, document the mismatch and stop for review.
- [ ] Do not move existing services.

## Access checklist

- [ ] Prefer an internal/private URL.
- [ ] Keep external access disabled or restricted.
- [ ] Never commit credentials.
- [ ] Do not capture screenshots containing connection strings or credentials.
- [ ] Do not place provider account IDs or private URLs in documentation unless they are clearly non-secret and approved.
- [ ] Future adapters must send only opaque/derived limiter keys; never raw/private limiter keys.

## Cost and billing checklist

| Field | Value |
| --- | --- |
| Plan selected | TBD |
| Monthly cost | TBD |
| Free plan confirmed? | yes / no / TBD |
| Paid plan required? | yes / no / TBD |
| Owner approved cost? | yes / no / TBD |
| Billing owner |  |
| Cancellation path verified? | yes / no / TBD |
| Usage/quota visibility verified? | yes / no / TBD |
| Budget/spend cap available? | yes / no / TBD |

## Sanitized facts to record after manual setup

Only after instance creation is explicitly approved and completed, record the following:

| Fact | Value |
| --- | --- |
| Instance name | `slotzy-staging-limiter` |
| Plan type | Free |
| Region | Virginia (US East) |
| Internal URL available? | yes |
| External access disabled/restricted? | TBD (must be verified before activation) |
| Created for staging only? | yes |
| Credentials stored in Render environment secrets later? | pending |
| No secrets captured in docs? | yes |

The instance is available with persistence off. No connection URL, credential, account ID, or private endpoint is recorded here.

Do not record connection strings, passwords, tokens, private URLs if considered sensitive, screenshots containing secrets, raw IPs, or customer data.

## Backend integration remains blocked

Even after manual setup, provider adapter implementation requires separate authorization. Environment-variable names, HMAC/key ownership and rotation, TTL/window and response decisions, and the staging validation plan all remain pending. A Render API deployment would be required only after approved backend source changes.

## Rollback expectations

- The current in-process limiter remains the default until a provider adapter is approved.
- Any future provider implementation must default its feature flag to off.
- Disabling or removing provider configuration must return to the in-process limiter.
- The ordinary health check must not depend on provider availability.

## Decision outcome now

The setup checklist is documented. Instance creation is not yet approved; Render configuration is unchanged; provider implementation is blocked; the production shared limiter remains **not approved**; and production launch remains **no-go**.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **No.** |
| Render required? | **No change now.** Render is needed only for a later explicitly approved manual staging setup. |
| Supabase migration required? | **No.** |
