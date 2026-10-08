-- Slotzy public manage-link cancellation hardening.
--
-- Additive only: this migration creates one service-role RPC. Applying it does
-- not update existing bookings, tokens, events, or any other stored rows.
-- Test on the disposable database before staging. Do not run in production as
-- part of the closed-pilot workflow.

begin;

create or replace function public.slotzy_cancel_booking_by_manage_token_hash(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.booking_manage_tokens;
  v_before public.bookings;
  v_after public.bookings;
  v_cancel_hours integer;
  v_shop_source text;
  v_service_source text;
  v_provider_username text;
begin
  if nullif(btrim(p_token_hash), '') is null then
    return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false);
  end if;

  select token.* into v_token
  from public.booking_manage_tokens token
  where token.token_hash = p_token_hash
    and token.revoked_at is null
    and token.expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false);
  end if;

  select booking.* into v_before
  from public.bookings booking
  where booking.id = v_token.booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false);
  end if;

  if v_before.status not in ('booked', 'confirmed') then
    return jsonb_build_object(
      'outcome', 'cancellation_unavailable',
      'booking_found', true,
      'status_before', v_before.status,
      'status_after', v_before.status,
      'event_created', false
    );
  end if;

  select coalesce(settings.cancel_hours, 24) into v_cancel_hours
  from public.shops shop
  left join public.shop_settings settings on settings.shop_id = shop.id
  where shop.id = v_before.shop_id;

  if v_cancel_hours is null then
    return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false);
  end if;

  if now() >= v_before.start_at - make_interval(hours => v_cancel_hours) then
    return jsonb_build_object(
      'outcome', 'cancellation_policy',
      'booking_found', true,
      'cancel_hours', v_cancel_hours,
      'status_before', v_before.status,
      'status_after', v_before.status,
      'event_created', false
    );
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_before.id and status in ('booked', 'confirmed')
  returning * into v_after;

  if not found then
    return jsonb_build_object(
      'outcome', 'cancellation_unavailable',
      'booking_found', true,
      'status_before', v_before.status,
      'status_after', v_before.status,
      'event_created', false
    );
  end if;

  insert into public.booking_events (booking_id, event_type, actor_type, before_state, after_state)
  values (v_after.id, 'cancelled', 'public_client', to_jsonb(v_before), to_jsonb(v_after));

  update public.booking_manage_tokens set last_used_at = now() where id = v_token.id;

  select mapping.source_id into v_shop_source
  from public.legacy_source_ids mapping
  where mapping.entity_type = 'shop' and mapping.target_id = v_after.shop_id and mapping.is_canonical = true
  limit 1;

  select mapping.source_id into v_service_source
  from public.legacy_source_ids mapping
  where mapping.entity_type = 'service' and mapping.target_id = v_after.service_id and mapping.is_canonical = true
  limit 1;

  select provider.username into v_provider_username
  from public.shop_members member
  join public.users provider on provider.id = member.user_id
  where member.id = v_after.provider_member_id;

  return jsonb_build_object(
    'outcome', 'cancelled',
    'booking_found', true,
    'status_before', v_before.status,
    'status_after', v_after.status,
    'event_created', true,
    'booking', jsonb_build_object(
      'id', v_after.id,
      'shopId', coalesce(v_shop_source, v_after.shop_id::text),
      'serviceId', coalesce(v_service_source, v_after.service_id::text),
      'barberUsername', coalesce(v_provider_username, ''),
      'ownerUsername', coalesce(v_provider_username, ''),
      'serviceName', coalesce(v_after.service_snapshot->>'name', 'Service'),
      'serviceTitle', coalesce(v_after.service_snapshot->>'name', 'Service'),
      'clientName', v_after.client_name,
      'clientContact', v_after.client_contact,
      'clientEmail', v_after.client_email,
      'clientPhone', v_after.client_phone,
      'startISO', v_after.start_at,
      'endISO', v_after.end_at,
      'timezone', v_after.timezone,
      'durationMinutes', v_after.duration_minutes,
      'status', v_after.status,
      'confirmationCode', v_after.confirmation_code,
      'depositRequired', v_after.deposit_required,
      'depositAmount', v_after.deposit_amount_cents::numeric / 100,
      'depositStatus', v_after.deposit_status,
      'policySnapshot', v_after.policy_snapshot,
      'serviceSnapshot', v_after.service_snapshot,
      'createdAtISO', v_after.created_at,
      'updatedAtISO', v_after.updated_at
    ),
    'previous_booking', jsonb_build_object(
      'id', v_before.id,
      'shopId', coalesce(v_shop_source, v_before.shop_id::text),
      'serviceId', coalesce(v_service_source, v_before.service_id::text),
      'barberUsername', coalesce(v_provider_username, ''),
      'ownerUsername', coalesce(v_provider_username, ''),
      'serviceName', coalesce(v_before.service_snapshot->>'name', 'Service'),
      'serviceTitle', coalesce(v_before.service_snapshot->>'name', 'Service'),
      'clientName', v_before.client_name,
      'clientContact', v_before.client_contact,
      'clientEmail', v_before.client_email,
      'clientPhone', v_before.client_phone,
      'startISO', v_before.start_at,
      'endISO', v_before.end_at,
      'timezone', v_before.timezone,
      'durationMinutes', v_before.duration_minutes,
      'status', v_before.status,
      'confirmationCode', v_before.confirmation_code,
      'depositRequired', v_before.deposit_required,
      'depositAmount', v_before.deposit_amount_cents::numeric / 100,
      'depositStatus', v_before.deposit_status,
      'policySnapshot', v_before.policy_snapshot,
      'serviceSnapshot', v_before.service_snapshot,
      'createdAtISO', v_before.created_at,
      'updatedAtISO', v_before.updated_at
    ),
    'shop', (
      select jsonb_build_object(
        'id', coalesce(v_shop_source, shop.id::text),
        'name', shop.name,
        'businessName', shop.name,
        'slug', shop.slug,
        'shopEmail', shop.email,
        'bookingPolicy', jsonb_build_object('cancelHours', coalesce(settings.cancel_hours, 24))
      )
      from public.shops shop
      left join public.shop_settings settings on settings.shop_id = shop.id
      where shop.id = v_after.shop_id
    ),
    'barber', (
      select jsonb_build_object('username', provider.username, 'displayName', provider.display_name, 'email', provider.email)
      from public.shop_members member
      join public.users provider on provider.id = member.user_id
      where member.id = v_after.provider_member_id
    ),
    'owner', (
      select jsonb_build_object('username', owner_user.username, 'displayName', owner_user.display_name, 'email', owner_user.email)
      from public.shops shop
      join public.users owner_user on owner_user.id = shop.owner_user_id
      where shop.id = v_after.shop_id
    )
  );
end;
$$;

revoke all on function public.slotzy_cancel_booking_by_manage_token_hash(text) from public;
grant execute on function public.slotzy_cancel_booking_by_manage_token_hash(text) to service_role;

commit;
