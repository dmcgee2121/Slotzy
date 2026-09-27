# Staging Postgres cutover

This runbook prepares a dedicated staging environment only. Do not use production credentials, migrate pilot data, or deploy as part of these steps.

## Configuration

Set these values only in the staging backend host's secret store:

```text
NODE_ENV=staging
SLOTZY_STORAGE=postgres
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only secret>
JWT_SECRET=<unique staging secret>
CORS_ALLOWED_ORIGINS=https://your-staging-frontend.netlify.app
```

Add controlled SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) only when staging email validation is planned. Never place these values in frontend configuration or committed `.env` files.

## Cutover sequence

1. Create a dedicated, empty Supabase staging project.
2. Review and manually apply `docs/SUPABASE_SCHEMA.sql` to that staging project.
3. Configure the backend staging secrets above. Keep staging credentials, JWT secret, mail sender, and CORS origins separate from production.
4. Start the backend with `SLOTZY_STORAGE=postgres`; startup must fail if Supabase credentials, `JWT_SECRET`, or the CORS allowlist are missing.
5. Request `GET /api/health` and confirm `ok: true`, `storage: "postgres"`, and `environment: "staging"`. This endpoint never returns configuration values or secrets.
6. Run server-mode smoke paths against staging.
7. Manually verify owner registration and login.
8. Verify shop setup, then service/team/availability configuration.
9. Verify public booking, receipt/manage link, cancellation, rescheduling, and active-booking overlap rejection.
10. Verify email/outbox behavior only with controlled staging inboxes.

Use an empty staging database for the first cutover. Optional demo data must be synthetic, separately reviewed, and seeded through a repeatable non-production procedure; do not copy `server/src/db.json`, browser storage, or pilot/customer data.

## Required checks

- `cd server && npm run test:storage` for the JSON contract.
- `cd server && npm run test:storage:postgres` against the separate disposable project, not staging.
- `npm run test:smoke -- --list` locally, plus server-mode and manual staging QA after deployment is explicitly authorized.

## Rollback

Set `SLOTZY_STORAGE=json` on the staging backend and restart it. JSON remains the default adapter and no silent fallback occurs from a failed Postgres startup. If staging Postgres has received data, retain it for diagnosis or take an approved staging-only backup before cleanup; switching to JSON does not copy, merge, or delete Postgres data. Do not use this rollback procedure for production.
