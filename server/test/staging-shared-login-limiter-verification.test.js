import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_STAGING_API_ORIGIN, verifyStagingSharedLoginLimiter } from "../scripts/verify-staging-shared-login-limiter.js";

const enabledEnvironment = {
  SLOTZY_RUN_STAGING_SHARED_LIMITER_VERIFICATION: "true",
  SLOTZY_RENDER_SHARED_LIMITER_ENABLED_CONFIRMATION: "enabled",
};
const approvedPolicies = { login: { account: { limit: 30, windowMs: 15 * 60_000 } } };
const response = (status, body, retryAfter = null) => ({
  status,
  json: async () => body,
  headers: { get: (name) => name === "retry-after" ? retryAfter : null },
});

test("staging verifier refuses a missing execution guard before fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error("must not fetch"); };
  await assert.rejects(() => verifyStagingSharedLoginLimiter({ environment: {}, fetchImpl, policies: approvedPolicies }), /SLOTZY_RUN_STAGING_SHARED_LIMITER_VERIFICATION/);
  await assert.rejects(() => verifyStagingSharedLoginLimiter({ environment: { SLOTZY_RUN_STAGING_SHARED_LIMITER_VERIFICATION: "true" }, fetchImpl, policies: approvedPolicies }), /SLOTZY_RENDER_SHARED_LIMITER_ENABLED_CONFIRMATION/);
  assert.equal(calls, 0);
});

test("staging verifier refuses production and unexpected origins before fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error("must not fetch"); };
  for (const origin of ["https://slotzy.com", "https://api.example.test", "https://slotzy-staging-api.onrender.com.evil.test"]) {
    await assert.rejects(() => verifyStagingSharedLoginLimiter({ environment: { ...enabledEnvironment, SLOTZY_STAGING_API_ORIGIN: origin }, fetchImpl, policies: approvedPolicies }), /approved staging API origin/);
  }
  assert.equal(calls, 0);
});

test("staging verifier refuses a policy requiring more than exactly 31 requests", async () => {
  let calls = 0;
  await assert.rejects(() => verifyStagingSharedLoginLimiter({
    environment: enabledEnvironment,
    fetchImpl: async () => { calls += 1; },
    policies: { login: { account: { limit: 31, windowMs: 1 } } },
  }), /needs 32 requests, above the approved maximum of 31/);
  assert.equal(calls, 0);
});

test("staging verifier makes exactly 30 failed logins then accepts the exact request-31 limit response", async () => {
  const calls = [];
  let generatedIdentifiers = 0;
  const result = await verifyStagingSharedLoginLimiter({
    environment: enabledEnvironment,
    randomId: () => { generatedIdentifiers += 1; return "unique-local-synthetic-id"; },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length < 31
        ? response(401, { error: "invalid credentials" })
        : response(429, { error: "Sign-in is temporarily limited. Please try again later.", code: "auth_temporarily_limited" }, "60");
    },
  });
  assert.deepEqual(result, { outcome: "rate_limited", attempts: 31, maximumRequests: 31, windowMs: 15 * 60_000 });
  assert.equal(calls.length, 31);
  assert.equal(generatedIdentifiers, 1);
  assert.ok(calls.every(({ url, options }) => url === `${APPROVED_STAGING_API_ORIGIN}/api/auth/login` && options.method === "POST"));
  assert.equal(new Set(calls.map(({ options }) => options.body)).size, 1);
  assert.doesNotMatch(JSON.stringify(result), /unique-local-synthetic-id|synthetic-invalid-credential/);
});

test("staging verifier rejects an early 429 without another request", async () => {
  let calls = 0;
  await assert.rejects(() => verifyStagingSharedLoginLimiter({
    environment: enabledEnvironment,
    policies: approvedPolicies,
    fetchImpl: async () => {
      calls += 1;
      return response(429, { error: "Sign-in is temporarily limited. Please try again later.", code: "auth_temporarily_limited" }, "60");
    },
  }), /before the policy threshold/);
  assert.equal(calls, 1);
});

test("staging verifier rejects provider 503 without retrying or unsafe output", async () => {
  let calls = 0;
  const unsafeIdentifier = "must-not-appear-in-output";
  await assert.rejects(() => verifyStagingSharedLoginLimiter({
    environment: enabledEnvironment,
    policies: approvedPolicies,
    randomId: () => unsafeIdentifier,
    fetchImpl: async () => {
      calls += 1;
      return response(503, { error: "This action is temporarily unavailable. Please try again later.", code: "limiter_temporarily_unavailable" });
    },
  }), (error) => !error.message.includes(unsafeIdentifier) && /provider is unavailable/.test(error.message));
  assert.equal(calls, 1);
});

test("staging verifier rejects missing or malformed request-31 Retry-After without retrying", async () => {
  for (const retryAfter of [null, "not-a-number", "0"]) {
    let calls = 0;
    await assert.rejects(() => verifyStagingSharedLoginLimiter({
      environment: enabledEnvironment,
      policies: approvedPolicies,
      fetchImpl: async () => {
        calls += 1;
        return calls < 31
          ? response(401, { error: "invalid credentials" })
          : response(429, { error: "Sign-in is temporarily limited. Please try again later.", code: "auth_temporarily_limited" }, retryAfter);
      },
    }), /unexpected rate-limit response/);
    assert.equal(calls, 31);
  }
});

test("staging verifier rejects an unexpected status or response envelope without retrying", async () => {
  for (const mockedResponse of [
    response(401, { error: "invalid credentials", extra: "unexpected" }),
    response(200, {}),
  ]) {
    let calls = 0;
    await assert.rejects(() => verifyStagingSharedLoginLimiter({
      environment: enabledEnvironment,
      policies: approvedPolicies,
      fetchImpl: async () => { calls += 1; return mockedResponse; },
    }), /unexpected login response/);
    assert.equal(calls, 1);
  }
});
