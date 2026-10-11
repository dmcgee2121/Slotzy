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

test("registration and login tokens use the persisted user identity accepted by protected routes", () => {
  const secret = "test-secret-only";
  // PostgreSQL snapshot storage may map a registration source ID to a canonical
  // users.id. Both registration and login must sign the persisted ID.
  const persistedUser = { id: "canonical-user-id", role: "owner", authVersion: 1, isActive: true, authInvalidAfter: "" };
  const registrationToken = issueStaffToken(persistedUser, secret);
  const loginToken = issueStaffToken(persistedUser, secret);

  for (const token of [registrationToken, loginToken]) {
    const session = verifyStaffToken(token, secret);
    assert.equal(session.userId, persistedUser.id);
    assert.equal(isCurrentStaffSession(session, persistedUser), true);
  }
});

test("staff tokens reject wrong issuer or audience and invalidated sessions", () => {
  const secret = "test-secret-only";
  const user = { id: "user_456", role: "owner", authVersion: 1, isActive: true, authInvalidAfter: "" };
  const valid = issueStaffToken(user, secret);
  const session = verifyStaffToken(valid, secret);
  assert.equal(isCurrentStaffSession(session, { ...user, authVersion: 2 }), false);
  assert.equal(isCurrentStaffSession({ ...session, issuedAt: 1 }, { ...user, authInvalidAfter: new Date(10_000).toISOString() }), false);

  const wrongIssuer = jwt.sign({ ver: 1 }, secret, {
    subject: user.id,
    issuer: "other-api",
    audience: STAFF_JWT_AUDIENCE,
    expiresIn: "1h",
  });
  const wrongAudience = jwt.sign({ ver: 1 }, secret, {
    subject: user.id,
    issuer: STAFF_JWT_ISSUER,
    audience: "other-audience",
    expiresIn: "1h",
  });
  assert.throws(() => verifyStaffToken(wrongIssuer, secret));
  assert.throws(() => verifyStaffToken(wrongAudience, secret));
});
