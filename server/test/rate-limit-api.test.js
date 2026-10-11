import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

let temporaryDirectory = "";
let serverProcess = null;
let serverOutput = "";

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await once(serverProcess, "exit");
  }
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

function futureSlot(daysAhead, hourOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(18 + hourOffset, 0, 0, 0);
  return date;
}

async function startServer() {
  temporaryDirectory = await mkdtemp(path.join(process.cwd(), ".slotzy-rate-limit-"));
  const sourceDirectory = path.join(temporaryDirectory, "src");
  await cp(path.join(process.cwd(), "src"), sourceDirectory, { recursive: true });

  const password = "rate-limit-password-private";
  const manageToken = "manage-token-private-abcdefghijklmnopqrstuvwxyz";
  const managedStart = futureSlot(5);
  const managedEnd = new Date(managedStart.getTime() + 30 * 60 * 1000);
  const weekly = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    .map((day) => [day, { enabled: true, start: "00:00", end: "23:59" }]));
  const fixture = {
    users: [{ id: "rate-owner-id", username: "rate-owner", displayName: "Rate Owner", passwordHash: await bcrypt.hash(password, 4), role: "owner", shopId: "rate-shop", authVersion: 0 }],
    shops: [{ id: "rate-shop", name: "Rate Shop", slug: "rate-shop", ownerUsername: "rate-owner", bookingPolicy: { allowSameDay: true, maxDaysAdvance: 30, cancelHours: 0, bufferMinutes: 0 } }],
    services: [{ id: "rate-service", name: "Rate Cut", title: "Rate Cut", price: 25, durationMinutes: 30, duration: 30, active: true, shopId: "rate-shop", barberUsername: "rate-owner", ownerUsername: "rate-owner" }],
    availability: { "rate-owner": { timezone: "America/Chicago", bufferMinutes: 0, weekly, timeOff: [], recurringBlocks: [] } },
    bookings: [{ id: "managed-booking", shopId: "rate-shop", barberUsername: "rate-owner", ownerUsername: "rate-owner", serviceName: "Rate Cut", clientName: "Private Customer", clientContact: "private-customer@example.test", clientEmail: "private-customer@example.test", startISO: managedStart.toISOString(), endISO: managedEnd.toISOString(), durationMinutes: 30, status: "booked", confirmationCode: "RATE01", manageTokenHash: createHash("sha256").update(manageToken).digest("hex") }],
    bookingEvents: [],
    emails: [],
  };
  await writeFile(path.join(sourceDirectory, "db.json"), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

  const port = 37000 + Math.floor(Math.random() * 1000);
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: sourceDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      SLOTZY_STORAGE: "json",
      JWT_SECRET: "test-only-rate-limit-jwt-secret",
      RATE_LIMIT_KEY_SECRET: "test-only-rate-limit-key-secret",
      SLOTZY_RATE_LIMIT_TEST_PROFILE: "tight",
      SLOTZY_APP_ORIGIN: "https://staging.example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
  serverProcess.stderr.on("data", (chunk) => { serverOutput += String(chunk); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("rate-limit test API did not start")), 10_000);
    serverProcess.once("error", reject);
    serverProcess.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Slotzy API server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return { baseUrl: `http://127.0.0.1:${port}`, password, manageToken, managedStart };
}

async function request(baseUrl, pathname, { method = "GET", body, manageToken = "" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      "X-Request-ID": `rate-limit-test-${method.toLowerCase()}-${Math.random().toString(16).slice(2)}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(manageToken ? { "X-Slotzy-Manage-Token": manageToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    retryAfter: response.headers.get("retry-after"),
  };
}

test("exposed route limits preserve allowed requests and return generic safe 429 responses", async () => {
  const { baseUrl, password, manageToken, managedStart } = await startServer();

  const loginBody = { username: "rate-owner", password };
  assert.equal((await request(baseUrl, "/api/auth/login", { method: "POST", body: loginBody })).status, 200);
  assert.equal((await request(baseUrl, "/api/auth/login", { method: "POST", body: loginBody })).status, 200);
  const limitedLogin = await request(baseUrl, "/api/auth/login", { method: "POST", body: loginBody });
  assert.equal(limitedLogin.status, 429);
  assert.equal(limitedLogin.body.code, "auth_temporarily_limited");
  assert.match(limitedLogin.retryAfter, /^\d+$/);

  const missingLoginBody = { username: "missing-rate-owner", password: "different-private-password" };
  assert.equal((await request(baseUrl, "/api/auth/login", { method: "POST", body: missingLoginBody })).status, 401);
  assert.equal((await request(baseUrl, "/api/auth/login", { method: "POST", body: missingLoginBody })).status, 401);
  const limitedMissingLogin = await request(baseUrl, "/api/auth/login", { method: "POST", body: missingLoginBody });
  assert.equal(limitedMissingLogin.status, 429);
  assert.deepEqual(limitedMissingLogin.body, limitedLogin.body);

  const bookingStart = futureSlot(7);
  const bookingBody = (offset) => ({
    shopId: "rate-shop", serviceId: "rate-service", barberUsername: "rate-owner",
    clientName: "Private Booking Customer", clientContact: "booking-customer@example.test",
    startISO: new Date(bookingStart.getTime() + offset * 60 * 60 * 1000).toISOString(),
    endISO: new Date(bookingStart.getTime() + offset * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  });
  assert.equal((await request(baseUrl, "/api/bookings", { method: "POST", body: bookingBody(0) })).status, 201);
  assert.equal((await request(baseUrl, "/api/bookings", { method: "POST", body: bookingBody(1) })).status, 201);
  const limitedBooking = await request(baseUrl, "/api/bookings", { method: "POST", body: bookingBody(2) });
  assert.equal(limitedBooking.status, 429);
  assert.equal(limitedBooking.body.code, "booking_temporarily_limited");
  assert.doesNotMatch(JSON.stringify(limitedBooking.body), /rate-shop|booking-customer|slot|contact/i);

  assert.equal((await request(baseUrl, "/api/public/manage", { manageToken })).status, 200);
  assert.equal((await request(baseUrl, "/api/public/manage", { manageToken })).status, 200);
  const limitedManage = await request(baseUrl, "/api/public/manage", { manageToken });
  assert.equal(limitedManage.status, 429);
  assert.equal(limitedManage.body.code, "manage_temporarily_limited");
  const invalidManageToken = "invalid-manage-token-abcdefghijklmnopqrstuvwxyz";
  assert.equal((await request(baseUrl, "/api/public/manage", { manageToken: invalidManageToken })).status, 404);
  assert.equal((await request(baseUrl, "/api/public/manage", { manageToken: invalidManageToken })).status, 404);
  const limitedInvalidManage = await request(baseUrl, "/api/public/manage", { manageToken: invalidManageToken });
  assert.equal(limitedInvalidManage.status, 429);
  assert.deepEqual(limitedInvalidManage.body, limitedManage.body);

  assert.equal((await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken })).status, 200);
  assert.notEqual((await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken })).status, 200);
  const limitedCancel = await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken });
  assert.equal(limitedCancel.status, 429);
  assert.equal(limitedCancel.body.code, "manage_temporarily_limited");
  assert.equal((await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken: invalidManageToken })).status, 404);
  assert.equal((await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken: invalidManageToken })).status, 404);
  const limitedInvalidCancel = await request(baseUrl, "/api/public/manage/cancel", { method: "PATCH", manageToken: invalidManageToken });
  assert.equal(limitedInvalidCancel.status, 429);
  assert.deepEqual(limitedInvalidCancel.body, limitedCancel.body);

  const recoveryBody = { contact: "private-customer@example.test", shopId: "rate-shop", appointmentDate: managedStart.toISOString().slice(0, 10) };
  assert.equal((await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: recoveryBody })).status, 200);
  assert.equal((await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: recoveryBody })).status, 200);
  const limitedRecovery = await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: recoveryBody });
  assert.equal(limitedRecovery.status, 429);
  assert.equal(limitedRecovery.body.code, "recovery_temporarily_limited");
  const missingRecoveryBody = { ...recoveryBody, contact: "missing-customer@example.test" };
  assert.equal((await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: missingRecoveryBody })).status, 200);
  assert.equal((await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: missingRecoveryBody })).status, 200);
  const limitedMissingRecovery = await request(baseUrl, "/api/public/manage/recover", { method: "POST", body: missingRecoveryBody });
  assert.equal(limitedMissingRecovery.status, 429);
  assert.deepEqual(limitedMissingRecovery.body, limitedRecovery.body);

  await new Promise((resolve) => setTimeout(resolve, 25));
  const abuseEvents = serverOutput.split(/\r?\n/).filter((line) => line.includes('"event":"abuse.rate_limited"'));
  assert.ok(abuseEvents.length >= 8);
  const allowedFields = new Set(["event", "environment", "service", "storageMode", "requestId", "route", "method", "status", "errorCode", "release", "outcome", "category", "keyType"]);
  for (const line of abuseEvents) {
    const event = JSON.parse(line);
    assert.ok(Object.keys(event).every((key) => allowedFields.has(key)));
    assert.equal(event.status, 429);
    assert.equal(event.outcome, "rate_limited");
  }
  assert.doesNotMatch(abuseEvents.join("\n"), /127\.0\.0\.1|rate-limit-password-private|different-private-password|private-manage-token|invalid-manage-token|private-customer|booking-customer|example\.test|authorization|token=|https?:\/\//i);
});
