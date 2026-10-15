import { createHmac } from "node:crypto";

const MINUTE = 60 * 1000;

// These are the only categories enforced by the current in-process limiter.
// Unresolved routes remain docs-only until a separately approved policy exists.
export const RATE_LIMIT_CATEGORIES = Object.freeze({
  AUTH_LOGIN: "login",
  BOOKING_CREATE: "booking_create",
  MANAGE_LOOKUP: "manage_lookup",
  MANAGE_CANCEL: "manage_cancel",
  MANAGE_RECOVERY: "manage_recovery",
});

export const LIMITER_STORE_FAILURE_CATEGORY = "store_unavailable";
export const SHARED_LIMITER_FEATURE_FLAG = "SLOTZY_STAGING_SHARED_LIMITER_ENABLED";
export const SHARED_LIMITER_UNAVAILABLE_RESPONSE = Object.freeze({
  status: 503,
  body: Object.freeze({
    error: "This action is temporarily unavailable. Please try again later.",
    code: "limiter_temporarily_unavailable",
  }),
});

// This script deliberately combines increment and first-write expiry in one
// server-side operation. The adapter accepts an injected Redis-compatible
// client so this module does not select, connect to, or configure a provider.
const REDIS_FIXED_WINDOW_CONSUME_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;
const OPAQUE_LIMITER_KEY_PATTERN = /^[a-f0-9]{64}$/;
const REDIS_KEY_PREFIX_PATTERN = /^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)*$/;

const STAGING_POLICIES = Object.freeze({
  [RATE_LIMIT_CATEGORIES.AUTH_LOGIN]: Object.freeze({ account: { limit: 30, windowMs: 15 * MINUTE }, coarse_source: { limit: 60, windowMs: 15 * MINUTE } }),
  [RATE_LIMIT_CATEGORIES.BOOKING_CREATE]: Object.freeze({ coarse_source: { limit: 60, windowMs: 60 * MINUTE }, shop: { limit: 300, windowMs: 60 * MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_LOOKUP]: Object.freeze({ manage: { limit: 60, windowMs: 15 * MINUTE }, coarse_source: { limit: 120, windowMs: 15 * MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_CANCEL]: Object.freeze({ manage: { limit: 20, windowMs: 15 * MINUTE }, coarse_source: { limit: 60, windowMs: 15 * MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_RECOVERY]: Object.freeze({ contact: { limit: 10, windowMs: 15 * MINUTE }, coarse_source: { limit: 30, windowMs: 15 * MINUTE } }),
});

const TEST_POLICIES = Object.freeze({
  [RATE_LIMIT_CATEGORIES.AUTH_LOGIN]: Object.freeze({ account: { limit: 2, windowMs: MINUTE }, coarse_source: { limit: 50, windowMs: MINUTE } }),
  [RATE_LIMIT_CATEGORIES.BOOKING_CREATE]: Object.freeze({ coarse_source: { limit: 2, windowMs: MINUTE }, shop: { limit: 50, windowMs: MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_LOOKUP]: Object.freeze({ manage: { limit: 2, windowMs: MINUTE }, coarse_source: { limit: 50, windowMs: MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_CANCEL]: Object.freeze({ manage: { limit: 2, windowMs: MINUTE }, coarse_source: { limit: 50, windowMs: MINUTE } }),
  [RATE_LIMIT_CATEGORIES.MANAGE_RECOVERY]: Object.freeze({ contact: { limit: 2, windowMs: MINUTE }, coarse_source: { limit: 50, windowMs: MINUTE } }),
});

export function getRateLimitPolicies({ useTestProfile = false } = {}) {
  return useTestProfile ? TEST_POLICIES : STAGING_POLICIES;
}

export function createOpaqueLimiterKey({ secret, environment, route, keyType, values = [] }) {
  const normalizedSecret = String(secret ?? "");
  if (normalizedSecret.length < 16) throw new Error("rate-limit key secret must be at least 16 characters");
  const material = [environment, route, keyType, ...values]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("\u001f");
  return createHmac("sha256", normalizedSecret).update(material).digest("hex");
}

export function isStagingSharedLimiterEnabled({ environment, value } = {}) {
  // Production is an explicit hard stop for this groundwork package. Nothing
  // reads this flag at runtime yet; a later approved integration may do so.
  return String(environment ?? "").trim().toLowerCase() === "staging"
    && String(value ?? "").trim().toLowerCase() === "true";
}

export function getSharedLimiterUnavailableResponse(category) {
  if (!Object.values(RATE_LIMIT_CATEGORIES).includes(category)) {
    throw new Error("unknown rate-limit category");
  }
  return SHARED_LIMITER_UNAVAILABLE_RESPONSE;
}

export function createStagingSharedLimiterStore({ environment, value, createClient, keyPrefix } = {}) {
  if (!isStagingSharedLimiterEnabled({ environment, value })) return null;
  if (typeof createClient !== "function") throw new Error("a Redis-compatible client factory is required");
  return createRedisCompatibleLimiterStore({ client: createClient(), keyPrefix });
}

export function createRedisCompatibleLimiterStore({ client, keyPrefix = "slotzy:rl:v1" } = {}) {
  if (!client || typeof client.eval !== "function") {
    throw new Error("a Redis-compatible client with eval is required");
  }
  const safePrefix = String(keyPrefix ?? "").trim();
  if (!REDIS_KEY_PREFIX_PATTERN.test(safePrefix) || safePrefix.length > 128) {
    throw new Error("invalid rate-limit key prefix");
  }

  return {
    // The input key must already be an opaque HMAC digest. This adapter never
    // derives, logs, or returns it, preserving the privacy boundary.
    async consume({ key, limit, windowMs }) {
      const safeKey = String(key ?? "");
      const safeLimit = Number(limit);
      const safeWindow = Number(windowMs);
      if (!OPAQUE_LIMITER_KEY_PATTERN.test(safeKey)) {
        throw new Error("invalid opaque limiter key");
      }
      if (!Number.isInteger(safeLimit) || safeLimit < 1 || !Number.isFinite(safeWindow) || safeWindow < 1) {
        throw new Error("invalid rate-limit policy");
      }
      try {
        const response = await client.eval(REDIS_FIXED_WINDOW_CONSUME_SCRIPT, {
          keys: [`${safePrefix}:${safeKey}`],
          arguments: [String(Math.ceil(safeWindow))],
        });
        const [count, ttlMs] = Array.isArray(response) ? response : [];
        const safeCount = Number(count);
        const safeTtlMs = Number(ttlMs);
        if (!Number.isFinite(safeCount) || !Number.isFinite(safeTtlMs) || safeTtlMs < 0) {
          throw new Error("invalid Redis-compatible limiter response");
        }
        if (safeCount > safeLimit) {
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.min(3600, Math.ceil(safeTtlMs / 1000))),
          };
        }
        return {
          allowed: true,
          remaining: Math.max(0, safeLimit - safeCount),
          retryAfterSeconds: 0,
        };
      } catch {
        // Callers must make the route-specific outage decision; this category
        // is intentionally not translated into a fail-open or fail-closed API
        // response by the foundation.
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: 0,
          failureCategory: LIMITER_STORE_FAILURE_CATEGORY,
        };
      }
    },
  };
}

export function createInMemoryRateLimiter({ maxKeys = 10_000, now = () => Date.now() } = {}) {
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new Error("maxKeys must be a positive integer");
  const counters = new Map();

  function cleanup(currentTime = now()) {
    for (const [key, entry] of counters) {
      if (entry.resetAt <= currentTime) counters.delete(key);
    }
    return counters.size;
  }

  function evictOldest() {
    let candidateKey = "";
    let candidateReset = Number.POSITIVE_INFINITY;
    for (const [key, entry] of counters) {
      if (entry.resetAt < candidateReset) {
        candidateKey = key;
        candidateReset = entry.resetAt;
      }
    }
    if (candidateKey) counters.delete(candidateKey);
  }

  function consume({ key, limit, windowMs }) {
    const safeLimit = Number(limit);
    const safeWindow = Number(windowMs);
    if (!key || !Number.isInteger(safeLimit) || safeLimit < 1 || !Number.isFinite(safeWindow) || safeWindow < 1) {
      throw new Error("invalid rate-limit policy");
    }
    const currentTime = now();
    cleanup(currentTime);
    let entry = counters.get(key);
    if (!entry) {
      if (counters.size >= maxKeys) evictOldest();
      entry = { count: 0, resetAt: currentTime + safeWindow };
      counters.set(key, entry);
    }
    if (entry.count >= safeLimit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.min(3600, Math.ceil((entry.resetAt - currentTime) / 1000))),
      };
    }
    entry.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, safeLimit - entry.count),
      retryAfterSeconds: 0,
    };
  }

  return { cleanup, consume, size: () => counters.size };
}

// Test-only stand-in for the future shared-store adapter contract. It does not
// connect to a network service or alter the application's active limiter.
export function createFakeSharedLimiterStore({ maxKeys = 10_000, now = () => Date.now(), fail = false } = {}) {
  const inMemoryStore = createInMemoryRateLimiter({ maxKeys, now });
  return {
    cleanup: inMemoryStore.cleanup,
    size: inMemoryStore.size,
    consume(input) {
      if (fail) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: 0,
          failureCategory: LIMITER_STORE_FAILURE_CATEGORY,
        };
      }
      return inMemoryStore.consume(input);
    },
  };
}

export function evaluateRateLimits({ limiter, policies, category, buildKey, keyInputs }) {
  const categoryPolicies = policies?.[category];
  if (!categoryPolicies) throw new Error("unknown rate-limit category");
  for (const { keyType, values } of keyInputs) {
    const policy = categoryPolicies[keyType];
    if (!policy) throw new Error("unknown rate-limit key type");
    const result = limiter.consume({ key: buildKey(keyType, values), ...policy });
    if (!result.allowed) return { ...result, keyType };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function evaluateRateLimitsAsync({ limiter, policies, category, buildKey, keyInputs }) {
  const categoryPolicies = policies?.[category];
  if (!categoryPolicies) throw new Error("unknown rate-limit category");
  for (const { keyType, values } of keyInputs) {
    const policy = categoryPolicies[keyType];
    if (!policy) throw new Error("unknown rate-limit key type");
    const result = await limiter.consume({ key: buildKey(keyType, values), ...policy });
    if (!result.allowed) return { ...result, keyType };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
