import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createPostgresStore } from "../src/storage/postgresStore.js";

const testUrl = String(process.env.SUPABASE_TEST_URL ?? "").trim();
const testServiceRoleKey = String(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "").trim();
const hasTestCredentials = Boolean(testUrl && testServiceRoleKey);
const skipReason = hasTestCredentials ? false : "Set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for an isolated disposable test project; production credentials are intentionally not accepted.";

// Test-only names are mapped at this seam; normal runtime configuration is untouched.
const testEnv = { SUPABASE_URL: testUrl, SUPABASE_SERVICE_ROLE_KEY: testServiceRoleKey };
const client = hasTestCredentials ? createClient(testUrl, testServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const store = hasTestCredentials ? createPostgresStore(testEnv) : null;
const fixtureFailure = (message) => new Error(`Postgres integration fixture setup failed: ${message}`);

async function resetDisposableDatabase() {
  if (process.env.SLOTZY_ALLOW_DISPOSABLE_TEST_RESET !== "true") {
    throw fixtureFailure('SLOTZY_ALLOW_DISPOSABLE_TEST_RESET must equal "true"; no reset was attempted.');
  }
  const { data: control, error: controlError } = await client.from("slotzy_test_control").select("is_disposable").eq("id", true).maybeSingle();
  if (controlError) throw fixtureFailure(`could not verify public.slotzy_test_control: ${controlError.message}`);
  if (control?.is_disposable !== true) throw fixtureFailure("public.slotzy_test_control.is_disposable must be true; no reset was attempted.");
  const { error } = await client.rpc("slotzy_reset_disposable_test_data", { p_confirmation: "DISPOSABLE_SLOTZY_TEST_RESET" });
  if (error) throw fixtureFailure(`guarded reset RPC failed: ${error.message}`);
}

function baseState(overrides = {}) {
  return {
    users: [{ id: "user-owner", username: "fixture-owner", displayName: "Fixture Owner", passwordHash: "not-a-real-password", role: "owner", email: "fixture-owner@example.test", shopId: "shop-fixture" }],
    shops: [{ id: "shop-fixture", name: "Fixture Cuts", slug: "fixture-cuts", ownerUsername: "fixture-owner", shopEmail: "fixture-shop@example.test", bookingPolicy: { allowSameDay: true, maxDaysAdvance: 30, cancelHours: 24, bufferMinutes: 5, requireDeposit: false, depositAmount: 0, lateGraceMinutes: 10, noShowStrikeLimit: 2, reminder24Hours: true, reminder2Hours: true, reminderCustomEnabled: false, reminderCustomMinutes: 60 } }],
    services: [{ id: "service-cut", shopId: "shop-fixture", name: "Fixture Cut", price: 32.5, durationMinutes: 30, barberUsername: "fixture-owner", active: true }],
    availability: { "fixture-owner": { timezone: "America/Chicago", bufferMinutes: 5, weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } }, timeOff: [] } },
    bookings: [], emails: [], ...overrides,
  };
}

async function seedBase() {
  const state = baseState();
  await store.writeStore(state);
  const { data, error } = await client.from("legacy_source_ids").select("entity_type, source_id, target_id");
  assert.ifError(error);
  return { state, ids: new Map(data.map((row) => [`${row.entity_type}:${row.source_id}`, row.target_id])) };
}

async function createAtomicBooking(ids, { confirmationCode = "FIX001", startAt = "2032-06-03T15:00:00.000Z", tokenHash = "fixture-token-hash", queueNotification = false } = {}) {
  return store.createBookingAtomically({
    shop_id: ids.get("shop:shop-fixture"), provider_member_id: ids.get("member:shop-fixture:fixture-owner"), service_id: ids.get("service:service-cut"),
    client_name: "Fixture Client", client_email: "client@example.test", client_contact: "client@example.test", start_at: startAt,
    end_at: new Date(new Date(startAt).getTime() + 30 * 60 * 1000).toISOString(), timezone: "America/Chicago", duration_minutes: 30,
    confirmation_code: confirmationCode, manage_token_hash: tokenHash, service_snapshot: { name: "Fixture Cut" }, queue_notification: queueNotification,
    notification_recipient: "client@example.test", notification_subject: "Fixture booking", notification_payload: { text: "fixture" },
  });
}

before({ skip: skipReason }, resetDisposableDatabase);
after({ skip: skipReason }, resetDisposableDatabase);

// Keep each top-level case independently reset even if the Node test runner's
// hook scheduling changes. This makes fixture isolation explicit and serial.
function postgresTest(name, fn) {
  return test(name, { skip: skipReason, concurrency: false }, async () => {
    await resetDisposableDatabase();
    return fn();
  });
}

postgresTest("Postgres user create/read contract", async () => {
  const state = baseState({ shops: [], services: [], availability: {} });
  // Owners may register before shop setup. A missing shop relationship must not
  // create an invalid shop_members row or prevent independent user persistence.
  state.users[0].shopId = null;
  await store.writeStore(state);
  const read = await store.readStore();
  assert.equal(read.users.length, 1); assert.equal(read.users[0].username, "fixture-owner"); assert.equal(read.users[0].shopId, null);
});

postgresTest("Postgres shop create/read/update contract", async () => {
  const { state } = await seedBase(); state.shops[0].name = "Fixture Cuts Updated"; state.shops[0].bookingPolicy.bufferMinutes = 10;
  await store.writeStore(state); const shop = (await store.readStore()).shops[0];
  assert.equal(shop.name, "Fixture Cuts Updated"); assert.equal(shop.bookingPolicy.bufferMinutes, 10);
});

postgresTest("Postgres service CRUD contract", async () => {
  const { state } = await seedBase(); state.services[0].name = "Fixture Fade"; state.services[0].price = 40;
  await store.writeStore(state); assert.equal((await store.readStore()).services[0].name, "Fixture Fade");
  // Services are soft-deleted by the relational contract; the legacy read shape
  // must consequently stop exposing the deleted service.
  const { error } = await client.from("services").update({ deleted_at: new Date().toISOString() }).eq("name", "Fixture Fade"); assert.ifError(error);
  assert.deepEqual((await store.readStore()).services, []);
});

postgresTest("Postgres availability round trip contract", async () => {
  const { state } = await seedBase(); state.availability["fixture-owner"].timeOff.push({ id: "fixture-time-off", startISO: "2032-06-04T15:00:00.000Z", endISO: "2032-06-04T16:00:00.000Z", note: "Training" });
  await store.writeStore(state); const schedule = (await store.readStore()).availability["fixture-owner"];
  assert.deepEqual(schedule.weekly.mon, { enabled: true, start: "09:00", end: "17:00" }); assert.equal(schedule.timeOff[0].note, "Training");
});

postgresTest("Postgres booking create/read/update and overlap rejection contract", async () => {
  const { ids } = await seedBase(); await createAtomicBooking(ids, { confirmationCode: "BKG001" });
  await assert.rejects(() => createAtomicBooking(ids, { confirmationCode: "BKG002", tokenHash: "fixture-token-hash-2" }), /booking_overlap/);
  const { data: booking, error } = await client.from("bookings").select("id").eq("confirmation_code", "BKG001").single(); assert.ifError(error);
  const { error: updateError } = await client.from("bookings").update({ status: "confirmed" }).eq("id", booking.id); assert.ifError(updateError);
  assert.equal((await store.readStore()).bookings[0].status, "confirmed");
});

postgresTest("Postgres manage-token lookup contract", async () => {
  const { ids } = await seedBase(); const rawToken = "fixture-raw-token-not-stored"; const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const created = await createAtomicBooking(ids, { confirmationCode: "TOK001", tokenHash });
  const { data, error } = await client.from("booking_manage_tokens").select("booking_id, token_hash, revoked_at").eq("token_hash", tokenHash).single(); assert.ifError(error);
  assert.equal(data.booking_id, created.booking.id); assert.equal(data.token_hash, tokenHash); assert.notEqual(data.token_hash, rawToken); assert.equal(data.revoked_at, null);
});

postgresTest("Postgres snapshot write and read round trip contract", async () => {
  const state = baseState(); state.bookings.push({ id: "booking-snapshot", shopId: "shop-fixture", barberUsername: "fixture-owner", serviceName: "Fixture Cut", clientName: "Snapshot Client", clientContact: "snapshot@example.test", clientEmail: "snapshot@example.test", startISO: "2032-06-05T15:00:00.000Z", endISO: "2032-06-05T15:30:00.000Z", durationMinutes: 30, status: "booked", confirmationCode: "SNP001" });
  await store.writeStore(state); const roundTrip = await store.readStore();
  assert.equal(roundTrip.bookings[0].clientName, "Snapshot Client"); assert.equal(roundTrip.bookings[0].confirmationCode, "SNP001");
});

postgresTest("Postgres repeated snapshot write is idempotent contract", async () => {
  const state = baseState(); await store.writeStore(state); await store.writeStore(state);
  const { data, error } = await client.from("users").select("id"); assert.ifError(error);
  assert.equal(data.length, 1); assert.equal((await store.readStore()).services.length, 1);
});

postgresTest("Postgres non-empty shop snapshot preserves service scope while adding a service", async () => {
  await seedBase();
  const snapshot = await store.readStore();
  assert.equal(snapshot.users[0].shopId, "shop-fixture");
  assert.equal(snapshot.shops[0].id, "shop-fixture");
  assert.equal(snapshot.services[0].id, "service-cut");
  assert.equal(snapshot.services[0].shopId, "shop-fixture");

  snapshot.services.push({ id: "service-finish", shopId: "shop-fixture", name: "Fixture Finish", price: 20, durationMinutes: 20, barberUsername: "fixture-owner", active: true });
  await store.writeStore(snapshot);
  const afterService = await store.readStore();
  assert.deepEqual(afterService.services.map((service) => service.name).sort(), ["Fixture Cut", "Fixture Finish"]);
  assert.ok(afterService.services.every((service) => service.shopId === "shop-fixture"));

  afterService.availability["fixture-owner"].weekly.tue = { enabled: true, start: "10:00", end: "16:00" };
  await store.writeStore(afterService);
  const afterSetupWrite = await store.readStore();
  assert.equal(afterSetupWrite.services.length, 2);
  assert.ok(afterSetupWrite.services.every((service) => service.shopId === afterSetupWrite.users[0].shopId));
  const { data: relationalShops, error: shopsError } = await client.from("shops").select("id"); assert.ifError(shopsError);
  const { data: relationalServices, error: servicesError } = await client.from("services").select("id").is("deleted_at", null); assert.ifError(servicesError);
  assert.equal(relationalShops.length, 1); assert.equal(relationalServices.length, 2);
});

postgresTest("Postgres non-empty user snapshot preserves source identity while adding a user", async () => {
  await seedBase();
  const snapshot = await store.readStore();
  snapshot.users.push({ id: "user-second", username: "fixture-second", displayName: "Fixture Second", passwordHash: "not-a-real-password", role: "owner", email: "fixture-second@example.test", shopId: null });
  await store.writeStore(snapshot);
  const { data, error } = await client.from("users").select("username").order("username"); assert.ifError(error);
  assert.deepEqual(data.map((row) => row.username), ["fixture-owner", "fixture-second"]);
});

postgresTest("Postgres snapshot safely repairs a pre-existing user with no source mapping", async () => {
  const { data: existing, error: insertError } = await client.from("users")
    .insert({ username: "relational-existing", display_name: "Relational Existing", password_hash: "not-a-real-password", role: "owner" })
    .select("id").single();
  assert.ifError(insertError);
  const { data: beforeMappings, error: beforeMappingError } = await client.from("legacy_source_ids")
    .select("source_id").eq("entity_type", "user").eq("target_id", existing.id);
  assert.ifError(beforeMappingError); assert.equal(beforeMappings.length, 0);
  const snapshot = await store.readStore();
  snapshot.users.push({ id: "user-added-after-relational", username: "relational-added", displayName: "Relational Added", passwordHash: "not-a-real-password", role: "owner", shopId: null });
  await store.writeStore(snapshot);
  const { data: users, error: usersError } = await client.from("users").select("id,username").order("username"); assert.ifError(usersError);
  assert.deepEqual(users.map((row) => row.username), ["relational-added", "relational-existing"]);
  const { data: repairedMapping, error: repairedMappingError } = await client.from("legacy_source_ids")
    .select("target_id").eq("entity_type", "user").eq("source_id", existing.id).single();
  assert.ifError(repairedMappingError); assert.equal(repairedMapping.target_id, existing.id);
});

postgresTest("Postgres outbox contract", async () => {
  await store.appendOutboxEmail({ to: "older@example.test", subject: "Older", html: "<p>old</p>", text: "old", tags: ["fixture"], meta: { order: 1 } });
  await store.appendOutboxEmail({ to: "newer@example.test", subject: "Newer", html: "<p>new</p>", text: "new", tags: ["fixture"], meta: { order: 2 } });
  assert.equal((await store.listOutboxEmails(1))[0].subject, "Newer"); assert.deepEqual(await store.clearOutboxEmails(), { cleared: 2 }); assert.deepEqual(await store.listOutboxEmails(), []);
});
