-- Optional one-time, non-destructive staging identity repair.
-- Review the preflight count first. This script only adds a canonical user
-- source mapping for relational users that have none; it never deletes or
-- updates users, usernames, credentials, shops, bookings, or metadata.
begin;

-- A non-zero count means historical relational users lack a canonical source
-- identity and may need this backfill before a full legacy snapshot write.
select count(*) as users_missing_canonical_source_mapping
from public.users u
where not exists (
  select 1 from public.legacy_source_ids l
  where l.entity_type = 'user' and l.target_id = u.id and l.is_canonical
);

insert into public.legacy_source_ids (entity_type, source_id, target_id, is_canonical)
select 'user', u.id::text, u.id, true
from public.users u
where not exists (
  select 1 from public.legacy_source_ids l
  where l.entity_type = 'user' and l.target_id = u.id and l.is_canonical
)
and not exists (
  select 1 from public.legacy_source_ids l
  where l.entity_type = 'user' and l.source_id = u.id::text
);

select count(*) as users_still_missing_canonical_source_mapping
from public.users u
where not exists (
  select 1 from public.legacy_source_ids l
  where l.entity_type = 'user' and l.target_id = u.id and l.is_canonical
);

commit;
