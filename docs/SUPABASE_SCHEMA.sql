-- Slotzy Supabase/Postgres schema foundation
-- Planning artifact only. Do NOT run this against staging or production yet.
-- Express remains the only application caller in the first migration phase.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

do $$ begin
  create type public.user_role as enum ('owner', 'barber', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_role as enum ('owner', 'barber');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum ('booked', 'confirmed', 'completed', 'cancelled', 'no-show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deposit_status as enum ('not_required', 'unpaid', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outbox_status as enum ('pending', 'sent', 'failed', 'suppressed');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  display_name text not null,
  password_hash text not null,
  role public.user_role not null,
  email citext,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_username_not_blank check (btrim(username::text) <> ''),
  constraint users_display_name_not_blank check (btrim(display_name) <> '')
);

create unique index if not exists users_email_unique_active
  on public.users (email) where email is not null and deleted_at is null;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  slug citext not null,
  phone text,
  email citext,
  logo_url text,
  cover_url text,
  timezone text not null default 'America/Chicago',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shops_name_not_blank check (btrim(name) <> ''),
  constraint shops_slug_not_blank check (btrim(slug::text) <> '')
);

create unique index if not exists shops_slug_unique_active
  on public.shops (slug) where deleted_at is null;
create index if not exists shops_owner_user_id_idx on public.shops (owner_user_id);

create table if not exists public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  role public.membership_role not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shop_members_unique_membership unique (shop_id, user_id)
);

create index if not exists shop_members_user_id_idx on public.shop_members (user_id);
create index if not exists shop_members_active_shop_idx on public.shop_members (shop_id, is_active)
  where deleted_at is null;

create table if not exists public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete restrict,
  allow_same_day boolean not null default true,
  max_days_advance integer not null default 30 check (max_days_advance >= 1),
  cancel_hours integer not null default 24 check (cancel_hours >= 0),
  buffer_minutes integer not null default 0 check (buffer_minutes in (0, 5, 10, 15)),
  require_deposit boolean not null default false,
  deposit_amount_cents integer not null default 0 check (deposit_amount_cents >= 0),
  late_grace_minutes integer not null default 10 check (late_grace_minutes >= 0),
  no_show_strike_limit integer not null default 2 check (no_show_strike_limit >= 0),
  reminder_24_hours boolean not null default true,
  reminder_2_hours boolean not null default true,
  reminder_custom_enabled boolean not null default false,
  reminder_custom_minutes integer not null default 60 check (reminder_custom_minutes >= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint services_name_not_blank check (btrim(name) <> '')
);
create index if not exists services_public_listing_idx on public.services (shop_id, is_active, name)
  where deleted_at is null;

create table if not exists public.provider_services (
  provider_member_id uuid not null references public.shop_members(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_member_id, service_id)
);
create index if not exists provider_services_service_idx
  on public.provider_services (service_id, is_active);

-- One recurring local-time schedule row per provider and weekday (0=Sunday, 6=Saturday).
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  provider_member_id uuid not null references public.shop_members(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  is_enabled boolean not null default true,
  start_time time not null default time '09:00',
  end_time time not null default time '17:00',
  timezone text not null default 'America/Chicago',
  buffer_minutes integer not null default 0 check (buffer_minutes in (0, 5, 10, 15)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_unique_day unique (provider_member_id, weekday),
  constraint availability_valid_times check (not is_enabled or end_time > start_time)
);
create index if not exists availability_provider_idx on public.availability (provider_member_id, weekday);

create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  provider_member_id uuid not null references public.shop_members(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_valid_range check (ends_at > starts_at)
);
create index if not exists time_off_provider_range_idx
  on public.time_off (provider_member_id, starts_at, ends_at);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  provider_member_id uuid not null references public.shop_members(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  client_name text not null,
  client_email citext,
  client_phone text,
  client_contact text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/Chicago',
  duration_minutes integer not null check (duration_minutes > 0),
  status public.booking_status not null default 'booked',
  confirmation_code text not null,
  deposit_required boolean not null default false,
  deposit_amount_cents integer not null default 0 check (deposit_amount_cents >= 0),
  deposit_status public.deposit_status not null default 'not_required',
  cancelled_at timestamptz,
  cancelled_by_member_id uuid references public.shop_members(id) on delete set null,
  cancellation_reason text,
  rescheduled_at timestamptz,
  rescheduled_by_member_id uuid references public.shop_members(id) on delete set null,
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  policy_snapshot jsonb not null default '{}'::jsonb,
  service_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  appointment_range tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  constraint bookings_client_name_not_blank check (btrim(client_name) <> ''),
  constraint bookings_contact_not_blank check (btrim(client_contact) <> ''),
  constraint bookings_valid_range check (end_at > start_at),
  constraint bookings_duration_matches_range check (
    end_at = start_at + make_interval(mins => duration_minutes)
  ),
  constraint bookings_confirmation_code_not_blank check (btrim(confirmation_code) <> ''),
  constraint bookings_cancelled_metadata check (
    status <> 'cancelled' or cancelled_at is not null
  )
);
create unique index if not exists bookings_shop_confirmation_code_unique
  on public.bookings (shop_id, confirmation_code);
create index if not exists bookings_provider_schedule_idx
  on public.bookings (provider_member_id, start_at) where status in ('booked', 'confirmed');
create index if not exists bookings_shop_schedule_idx on public.bookings (shop_id, start_at);
create index if not exists bookings_contact_lookup_idx on public.bookings (shop_id, client_contact, start_at desc);
create index if not exists bookings_status_schedule_idx on public.bookings (status, start_at);
alter table public.bookings drop constraint if exists bookings_provider_active_overlap;
alter table public.bookings add constraint bookings_provider_active_overlap
  exclude using gist (provider_member_id with =, appointment_range with &&)
  where (status in ('booked', 'confirmed'));

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_type text not null,
  actor_type text not null check (actor_type in ('public_client', 'owner', 'barber', 'system')),
  actor_member_id uuid references public.shop_members(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  request_id uuid,
  occurred_at timestamptz not null default now(),
  constraint booking_events_type_not_blank check (btrim(event_type) <> '')
);
create index if not exists booking_events_booking_time_idx on public.booking_events (booking_id, occurred_at desc);

-- Store only a SHA-256/HMAC hash of a high-entropy, random bearer token.
create table if not exists public.booking_manage_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_manage_tokens_hash_not_blank check (btrim(token_hash) <> ''),
  constraint booking_manage_tokens_expiry_after_creation check (expires_at > created_at)
);
create index if not exists booking_manage_tokens_active_idx
  on public.booking_manage_tokens (booking_id, expires_at)
  where revoked_at is null;

-- Optional server-only operational outbox. It is not a public Dev Outbox replacement.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  shop_id uuid references public.shops(id) on delete set null,
  recipient_email citext not null,
  subject text not null,
  template_type text,
  payload jsonb not null default '{}'::jsonb,
  delivery_status public.outbox_status not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_outbox_recipient_not_blank check (btrim(recipient_email::text) <> ''),
  constraint email_outbox_subject_not_blank check (btrim(subject) <> '')
);
create index if not exists email_outbox_delivery_idx on public.email_outbox (delivery_status, created_at);

-- Maps legacy JSON identifiers (which may not be UUIDs) to relational UUIDs.
-- `is_canonical` is the identifier returned to legacy-shaped Express callers.
create table if not exists public.legacy_source_ids (
  entity_type text not null check (entity_type in ('user', 'shop', 'member', 'service', 'booking', 'time_off', 'email')),
  source_id text not null,
  target_id uuid not null,
  is_canonical boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (entity_type, source_id)
);
create unique index if not exists legacy_source_ids_canonical_target_unique
  on public.legacy_source_ids (entity_type, target_id) where is_canonical;

create or replace function public.slotzy_legacy_target_id(p_entity_type text, p_source_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if coalesce(btrim(p_source_id), '') = '' then
    raise exception 'legacy source id is required for %', p_entity_type;
  end if;
  select target_id into target from public.legacy_source_ids
    where entity_type = p_entity_type and source_id = p_source_id;
  -- readStore returns a user's canonical legacy source when present. Historical
  -- relational users may predate that map, however, and are read with their
  -- relational UUID as a safe fallback. Reuse that UUID rather than generating
  -- a second target which would collide on users.username during upsert.
  if target is null and p_entity_type = 'user' then
    select u.id into target from public.users u where u.id::text = p_source_id;
    if target is not null then
      insert into public.legacy_source_ids (entity_type, source_id, target_id, is_canonical)
      values ('user', p_source_id, target, not exists (
        select 1 from public.legacy_source_ids l
        where l.entity_type = 'user' and l.target_id = target and l.is_canonical
      ))
      on conflict (entity_type, source_id) do update set target_id = excluded.target_id;
    end if;
  end if;
  if target is null then
    target := gen_random_uuid();
    insert into public.legacy_source_ids (entity_type, source_id, target_id)
    values (p_entity_type, p_source_id, target);
  end if;
  return target;
end;
$$;

-- Reconciles only rows named by the supplied legacy snapshot. It does not delete
-- unrelated relational rows. Repeated snapshots update the same source mappings.
create or replace function public.slotzy_storage_write_snapshot(snapshot jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user jsonb; v_shop jsonb; v_service jsonb; v_booking jsonb; v_time_off jsonb;
  v_schedule jsonb; v_day_schedule jsonb; v_username text; v_day_name text;
  v_user_id uuid; v_shop_id uuid; v_member_id uuid; v_service_id uuid; v_booking_id uuid;
  v_source text; v_provider_source text; v_starts timestamptz; v_ends timestamptz; v_duration integer;
begin
  if jsonb_typeof(snapshot) <> 'object' then raise exception 'snapshot must be an object'; end if;

  -- Users first. The username is also an alias so provider references resolve by
  -- current application username without relying on array ordering.
  for v_user in select entry.value from jsonb_array_elements(coalesce(snapshot->'users', '[]'::jsonb)) as entry(value) loop
    v_source := coalesce(nullif(v_user->>'id', ''), v_user->>'username');
    v_user_id := public.slotzy_legacy_target_id('user', v_source);
    insert into public.users (id, username, display_name, password_hash, role, email, phone, created_at)
    values (v_user_id, v_user->>'username', coalesce(nullif(v_user->>'displayName', ''), v_user->>'username'),
      coalesce(v_user->>'passwordHash', ''), coalesce((v_user->>'role')::public.user_role, 'customer'),
      nullif(v_user->>'email', '')::citext, nullif(v_user->>'phone', ''), coalesce(nullif(v_user->>'createdAt', '')::timestamptz, now()))
    on conflict (id) do update set username = excluded.username, display_name = excluded.display_name,
      password_hash = excluded.password_hash, role = excluded.role, email = excluded.email, phone = excluded.phone, deleted_at = null;
    if v_source <> v_user->>'username' then
      insert into public.legacy_source_ids (entity_type, source_id, target_id, is_canonical)
      values ('user', v_user->>'username', v_user_id, false) on conflict (entity_type, source_id) do update set target_id = excluded.target_id;
    end if;
  end loop;

  for v_shop in select entry.value from jsonb_array_elements(coalesce(snapshot->'shops', '[]'::jsonb)) as entry(value) loop
    v_source := v_shop->>'id'; v_shop_id := public.slotzy_legacy_target_id('shop', v_source);
    select l.target_id into v_user_id from public.legacy_source_ids l where l.entity_type = 'user' and l.source_id = v_shop->>'ownerUsername';
    if v_user_id is null then raise exception 'shop % references unknown owner %', v_source, v_shop->>'ownerUsername'; end if;
    insert into public.shops (id, owner_user_id, name, slug, phone, email, logo_url, cover_url, created_at)
    values (v_shop_id, v_user_id, coalesce(v_shop->>'name', v_shop->>'businessName'), v_shop->>'slug', nullif(v_shop->>'shopPhone', ''),
      nullif(v_shop->>'shopEmail', '')::citext, nullif(v_shop->>'logo', ''), nullif(v_shop->>'cover', ''), coalesce(nullif(v_shop->>'createdAtISO', '')::timestamptz, now()))
    on conflict (id) do update set owner_user_id = excluded.owner_user_id, name = excluded.name, slug = excluded.slug,
      phone = excluded.phone, email = excluded.email, logo_url = excluded.logo_url, cover_url = excluded.cover_url, deleted_at = null;
    insert into public.shop_settings (shop_id, allow_same_day, max_days_advance, cancel_hours, buffer_minutes, require_deposit, deposit_amount_cents, late_grace_minutes, no_show_strike_limit, reminder_24_hours, reminder_2_hours, reminder_custom_enabled, reminder_custom_minutes)
    values (v_shop_id, coalesce((v_shop#>>'{bookingPolicy,allowSameDay}')::boolean, true), coalesce((v_shop#>>'{bookingPolicy,maxDaysAdvance}')::integer, 30), coalesce((v_shop#>>'{bookingPolicy,cancelHours}')::integer, 24), coalesce((v_shop#>>'{bookingPolicy,bufferMinutes}')::integer, 0), coalesce((v_shop#>>'{bookingPolicy,requireDeposit}')::boolean, false), round(coalesce((v_shop#>>'{bookingPolicy,depositAmount}')::numeric, 0) * 100)::integer, coalesce((v_shop#>>'{bookingPolicy,lateGraceMinutes}')::integer, 10), coalesce((v_shop#>>'{bookingPolicy,noShowStrikeLimit}')::integer, 2), coalesce((v_shop#>>'{bookingPolicy,reminder24Hours}')::boolean, true), coalesce((v_shop#>>'{bookingPolicy,reminder2Hours}')::boolean, true), coalesce((v_shop#>>'{bookingPolicy,reminderCustomEnabled}')::boolean, false), coalesce((v_shop#>>'{bookingPolicy,reminderCustomMinutes}')::integer, 60))
    on conflict (shop_id) do update set allow_same_day = excluded.allow_same_day, max_days_advance = excluded.max_days_advance, cancel_hours = excluded.cancel_hours, buffer_minutes = excluded.buffer_minutes, require_deposit = excluded.require_deposit, deposit_amount_cents = excluded.deposit_amount_cents, late_grace_minutes = excluded.late_grace_minutes, no_show_strike_limit = excluded.no_show_strike_limit, reminder_24_hours = excluded.reminder_24_hours, reminder_2_hours = excluded.reminder_2_hours, reminder_custom_enabled = excluded.reminder_custom_enabled, reminder_custom_minutes = excluded.reminder_custom_minutes;
  end loop;

  -- Membership source key is stable shop-id + username; providers resolve through it.
  for v_user in select entry.value from jsonb_array_elements(coalesce(snapshot->'users', '[]'::jsonb)) as entry(value) loop
    if coalesce(v_user->>'shopId', '') <> '' and coalesce(v_user->>'role', '') in ('owner', 'barber') then
      select l.target_id into v_shop_id from public.legacy_source_ids l where l.entity_type = 'shop' and l.source_id = v_user->>'shopId';
      select l.target_id into v_user_id from public.legacy_source_ids l where l.entity_type = 'user' and l.source_id = coalesce(nullif(v_user->>'id', ''), v_user->>'username');
      if v_shop_id is not null and v_user_id is not null then
        v_source := (v_user->>'shopId') || ':' || (v_user->>'username'); v_member_id := public.slotzy_legacy_target_id('member', v_source);
        insert into public.shop_members (id, shop_id, user_id, role) values (v_member_id, v_shop_id, v_user_id, (v_user->>'role')::public.membership_role)
        on conflict (id) do update set shop_id = excluded.shop_id, user_id = excluded.user_id, role = excluded.role, deleted_at = null;
      end if;
    end if;
  end loop;

  for v_service in select entry.value from jsonb_array_elements(coalesce(snapshot->'services', '[]'::jsonb)) as entry(value) loop
    v_source := v_service->>'id'; v_service_id := public.slotzy_legacy_target_id('service', v_source);
    select l.target_id into v_shop_id from public.legacy_source_ids l where l.entity_type = 'shop' and l.source_id = v_service->>'shopId';
    insert into public.services (id, shop_id, name, price_cents, duration_minutes, is_active)
    values (v_service_id, v_shop_id, coalesce(v_service->>'name', v_service->>'title'), round(coalesce((v_service->>'price')::numeric, 0) * 100)::integer, coalesce((v_service->>'durationMinutes')::integer, (v_service->>'duration')::integer, 30), coalesce((v_service->>'active')::boolean, true))
    on conflict (id) do update set shop_id = excluded.shop_id, name = excluded.name, price_cents = excluded.price_cents, duration_minutes = excluded.duration_minutes, is_active = excluded.is_active, deleted_at = null;
    v_provider_source := (v_service->>'shopId') || ':' || coalesce(v_service->>'barberUsername', v_service->>'ownerUsername');
    select l.target_id into v_member_id from public.legacy_source_ids l where l.entity_type = 'member' and l.source_id = v_provider_source;
    if v_member_id is not null then insert into public.provider_services (provider_member_id, service_id, is_active) values (v_member_id, v_service_id, coalesce((v_service->>'active')::boolean, true)) on conflict (provider_member_id, service_id) do update set is_active = excluded.is_active; end if;
  end loop;

  -- Availability object is keyed by username; map each schedule/time-off block by provider membership.
  for v_username, v_schedule in select entry.key, entry.value from jsonb_each(coalesce(snapshot->'availability', '{}'::jsonb)) as entry(key, value) loop
    select l.target_id into v_member_id from public.legacy_source_ids l where l.entity_type = 'member' and l.source_id like '%:' || v_username order by l.is_canonical desc limit 1;
    if v_member_id is null then continue; end if;
    for v_time_off in select entry.value from jsonb_array_elements(coalesce(v_schedule->'timeOff', '[]'::jsonb)) as entry(value) loop
      -- Parentheses are required here: PostgreSQL's generic operators are
      -- left-associative, so text concatenation must not become the left side
      -- of a subsequent JSON extraction operator.
      v_source := coalesce(nullif(v_time_off->>'id', ''), v_username || ':' || (v_time_off->>'startISO') || ':' || (v_time_off->>'endISO'));
      insert into public.time_off (id, provider_member_id, starts_at, ends_at, note) values (public.slotzy_legacy_target_id('time_off', v_source), v_member_id, (v_time_off->>'startISO')::timestamptz, (v_time_off->>'endISO')::timestamptz, v_time_off->>'note') on conflict (id) do update set provider_member_id = excluded.provider_member_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at, note = excluded.note;
    end loop;
    for v_day_name, v_day_schedule in select entry.key, entry.value from jsonb_each(coalesce(v_schedule->'weekly', '{}'::jsonb)) as entry(key, value) loop
      insert into public.availability (provider_member_id, weekday, is_enabled, start_time, end_time, timezone, buffer_minutes)
      values (v_member_id, case v_day_name when 'sun' then 0 when 'mon' then 1 when 'tue' then 2 when 'wed' then 3 when 'thu' then 4 when 'fri' then 5 else 6 end, coalesce((v_day_schedule->>'enabled')::boolean, false), coalesce((v_day_schedule->>'start')::time, time '09:00'), coalesce((v_day_schedule->>'end')::time, time '17:00'), coalesce(nullif(v_day_schedule->>'timezone', ''), nullif(v_schedule->>'timezone', ''), 'America/Chicago'), coalesce((v_day_schedule->>'bufferMinutes')::integer, (v_schedule->>'bufferMinutes')::integer, 0))
      on conflict (provider_member_id, weekday) do update set is_enabled = excluded.is_enabled, start_time = excluded.start_time, end_time = excluded.end_time, timezone = excluded.timezone, buffer_minutes = excluded.buffer_minutes;
    end loop;
  end loop;

  for v_booking in select entry.value from jsonb_array_elements(coalesce(snapshot->'bookings', '[]'::jsonb)) as entry(value) loop
    v_source := v_booking->>'id'; v_booking_id := public.slotzy_legacy_target_id('booking', v_source);
    select l.target_id into v_shop_id from public.legacy_source_ids l where l.entity_type = 'shop' and l.source_id = v_booking->>'shopId';
    v_provider_source := (v_booking->>'shopId') || ':' || coalesce(v_booking->>'barberUsername', v_booking->>'ownerUsername'); select l.target_id into v_member_id from public.legacy_source_ids l where l.entity_type = 'member' and l.source_id = v_provider_source;
    select l.target_id into v_service_id from public.legacy_source_ids l where l.entity_type = 'service' and l.source_id = v_booking->>'serviceId';
    if v_service_id is null then select l.target_id into v_service_id from public.legacy_source_ids l join public.services s on s.id = l.target_id where l.entity_type = 'service' and s.shop_id = v_shop_id and s.name = coalesce(v_booking->>'serviceName', v_booking->>'serviceTitle') limit 1; end if;
    v_starts := coalesce(nullif(v_booking->>'startISO', '')::timestamptz, ((v_booking->>'date') || 'T' || (v_booking->>'time'))::timestamptz); v_duration := coalesce((v_booking->>'durationMinutes')::integer, (v_booking->>'duration')::integer, 30); v_ends := coalesce(nullif(v_booking->>'endISO', '')::timestamptz, v_starts + make_interval(mins => v_duration));
    insert into public.bookings (id, shop_id, provider_member_id, service_id, client_name, client_email, client_phone, client_contact, start_at, end_at, timezone, duration_minutes, status, confirmation_code, deposit_required, deposit_amount_cents, deposit_status, cancelled_at, policy_snapshot, service_snapshot)
    values (v_booking_id, v_shop_id, v_member_id, v_service_id, v_booking->>'clientName', nullif(v_booking->>'clientEmail', '')::citext, nullif(v_booking->>'clientPhone', ''), v_booking->>'clientContact', v_starts, v_ends, coalesce(nullif(v_booking->>'timezone', ''), 'America/Chicago'), v_duration, coalesce((v_booking->>'status')::public.booking_status, 'booked'), coalesce(nullif(v_booking->>'confirmationCode', ''), upper(right(replace(v_source, '-', ''), 6)), 'N/A'), coalesce((v_booking->>'depositRequired')::boolean, false), round(coalesce((v_booking->>'depositAmount')::numeric, 0) * 100)::integer, coalesce((v_booking->>'depositStatus')::public.deposit_status, 'not_required'), case when v_booking->>'status' = 'cancelled' then now() else null end, coalesce(v_booking->'policySnapshot', '{}'::jsonb), jsonb_build_object('name', coalesce(v_booking->>'serviceName', v_booking->>'serviceTitle', 'Service')))
    on conflict (id) do update set shop_id = excluded.shop_id, provider_member_id = excluded.provider_member_id, service_id = excluded.service_id, start_at = excluded.start_at, end_at = excluded.end_at, duration_minutes = excluded.duration_minutes, status = excluded.status, confirmation_code = excluded.confirmation_code, client_name = excluded.client_name, client_email = excluded.client_email, client_phone = excluded.client_phone, client_contact = excluded.client_contact, timezone = excluded.timezone, deposit_required = excluded.deposit_required, deposit_amount_cents = excluded.deposit_amount_cents, deposit_status = excluded.deposit_status, cancelled_at = excluded.cancelled_at, policy_snapshot = excluded.policy_snapshot, service_snapshot = excluded.service_snapshot;
  end loop;
end;
$$;

-- Destructive reset guard for a manually marked disposable test project only.
create table if not exists public.slotzy_test_control (id boolean primary key default true check (id), is_disposable boolean not null default false);
insert into public.slotzy_test_control (id, is_disposable) values (true, false) on conflict (id) do nothing;
create or replace function public.slotzy_reset_disposable_test_data(p_confirmation text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_confirmation <> 'DISPOSABLE_SLOTZY_TEST_RESET' or not (select is_disposable from public.slotzy_test_control where id) then raise exception 'disposable test reset is not enabled'; end if;
  truncate public.email_outbox, public.booking_manage_tokens, public.booking_events, public.bookings, public.time_off, public.availability, public.provider_services, public.services, public.shop_settings, public.shop_members, public.shops, public.users, public.legacy_source_ids restart identity;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at before update on public.shops
for each row execute function public.set_updated_at();
drop trigger if exists shop_members_set_updated_at on public.shop_members;
create trigger shop_members_set_updated_at before update on public.shop_members
for each row execute function public.set_updated_at();
drop trigger if exists shop_settings_set_updated_at on public.shop_settings;
create trigger shop_settings_set_updated_at before update on public.shop_settings
for each row execute function public.set_updated_at();
drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();
drop trigger if exists provider_services_set_updated_at on public.provider_services;
create trigger provider_services_set_updated_at before update on public.provider_services
for each row execute function public.set_updated_at();
drop trigger if exists availability_set_updated_at on public.availability;
create trigger availability_set_updated_at before update on public.availability
for each row execute function public.set_updated_at();
drop trigger if exists time_off_set_updated_at on public.time_off;
create trigger time_off_set_updated_at before update on public.time_off
for each row execute function public.set_updated_at();
drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at before update on public.email_outbox
for each row execute function public.set_updated_at();

-- Server-only atomic hosted-booking RPC. Express generates the raw manage token,
-- hashes it before this call, and must never log the raw value. Apply/review this
-- only in a disposable test database before making postgres storage selectable.
create or replace function public.slotzy_create_booking(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking public.bookings;
  token_expiry timestamptz;
begin
  insert into public.bookings (
    shop_id, provider_member_id, service_id, client_name, client_email, client_phone,
    client_contact, start_at, end_at, timezone, duration_minutes, status,
    confirmation_code, deposit_required, deposit_amount_cents, deposit_status,
    policy_snapshot, service_snapshot
  ) values (
    (payload->>'shop_id')::uuid, (payload->>'provider_member_id')::uuid,
    (payload->>'service_id')::uuid, payload->>'client_name', nullif(payload->>'client_email', '')::citext,
    nullif(payload->>'client_phone', ''), payload->>'client_contact',
    (payload->>'start_at')::timestamptz, (payload->>'end_at')::timestamptz,
    coalesce(nullif(payload->>'timezone', ''), 'America/Chicago'), (payload->>'duration_minutes')::integer,
    coalesce((payload->>'status')::public.booking_status, 'booked'), payload->>'confirmation_code',
    coalesce((payload->>'deposit_required')::boolean, false), coalesce((payload->>'deposit_amount_cents')::integer, 0),
    coalesce((payload->>'deposit_status')::public.deposit_status, 'not_required'),
    coalesce(payload->'policy_snapshot', '{}'::jsonb), coalesce(payload->'service_snapshot', '{}'::jsonb)
  ) returning * into new_booking;

  token_expiry := coalesce((payload->>'manage_token_expires_at')::timestamptz, new_booking.end_at + interval '30 days');
  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at)
  values (new_booking.id, payload->>'manage_token_hash', token_expiry);

  insert into public.booking_events (booking_id, event_type, actor_type, after_state, request_id)
  values (new_booking.id, 'created', coalesce(payload->>'actor_type', 'public_client'), to_jsonb(new_booking), nullif(payload->>'request_id', '')::uuid);

  if coalesce((payload->>'queue_notification')::boolean, false) then
    insert into public.email_outbox (booking_id, shop_id, recipient_email, subject, template_type, payload)
    values (new_booking.id, new_booking.shop_id, (payload->>'notification_recipient')::citext,
      coalesce(payload->>'notification_subject', 'Slotzy booking confirmation'), 'booking_created',
      coalesce(payload->'notification_payload', '{}'::jsonb));
  end if;

  return jsonb_build_object('booking', to_jsonb(new_booking));
exception when exclusion_violation then
  raise exception 'booking_overlap' using errcode = '23P01';
end;
$$;

-- The first migration is server-only. Supabase's automatic table grants may be
-- disabled, so grant only the server role used by the Express adapter. Browser
-- roles receive no table or RPC grants here.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.users, public.shops,
  public.shop_members, public.shop_settings, public.services,
  public.provider_services, public.availability, public.time_off,
  public.bookings, public.booking_events, public.booking_manage_tokens,
  public.email_outbox, public.legacy_source_ids, public.slotzy_test_control
  to service_role;
revoke all on function public.slotzy_legacy_target_id(text, text) from public;
revoke all on function public.slotzy_storage_write_snapshot(jsonb) from public;
revoke all on function public.slotzy_reset_disposable_test_data(text) from public;
revoke all on function public.slotzy_create_booking(jsonb) from public;
grant execute on function public.slotzy_legacy_target_id(text, text),
  public.slotzy_storage_write_snapshot(jsonb),
  public.slotzy_reset_disposable_test_data(text), public.slotzy_create_booking(jsonb)
  to service_role;

-- First migration phase is server-only: Express uses a server-side Supabase
-- service-role key and browsers do not connect to Supabase. RLS is therefore
-- intentionally not enabled here. Revisit RLS before granting any browser role
-- database access; service-role calls bypass RLS and must remain server-only.

commit;
