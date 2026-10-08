import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPublicManageCancelHttpResult } from "../src/publicManageCancel.js";

test("public cancellation returns only the safe booking envelope after an atomic event", () => {
  const booking = { id: "booking_fixture", status: "cancelled", confirmationCode: "FIXTURE", manageTokenHash: "never-public" };
  assert.deepEqual(buildPublicManageCancelHttpResult({ outcome: "cancelled", eventCreated: true, booking }), {
    status: 200,
    body: { booking: { id: "booking_fixture", status: "cancelled", confirmationCode: "FIXTURE" } },
  });
});

test("public cancellation preserves generic invalid-token and unavailable responses", () => {
  assert.deepEqual(buildPublicManageCancelHttpResult({ outcome: "invalid_token" }), {
    status: 404,
    body: { error: "This manage link is invalid or has expired.", code: "invalid_manage_token" },
  });
  assert.deepEqual(buildPublicManageCancelHttpResult({ outcome: "cancellation_unavailable" }), {
    status: 409,
    body: { error: "This appointment cannot be cancelled.", code: "cancellation_unavailable" },
  });
});

test("public cancellation reports policy without exposing storage context", () => {
  assert.deepEqual(buildPublicManageCancelHttpResult({ outcome: "cancellation_policy", cancelHours: 12 }), {
    status: 409,
    body: { error: "Cancellations must be made at least 12 hours before.", code: "cancellation_policy" },
  });
});

test("public cancellation fails closed when atomic persistence lacks its event", () => {
  assert.deepEqual(buildPublicManageCancelHttpResult({ outcome: "cancelled", eventCreated: false, booking: { id: "fixture" } }), {
    status: 500,
    body: { error: "Could not cancel this appointment. Please try again.", code: "manage_cancel_failed" },
  });
});
