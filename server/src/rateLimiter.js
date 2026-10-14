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
