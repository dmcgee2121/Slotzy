# Closed-pilot backup and restore rehearsal runbook

## Purpose and scope

This is the dry-run-first recovery procedure for the **dedicated staging Supabase project** used by the Slotzy closed pilot. Its purpose is to prove that a known staging snapshot can be identified, exported or provider-backed up, restored into an isolated rehearsal target, and validated without risking the live staging or production environment.

It does not authorize production access, a staging reset, deletion, destructive SQL, or a restore into the active staging project. No real pilot/customer data should be copied to a rehearsal target unless the pilot owner has separately approved it and privacy controls are in place.

## Persistence model and recovery scope

- Hosted staging runs the Express API with `SLOTZY_STORAGE=postgres` against its dedicated Supabase Postgres project. The server-side adapter reads relational tables and maps them to the API's legacy document shape.
- Local/demo remains intentionally separate: the backend's default adapter is JSON (`server/src/db.json`) and the browser uses `Slotzy_` local/session-storage keys. These local stores are not a staging backup and must not be imported into staging as a recovery shortcut.
- The recovery set is the staging database schema plus the pilot data required by the API: `users`, `shops`, `shop_members`, `shop_settings`, `services`, `provider_services`, `availability`, `time_off`, `bookings`, `booking_events`, `booking_manage_tokens`, `email_outbox` if enabled, and `legacy_source_ids`.
- At minimum, recovery validation must cover identities, shop/provider relationships, services, hours/time off, bookings, and manage-token **hash** records. A token bearer value is not recoverable from its hash and must never be exported into notes or logs.

Not covered yet: mail-provider delivery history outside `email_outbox`, Render/Netlify configuration and deploy rollback, JWT/session invalidation, browser-local data, external support tooling, retention policy approval, and a production backup/recovery plan.

## Authorization and prerequisites

Only a named staging operator with Supabase project access and explicit approval from the pilot owner may create a backup or perform a restore rehearsal. A second reviewer should confirm the project identifier and target before any restore. Restore permission is separate from ordinary application access.

Before starting, record operator, reviewer, date/time (UTC), approved change/incident reference, source project label, target project label, intended snapshot/export ID, and whether the source contains synthetic-only data. Use an empty, separately created Supabase rehearsal project or an explicitly isolated provider-supported branch/project. It must have different credentials and must not be wired to the staging frontend/API.

Keep Supabase credentials only in approved secret stores or an interactive authenticated operator session. Do not put keys, connection strings, SQL-editor exports containing customer data, or raw dump files in Git, tickets, chat, screenshots, Playwright artifacts, or shared public storage.

## Safe backup/export procedure

1. Confirm the source is the dedicated **staging** Supabase project, not production, from the provider project dashboard and the API health/environment evidence. Stop on any ambiguity.
2. Record the timestamp and source project label in the rehearsal record. Do not record secrets.
3. Prefer the Supabase/provider backup snapshot or point-in-time-recovery record. Capture its provider snapshot identifier, timestamp, retention window, and displayed project label.
4. If an export is required, have the authorized operator use Supabase's approved database export/backup workflow with credentials held outside the repository. Export schema and required data to an access-controlled, encrypted location; preserve a checksum and access record. Do not paste dump contents into this runbook or execute it against staging.
5. Record only non-sensitive metadata: schema migration/version or checksum, artifact checksum, size, timestamp, provider snapshot/export ID, and table row counts.

## Read-only completeness verification

Use the read-only examples below in the Supabase SQL editor for the confirmed staging project. Capture counts and a small synthetic-data proof before the backup, then compare them after restore. Do not select client contact fields, password hashes, token hashes, or outbox payloads into a ticket unless an incident requires restricted handling.

```sql
-- Read-only: expected application tables present in the public schema.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users', 'shops', 'shop_members', 'shop_settings', 'services',
    'provider_services', 'availability', 'time_off', 'bookings',
    'booking_events', 'booking_manage_tokens', 'email_outbox',
    'legacy_source_ids'
  )
order by table_name;

-- Read-only: row-count baseline. Record counts, not row contents.
select 'users' as table_name, count(*) as row_count from public.users
union all select 'shops', count(*) from public.shops
union all select 'shop_members', count(*) from public.shop_members
union all select 'shop_settings', count(*) from public.shop_settings
union all select 'services', count(*) from public.services
union all select 'provider_services', count(*) from public.provider_services
union all select 'availability', count(*) from public.availability
union all select 'time_off', count(*) from public.time_off
union all select 'bookings', count(*) from public.bookings
union all select 'booking_events', count(*) from public.booking_events
union all select 'booking_manage_tokens', count(*) from public.booking_manage_tokens
union all select 'email_outbox', count(*) from public.email_outbox
union all select 'legacy_source_ids', count(*) from public.legacy_source_ids
order by table_name;

-- Read-only: booking recency only; do not export appointment details.
select max(created_at) as latest_booking_created_at,
       max(start_at) as latest_booking_start_at,
       count(*) as booking_count
from public.bookings;

-- Read-only: synthetic shop existence by a reviewed marker/slug.
-- Replace the placeholder locally; do not paste a real customer identifier into shared notes.
select count(*) as synthetic_shop_count
from public.shops
where slug = '<approved-synthetic-shop-slug>';

-- Read-only: confirm token records exist without returning any hashes.
select count(*) as manage_token_record_count,
       count(*) filter (where revoked_at is null and expires_at > now()) as active_unexpired_count
from public.booking_manage_tokens;
```

The following are forbidden in this rehearsal: `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, `INSERT`, reset RPCs, broad cleanup scripts, and any SQL that changes the staging database. Do not run `docs/SUPABASE_SCHEMA.sql` or `docs/SUPABASE_STAGING_REPAIR.sql` as part of this backup check; those are separate controlled schema/repair procedures.

## Restore rehearsal into a safe target

1. Create or select the empty rehearsal project/branch. Verify its project label, URL, account, and credentials are different from staging and production; record this evidence.
2. Restore only the approved staging snapshot/export into that target through the provider-supported restore/import workflow. The target must have no production connection, no public frontend routing, and no staging API configured to point at it.
3. If a temporary API validation is needed, configure an isolated rehearsal service with target-only secrets and an explicit non-production environment label. Never change the live staging service's database URL.
4. Compare schema/table inventory, counts, and booking recency against the pre-backup record. Investigate mismatches before application testing; do not repair the source by hand.
5. Verify the approved synthetic shop, its provider/service/hour relationships, booking presence, and the count-only manage-token proof. Do not attempt to recover or display bearer manage tokens.
6. If an isolated rehearsal API is available, request `GET /api/health`, then run the guarded staging tests or an equivalent synthetic-only smoke path against the rehearsal target only when its target guard confirms non-production. Confirm public booking context and authenticated owner appointment visibility using synthetic records. Do not direct normal staging E2E at the restore target without its explicit environment guard.

## Abort, rollback, and incident handling

Abort immediately if the source or target may be production, the target is not isolated, credentials appear in output, snapshot provenance is unclear, counts cannot be captured safely, or an operation requests destructive confirmation for staging. Stop rather than guessing.

The safe rollback for a failed rehearsal is to disconnect/stop the isolated rehearsal service and preserve its evidence for diagnosis. Do not overwrite, reset, or "roll back" active staging. Escalate an actual staging data-loss event to the pilot owner and Supabase-authorized operator; choose a provider-supported point-in-time/snapshot restore only under a separately approved incident decision.

### Incident/rehearsal notes template

```text
Date/time (UTC):
Operator / reviewer:
Change or incident reference:
Confirmed source project label (staging only):
Confirmed isolated target project label:
Snapshot/export ID and timestamp:
Artifact checksum / retention location (restricted):
Pre-restore and post-restore row counts:
Synthetic shop validation result:
Bookings / manage-token-hash count validation result:
Health and guarded-test result (if run):
Mismatch, abort condition, or failure observed:
Decision, owner, and follow-up:
```

## Rehearsal checklist

- [ ] Confirm the correct Supabase project/environment and record evidence that it is staging, not production.
- [ ] Record timestamp, operator, reviewer, and snapshot/export identifier.
- [ ] Export schema/data through approved restricted tooling, or verify a provider backup snapshot/PITR record.
- [ ] Capture and compare row counts by recovery table.
- [ ] Verify an approved synthetic shop exists without exposing personal data.
- [ ] Verify bookings and manage-token hash records exist using counts only.
- [ ] Restore only to an isolated, non-production rehearsal target.
- [ ] Request the rehearsal API health check, if an isolated API is configured.
- [ ] Run guarded staging tests or an equivalent synthetic-only smoke path against the restore target, if available.
- [ ] Confirm public booking context and authenticated owner appointment visibility on the restore target.
- [ ] Document result, mismatches, aborts, and next owner.

## Rehearsal evidence log — readiness review (2026-10-03)

### Status

- **Classification:** Cannot perform because an isolated target is missing.
- **Runbook created:** yes.
- **Read-only readiness review completed:** yes — documentation, schema, and storage/runtime configuration were reviewed locally; no live database query was made.
- **Actual export captured:** no.
- **Actual isolated restore performed:** no.
- **Restore target:** none configured or evidenced in this workspace.
- **Validation performed:** confirmed the expected recovery tables in `docs/SUPABASE_SCHEMA.sql`; confirmed that `GET /api/health` reports the storage adapter and runtime environment; confirmed the Postgres adapter requires server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; prepared count-only validation SQL above.
- **What could not be verified:** staging health live response, provider snapshot/export identifier and retention, pre/post-restore table counts, synthetic-shop proof, restored API/smoke path, and target isolation.
- **Why:** this environment has no Supabase/staging environment variables or isolated target configuration. Supabase snapshot/export and restore actions require an authorized operator's authenticated dashboard/provider session. No credentials were requested, read, or exposed.
- **Remaining blocker:** **Backup/restore rehearsal remains open pending isolated restore execution.**
- **Evidence location:** this section; the completed operator record belongs in the restricted incident/rehearsal notes template below, not in Git.
- **Next owner action:** appoint the authorized staging operator and reviewer, create or select an empty isolated Supabase rehearsal project/branch, then complete the manual procedure below.

### Exact operator procedure to close this blocker

1. In an authenticated Supabase session, have the operator and reviewer independently confirm the source project is the dedicated staging project and record only its human-readable label and UTC time in the restricted record. Stop if the project could be production.
2. Run the **read-only** table-inventory and row-count queries in [Read-only completeness verification](#read-only-completeness-verification). Record counts only; do not export rows, contacts, token hashes, or outbox payloads.
3. In the Supabase dashboard/provider backup interface, identify the approved staging snapshot/PITR point or create an approved restricted export. Record snapshot/export ID, timestamp, retention, artifact checksum (if exported), and restricted storage reference—never credentials or dump contents.
4. Create/select an empty rehearsal project or provider-supported isolated branch with a distinct project label and distinct credentials. Record evidence that it has no production connection, public routing, or live staging API configuration.
5. Use the provider-supported restore/import interface to restore the approved artifact **only** into that isolated target. Do not run the schema file, repair scripts, resets, cleanup, or any destructive SQL against staging.
6. On the target, rerun the same inventory/count queries and compare with the staging baseline. Validate the approved synthetic shop, relationship/service/hours shape, booking recency/count, and count-only manage-token proof.
7. If an isolated API is provisioned with target-only secrets, call `GET /api/health` and record only `ok`, `service`, `storage`, and `environment`. Run a synthetic-only guarded smoke path only after its target guard proves it cannot reach production or active staging.
8. Complete the restricted notes template with pass/fail, discrepancies, operator/reviewer, and follow-up. Mark this blocker resolved only when the isolated restore and required comparisons pass.

## Current status

Runbook created on 2026-10-02; readiness review completed on 2026-10-03. No backup/export, restore, credential access, SQL execution, staging mutation, staging reset, or production action was performed from this workspace. The actual isolated restore rehearsal remains required before closed-pilot readiness can be approved.
