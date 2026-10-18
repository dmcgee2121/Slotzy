export function buildPublicManageRescheduleHttpResult(result) {
  const outcome = String(result?.outcome ?? "invalid_token");
  if (outcome === "rescheduled" && result?.booking && result?.eventCreated === true) {
    const { manageToken: _token, manageTokenHash: _hash, ...booking } = result.booking;
    return { status: 200, body: { booking } };
  }
  if (outcome === "invalid_token") return { status: 404, body: { error: "This manage link is invalid or has expired.", code: "invalid_manage_token" } };
  if (outcome === "reschedule_policy") return { status: 409, body: { error: "This appointment can no longer be rescheduled.", code: "reschedule_policy" } };
  if (outcome === "reschedule_unavailable") return { status: 409, body: { error: "This appointment cannot be rescheduled.", code: "reschedule_unavailable" } };
  if (outcome === "booking_conflict" || outcome === "slot_unavailable") return { status: 409, body: { error: "That time is no longer available. Please choose another time.", code: "slot_unavailable" } };
  return { status: 500, body: { error: "Could not reschedule this appointment. Please try again.", code: "manage_reschedule_failed" } };
}
