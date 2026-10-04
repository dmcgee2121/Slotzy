-- Slotzy beta: additive recurring weekly unavailable blocks.
-- Apply to staging only after taking a verified backup. This migration does
-- not update or delete existing availability, time_off, booking, user, or shop rows.

create table if not exists public.recurring_time_blocks (
  id uuid primary key default gen_random_uuid(),
  provider_member_id uuid not null references public.shop_members(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_time_blocks_valid_times check (end_time > start_time)
);

create index if not exists recurring_time_blocks_provider_weekday_idx
  on public.recurring_time_blocks (provider_member_id, weekday, start_time);

-- Backend-only table. No anon/authenticated policies are intentionally added;
-- Express uses the service role and the reconciliation RPC is security definer.
alter table public.recurring_time_blocks enable row level security;

drop trigger if exists recurring_time_blocks_set_updated_at on public.recurring_time_blocks;
create trigger recurring_time_blocks_set_updated_at before update on public.recurring_time_blocks
for each row execute function public.set_updated_at();

-- Reconcile only providers explicitly present in the supplied snapshot and only
-- when their schedule explicitly carries recurringBlocks. This stale-client
-- safety guard means an older/partial writer that omits the key cannot erase
-- recurring blocks. An explicit [] still intentionally deletes all blocks for
-- that provider; an explicit array upserts retained IDs and deletes omitted IDs.
-- Other providers and every pre-existing scheduling table remain untouched.
create or replace function public.slotzy_reconcile_recurring_blocks(snapshot jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_schedule jsonb; v_block jsonb; v_username text; v_member_id uuid;
begin
  if jsonb_typeof(snapshot) <> 'object' then raise exception 'snapshot must be an object'; end if;
  for v_username, v_schedule in
    select entry.key, entry.value from jsonb_each(coalesce(snapshot->'availability', '{}'::jsonb)) as entry(key, value)
  loop
    if not (v_schedule ? 'recurringBlocks') then
      continue;
    end if;

    select m.id into v_member_id
      from public.shop_members m
      join public.users u on u.id = m.user_id
      where u.username = v_username and u.deleted_at is null and m.deleted_at is null
      order by m.created_at limit 1;
    if v_member_id is null then continue; end if;

    delete from public.recurring_time_blocks r
      where r.provider_member_id = v_member_id
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(v_schedule->'recurringBlocks', '[]'::jsonb)) as retained(value)
          where retained.value->>'id' = r.id::text
        );
    for v_block in
      select entry.value from jsonb_array_elements(coalesce(v_schedule->'recurringBlocks', '[]'::jsonb)) as entry(value)
    loop
      insert into public.recurring_time_blocks (id, provider_member_id, weekday, start_time, end_time, label, is_enabled)
      values (
        (v_block->>'id')::uuid,
        v_member_id,
        case v_block->>'weekday' when 'sun' then 0 when 'mon' then 1 when 'tue' then 2 when 'wed' then 3 when 'thu' then 4 when 'fri' then 5 when 'sat' then 6 else null end,
        (v_block->>'start')::time,
        (v_block->>'end')::time,
        nullif(btrim(v_block->>'label'), ''),
        coalesce((v_block->>'enabled')::boolean, true)
      )
      on conflict (id) do update set
        provider_member_id = excluded.provider_member_id,
        weekday = excluded.weekday,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        label = excluded.label,
        is_enabled = excluded.is_enabled;
    end loop;
  end loop;
end;
$$;

-- One RPC keeps legacy snapshot reconciliation and recurring-block deletion/
-- insertion in the same database transaction.
create or replace function public.slotzy_storage_write_snapshot_with_recurring(snapshot jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.slotzy_storage_write_snapshot(snapshot);
  perform public.slotzy_reconcile_recurring_blocks(snapshot);
end;
$$;

-- Add recurring blocks to the transaction-level booking guard. Express also
-- performs the equivalent check before its current snapshot write path.
create or replace function public.slotzy_create_booking(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  new_booking public.bookings; token_expiry timestamptz;
  v_start timestamptz := (payload->>'start_at')::timestamptz;
  v_end timestamptz := (payload->>'end_at')::timestamptz;
  v_availability public.availability; v_local_start timestamp; v_local_end timestamp;
begin
  select a.* into v_availability from public.availability a
    where a.provider_member_id = (payload->>'provider_member_id')::uuid
      and a.weekday = extract(dow from (v_start at time zone a.timezone))::integer;
  if not found or not v_availability.is_enabled then raise exception 'slot_unavailable'; end if;
  v_local_start := v_start at time zone v_availability.timezone;
  v_local_end := v_end at time zone v_availability.timezone;
  if v_local_start::date <> v_local_end::date or v_local_start::time < v_availability.start_time or v_local_end::time > v_availability.end_time then
    raise exception 'slot_unavailable';
  end if;
  if exists (select 1 from public.time_off t where t.provider_member_id = v_availability.provider_member_id and v_start < t.ends_at and v_end > t.starts_at) then raise exception 'slot_unavailable'; end if;
  if exists (select 1 from public.recurring_time_blocks r where r.provider_member_id = v_availability.provider_member_id and r.is_enabled and r.weekday = v_availability.weekday and v_local_start::time < r.end_time and v_local_end::time > r.start_time) then raise exception 'slot_unavailable'; end if;

  insert into public.bookings (shop_id, provider_member_id, service_id, client_name, client_email, client_phone, client_contact, start_at, end_at, timezone, duration_minutes, status, confirmation_code, deposit_required, deposit_amount_cents, deposit_status, policy_snapshot, service_snapshot)
  values ((payload->>'shop_id')::uuid, (payload->>'provider_member_id')::uuid, (payload->>'service_id')::uuid, payload->>'client_name', nullif(payload->>'client_email', '')::citext, nullif(payload->>'client_phone', ''), payload->>'client_contact', v_start, v_end, coalesce(nullif(payload->>'timezone', ''), 'America/Chicago'), (payload->>'duration_minutes')::integer, coalesce((payload->>'status')::public.booking_status, 'booked'), payload->>'confirmation_code', coalesce((payload->>'deposit_required')::boolean, false), coalesce((payload->>'deposit_amount_cents')::integer, 0), coalesce((payload->>'deposit_status')::public.deposit_status, 'not_required'), coalesce(payload->'policy_snapshot', '{}'::jsonb), coalesce(payload->'service_snapshot', '{}'::jsonb)) returning * into new_booking;
  token_expiry := coalesce((payload->>'manage_token_expires_at')::timestamptz, new_booking.end_at + interval '30 days');
  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at) values (new_booking.id, payload->>'manage_token_hash', token_expiry);
  insert into public.booking_events (booking_id, event_type, actor_type, after_state, request_id) values (new_booking.id, 'created', coalesce(payload->>'actor_type', 'public_client'), to_jsonb(new_booking), nullif(payload->>'request_id', '')::uuid);
  if coalesce((payload->>'queue_notification')::boolean, false) then
    insert into public.email_outbox (booking_id, shop_id, recipient_email, subject, template_type, payload) values (new_booking.id, new_booking.shop_id, (payload->>'notification_recipient')::citext, coalesce(payload->>'notification_subject', 'Slotzy booking confirmation'), 'booking_created', coalesce(payload->'notification_payload', '{}'::jsonb));
  end if;
  return jsonb_build_object('booking', to_jsonb(new_booking));
exception when exclusion_violation then raise exception 'booking_overlap' using errcode = '23P01';
end;
$$;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.recurring_time_blocks to service_role;
revoke all on function public.slotzy_reconcile_recurring_blocks(jsonb), public.slotzy_storage_write_snapshot_with_recurring(jsonb), public.slotzy_create_booking(jsonb) from public;
grant execute on function public.slotzy_reconcile_recurring_blocks(jsonb), public.slotzy_storage_write_snapshot_with_recurring(jsonb), public.slotzy_create_booking(jsonb) to service_role;
