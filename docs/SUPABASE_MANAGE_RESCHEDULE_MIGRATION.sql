-- Slotzy public manage-link rescheduling foundation.
-- Additive only: creates one service-role RPC and changes no stored rows.

begin;

create or replace function public.slotzy_reschedule_booking_by_manage_token_hash(
  p_token_hash text,
  p_start_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.booking_manage_tokens;
  v_before public.bookings;
  v_after public.bookings;
  v_availability public.availability;
  v_start timestamptz := p_start_at;
  v_end timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_cancel_hours integer;
  v_buffer_minutes integer;
  v_allow_same_day boolean;
  v_max_days_advance integer;
begin
  if nullif(btrim(p_token_hash), '') is null or v_start is null then
    return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false);
  end if;
  select token.* into v_token from public.booking_manage_tokens token
    where token.token_hash = p_token_hash and token.revoked_at is null and token.expires_at > now() for update;
  if not found then return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false); end if;
  select booking.* into v_before from public.bookings booking where booking.id = v_token.booking_id for update;
  if not found then return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false); end if;
  if v_before.status not in ('booked', 'confirmed') then
    return jsonb_build_object('outcome', 'reschedule_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  if v_start <= now() then return jsonb_build_object('outcome', 'slot_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false); end if;
  select coalesce(settings.cancel_hours, 24), coalesce(settings.buffer_minutes, 0), coalesce(settings.allow_same_day, true), coalesce(settings.max_days_advance, 30)
    into v_cancel_hours, v_buffer_minutes, v_allow_same_day, v_max_days_advance
    from public.shops shop left join public.shop_settings settings on settings.shop_id = shop.id where shop.id = v_before.shop_id;
  if v_cancel_hours is null then return jsonb_build_object('outcome', 'invalid_token', 'booking_found', false, 'event_created', false); end if;
  if now() >= v_before.start_at - make_interval(hours => v_cancel_hours) then
    return jsonb_build_object('outcome', 'reschedule_policy', 'booking_found', true, 'cancel_hours', v_cancel_hours, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  v_end := v_start + make_interval(mins => v_before.duration_minutes);
  select availability.* into v_availability from public.availability availability
    where availability.provider_member_id = v_before.provider_member_id and availability.weekday = extract(dow from (v_start at time zone availability.timezone))::integer;
  if not found or not v_availability.is_enabled then return jsonb_build_object('outcome', 'slot_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false); end if;
  v_local_start := v_start at time zone v_availability.timezone;
  v_local_end := v_end at time zone v_availability.timezone;
  if (not v_allow_same_day and v_local_start::date = (now() at time zone v_availability.timezone)::date)
    or v_local_start::date > (now() at time zone v_availability.timezone)::date + v_max_days_advance
    or v_local_start::date <> v_local_end::date or v_local_start::time < v_availability.start_time or v_local_end::time > v_availability.end_time then
    return jsonb_build_object('outcome', 'slot_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  if exists (select 1 from public.time_off time_off where time_off.provider_member_id = v_before.provider_member_id and v_start < time_off.ends_at and v_end > time_off.starts_at) then
    return jsonb_build_object('outcome', 'slot_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  if exists (select 1 from public.recurring_time_blocks block where block.provider_member_id = v_before.provider_member_id and block.is_enabled and block.weekday = v_availability.weekday and v_local_start::time < block.end_time and v_local_end::time > block.start_time) then
    return jsonb_build_object('outcome', 'slot_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  if exists (select 1 from public.bookings other_booking where other_booking.id <> v_before.id and other_booking.provider_member_id = v_before.provider_member_id and other_booking.status in ('booked', 'confirmed') and v_start < other_booking.end_at + make_interval(mins => v_buffer_minutes) and v_end > other_booking.start_at - make_interval(mins => v_buffer_minutes)) then
    return jsonb_build_object('outcome', 'booking_conflict', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
  end if;
  update public.bookings set start_at = v_start, end_at = v_end, rescheduled_at = now(), rescheduled_by_member_id = null, reschedule_count = reschedule_count + 1, updated_at = now()
    where id = v_before.id and status in ('booked', 'confirmed') returning * into v_after;
  if not found then return jsonb_build_object('outcome', 'reschedule_unavailable', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false); end if;
  insert into public.booking_events (booking_id, event_type, actor_type, before_state, after_state)
    values (v_after.id, 'rescheduled', 'public_client', to_jsonb(v_before), to_jsonb(v_after));
  update public.booking_manage_tokens set last_used_at = now() where id = v_token.id;
  return jsonb_build_object('outcome', 'rescheduled', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_after.status, 'event_created', true,
    'booking', jsonb_build_object('id', v_after.id, 'shopId', v_after.shop_id, 'serviceId', v_after.service_id, 'startISO', v_after.start_at, 'endISO', v_after.end_at, 'timezone', v_after.timezone, 'durationMinutes', v_after.duration_minutes, 'status', v_after.status, 'confirmationCode', v_after.confirmation_code, 'rescheduledAtISO', v_after.rescheduled_at, 'rescheduleCount', v_after.reschedule_count, 'updatedAtISO', v_after.updated_at),
    'previous_booking', jsonb_build_object('id', v_before.id, 'startISO', v_before.start_at, 'endISO', v_before.end_at, 'durationMinutes', v_before.duration_minutes, 'status', v_before.status, 'rescheduleCount', v_before.reschedule_count, 'updatedAtISO', v_before.updated_at));
exception when exclusion_violation then
  return jsonb_build_object('outcome', 'booking_conflict', 'booking_found', true, 'status_before', v_before.status, 'status_after', v_before.status, 'event_created', false);
end;
$$;

revoke all on function public.slotzy_reschedule_booking_by_manage_token_hash(text, timestamptz) from public;
-- Local Supabase may apply explicit default grants to browser roles. Revoke
-- them explicitly as well; this RPC is callable only by Express's service role.
revoke all on function public.slotzy_reschedule_booking_by_manage_token_hash(text, timestamptz) from anon, authenticated;
grant execute on function public.slotzy_reschedule_booking_by_manage_token_hash(text, timestamptz) to service_role;

commit;
