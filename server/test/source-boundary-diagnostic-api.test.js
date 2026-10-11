import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

const servers = [];
const temporaryDirectories = [];

after(async () => {
  await Promise.all(servers.map(async (server) => {
    if (server.process.exitCode === null) {
      server.process.kill();
      await once(server.process, "exit");
    }
  }));
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

function dotted(...parts) {
  return parts.join(".");
}

async function startServer({ environment = "test", enabled = false } = {}) {
  const directory = await mkdtemp(path.join(process.cwd(), ".slotzy-source-boundary-"));
  temporaryDirectories.push(directory);
  const sourceDirectory = path.join(directory, "src");
  await cp(path.join(process.cwd(), "src"), sourceDirectory, { recursive: true });
  const port = 38000 + Math.floor(Math.random() * 1000);
  let output = "";
  const serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: sourceDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: environment,
      SLOTZY_STORAGE: "json",
      JWT_SECRET: "test-source-boundary-jwt-secret",
      CORS_ALLOWED_ORIGINS: "https://staging.example.test",
      SLOTZY_SOURCE_BOUNDARY_DIAGNOSTIC_ENABLED: enabled ? "true" : "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push({ process: serverProcess });
  serverProcess.stdout.on("data", (chunk) => { output += String(chunk); });
  serverProcess.stderr.on("data", (chunk) => { output += String(chunk); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("source-boundary test API did not start")), 10_000);
    serverProcess.once("error", reject);
    serverProcess.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Slotzy API server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return { baseUrl: `http://127.0.0.1:${port}`, getOutput: () => output };
}

async function request(baseUrl, pathname, { method = "GET", token = "", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function createOwner(baseUrl) {
  const response = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { username: "source-boundary-owner", password: "source-boundary-password", role: "owner" },
  });
  assert.equal(response.status, 201);
  return response.body.token;
}

test("source-boundary diagnostic is disabled by default and production refuses enablement", async () => {
  const disabled = await startServer();
  assert.equal((await request(disabled.baseUrl, "/api/internal/source-boundary-diagnostic", { method: "POST" })).status, 404);

  const production = await startServer({ environment: "production", enabled: true });
  const productionOwner = await createOwner(production.baseUrl);
  assert.equal((await request(production.baseUrl, "/api/internal/source-boundary-diagnostic", {
    method: "POST", token: productionOwner, headers: { "X-Slotzy-Source-Boundary-Case": "missing-forwarded" },
  })).status, 404);
});

test("source-boundary diagnostic is owner-only, category-only, and redacted", async () => {
  const server = await startServer({ enabled: true });
  assert.equal((await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", { method: "POST" })).status, 404);
  const ownerToken = await createOwner(server.baseUrl);
  const customer = await request(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { username: "source-boundary-customer", password: "source-boundary-customer-password", role: "customer" },
  });
  assert.equal(customer.status, 201);
  assert.equal((await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", {
    method: "POST", token: customer.body.token, headers: { "X-Slotzy-Source-Boundary-Case": "missing-forwarded" },
  })).status, 404);
  const bodyCase = await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", {
    method: "POST", token: ownerToken, body: { caseLabel: "missing-forwarded" },
  });
  assert.equal(bodyCase.status, 400);
  assert.deepEqual(bodyCase.body, { ok: false, caseLabel: "unknown" });
  const headerCase = await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", {
    method: "POST", token: ownerToken, headers: { "X-Slotzy-Source-Boundary-Case": "missing-forwarded" },
  });
  assert.equal(headerCase.status, 200);
  assert.deepEqual(Object.keys(headerCase.body).sort(), ["caseLabel", "diagnosticEnabled", "directSocketSource", "environment", "forwardedHandling", "forwardedInput", "ok", "service", "sourceKeyDecision"].sort());
  assert.equal(headerCase.body.caseLabel, "missing-forwarded");
  assert.equal(headerCase.body.forwardedInput, "none");
  assert.equal(headerCase.body.forwardedHandling, "not-trusted");
  assert.equal(headerCase.body.sourceKeyDecision, "direct-socket-current");
  const publicV4 = dotted(198, 51, 100, 17);
  const privateV4 = dotted(10, 0, 0, 7);
  const publicV6 = ["2001", "db8", "", "17"].join(":");
  const malformed = "not-a-forwarded-source";
  const cases = [
    { label: "missing-forwarded", value: "", category: "none", handling: "not-trusted" },
    { label: "single-forwarded", value: publicV4, category: "ipv4-looking", handling: "observed-only" },
    { label: "multiple-forwarded", value: `${publicV4}, ${dotted(203, 0, 113, 18)}`, category: "multiple", handling: "ambiguous" },
    { label: "malformed-forwarded", value: malformed, category: "malformed", handling: "rejected" },
    { label: "private-looking-forwarded", value: privateV4, category: "private-looking", handling: "observed-only" },
    { label: "ipv4-looking-forwarded", value: publicV4, category: "ipv4-looking", handling: "observed-only" },
    { label: "ipv6-looking-forwarded", value: publicV6, category: "ipv6-looking", handling: "observed-only" },
    { label: "mixed-forwarded", value: `${publicV4}, ${publicV6}`, category: "mixed", handling: "ambiguous" },
  ];

  for (const testCase of cases) {
    const response = await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", {
      method: "POST",
      token: ownerToken,
      headers: {
        "X-Slotzy-Source-Boundary-Case": testCase.label,
        ...(testCase.value ? { "X-Forwarded-For": testCase.value } : {}),
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ["caseLabel", "diagnosticEnabled", "directSocketSource", "environment", "forwardedHandling", "forwardedInput", "ok", "service", "sourceKeyDecision"].sort());
    assert.equal(response.body.caseLabel, testCase.label);
    assert.equal(response.body.forwardedInput, testCase.category);
    assert.equal(response.body.forwardedHandling, testCase.handling);
    assert.equal(response.body.sourceKeyDecision, "direct-socket-current");
    const serialized = JSON.stringify(response.body);
    if (testCase.value) assert.equal(serialized.includes(testCase.value), false);
    assert.equal(serialized.includes("sha256"), false);
  }

  const unknown = await request(server.baseUrl, "/api/internal/source-boundary-diagnostic", {
    method: "POST", token: ownerToken,
    headers: { "X-Slotzy-Source-Boundary-Case": "unapproved-private-case", "X-Forwarded-For": publicV4 },
  });
  assert.equal(unknown.status, 400);
  assert.deepEqual(unknown.body, { ok: false, caseLabel: "unknown" });
  await new Promise((resolve) => setTimeout(resolve, 25));
  const output = server.getOutput();
  for (const value of [publicV4, privateV4, publicV6, malformed, "source-boundary-password", "unapproved-private-case"]) {
    assert.equal(output.includes(value), false);
  }
  assert.match(output, /"event":"security.source_boundary_checked"/);
  assert.match(output, /"sourceKeyDecision":"direct-socket-current"/);
});
