import test from "node:test";
import assert from "node:assert/strict";
import { LIMITER_STORE_FAILURE_CATEGORY, RATE_LIMIT_CATEGORIES, createFakeSharedLimiterStore, createInMemoryRateLimiter, createOpaqueLimiterKey, evaluateRateLimits } from "../src/rateLimiter.js";

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

test("fake shared-store adapter provides local atomic-window semantics and expiry", () => {
  let currentTime = 1_000;
  const store = createFakeSharedLimiterStore({ now: () => currentTime });
  assert.equal(store.consume({ key: "local-test-key", limit: 2, windowMs: 1_000 }).allowed, true);
  assert.equal(store.consume({ key: "local-test-key", limit: 2, windowMs: 1_000 }).allowed, true);
  assert.equal(store.consume({ key: "local-test-key", limit: 2, windowMs: 1_000 }).allowed, false);
  currentTime = 2_001;
  assert.equal(store.consume({ key: "local-test-key", limit: 2, windowMs: 1_000 }).allowed, true);
});

test("fake shared-store failure is bounded and category-only", () => {
  const result = createFakeSharedLimiterStore({ fail: true }).consume({ key: "local-test-key", limit: 1, windowMs: 1_000 });
  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 0,
    failureCategory: LIMITER_STORE_FAILURE_CATEGORY,
  });
  assert.equal(JSON.stringify(result).includes("local-test-key"), false);
});

test("enforced rate-limit category constants remain a small fixed set", () => {
  assert.deepEqual(Object.values(RATE_LIMIT_CATEGORIES).sort(), [
    "booking_create", "login", "manage_cancel", "manage_lookup", "manage_recovery",
  ]);
});
