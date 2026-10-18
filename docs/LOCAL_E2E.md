# Controlled local E2E startup

Run `npm run local:e2e` only for the controlled local acceptance workflow. It does not start, stop, migrate, reset, seed, or clean Supabase.

The launcher obtains transient connection values from `npx --yes supabase status --output env`. It fails before starting either application unless the CLI reports exactly:

- Supabase API: `http://127.0.0.1:54321`
- PostgreSQL: `127.0.0.1:54322/postgres`
- a non-empty local service-role key

It starts the frontend at `http://127.0.0.1:5173` and Express at `http://127.0.0.1:3001`. The frontend server replaces only its served `js/public-config.js` response with a loopback API base for that process; the checked-in hosted configuration is not edited and normal `npm run serve` behavior is unchanged.

The Express child receives a minimal environment: `SLOTZY_STORAGE=postgres`, exact local CLI credentials, loopback binding, blank SMTP variables, and `SLOTZY_FORCE_DEV_OUTBOX=true`. It does not inherit Supabase, SMTP, staging, production, proxy, or other runtime settings from the shell. The forced local flag makes the Dev Outbox authoritative even if SMTP configuration is later added to a local `.env`. The launcher verifies API health reports `storage: "postgres"` and checks the served frontend configuration before announcing readiness. No local credential is written to disk or printed.

Stop the launcher with Ctrl+C. It stops only its frontend and API child processes; it leaves the Supabase Docker stack and its data untouched.

Use `npm run test:local-e2e-config` for the non-destructive launcher guard tests.
