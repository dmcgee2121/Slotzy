-- FIX-012A: atomic, server-only staff cancellation.
-- Additive only. This creates one RPC and does not alter existing records.

begin;

create or replace function public.slotzy_cancel_booking_by_staff(
  p_booking_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.bookings;
  v_after public.bookings;
  v_actor public.shop_members;
begin
  if p_booking_id is null or p_actor_user_id is null then
    return jsonb_build_object('outcome', 'invalid_request', 'booking_found', false, 'event_created', false);
  end if;

  select booking.* into v_before
    from public.bookings booking
    where booking.id = p_booking_id
    for update;
  if not found then
    return jsonb_build_object('outcome', 'booking_not_found', 'booking_found', false, 'event_created', false);
  end if;

  select member.* into v_actor
    from public.shop_members member
    where member.user_id = p_actor_user_id
      and member.shop_id = v_before.shop_id
      and member.is_active
      and member.deleted_at is null
      and member.role in ('owner', 'barber')
    for update;
  if not found then
    return jsonb_build_object('outcome', 'not_allowed', 'booking_found', true, 'event_created', false);
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

  update public.bookings
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by_member_id = v_actor.id,
        updated_at = now()
    where id = v_before.id
      and status in ('booked', 'confirmed')
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

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_member_id,
    before_state,
    after_state
  ) values (
    v_after.id,
    'cancelled',
    v_actor.role::text,
    v_actor.id,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return jsonb_build_object(
    'outcome', 'cancelled',
    'booking_found', true,
    'status_before', v_before.status,
    'status_after', v_after.status,
    'event_created', true,
    'booking', jsonb_build_object(
      'id', v_after.id,
      'status', v_after.status,
      'cancelledAtISO', v_after.cancelled_at,
      'updatedAtISO', v_after.updated_at
    )
  );
end;
$$;

revoke all on function public.slotzy_cancel_booking_by_staff(uuid, uuid) from public;
revoke all on function public.slotzy_cancel_booking_by_staff(uuid, uuid) from anon, authenticated;
grant execute on function public.slotzy_cancel_booking_by_staff(uuid, uuid) to service_role;

commit;
