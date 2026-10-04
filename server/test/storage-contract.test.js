import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createJsonStore } from "../src/storage/jsonStore.js";
import { normalizePostgresSnapshot } from "../src/storage/postgresStore.js";

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
    availability: { owner: { timezone: "America/Chicago", weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } }, timeOff: [] } },
    bookings: [{ id: "booking_1", shopId: "shop_1", barberUsername: "owner", serviceName: "Cut", status: "booked" }],
    emails: [],
  };

  await store.writeStore(state);
  assert.deepEqual(await store.readStore(), state);
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
