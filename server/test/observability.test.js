import test from "node:test";
import assert from "node:assert/strict";
import { attachRequestContext, buildSafeEvent, createRequestId, emitSafeEvent } from "../src/observability.js";

const sensitiveValues = [
  "password=super-secret", "hash$2b$private", "eyJhbGciOiJIUzI1NiJ9.token", "jti-private",
  "reset-token-private", "manage-token-private", "https://private.example/#token=secret",
  "service-role-secret", "customer@example.test", "+15551234567",
];

test("observability events are allowlisted and redact sensitive-looking input", () => {
  const event = buildSafeEvent({
    event: "booking.create", environment: "staging", service: "slotzy-api", storageMode: "postgres",
    requestId: "safe-request-123", route: "/api/bookings", method: "POST", status: 201,
    outcome: "persisted", password: sensitiveValues[0], token: sensitiveValues[2],
    manageLink: sensitiveValues[5], email: sensitiveValues[7], phone: sensitiveValues[8], body: { password: "nope" },
  });
  const serialized = JSON.stringify(event);
  assert.deepEqual(Object.keys(event).sort(), ["environment", "event", "method", "outcome", "requestId", "route", "service", "status", "storageMode"].sort());
  for (const value of sensitiveValues) assert.equal(serialized.includes(value), false);
});

test("request IDs accept only bounded safe values and middleware returns one", () => {
  assert.equal(createRequestId("safe.request_id-123"), "safe.request_id-123");
  assert.match(createRequestId("x\nprivate-token"), /^[0-9a-f-]{36}$/);
  let finish;
  const headers = {};
  const req = { get: () => "unsafe value with spaces", method: "GET", route: { path: "/api/health" } };
  const res = { statusCode: 200, setHeader: (key, value) => { headers[key] = value; }, on: (_event, callback) => { finish = callback; } };
  attachRequestContext({ environment: "staging", service: "slotzy-api", storageMode: "postgres" })(req, res, () => {});
  assert.match(req.observability.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(headers["X-Request-ID"], req.observability.requestId);
  finish();
});

test("health and mutation events retain safe outcome context without secrets", () => {
  const lines = [];
  emitSafeEvent({ event: "api.health_checked", environment: "staging", service: "slotzy-api", storageMode: "postgres", requestId: "health-check-123", route: "/api/health", method: "GET", status: 200, dependencyStatus: "available", authorization: "Bearer private", supabaseKey: "secret" }, (line) => lines.push(line));
  emitSafeEvent({ event: "booking.cancel", environment: "staging", service: "slotzy-api", storageMode: "postgres", requestId: "booking-cancel-123", route: "/api/public/manage/cancel", method: "PATCH", status: 200, outcome: "persisted", password: "private", manageToken: "private", clientContact: "customer@example.test" }, (line) => lines.push(line));
  emitSafeEvent({ event: "abuse.rate_limited", environment: "staging", service: "slotzy-api", storageMode: "postgres", requestId: "rate-limit-123", route: "/api/auth/login", method: "POST", status: 429, category: "login", outcome: "rate_limited", errorCode: "auth_temporarily_limited", keyType: "account", rawIp: "127.0.0.1", password: "private" }, (line) => lines.push(line));
  assert.equal(lines.length, 3);
  assert.match(lines[1], /"outcome":"persisted"/);
  assert.match(lines[1], /"requestId":"booking-cancel-123"/);
  assert.doesNotMatch(lines.join("\n"), /Bearer private|customer@example\.test|manageToken|password|supabaseKey/);
  assert.match(lines[2], /"category":"login"/);
  assert.match(lines[2], /"keyType":"account"/);
  assert.doesNotMatch(lines[2], /127\.0\.0\.1|rawIp/);
});
