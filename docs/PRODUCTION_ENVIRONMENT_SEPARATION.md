# Production environment separation plan

**Status:** Planning only; pending implementation and approval.  
**Current framing:** Slotzy is staging-ready for solo-founder QA, not production-ready. This is not external-tester validation or payment-launch approval.

## Purpose and boundary

Production must be an independently controlled environment. Do not create, configure, or connect production resources from this plan. Separation prevents staging activity, credentials, data, logs, and deploys from affecting customers, while keeping production incidents from exposing customer data in lower environments.

## Required separation checklist

| Area | Production requirement | Evidence before launch |
| --- | --- | --- |
| Supabase | A distinct production Supabase project, project URL, service-role key, access roles, backups, and storage configuration. No staging project may be repurposed. | Project identity and access review recorded without secrets; restore ownership confirmed. |
| Render | A distinct production Render service with production-only environment variables, service access, logs, deploy history, and rollback target. | Service identity, deploy source/branch rule, and authorized operators recorded. |
| Netlify | A distinct production Netlify site, or an explicitly isolated production deploy context, with its own domain/origin and environment variables. Preview/staging deploys must not use production values. | Site/context identity, domain mapping, deploy rules, and authorized operators recorded. |
| App and CORS origins | Use a separate production app origin and exact production API/app CORS allowlists. Do not allow broad wildcards or staging origins in production. | Approved origin inventory and a browser/API verification. |
| JWT and privileged keys | Use a separate production JWT secret and separate production Supabase service-role key. Never copy, reuse, log, or place either in client configuration. | Secret inventory confirms separate values and scoped access; values are not recorded in evidence. |
| Email/SMS providers | Use separate production provider credentials and approved production senders, domains, templates, and recipients if those channels apply. Staging must use non-customer-safe test routing. | Sender/credential separation and safe delivery test evidence, without recipient or message content. |
| Storage | Confirm production storage mode, buckets/containers, access policies, retention, upload/download origins, and that staging cannot read or write production storage. | Storage-mode/access review and non-sensitive verification result. |
| Data boundaries | Do not copy staging/test data into production unless specifically approved, minimized, and sanitized. Never use production customer data in staging. | Written exception approval if any; otherwise explicit no-copy confirmation. |

## Naming and promotion conventions

Use unambiguous names that include the environment, such as `slotzy-staging-api` and `slotzy-production-api`, and equivalent `-staging` / `-production` names for sites, projects, providers, dashboards, and alerts. Production domains must be visibly distinct from preview/staging domains. Do not use ambiguous labels such as `new`, `final`, `live2`, or a shared `default` resource.

Promotions must have an identified source revision, change owner, approver where required, and rollback target. A staging or preview deployment is never evidence that production configuration is correct.

## Secret inventory checklist

Maintain a restricted inventory of the *presence, owner, environment, rotation date, access path, and dependent service* for each secret; never store values in docs, tickets, logs, screenshots, or test artifacts. Review at minimum:

- JWT signing secret and any signing/verification configuration;
- Supabase project URL, anon key handling, and service-role key;
- Render and Netlify environment variables and deploy tokens, if used;
- email/SMS provider credentials, sender/domain verification, and webhook secrets, if applicable;
- rate-limit shared-store or edge/WAF credentials, if approved later;
- storage credentials/configuration and any notification or observability credentials.

Remove unused values, prohibit client exposure of privileged keys, use least privilege, and define an owner and rotation/revocation procedure for each item. A secret suspected to cross an environment boundary is treated as an incident and rotated under the approved procedure.

## Least-privilege access and operational authority

Before production, review every human and automation identity with access to Supabase, Render, Netlify, provider consoles, secrets, deploys, logs, storage, and backups. Grant the narrowest role needed; use separate accounts where platforms support them; remove former collaborators and unused tokens; and periodically re-review access.

Record named roles (not credentials) for: deploy authority, rollback authority, environment-variable/secret changes, production-log access, database/backup restore approval, provider sender changes, and customer/support communication. In solo-founder operation these roles may initially be one person, but the authority and emergency backup procedure must still be explicit. Production logs must follow the existing redaction rules and must not be exported into staging tooling without approval.

## Implementation readiness checks

Before configuration begins, approve the production domain/origin inventory, platform account ownership/billing, access roles, secret inventory process, storage mode, backup/restore ownership, and notification sender plan. Configuration and evidence collection must contain no customer data, raw IPs, JWTs, private links, tokens, passwords, secrets, full URLs with private query data, or raw request bodies.

## Open decisions

- Whether production uses a separate Netlify site or an isolated production deploy context.
- Which provider credentials/senders and storage mode are required for the approved production notification scope.
- Who holds each operational authority and the emergency backup contact/process.
- The exact production domain and approved CORS-origin inventory.
- Whether the eventual rate-limit store/edge provider adds further environment-specific credentials and access roles.

## Infrastructure impact

| Question | Answer |
| --- | --- |
| Netlify required? | **Yes for a production frontend/deploy context**, but no configuration is authorized by this document. |
| Render required? | **Yes for a production API service**, but no configuration is authorized by this document. |
| Supabase migration required? | **No.** A separate project/access review is operational work, not a schema migration. |
