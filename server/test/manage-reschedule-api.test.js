import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPublicManageRescheduleHttpResult } from "../src/publicManageReschedule.js";

test("public reschedule returns only a safe persisted booking", () => {
  assert.deepEqual(buildPublicManageRescheduleHttpResult({ outcome: "rescheduled", eventCreated: true, booking: { id: "fixture", startISO: "2032-01-01T10:00:00.000Z", manageTokenHash: "private" } }), { status: 200, body: { booking: { id: "fixture", startISO: "2032-01-01T10:00:00.000Z" } } });
});

test("public reschedule maps token and availability failures without storage detail", () => {
  assert.equal(buildPublicManageRescheduleHttpResult({ outcome: "invalid_token" }).status, 404);
  assert.deepEqual(buildPublicManageRescheduleHttpResult({ outcome: "booking_conflict" }), { status: 409, body: { error: "That time is no longer available. Please choose another time.", code: "slot_unavailable" } });
  assert.equal(buildPublicManageRescheduleHttpResult({ outcome: "rescheduled", eventCreated: false }).status, 500);
});
