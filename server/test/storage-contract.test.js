import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createJsonStore } from "../src/storage/jsonStore.js";
import { buildAtomicBookingPayload, buildPostgresAvailabilitySnapshot, buildPostgresServiceSnapshot, buildPostgresShopSnapshot, buildPostgresUserSnapshot, normalizePostgresSnapshot } from "../src/storage/postgresStore.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createTestStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "slotzy-storage-"));
  temporaryDirectories.push(directory);
  return createJsonStore({ filePath: path.join(directory, "db.json") });
}

test("JSON storage creates the required default shape in an isolated file", async () => {
  const store = await createTestStore();
  assert.deepEqual(await store.readStore(), {
    users: [], shops: [], services: [], availability: {}, bookings: [], emails: [],
  });
});

test("JSON storage round-trips users, shops, services, availability, and bookings", async () => {
  const store = await createTestStore();
  const state = {
    users: [{ id: "user_1", username: "owner", role: "owner" }],
    shops: [{ id: "shop_1", name: "Test Shop", slug: "test-shop", ownerUsername: "owner" }],
    services: [{ id: "service_1", shopId: "shop_1", name: "Cut", price: 30, durationMinutes: 30 }],
    availability: { owner: { timezone: "America/Chicago", weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } }, timeOff: [], recurringBlocks: [{ id: "11111111-1111-4111-8111-111111111111", weekday: "mon", start: "12:00", end: "13:00", label: "Lunch", enabled: true }] } },
    bookings: [{ id: "booking_1", shopId: "shop_1", barberUsername: "owner", serviceName: "Cut", status: "booked" }],
    emails: [],
  };

  await store.writeStore(state);
  assert.deepEqual(await store.readStore(), state);
  assert.deepEqual(await store.readUserByUsername(" OWNER "), {
    id: "user_1", username: "owner", displayName: undefined, role: "owner", shopId: null, createdAt: undefined,
  });
  assert.equal(await store.readUserByUsername("missing-owner"), null);
});

test("Postgres snapshots map browser branding aliases to RPC logo and cover fields", () => {
  const snapshot = normalizePostgresSnapshot({
    users: [], services: [], availability: {}, bookings: [], emails: [],
    shops: [{
      id: "shop_1",
      logoDataUrl: "data:image/png;base64,small-logo-fixture",
      coverImageDataUrl: "data:image/webp;base64,small-cover-fixture",
    }],
  });

  assert.equal(snapshot.shops[0].logo, "data:image/png;base64,small-logo-fixture");
  assert.equal(snapshot.shops[0].cover, "data:image/webp;base64,small-cover-fixture");

  const removed = normalizePostgresSnapshot({
    users: [], services: [], availability: {}, bookings: [], emails: [],
    shops: [{ logo: "old-logo", logoDataUrl: null, cover: "old-cover", coverDataUrl: "" }],
  });
  assert.equal(removed.shops[0].logo, "");
  assert.equal(removed.shops[0].cover, "");
});

test("Postgres shop writes exclude unrelated rows and preserve canonical branding", () => {
  const shop = {
    id: "shop_1",
    ownerUsername: "owner",
    logoDataUrl: "data:image/png;base64,small-logo-fixture",
    coverDataUrl: "data:image/webp;base64,small-cover-fixture",
  };
  const snapshot = buildPostgresShopSnapshot(shop);

  assert.deepEqual(snapshot.users, []);
  assert.deepEqual(snapshot.services, []);
  assert.deepEqual(snapshot.availability, {});
  assert.deepEqual(snapshot.bookings, []);
  assert.deepEqual(snapshot.emails, []);
  assert.equal(snapshot.shops.length, 1);
  assert.equal(snapshot.shops[0].logo, "data:image/png;base64,small-logo-fixture");
  assert.equal(snapshot.shops[0].cover, "data:image/webp;base64,small-cover-fixture");

  const creationSnapshot = buildPostgresShopSnapshot(shop, {
    id: "user_1",
    username: "owner",
    role: "owner",
    shopId: null,
  });
  assert.equal(creationSnapshot.users.length, 1);
  assert.equal(creationSnapshot.users[0].shopId, "shop_1");
  assert.deepEqual(creationSnapshot.services, []);
  assert.deepEqual(creationSnapshot.availability, {});
  assert.deepEqual(creationSnapshot.bookings, []);
});

test("Postgres user registration snapshots exclude unrelated operational rows", () => {
  const user = { id: "user_new", username: "new-owner", passwordHash: "fixture-hash", role: "owner", shopId: null };
  const snapshot = buildPostgresUserSnapshot(user);

  assert.deepEqual(snapshot.users, [user]);
  assert.deepEqual(snapshot.shops, []);
  assert.deepEqual(snapshot.services, []);
  assert.deepEqual(snapshot.availability, {});
  assert.deepEqual(snapshot.bookings, []);
  assert.deepEqual(snapshot.emails, []);
});

test("JSON narrow user creation preserves existing data and rejects duplicates", async () => {
  const store = await createTestStore();
  await store.writeStore({
    users: [{ id: "existing", username: "existing-owner", role: "owner" }],
    shops: [{ id: "existing-shop" }], services: [], availability: {}, bookings: [], emails: [],
  });
  const user = { id: "new", username: "new-owner", role: "owner" };
  await store.writeUser(user);
  const state = await store.readStore();
  assert.deepEqual(state.users, [{ id: "existing", username: "existing-owner", role: "owner" }, user]);
  assert.deepEqual(state.shops, [{ id: "existing-shop" }]);
  await assert.rejects(() => store.writeUser({ id: "duplicate", username: "NEW-OWNER" }), (error) => error?.code === "23505");
});

test("Postgres service creation writes only its provider membership and service", () => {
  const snapshot = buildPostgresServiceSnapshot({
    id: "service_1",
    name: "Cut",
    shopId: "shop_1",
    barberUsername: "owner",
  }, {
    id: "user_1",
    username: "owner",
    role: "owner",
    shopId: "shop_1",
  });

  assert.equal(snapshot.users.length, 1);
  assert.equal(snapshot.users[0].shopId, "shop_1");
  assert.deepEqual(snapshot.shops, []);
  assert.equal(snapshot.services.length, 1);
  assert.deepEqual(snapshot.availability, {});
  assert.deepEqual(snapshot.bookings, []);
  assert.deepEqual(snapshot.emails, []);
});

test("Postgres availability writes include only the target provider schedule", () => {
  const availability = {
    timezone: "America/Chicago",
    bufferMinutes: 10,
    weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } },
    timeOff: [],
    recurringBlocks: [{
      id: "11111111-1111-4111-8111-111111111111",
      weekday: "mon",
      start: "12:00",
      end: "13:00",
      label: "Lunch",
      enabled: true,
    }],
  };
  const snapshot = buildPostgresAvailabilitySnapshot("owner", availability);

  assert.deepEqual(snapshot.users, []);
  assert.deepEqual(snapshot.shops, []);
  assert.deepEqual(snapshot.services, []);
  assert.deepEqual(snapshot.bookings, []);
  assert.deepEqual(snapshot.emails, []);
  assert.deepEqual(snapshot.availability, { owner: availability });
});

test("Postgres availability snapshots require a target provider", () => {
  assert.throws(() => buildPostgresAvailabilitySnapshot("", {}), /provider username/);
});

test("atomic booking payload keeps security and policy fields while excluding unrelated state", () => {
  const payload = buildAtomicBookingPayload({
    clientName: "Fixture Client", clientContact: "client@example.test",
    startISO: "2032-06-03T15:00:00.000Z", endISO: "2032-06-03T15:30:00.000Z",
    timezone: "America/Chicago", durationMinutes: 30, status: "booked",
    confirmationCode: "FIX001", depositRequired: true, depositAmount: 10, depositStatus: "unpaid",
    policySnapshot: { cancelHours: 24 }, serviceSnapshot: { name: "Fixture Cut" },
    manageTokenHash: "fixture-hash", manageTokenExpiresAt: "2032-07-03T15:30:00.000Z",
    requestId: "11111111-1111-4111-8111-111111111111",
  }, { shopId: "shop-uuid", providerMemberId: "member-uuid", serviceId: "service-uuid" });

  assert.equal(payload.shop_id, "shop-uuid");
  assert.equal(payload.provider_member_id, "member-uuid");
  assert.equal(payload.service_id, "service-uuid");
  assert.equal(payload.client_email, "client@example.test");
  assert.equal(payload.manage_token_hash, "fixture-hash");
  assert.deepEqual(payload.policy_snapshot, { cancelHours: 24 });
  assert.deepEqual(payload.service_snapshot, { name: "Fixture Cut" });
  assert.equal(payload.queue_notification, false);
});

test("JSON booking write adds only the requested booking", async () => {
  const store = await createTestStore();
  const state = { users: [], shops: [{ id: "shop_1" }], services: [], availability: {}, bookings: [], emails: [] };
  await store.writeStore(state);
  const booking = { id: "booking_1", shopId: "shop_1", status: "booked", manageTokenHash: "fixture-hash" };
  await store.writeBooking(booking, state);
  const saved = await store.readStore();
  assert.deepEqual(saved.bookings, [booking]);
  assert.deepEqual(saved.shops, [{ id: "shop_1" }]);
});

test("JSON storage normalizes incomplete persisted data without losing valid user records", async () => {
  const store = await createTestStore();
  await store.writeStore({ users: [{ username: "owner" }], availability: [] });
  assert.deepEqual(await store.readStore(), {
    users: [{ username: "owner" }], shops: [], services: [], availability: {}, bookings: [], emails: [],
  });
});

test("JSON storage appends, orders, limits, and clears the Dev Outbox", async () => {
  const store = await createTestStore();
  await store.appendOutboxEmail({ id: "email_older", subject: "Older", createdAtISO: "2026-01-01T00:00:00.000Z" });
  await store.appendOutboxEmail({ id: "email_newer", subject: "Newer", createdAtISO: "2026-01-02T00:00:00.000Z" });

  assert.deepEqual((await store.listOutboxEmails(1)).map((email) => email.id), ["email_newer"]);
  assert.deepEqual(await store.clearOutboxEmails(), { cleared: 2 });
  assert.deepEqual(await store.listOutboxEmails(), []);
});

function runStorageSelection(env) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", "import './src/storage/index.js';"], {
    cwd: path.resolve("."),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("storage selector defaults to JSON when SLOTZY_STORAGE is missing", () => {
  const env = { ...process.env };
  delete env.SLOTZY_STORAGE;
  const result = runStorageSelection(env);
  assert.equal(result.status, 0, result.stderr);
});

test("storage selector rejects unsupported values", () => {
  const result = runStorageSelection({ SLOTZY_STORAGE: "invalid" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported SLOTZY_STORAGE value "invalid"/);
});

test("explicit Postgres selection fails without server-only credentials and does not fall back", () => {
  const env = { ...process.env, SLOTZY_STORAGE: "postgres" };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const result = runStorageSelection(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SLOTZY_STORAGE=postgres requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/);
});
