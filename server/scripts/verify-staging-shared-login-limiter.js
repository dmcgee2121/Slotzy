import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { RATE_LIMIT_CATEGORIES, getRateLimitPolicies } from "../src/rateLimiter.js";

export const APPROVED_STAGING_API_ORIGIN = "https://slotzy-staging-api.onrender.com";
const EXECUTION_FLAG = "SLOTZY_RUN_STAGING_SHARED_LIMITER_VERIFICATION";
const DASHBOARD_CONFIRMATION = "SLOTZY_RENDER_SHARED_LIMITER_ENABLED_CONFIRMATION";
const MAX_REQUESTS_PER_EXECUTION = 31;
const INVALID_LOGIN_BODY = Object.freeze({ error: "invalid credentials" });
const RATE_LIMIT_BODY = Object.freeze({
  error: "Sign-in is temporarily limited. Please try again later.",
  code: "auth_temporarily_limited",
});

function isApprovedStagingOrigin(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.origin === APPROVED_STAGING_API_ORIGIN && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function requireExecutionGuards(environment) {
  if (environment[EXECUTION_FLAG] !== "true") {
    throw new Error(`refusing execution: set ${EXECUTION_FLAG}=true locally`);
  }
  if (environment[DASHBOARD_CONFIRMATION] !== "enabled") {
    throw new Error(`refusing execution: set ${DASHBOARD_CONFIRMATION}=enabled only after dashboard confirmation`);
  }
  const target = environment.SLOTZY_STAGING_API_ORIGIN ?? APPROVED_STAGING_API_ORIGIN;
  if (!isApprovedStagingOrigin(target)) {
    throw new Error("refusing execution: target is not the approved staging API origin");
  }
  return target;
}

function loginPolicy(policySet) {
  const policy = policySet?.[RATE_LIMIT_CATEGORIES.AUTH_LOGIN]?.account;
  if (!Number.isInteger(policy?.limit) || policy.limit < 1 || !Number.isFinite(policy?.windowMs) || policy.windowMs < 1) {
    throw new Error("refusing execution: login rate-limit policy is invalid");
  }
  return policy;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function hasExactEnvelope(body, expected) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const actualKeys = Object.keys(body).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index] && body[key] === expected[key]);
}

// The caller must explicitly set both guards. This script makes only invalid
// synthetic login attempts; it does not read/write customer, booking, or KV data.
export async function verifyStagingSharedLoginLimiter({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  policies = getRateLimitPolicies(),
  randomId = randomUUID,
} = {}) {
  const target = requireExecutionGuards(environment);
  const policy = loginPolicy(policies);
  const maximumRequests = policy.limit + 1;
  if (maximumRequests > MAX_REQUESTS_PER_EXECUTION) {
    throw new Error(`refusing execution: login policy needs ${maximumRequests} requests, above the approved maximum of ${MAX_REQUESTS_PER_EXECUTION}`);
  }
  if (typeof fetchImpl !== "function") throw new Error("refusing execution: fetch is unavailable");

  const syntheticId = `synthetic-limiter-${String(randomId()).replace(/[^a-z0-9]/gi, "").slice(0, 20).toLowerCase()}`;
  const requestBody = JSON.stringify({
    username: syntheticId,
    password: "synthetic-invalid-credential",
  });

  for (let attempt = 1; attempt <= maximumRequests; attempt += 1) {
    const response = await fetchImpl(`${target}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
    });
    const body = await parseJson(response);
    if (response.status === 503) {
      throw new Error("shared limiter provider is unavailable; stop without retrying");
    }
    if (response.status === 429) {
      const retryAfter = response.headers?.get("retry-after") ?? "";
      if (attempt !== maximumRequests) {
        throw new Error("rate limit arrived before the policy threshold; stop without retrying");
      }
      if (!/^\d+$/.test(retryAfter) || Number(retryAfter) < 1 || !hasExactEnvelope(body, RATE_LIMIT_BODY)) {
        throw new Error("unexpected rate-limit response; stop without retrying");
      }
      return { outcome: "rate_limited", attempts: attempt, maximumRequests, windowMs: policy.windowMs };
    }
    if (response.status !== 401 || !hasExactEnvelope(body, INVALID_LOGIN_BODY)) {
      throw new Error("unexpected login response; stop without retrying");
    }
  }
  throw new Error("expected rate-limit response was not received; stop without retrying");
}

async function main() {
  const result = await verifyStagingSharedLoginLimiter();
  // Intentionally bounded, aggregate-only output: no request IDs or credentials.
  console.log(`shared login limiter verification passed: ${result.attempts}/${result.maximumRequests} synthetic invalid attempts; windowMs=${result.windowMs}`);
  console.log("This proves one API path only; it does not prove multi-instance shared-counter consistency.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
