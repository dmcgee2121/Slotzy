import { randomUUID } from "crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const EVENT_FIELDS = new Set([
  "event", "environment", "service", "storageMode", "requestId", "route", "method",
  "status", "errorCode", "errorClass", "durationMs", "durationBucket", "release",
  "outcome", "operation", "dependencyStatus", "notificationMode",
  "category", "keyType",
]);

function safeText(value, max = 120) {
  const text = String(value ?? "").trim();
  return text.slice(0, max);
}

function safeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

function safeRoute(value) {
  const route = safeText(value, 160);
  return /^\/api(?:\/[A-Za-z0-9:_-]+)*$/.test(route) ? route : undefined;
}

function safeMethod(value) {
  const method = safeText(value, 10).toUpperCase();
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method) ? method : undefined;
}

function safeEnum(value, pattern, max = 80) {
  const text = safeText(value, max);
  return pattern.test(text) ? text : undefined;
}

function durationBucket(durationMs) {
  if (durationMs < 100) return "under_100ms";
  if (durationMs < 500) return "under_500ms";
  if (durationMs < 2000) return "under_2s";
  return "over_2s";
}

export function createRequestId(value) {
  const candidate = safeText(value, 128);
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function buildSafeEvent(input = {}) {
  const event = {
    event: safeEnum(input.event, /^[a-z][a-z0-9_.-]{2,79}$/),
    environment: safeEnum(input.environment, /^[a-z][a-z0-9_-]{0,31}$/),
    service: safeEnum(input.service, /^[a-z][a-z0-9_-]{0,63}$/),
    storageMode: safeEnum(input.storageMode, /^[a-z][a-z0-9_-]{0,31}$/),
    requestId: createRequestId(input.requestId),
  };
  const values = {
    route: safeRoute(input.route), method: safeMethod(input.method), status: safeInteger(input.status),
    errorCode: safeEnum(input.errorCode, /^[a-z][a-z0-9_.-]{0,79}$/),
    errorClass: safeEnum(input.errorClass, /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/),
    durationMs: safeInteger(input.durationMs), release: safeEnum(input.release, /^[A-Za-z0-9_.-]{1,80}$/),
    outcome: safeEnum(input.outcome, /^[a-z][a-z0-9_.-]{0,79}$/),
    operation: safeEnum(input.operation, /^[a-z][a-z0-9_.-]{0,79}$/),
    dependencyStatus: safeEnum(input.dependencyStatus, /^[a-z][a-z0-9_.-]{0,79}$/),
    notificationMode: safeEnum(input.notificationMode, /^[a-z][a-z0-9_.-]{0,31}$/),
    category: safeEnum(input.category, /^[a-z][a-z0-9_.-]{0,79}$/),
    keyType: safeEnum(input.keyType, /^(account|coarse_source|shop|manage|contact)$/),
  };
  if (values.durationMs !== undefined) values.durationBucket = durationBucket(values.durationMs);
  for (const [key, value] of Object.entries(values)) {
    if (EVENT_FIELDS.has(key) && value !== undefined) event[key] = value;
  }
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

export function emitSafeEvent(input, write = console.info) {
  const event = buildSafeEvent(input);
  write(JSON.stringify(event));
  return event;
}

export function attachRequestContext({ environment, service, storageMode, release } = {}) {
  return (req, res, next) => {
    const startedAt = Date.now();
    req.observability = { requestId: createRequestId(req.get("X-Request-ID")), startedAt };
    res.setHeader("X-Request-ID", req.observability.requestId);
    res.on("finish", () => {
      if (res.statusCode < 500) return;
      emitSafeEvent({
        event: "api.request_failed", environment, service, storageMode, release,
        requestId: req.observability.requestId, route: req.route?.path, method: req.method,
        status: res.statusCode, errorClass: "Http5xx", durationMs: Date.now() - startedAt,
      });
    });
    next();
  };
}
