import test from "node:test";
import assert from "node:assert/strict";
import { LIMITER_STORE_FAILURE_CATEGORY, RATE_LIMIT_CATEGORIES, SHARED_LIMITER_FEATURE_FLAG, createFakeSharedLimiterStore, createInMemoryRateLimiter, createOpaqueLimiterKey, createRedisCompatibleLimiterStore, createStagingSharedLimiterStore, evaluateRateLimits, getRateLimitPolicies, getSharedLimiterUnavailableResponse, isStagingSharedLimiterEnabled } from "../src/rateLimiter.js";

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

test("Redis-compatible adapter uses one atomic increment/expiry operation without exposing opaque keys", async () => {
  let currentTime = 1_000;
  const entries = new Map();
  const calls = [];
  const client = {
    async eval(script, { keys, arguments: args }) {
      calls.push({ script, keys, args });
      const key = keys[0];
      const windowMs = Number(args[0]);
      const existing = entries.get(key);
      const entry = !existing || existing.expiresAt <= currentTime
        ? { count: 0, expiresAt: currentTime + windowMs }
        : existing;
      entry.count += 1;
      entries.set(key, entry);
      return [entry.count, entry.expiresAt - currentTime];
    },
  };
  const sensitive = "customer@example.test 127.0.0.1 private-token";
  const opaqueKey = createOpaqueLimiterKey({
    secret: "test-only-limiter-secret",
    environment: "staging",
    route: "/api/auth/login",
    keyType: "account",
    values: [sensitive],
  });
  const store = createRedisCompatibleLimiterStore({ client });
  assert.equal((await store.consume({ key: opaqueKey, limit: 2, windowMs: 1_000 })).allowed, true);
  assert.equal((await store.consume({ key: opaqueKey, limit: 2, windowMs: 1_000 })).remaining, 0);
  const denied = await store.consume({ key: opaqueKey, limit: 2, windowMs: 1_000 });
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
  assert.equal(calls.length, 3);
  assert.match(calls[0].keys[0], /^slotzy:rl:v1:[a-f0-9]{64}$/);
  assert.match(calls[0].script, /redis\.call\("PEXPIRE", KEYS\[1\], ARGV\[1\]\)/);
  assert.doesNotMatch(JSON.stringify(calls), /customer|127\.0\.0\.1|private-token/);

  currentTime = 2_001;
  assert.equal((await store.consume({ key: opaqueKey, limit: 2, windowMs: 1_000 })).allowed, true);
});

test("Redis-compatible adapter reports provider outage without a key or provider detail", async () => {
  const store = createRedisCompatibleLimiterStore({
    client: { async eval() { throw new Error("connection refused private-url"); } },
  });
  const opaqueKey = createOpaqueLimiterKey({
    secret: "test-only-limiter-secret",
    environment: "staging",
    route: "/api/auth/login",
    keyType: "account",
    values: ["outage-test"],
  });
  const result = await store.consume({ key: opaqueKey, limit: 1, windowMs: 1_000 });
  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 0,
    failureCategory: LIMITER_STORE_FAILURE_CATEGORY,
  });
  assert.doesNotMatch(JSON.stringify(result), /private-url|connection/i);
});

test("fake-store local atomic-counter coverage is not hosted multi-worker verification", async () => {
  const counts = new Map();
  const client = {
    async eval(_script, { keys }) {
      const next = (counts.get(keys[0]) ?? 0) + 1;
      counts.set(keys[0], next);
      return [next, 1_000];
    },
  };
  const key = createOpaqueLimiterKey({ secret: "test-only-limiter-secret", environment: "staging", route: "/api/auth/login", keyType: "account", values: ["shared"] });
  const first = createRedisCompatibleLimiterStore({ client });
  const second = createRedisCompatibleLimiterStore({ client });
  const results = await Promise.all(Array.from({ length: 4 }, (_, index) => (index % 2 ? first : second).consume({ key, limit: 2, windowMs: 1_000 })));
  assert.equal(results.filter((result) => result.allowed).length, 2);
  assert.equal(results.filter((result) => !result.allowed).length, 2);

  const malformed = createRedisCompatibleLimiterStore({ client: { async eval() { return ["not-a-number", -1]; } } });
  assert.equal((await malformed.consume({ key, limit: 1, windowMs: 1_000 })).failureCategory, LIMITER_STORE_FAILURE_CATEGORY);
});

test("shared limiter outage envelope is stable and fail-closed for every live category", () => {
  for (const category of Object.values(RATE_LIMIT_CATEGORIES)) {
    assert.deepEqual(getSharedLimiterUnavailableResponse(category), {
      status: 503,
      body: {
        error: "This action is temporarily unavailable. Please try again later.",
        code: "limiter_temporarily_unavailable",
      },
    });
  }
});

test("Redis-compatible adapter rejects non-opaque keys before client evaluation", async () => {
  let evalCalls = 0;
  const store = createRedisCompatibleLimiterStore({
    client: { async eval() { evalCalls += 1; return [1, 1_000]; } },
  });
  const rejectedKeys = ["customer@example.test", "127.0.0.1", "", "not-a-sha256-digest", "A".repeat(64), "a".repeat(63)];
  for (const key of rejectedKeys) {
    await assert.rejects(
      store.consume({ key, limit: 1, windowMs: 1_000 }),
      /invalid opaque limiter key/
    );
  }
  assert.equal(evalCalls, 0);
});

test("Redis-compatible adapter validates its non-secret namespace prefix", () => {
  const client = { async eval() { return [1, 1_000]; } };
  assert.doesNotThrow(() => createRedisCompatibleLimiterStore({ client, keyPrefix: "slotzy:rl:v1" }));
  assert.throws(() => createRedisCompatibleLimiterStore({ client, keyPrefix: "customer@example.test" }), /invalid rate-limit key prefix/);
  assert.throws(() => createRedisCompatibleLimiterStore({ client, keyPrefix: "slotzy:private url" }), /invalid rate-limit key prefix/);
});

test("future shared limiter flag is staging-only and disabled by default", () => {
  assert.equal(SHARED_LIMITER_FEATURE_FLAG, "SLOTZY_STAGING_SHARED_LIMITER_ENABLED");
  assert.equal(isStagingSharedLimiterEnabled(), false);
  assert.equal(isStagingSharedLimiterEnabled({ environment: "staging", value: "false" }), false);
  assert.equal(isStagingSharedLimiterEnabled({ environment: "production", value: "true" }), false);
  assert.equal(isStagingSharedLimiterEnabled({ environment: "staging", value: "true" }), true);

  let clientFactoryCalls = 0;
  const createClient = () => {
    clientFactoryCalls += 1;
    return { async eval() { return [1, 1_000]; } };
  };
  assert.equal(createStagingSharedLimiterStore({ environment: "staging", value: "false", createClient }), null);
  assert.equal(createStagingSharedLimiterStore({ environment: "production", value: "true", createClient }), null);
  assert.equal(clientFactoryCalls, 0);
  assert.ok(createStagingSharedLimiterStore({ environment: "staging", value: "true", createClient }));
  assert.equal(clientFactoryCalls, 1);
});

test("enforced rate-limit category constants preserve current values and policy keys", () => {
  assert.deepEqual(RATE_LIMIT_CATEGORIES, {
    AUTH_LOGIN: "login",
    BOOKING_CREATE: "booking_create",
    MANAGE_LOOKUP: "manage_lookup",
    MANAGE_CANCEL: "manage_cancel",
    MANAGE_RECOVERY: "manage_recovery",
  });

  const expectedCategories = Object.values(RATE_LIMIT_CATEGORIES).sort();
  assert.deepEqual(Object.keys(getRateLimitPolicies()).sort(), expectedCategories);
  assert.deepEqual(Object.keys(getRateLimitPolicies({ useTestProfile: true })).sort(), expectedCategories);
});
