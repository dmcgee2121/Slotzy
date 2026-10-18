import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const upcomingUrl = new URL("../../js/owner-upcoming.js", import.meta.url);
const appointmentsUrl = new URL("../../js/owner-appointments.js", import.meta.url);
const apiUrl = new URL("../src/index.js", import.meta.url);
const postgresStoreUrl = new URL("../src/storage/postgresStore.js", import.meta.url);

test("both staff cancellation views submit the narrow status-only contract", async () => {
  const [upcoming, appointments] = await Promise.all([
    readFile(upcomingUrl, "utf8"),
    readFile(appointmentsUrl, "utf8"),
  ]);
  assert.match(upcoming, /updateBookingAsync\(id, \{ status: "cancelled" \}/);
  assert.doesNotMatch(upcoming, /updateBookingAsync\(id, \{ \.\.\.booking, status: "cancelled" \}/);
  assert.match(appointments, /updateBookingAsync\(targetId, \{ status: nextStatus \}/);
});

test("Postgres staff cancellation stays server-authorized and atomic", async () => {
  const [api, store] = await Promise.all([
    readFile(apiUrl, "utf8"),
    readFile(postgresStoreUrl, "utf8"),
  ]);
  assert.match(api, /cancelBookingByStaff\(current\.id, user\)/);
  assert.match(api, /cancelled\.outcome !== "cancelled" \|\| !cancelled\.eventCreated/);
  assert.match(store, /client\.rpc\("slotzy_cancel_booking_by_staff", \{[\s\S]*?p_booking_id: targetBookingId,[\s\S]*?p_actor_user_id: actorUserId/);
  assert.doesNotMatch(store, /slotzy_cancel_booking_by_staff[\s\S]*?p_actor_username/i);
});
