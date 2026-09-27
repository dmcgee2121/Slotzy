# Disposable Supabase test-project setup

This procedure is only for an empty, disposable Supabase project. It must never use staging, production, pilot, or personal-data credentials.

1. Create a new Supabase project clearly named as disposable test infrastructure, for example `slotzy-storage-test`. Do not reuse staging or production.
2. In that project's SQL editor, review and apply `docs/SUPABASE_SCHEMA.sql`. This is the only manual SQL application step; it is not performed by Slotzy tests.
   If the schema was applied before the latest 2026-09-27 integration fixes, apply the current `docs/SUPABASE_TEST_PATCH.sql` once in the same disposable project's SQL editor before testing. It is incremental (function replacement and grants only); do not recreate the project or run it against staging/production.
3. Mark that project disposable before any reset-capable test run:

   ```sql
   update public.slotzy_test_control set is_disposable = true where id = true;
   ```

4. Copy the project URL and service-role key from the project settings. The service-role key is server-only: never commit it, paste it into tickets, put it in `js/public-config.js`, or expose it to a browser.
5. In a temporary terminal environment, set only the test variables:

   ```powershell
   $env:SUPABASE_TEST_URL = "https://your-disposable-project.supabase.co"
   $env:SUPABASE_TEST_SERVICE_ROLE_KEY = "replace-with-disposable-test-service-role-key"
   $env:SLOTZY_ALLOW_DISPOSABLE_TEST_RESET = "true"
   cd server
   npm run test:storage:postgres
   ```

6. Expected result: all **9** Postgres integration cases execute instead of showing their missing-credentials skip reason. The fixture preflight and every test reset first verify `SLOTZY_ALLOW_DISPOSABLE_TEST_RESET=true`, then read `public.slotzy_test_control.is_disposable`; only after both pass does it call `slotzy_reset_disposable_test_data('DISPOSABLE_SLOTZY_TEST_RESET')`. A fixture failure means no destructive reset was attempted. Do not treat a skipped suite as database validation.
7. After testing, delete the disposable Supabase project from its dashboard. This is preferred over retaining test data. Do not run the reset RPC against any project that was not intentionally marked disposable.

## Reset safety

The SQL reset function requires both a database marker (`slotzy_test_control.is_disposable = true`) and the literal RPC confirmation `DISPOSABLE_SLOTZY_TEST_RESET`. Test code must also require `SLOTZY_ALLOW_DISPOSABLE_TEST_RESET=true` before calling it. These are defense-in-depth controls, not permission to use non-test credentials.

## Server-role access

This server-only phase grants the `service_role` explicitly because the disposable project has automatic new-table exposure/grants disabled. It grants only the schema usage, tables, and Slotzy RPCs used by the Express adapter and integration fixture; this UUID-based schema has no application sequences to grant. It does not grant `anon` or `authenticated` database access.

## Current test status

`server/test/postgres-store.integration.test.js` implements the disposable fixture lifecycle and contains all nine integration cases. It maps `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` directly into an explicitly constructed test store; it does not set runtime `SUPABASE_*` variables or select Postgres globally. Without the two test credentials, the cases skip clearly and make no network call. JSON tests remain the required local regression suite: `npm run test:storage`.
