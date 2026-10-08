export function buildPublicManageCancelHttpResult(result) {
  const outcome = String(result?.outcome ?? "invalid_token");
  if (outcome === "cancelled" && result?.booking && result?.eventCreated === true) {
    const { manageToken: _manageToken, manageTokenHash: _manageTokenHash, ...safeBooking } = result.booking;
    return { status: 200, body: { booking: safeBooking } };
  }
  if (outcome === "cancellation_policy") {
    const value = Number(result?.cancelHours ?? 24);
    const cancelHours = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 24;
    return {
      status: 409,
      body: { error: `Cancellations must be made at least ${cancelHours} hours before.`, code: "cancellation_policy" },
    };
  }
  if (outcome === "cancellation_unavailable") {
    return { status: 409, body: { error: "This appointment cannot be cancelled.", code: "cancellation_unavailable" } };
  }
  if (outcome === "invalid_token") {
    return { status: 404, body: { error: "This manage link is invalid or has expired.", code: "invalid_manage_token" } };
  }
  return { status: 500, body: { error: "Could not cancel this appointment. Please try again.", code: "manage_cancel_failed" } };
}
