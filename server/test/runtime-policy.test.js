import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areDevelopmentEndpointsEnabled,
  isProductionLikeEnvironment,
  normalizeRuntimeEnvironment,
} from "../src/runtimePolicy.js";
import jwt from "jsonwebtoken";
import { isCurrentStaffSession, issueStaffToken, verifyStaffToken, STAFF_JWT_AUDIENCE, STAFF_JWT_ISSUER } from "../src/authTokens.js";

test("development endpoints are available only in local development and test", () => {
  assert.equal(areDevelopmentEndpointsEnabled("development"), true);
  assert.equal(areDevelopmentEndpointsEnabled("test"), true);
  assert.equal(areDevelopmentEndpointsEnabled("staging"), false);
  assert.equal(areDevelopmentEndpointsEnabled("production"), false);
});

test("staging and production are production-like runtimes", () => {
  assert.equal(isProductionLikeEnvironment("staging"), true);
  assert.equal(isProductionLikeEnvironment("production"), true);
  assert.equal(isProductionLikeEnvironment("development"), false);
  assert.equal(normalizeRuntimeEnvironment("  STAGING  "), "staging");
});

test("staff tokens carry durable revocation claims and reject legacy claims", () => {
  const secret = "test-secret-only";
  const token = issueStaffToken({ id: "user_123", role: "owner", authVersion: 2 }, secret);
  const payload = jwt.verify(token, secret, { issuer: STAFF_JWT_ISSUER, audience: STAFF_JWT_AUDIENCE });
  assert.equal(payload.sub, "user_123");
  assert.equal(payload.ver, 2);
  assert.equal(typeof payload.jti, "string");
  const session = verifyStaffToken(token, secret);
  assert.equal(isCurrentStaffSession(session, { id: "user_123", isActive: true, authVersion: 2, authInvalidAfter: "" }), true);
  assert.equal(isCurrentStaffSession(session, { id: "user_123", isActive: true, authVersion: 3, authInvalidAfter: "" }), false);
  const legacy = jwt.sign({ username: "owner", role: "owner" }, secret, { expiresIn: "1h" });
  assert.throws(() => verifyStaffToken(legacy, secret));
});
