import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";

let temporaryDirectory = "";
let serverProcess = null;

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await once(serverProcess, "exit");
  }
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function startServer() {
  // Keep the server's JSON fixture and generated test state outside the source
  // tree while retaining normal dependency resolution through server/node_modules.
  temporaryDirectory = await mkdtemp(path.join(process.cwd(), ".slotzy-auth-change-"));
  const sourceDirectory = path.join(temporaryDirectory, "src");
  await cp(path.join(process.cwd(), "src"), sourceDirectory, { recursive: true });
  const port = 36000 + Math.floor(Math.random() * 1000);
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: sourceDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      SLOTZY_STORAGE: "json",
      JWT_SECRET: "test-only-auth-change-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("test API did not start")), 10_000);
    serverProcess.once("error", reject);
    serverProcess.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Slotzy API server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.resume();
  });
  return `http://127.0.0.1:${port}`;
}

async function request(baseUrl, pathname, { method = "GET", token = "", body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test("authenticated staff password change revokes old sessions and returns a fresh token", async () => {
  const baseUrl = await startServer();
  const owner = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { username: "password-change-owner", password: "old-password", role: "owner" },
  });
  assert.equal(owner.status, 201);
  const oldToken = owner.body.token;

  const missingCurrent = await request(baseUrl, "/api/auth/change-password", {
    method: "POST", token: oldToken, body: { newPassword: "new-password" },
  });
  assert.equal(missingCurrent.status, 400);
  const weakNew = await request(baseUrl, "/api/auth/change-password", {
    method: "POST", token: oldToken, body: { currentPassword: "old-password", newPassword: "short" },
  });
  assert.equal(weakNew.status, 400);
  const wrongCurrent = await request(baseUrl, "/api/auth/change-password", {
    method: "POST", token: oldToken, body: { currentPassword: "wrong-password", newPassword: "new-password" },
  });
  assert.equal(wrongCurrent.status, 401);

  const changed = await request(baseUrl, "/api/auth/change-password", {
    method: "POST", token: oldToken, body: { currentPassword: "old-password", newPassword: "new-password" },
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.ok, true);
  assert.equal(typeof changed.body.token, "string");
  assert.equal(changed.body.user.passwordHash, undefined);
  assert.equal(JSON.stringify(changed.body).includes("old-password"), false);
  assert.equal(JSON.stringify(changed.body).includes("new-password"), false);

  const staleTokenRoute = await request(baseUrl, "/api/shops", { token: oldToken });
  assert.equal(staleTokenRoute.status, 401);
  const freshTokenRoute = await request(baseUrl, "/api/shops", { token: changed.body.token });
  assert.equal(freshTokenRoute.status, 200);

  const oldLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST", body: { username: "password-change-owner", password: "old-password" },
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST", body: { username: "password-change-owner", password: "new-password" },
  });
  assert.equal(newLogin.status, 200);

  const ownerShop = await request(baseUrl, "/api/shops", {
    method: "POST", token: changed.body.token, body: { name: "Password Change Shop" },
  });
  assert.equal(ownerShop.status, 201);
  const barber = await request(baseUrl, "/api/auth/register", {
    method: "POST", body: { username: "password-change-barber", password: "barber-password", role: "barber", shopId: ownerShop.body.shop.id },
  });
  assert.equal(barber.status, 201);
  const barberShop = await request(baseUrl, "/api/shops", {
    method: "POST", token: barber.body.token, body: { name: "Barber Must Not Create Shop" },
  });
  assert.equal(barberShop.status, 403);
  const barberChanged = await request(baseUrl, "/api/auth/change-password", {
    method: "POST", token: barber.body.token, body: { currentPassword: "barber-password", newPassword: "barber-new-password" },
  });
  assert.equal(barberChanged.status, 200);
  assert.equal((await request(baseUrl, "/api/shops", { token: barber.body.token })).status, 401);
  assert.equal((await request(baseUrl, "/api/shops", { token: barberChanged.body.token })).status, 200);
});
