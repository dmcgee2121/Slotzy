import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

async function runWithEnvironment(environment) {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: environment,
      PORT: "0",
      JWT_SECRET: "test-only-jwt-secret-that-is-long-enough",
      CORS_ALLOWED_ORIGINS: "https://staging.example.test",
      SLOTZY_STAGING_SHARED_LIMITER_ENABLED: "true",
      // Intentionally omit provider URL and dedicated HMAC secret.
      SLOTZY_STAGING_LIMITER_REDIS_URL: "",
      RATE_LIMIT_STORE_HMAC_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const [exitCode] = await once(child, "exit");
  return { exitCode, output };
}

async function startWithDisabledSharedLimiter() {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "staging",
      PORT: "0",
      JWT_SECRET: "test-only-jwt-secret-that-is-long-enough",
      CORS_ALLOWED_ORIGINS: "https://staging.example.test",
      SLOTZY_STAGING_SHARED_LIMITER_ENABLED: "false",
      // Local closed port: a connection here would fail, but disabled mode
      // must never attempt it.
      SLOTZY_STAGING_LIMITER_REDIS_URL: "redis://127.0.0.1:1",
      RATE_LIMIT_STORE_HMAC_SECRET: "test-only-dedicated-limiter-secret-123456",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("disabled shared limiter server did not start")), 5_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Slotzy API server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  child.kill();
  await once(child, "exit");
  return output;
}

test("shared staging mode refuses incomplete configuration before serving requests", async () => {
  const { exitCode, output } = await runWithEnvironment("staging");
  assert.equal(exitCode, 1);
  assert.match(output, /shared limiter initialization failed/);
  assert.doesNotMatch(output, /redis:|password|url|secret-that-is-long/i);
});

test("production rejects shared limiter enablement before a provider connection", async () => {
  const { exitCode, output } = await runWithEnvironment("production");
  assert.notEqual(exitCode, 0);
  assert.match(output, /shared limiter cannot be enabled in production/);
  assert.doesNotMatch(output, /redis:|password|url|secret-that-is-long/i);
});

test("disabled staging mode starts without contacting the locally closed Redis-compatible endpoint", async () => {
  const output = await startWithDisabledSharedLimiter();
  assert.match(output, /Slotzy API server listening/);
  assert.doesNotMatch(output, /shared limiter initialization failed|redis:|127\.0\.0\.1:1/i);
});
