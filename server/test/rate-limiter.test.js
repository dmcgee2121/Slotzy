import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryRateLimiter, createOpaqueLimiterKey, evaluateRateLimits } from "../src/rateLimiter.js";

test("fixed windows expire and cleanup removes stale counters", () => {
  let currentTime = 1_000;
  const limiter = createInMemoryRateLimiter({ maxKeys: 4, now: () => currentTime });
  assert.equal(limiter.consume({ key: "one", limit: 2, windowMs: 1_000 }).allowed, true);
  assert.equal(limiter.consume({ key: "one", limit: 2, windowMs: 1_000 }).allowed, true);
  assert.equal(limiter.consume({ key: "one", limit: 2, windowMs: 1_000 }).allowed, false);
  currentTime = 2_001;
  assert.equal(limiter.cleanup(), 0);
  assert.equal(limiter.consume({ key: "one", limit: 2, windowMs: 1_000 }).allowed, true);
});

test("bounded counters evict an expiring entry and route keys remain isolated", () => {
  const limiter = createInMemoryRateLimiter({ maxKeys: 2, now: () => 1_000 });
  limiter.consume({ key: "route-a", limit: 1, windowMs: 1_000 });
  limiter.consume({ key: "route-b", limit: 1, windowMs: 2_000 });
  limiter.consume({ key: "route-c", limit: 1, windowMs: 3_000 });
  assert.equal(limiter.size(), 2);
  assert.equal(limiter.consume({ key: "route-a", limit: 1, windowMs: 1_000 }).allowed, true);

  const secret = "test-only-limiter-secret";
  const first = createOpaqueLimiterKey({ secret, environment: "staging", route: "/api/one", keyType: "account", values: ["same-user"] });
  const second = createOpaqueLimiterKey({ secret, environment: "staging", route: "/api/two", keyType: "account", values: ["same-user"] });
  assert.notEqual(first, second);
});

test("limiter keys and decisions never retain raw sensitive material", () => {
  const sensitive = "customer@example.test token=private-manage-token 127.0.0.1";
  const key = createOpaqueLimiterKey({
    secret: "test-only-limiter-secret",
    environment: "staging",
    route: "/api/public/manage",
    keyType: "manage",
    values: [sensitive],
  });
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key.includes("customer"), false);
  assert.equal(key.includes("127.0.0.1"), false);

  const limiter = createInMemoryRateLimiter();
  const policies = { login: { account: { limit: 1, windowMs: 1_000 } } };
  const buildKey = () => key;
  assert.equal(evaluateRateLimits({ limiter, policies, category: "login", buildKey, keyInputs: [{ keyType: "account", values: [sensitive] }] }).allowed, true);
  const denied = evaluateRateLimits({ limiter, policies, category: "login", buildKey, keyInputs: [{ keyType: "account", values: [sensitive] }] });
  assert.deepEqual(Object.keys(denied).sort(), ["allowed", "keyType", "remaining", "retryAfterSeconds"].sort());
  assert.equal(JSON.stringify(denied).includes(sensitive), false);
});
