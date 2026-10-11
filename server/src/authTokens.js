import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export const STAFF_JWT_ISSUER = "slotzy-api";
export const STAFF_JWT_AUDIENCE = "slotzy-staff";
export const STAFF_JWT_EXPIRY = "7d";

function normalizedId(value) {
  return String(value ?? "").trim();
}

function normalizedAuthVersion(value) {
  const version = Number(value);
  return Number.isInteger(version) && version >= 1 ? version : 1;
}

export function issueStaffToken(user, secret) {
  const userId = normalizedId(user?.id);
  if (!userId) throw new Error("Cannot issue a staff token without a user id");
  return jwt.sign(
    {
      ver: normalizedAuthVersion(user?.authVersion),
      role: String(user?.role ?? "").trim().toLowerCase(),
    },
    secret,
    {
      subject: userId,
      jwtid: randomUUID(),
      issuer: STAFF_JWT_ISSUER,
      audience: STAFF_JWT_AUDIENCE,
      expiresIn: STAFF_JWT_EXPIRY,
    }
  );
}

export function verifyStaffToken(token, secret) {
  const payload = jwt.verify(token, secret, {
    issuer: STAFF_JWT_ISSUER,
    audience: STAFF_JWT_AUDIENCE,
  });
  const userId = normalizedId(payload?.sub);
  const authVersion = Number(payload?.ver);
  const issuedAt = Number(payload?.iat);
  if (!userId || !Number.isInteger(authVersion) || authVersion < 1 || !Number.isInteger(issuedAt) || issuedAt <= 0) {
    throw new Error("Invalid staff token claims");
  }
  return { userId, authVersion, issuedAt };
}

export function isCurrentStaffSession(session, user) {
  if (!session || !user || user.isActive === false) return false;
  if (normalizedAuthVersion(user.authVersion) !== session.authVersion) return false;
  const invalidAfter = Date.parse(String(user.authInvalidAfter ?? ""));
  // JWT iat has second precision. auth_version handles same-second revocation;
  // compare the optional timestamp at that same precision so a newly issued
  // token is not rejected merely because the database stored milliseconds.
  return !Number.isFinite(invalidAfter) || session.issuedAt >= Math.floor(invalidAfter / 1000);
}
