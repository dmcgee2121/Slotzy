import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { lookup } from "node:dns/promises";
import { flattenSafeNetworkDiagnostic } from "./storage/postgresStore.js";
import { STORAGE_ADAPTER, cancelBookingByManageTokenHash, listBookingsForAuthenticatedUser, listServicesForAuthenticatedUser, listShopsForAuthenticatedUser, readAvailabilityForAuthenticatedUser, readLoginCredentialByUsername, readPublicBookingStore, readStore, readUserByUsername, storeManageToken, updateBookingStatus, writeAvailability, writeBooking, writeService, writeShop, writeStore, writeUser } from "./storage/index.js";
import { clearEmails, getEmailMode, getRecentEmails, sendEmail } from "./emailService.js";
import { buildPublicManageCancelHttpResult } from "./publicManageCancel.js";
import { areDevelopmentEndpointsEnabled, isProductionLikeEnvironment, normalizeRuntimeEnvironment } from "./runtimePolicy.js";
import { isBookingAllowedByAvailability } from "./schedulePolicy.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const RUNTIME_ENVIRONMENT = normalizeRuntimeEnvironment(process.env.NODE_ENV);
const IS_PRODUCTION_LIKE = isProductionLikeEnvironment(RUNTIME_ENVIRONMENT);
const DEV_JWT_FALLBACK = "dev-secret-change-me";
const JWT_SECRET = resolveJwtSecret();

const ROLE_OWNER = "owner";
const ROLE_BARBER = "barber";
const ROLE_CUSTOMER = "customer";
const ALLOWED_ROLES = new Set([ROLE_OWNER, ROLE_BARBER, ROLE_CUSTOMER]);
const BOOKING_STATUSES = new Set(["booked", "confirmed", "completed", "cancelled", "no-show"]);
const DEPOSIT_STATUSES = new Set(["not_required", "unpaid", "paid", "refunded"]);
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const BUFFER_OPTIONS = new Set([0, 5, 10, 15]);

const DEFAULT_BOOKING_POLICY = {
  allowSameDay: true,
  maxDaysAdvance: 30,
  cancelHours: 24,
  bufferMinutes: 0,
  requireDeposit: false,
  depositAmount: 0,
  lateGraceMinutes: 10,
  noShowStrikeLimit: 2,
  reminder24Hours: true,
  reminder2Hours: true,
  reminderCustomEnabled: false,
  reminderCustomMinutes: 60,
};

const DEFAULT_AVAILABILITY = {
  timezone: "America/Chicago",
  bufferMinutes: 0,
  weekly: {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: true, start: "09:00", end: "17:00" },
    sun: { enabled: false, start: "09:00", end: "17:00" },
  },
  timeOff: [],
  recurringBlocks: [],
};

const EMPTY_DB = {
  users: [],
  shops: [],
  services: [],
  availability: {},
  bookings: [],
  emails: [],
};

// Opaque manage credentials are deliberately separate from confirmation codes.
// Only this hash is persisted; the raw token exists only in the create response.
function createManageToken() {
  return randomBytes(32).toString("base64url");
}

const MANAGE_RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const MANAGE_RECOVERY_MAX_REQUESTS = 5;
const manageRecoveryAttempts = new Map();

function normalizeRecoveryContact(value) {
  return normalizeUsername(value).toLowerCase().replace(/[\s().-]/g, "");
}

function isRecoveryRequestAllowed(contact) {
  const now = Date.now();
  const key = hashManageToken(normalizeRecoveryContact(contact));
  const attempts = (manageRecoveryAttempts.get(key) ?? []).filter((time) => now - time < MANAGE_RECOVERY_WINDOW_MS);
  if (attempts.length >= MANAGE_RECOVERY_MAX_REQUESTS) {
    manageRecoveryAttempts.set(key, attempts);
    return false;
  }
  attempts.push(now);
  manageRecoveryAttempts.set(key, attempts);
  return true;
}

function getManageLinkOrigin(req) {
  const configured = normalizeUsername(process.env.SLOTZY_APP_ORIGIN);
  if (configured) return configured.replace(/\/$/, "");
  if (!IS_PRODUCTION_LIKE) return normalizeUsername(req.get("origin")).replace(/\/$/, "");
  return "";
}

function buildManageLinkForRecovery(req, token) {
  const origin = getManageLinkOrigin(req);
  if (!origin || !token) return "";
  return `${origin}/pages/manage.html#token=${encodeURIComponent(token)}`;
}

function hashManageToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

function hasManageToken(booking, token) {
  const expected = String(booking?.manageTokenHash ?? "").trim();
  const actual = hashManageToken(token);
  if (!expected || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function publicManageBooking(booking) {
  if (!booking) return null;
  const { manageTokenHash, ...safeBooking } = booking;
  return safeBooking;
}

function resolveJwtSecret() {
  const configuredSecret = String(process.env.JWT_SECRET || "").trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (IS_PRODUCTION_LIKE) {
    throw new Error(
      "Missing JWT_SECRET. Refusing to start in staging or production without an explicit JWT secret."
    );
  }

  console.warn(
    "[Slotzy:auth] JWT_SECRET is not set. Using the development fallback secret; set JWT_SECRET before any pilot or production deployment."
  );
  return DEV_JWT_FALLBACK;
}

function getCorsOptions() {
  const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!IS_PRODUCTION_LIKE) return { origin: true };
  if (!allowedOrigins.length) throw new Error("Missing CORS_ALLOWED_ORIGINS. Refusing to start staging or production with permissive CORS.");
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin is not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Slotzy-Manage-Token"],
  };
}

async function logStagingSupabaseDnsProbe() {
  if (RUNTIME_ENVIRONMENT !== "staging" || STORAGE_ADAPTER !== "postgres") return;
  let hostname = "";
  try {
    hostname = new URL(String(process.env.SUPABASE_URL ?? "")).hostname;
  } catch {
    console.warn("[Slotzy:storage] staging Supabase DNS probe skipped: SUPABASE_URL has no valid hostname");
    return;
  }
  if (!hostname) {
    console.warn("[Slotzy:storage] staging Supabase DNS probe skipped: SUPABASE_URL has no hostname");
    return;
  }
  try {
    await lookup(hostname);
  } catch (error) {
    console.warn("[Slotzy:storage] staging Supabase DNS probe failed", {
      hostname,
      ...flattenSafeNetworkDiagnostic(error),
    });
  }
}

// Shop branding is stored as image data URLs during the pilot. Two allowed
// 5 MiB source images expand when encoded as JSON, so the request ceiling
// must accommodate the documented client limit without rejecting a valid
// owner profile save.
app.use(express.json({ limit: "15mb" }));
app.use(cors(getCorsOptions()));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "slotzy-api", storage: STORAGE_ADAPTER, environment: RUNTIME_ENVIRONMENT });
});

app.get("/api/admin/status", (_req, res) => {
  return res.json({
    enabled: isAdminEnabled(),
  });
});

app.post("/api/admin/login", (req, res) => {
  if (!isAdminEnabled()) {
    return res.status(503).json({ error: "admin disabled" });
  }

  const secret = String(req.body?.secret ?? "");
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "invalid admin secret" });
  }

  return res.json({
    token: signAdminToken(),
    enabled: true,
  });
});

app.get("/api/dev/emails", async (_req, res) => {
  if (!areDevelopmentEndpointsEnabled(RUNTIME_ENVIRONMENT)) return res.status(404).json({ error: "not found" });
  try {
    const emails = await getRecentEmails(50);
    return res.json({
      mode: getEmailMode(),
      emails,
    });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.delete("/api/dev/emails", async (_req, res) => {
  if (!areDevelopmentEndpointsEnabled(RUNTIME_ENVIRONMENT)) return res.status(404).json({ error: "not found" });
  try {
    const result = await clearEmails();
    return res.json({
      ok: true,
      mode: getEmailMode(),
      ...result,
    });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/notify/booking", async (req, res) => {
  if (!areDevelopmentEndpointsEnabled(RUNTIME_ENVIRONMENT)) return res.status(404).json({ error: "not found" });
  return handleBookingNotifyRequest(req, res, "booking_created");
});

app.post("/api/notify/cancel", async (req, res) => {
  if (!areDevelopmentEndpointsEnabled(RUNTIME_ENVIRONMENT)) return res.status(404).json({ error: "not found" });
  return handleBookingNotifyRequest(req, res, "booking_cancelled");
});

app.post("/api/notify/reschedule", async (req, res) => {
  if (!areDevelopmentEndpointsEnabled(RUNTIME_ENVIRONMENT)) return res.status(404).json({ error: "not found" });
  return handleBookingNotifyRequest(req, res, "booking_rescheduled");
});

function normalizeRole(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (ALLOWED_ROLES.has(normalized)) return normalized;
  return ROLE_CUSTOMER;
}

function normalizeUsername(value) {
  return String(value ?? "").trim();
}

function usernamesEqual(left, right) {
  return normalizeUsername(left).toLowerCase() === normalizeUsername(right).toLowerCase();
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization ?? "");
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

function buildAuthUser(user) {
  const username = normalizeUsername(user?.username);
  return {
    username,
    role: normalizeRole(user?.role),
    shopId: normalizeUsername(user?.shopId) || null,
    displayName: normalizeUsername(user?.displayName) || username,
  };
}

function signToken(user) {
  return jwt.sign(
    { username: normalizeUsername(user.username), role: normalizeRole(user.role) },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function signAdminToken() {
  return jwt.sign(
    { scope: "admin" },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function isAdminEnabled() {
  return Boolean(ADMIN_SECRET);
}

function isOwner(user) {
  return normalizeRole(user?.role) === ROLE_OWNER;
}

function isBarber(user) {
  return normalizeRole(user?.role) === ROLE_BARBER;
}

function isCustomer(user) {
  return normalizeRole(user?.role) === ROLE_CUSTOMER;
}

function isProviderRole(role) {
  const normalized = normalizeRole(role);
  return normalized === ROLE_OWNER || normalized === ROLE_BARBER;
}

function createSlug(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `shop-${Date.now()}`;
}

function isSyntheticE2eShop(shop) {
  const names = [shop?.name, shop?.businessName]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (names.some((value) => /^e2e\s/i.test(value) || /e2e-/i.test(value))) return true;

  const identifiers = [shop?.slug, shop?.id]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return identifiers.some((value) => /(^|[-_])e2e(?:[-_]|$)/i.test(value));
}

function normalizePrice(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return Number(fallback.toFixed(2));
  const normalized = Math.max(0, raw);
  return Number(normalized.toFixed(2));
}

function normalizeDuration(value, fallback = 30) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return Math.max(1, Math.round(fallback));
  return Math.max(1, Math.round(raw));
}

function normalizeBookingStatus(statusValue) {
  const normalized = String(statusValue ?? "booked").trim().toLowerCase();
  if (normalized === "no_show" || normalized === "noshow") return "no-show";
  if (BOOKING_STATUSES.has(normalized)) return normalized;
  return "booked";
}

function boolOrDefault(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function intOrDefault(value, fallback, min = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.round(raw));
}

function normalizeBookingPolicy(policyValue) {
  const source = policyValue && typeof policyValue === "object" && !Array.isArray(policyValue)
    ? policyValue
    : {};

  return {
    allowSameDay: boolOrDefault(source.allowSameDay, DEFAULT_BOOKING_POLICY.allowSameDay),
    maxDaysAdvance: intOrDefault(source.maxDaysAdvance, DEFAULT_BOOKING_POLICY.maxDaysAdvance, 1),
    cancelHours: intOrDefault(source.cancelHours, DEFAULT_BOOKING_POLICY.cancelHours, 0),
    bufferMinutes: intOrDefault(source.bufferMinutes, DEFAULT_BOOKING_POLICY.bufferMinutes, 0),
    requireDeposit: boolOrDefault(source.requireDeposit, DEFAULT_BOOKING_POLICY.requireDeposit),
    depositAmount: normalizePrice(source.depositAmount, DEFAULT_BOOKING_POLICY.depositAmount),
    lateGraceMinutes: intOrDefault(source.lateGraceMinutes, DEFAULT_BOOKING_POLICY.lateGraceMinutes, 0),
    noShowStrikeLimit: intOrDefault(source.noShowStrikeLimit, DEFAULT_BOOKING_POLICY.noShowStrikeLimit, 0),
    reminder24Hours: boolOrDefault(source.reminder24Hours, DEFAULT_BOOKING_POLICY.reminder24Hours),
    reminder2Hours: boolOrDefault(source.reminder2Hours, DEFAULT_BOOKING_POLICY.reminder2Hours),
    reminderCustomEnabled: boolOrDefault(source.reminderCustomEnabled, DEFAULT_BOOKING_POLICY.reminderCustomEnabled),
    reminderCustomMinutes: intOrDefault(source.reminderCustomMinutes, DEFAULT_BOOKING_POLICY.reminderCustomMinutes, 5),
  };
}

function normalizeTimeValue(value, fallback) {
  const raw = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function normalizeTimeOffBlock(block) {
  const start = new Date(String(block?.startISO ?? ""));
  const end = new Date(String(block?.endISO ?? ""));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    return null;
  }
  return {
    id: normalizeUsername(block?.id) || `to_${randomUUID()}`,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    note: String(block?.note ?? "").trim(),
  };
}

function createDefaultAvailability() {
  return {
    timezone: DEFAULT_AVAILABILITY.timezone,
    bufferMinutes: DEFAULT_AVAILABILITY.bufferMinutes,
    weekly: DAY_KEYS.reduce((acc, key) => {
      acc[key] = { ...DEFAULT_AVAILABILITY.weekly[key] };
      return acc;
    }, {}),
    timeOff: [],
    recurringBlocks: [],
  };
}

function normalizeRecurringBlock(block) {
  const source = block && typeof block === "object" && !Array.isArray(block) ? block : {};
  const weekday = normalizeUsername(source.weekday).toLowerCase();
  const start = normalizeTimeValue(source.start, "");
  const end = normalizeTimeValue(source.end, "");
  if (!DAY_KEYS.includes(weekday) || !start || !end || start >= end) return null;
  const candidateId = normalizeUsername(source.id);
  return {
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId) ? candidateId : randomUUID(),
    weekday,
    start,
    end,
    label: String(source.label ?? "Unavailable").trim().slice(0, 80) || "Unavailable",
    enabled: boolOrDefault(source.enabled, true),
  };
}

function normalizeAvailabilityEntry(entry) {
  const defaults = createDefaultAvailability();
  const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const weekly = {};

  DAY_KEYS.forEach((day) => {
    const fallback = defaults.weekly[day];
    const daySource = source?.weekly?.[day] || {};
    weekly[day] = {
      enabled: boolOrDefault(daySource.enabled, fallback.enabled),
      start: normalizeTimeValue(daySource.start, fallback.start),
      end: normalizeTimeValue(daySource.end, fallback.end),
    };
  });

  const bufferMinutesRaw = Number(source.bufferMinutes ?? defaults.bufferMinutes);
  const bufferMinutes = BUFFER_OPTIONS.has(bufferMinutesRaw) ? bufferMinutesRaw : defaults.bufferMinutes;
  const timezone = String(source.timezone ?? defaults.timezone).trim() || defaults.timezone;
  const timeOff = Array.isArray(source.timeOff)
    ? source.timeOff.map(normalizeTimeOffBlock).filter(Boolean)
    : [];
  const recurringBlocks = Array.isArray(source.recurringBlocks)
    ? source.recurringBlocks.map(normalizeRecurringBlock).filter(Boolean)
    : [];

  return {
    timezone,
    bufferMinutes,
    weekly,
    timeOff,
    recurringBlocks,
  };
}


function normalizeDepositFields(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const depositRequired = Boolean(source.depositRequired);
  const depositAmount = depositRequired ? normalizePrice(source.depositAmount, 0) : 0;
  const candidate = String(
    source.depositStatus ?? (depositRequired ? "unpaid" : "not_required")
  ).trim().toLowerCase();
  const depositStatus = DEPOSIT_STATUSES.has(candidate)
    ? candidate
    : (depositRequired ? "unpaid" : "not_required");

  return {
    depositRequired,
    depositAmount,
    depositStatus: depositRequired ? depositStatus : "not_required",
  };
}

function findUserByUsername(db, username) {
  const key = normalizeUsername(username).toLowerCase();
  if (!key) return null;
  return db.users.find((user) => normalizeUsername(user?.username).toLowerCase() === key) || null;
}

function getUserShopId(db, user) {
  const direct = normalizeUsername(user?.shopId);
  if (direct) return direct;

  const ownedShop = db.shops.find((shop) => usernamesEqual(shop?.ownerUsername, user?.username));
  return ownedShop ? normalizeUsername(ownedShop.id) : "";
}

function getUserShopIdByUsername(db, username) {
  const user = findUserByUsername(db, username);
  if (!user) return "";
  return getUserShopId(db, user);
}

function userBelongsToShop(db, username, shopId) {
  const normalizedShopId = normalizeUsername(shopId);
  if (!normalizedShopId) return false;
  return getUserShopIdByUsername(db, username) === normalizedShopId;
}

function isUserManageableByOwner(db, ownerUser, targetUsername) {
  if (!isOwner(ownerUser)) return false;
  const ownerShopId = getUserShopId(db, ownerUser);
  if (!ownerShopId) return false;
  const target = findUserByUsername(db, targetUsername);
  if (!target) return false;
  if (!userBelongsToShop(db, target.username, ownerShopId)) return false;
  return isProviderRole(target.role);
}

function canOwnerManageShop(db, ownerUser, shopId) {
  if (!isOwner(ownerUser)) return false;
  const ownerShopId = getUserShopId(db, ownerUser);
  return Boolean(ownerShopId && ownerShopId === normalizeUsername(shopId));
}

function canOwnerManageService(db, ownerUser, service) {
  if (!isOwner(ownerUser)) return false;
  const ownerShopId = getUserShopId(db, ownerUser);
  if (!ownerShopId) return false;
  const serviceShopId = normalizeUsername(service?.shopId);
  if (serviceShopId && serviceShopId === ownerShopId) return true;
  const barberUsername = normalizeUsername(service?.barberUsername ?? service?.ownerUsername);
  return userBelongsToShop(db, barberUsername, ownerShopId);
}

function canBarberManageService(user, service) {
  const me = normalizeUsername(user?.username);
  if (!me) return false;
  return usernamesEqual(service?.barberUsername, me) || usernamesEqual(service?.ownerUsername, me);
}

function resolveBookingShopId(db, booking) {
  const direct = normalizeUsername(booking?.shopId);
  if (direct) return direct;
  const barberUsername = normalizeUsername(booking?.barberUsername ?? booking?.ownerUsername);
  if (!db || !Array.isArray(db.users)) return "";
  return getUserShopIdByUsername(db, barberUsername);
}

function canOwnerManageBooking(db, ownerUser, booking) {
  if (!isOwner(ownerUser)) return false;
  const ownerShopId = getUserShopId(db, ownerUser);
  if (!ownerShopId) return false;
  const bookingShopId = resolveBookingShopId(db, booking);
  if (bookingShopId && bookingShopId === ownerShopId) return true;
  const barberUsername = normalizeUsername(booking?.barberUsername ?? booking?.ownerUsername);
  return userBelongsToShop(db, barberUsername, ownerShopId);
}

function canBarberManageBooking(user, booking) {
  const me = normalizeUsername(user?.username);
  if (!me) return false;
  return usernamesEqual(booking?.barberUsername, me) || usernamesEqual(booking?.ownerUsername, me);
}

function canCustomerViewBooking(user, booking) {
  const me = normalizeUsername(user?.username);
  if (!me) return false;
  return usernamesEqual(booking?.customerUsername, me) || usernamesEqual(booking?.clientName, me);
}

function getProviderUsernamesForShop(db, shopId) {
  const normalizedShopId = normalizeUsername(shopId);
  if (!normalizedShopId) return [];

  return db.users
    .filter((user) => isProviderRole(user?.role))
    .filter((user) => getUserShopId(db, user) === normalizedShopId)
    .map((user) => normalizeUsername(user.username))
    .filter(Boolean);
}

function toIsoOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findShopById(db, shopId) {
  const targetShopId = normalizeUsername(shopId);
  if (!targetShopId) return null;
  if (!db || !Array.isArray(db.shops)) return null;
  return db.shops.find((shop) => normalizeUsername(shop?.id) === targetShopId) || null;
}

function getShopForBooking(db, booking) {
  const bookingShopId = resolveBookingShopId(db, booking);
  return findShopById(db, bookingShopId);
}

function getShopNameForBooking(db, booking) {
  return normalizeUsername(booking?.shopName)
    || normalizeUsername(getShopForBooking(db, booking)?.name)
    || "Slotzy Shop";
}

function getProviderDisplayName(db, username) {
  const user = db && Array.isArray(db.users) ? findUserByUsername(db, username) : null;
  return normalizeUsername(user?.displayName) || normalizeUsername(user?.username) || "Barber";
}

function getBookingStartDate(booking) {
  const startIso = toIsoOrNull(booking?.startISO ?? booking?.startAtISO);
  if (startIso) return new Date(startIso);

  const dateText = String(booking?.date ?? "").trim();
  const timeText = String(booking?.time ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) {
    return null;
  }

  const date = new Date(`${dateText}T${timeText}:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getBookingEndDate(booking) {
  const endIso = toIsoOrNull(booking?.endISO);
  if (endIso) return new Date(endIso);

  const start = getBookingStartDate(booking);
  const durationMinutes = normalizeDuration(booking?.durationMinutes ?? booking?.duration, 30);
  if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return null;
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTimeLabel(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoneyLabel(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizePrice(value, 0));
}

function formatBookingSchedule(booking) {
  const start = getBookingStartDate(booking);
  if (!(start instanceof Date) || !Number.isFinite(start.getTime())) {
    return "Time unavailable";
  }

  const end = getBookingEndDate(booking);
  const timeLabel = end instanceof Date && Number.isFinite(end.getTime())
    ? `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`
    : formatTimeLabel(start);

  return `${formatDateLabel(start)} | ${timeLabel}`;
}

function getConfirmationCode(bookingId) {
  const cleaned = String(bookingId ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned ? cleaned.slice(-6) : "N/A";
}

function normalizeEmail(value) {
  const email = normalizeUsername(value);
  return looksLikeEmail(email) ? email : "";
}

function normalizeObjectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveClientEmailTarget(booking) {
  return normalizeEmail(booking?.clientContact);
}

function buildShopNotificationContext(db, booking, shopInput = null) {
  const override = normalizeObjectRecord(shopInput);
  const fallback = normalizeObjectRecord(getShopForBooking(db, booking));
  const source = {
    ...fallback,
    ...override,
  };
  const bookingPolicy = normalizeBookingPolicy(source?.bookingPolicy);
  return {
    id: normalizeUsername(source?.id) || resolveBookingShopId(db, booking) || null,
    name: normalizeUsername(source?.name ?? source?.businessName ?? booking?.shopName) || "Slotzy Shop",
    email: normalizeEmail(source?.shopEmail),
    bookingPolicy,
  };
}

function buildProviderNotificationContext(db, booking, providerInput = null, fallbackUsername = "") {
  const override = normalizeObjectRecord(providerInput);
  const requestedUsername = normalizeUsername(
    override?.username ?? fallbackUsername ?? booking?.barberUsername ?? booking?.ownerUsername
  );
  const user = requestedUsername && db && Array.isArray(db.users)
    ? findUserByUsername(db, requestedUsername)
    : null;
  return {
    username: requestedUsername || normalizeUsername(user?.username),
    displayName: normalizeUsername(
      override?.displayName
      ?? override?.name
      ?? booking?.barberDisplayName
      ?? user?.displayName
      ?? user?.username
    ) || "Barber",
    email: normalizeEmail(override?.email ?? user?.email),
  };
}

function getCancellationPolicyNote(shopContext, explicitNote = "") {
  const provided = normalizeUsername(explicitNote);
  if (provided) return provided;
  const cancelHours = normalizeBookingPolicy(shopContext?.bookingPolicy).cancelHours;
  return `Cancellations must be made at least ${cancelHours} hours before.`;
}

function pushDetailLine(lines, label, value) {
  const normalized = normalizeUsername(value);
  if (!normalized) return;
  lines.push(`${label}: ${normalized}`);
}

function getProviderNotificationRecipients(shopContext, barberContext, ownerContext) {
  const recipients = [
    { kind: "shop", to: normalizeEmail(shopContext?.email) },
    { kind: "barber", to: normalizeEmail(barberContext?.email) },
    { kind: "owner", to: normalizeEmail(ownerContext?.email) },
  ];
  const seen = new Set();
  return recipients.filter((recipient) => {
    const key = normalizeUsername(recipient?.to).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEmailHtml({ headline, greeting, intro, detailLines, closing }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">${escapeHtml(headline)}</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(intro)}</p>
      <ul>
        ${detailLines.filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p>${escapeHtml(closing)}</p>
    </div>
  `;
}

function buildEmailText({ greeting, intro, detailLines, closing }) {
  return [
    greeting,
    "",
    intro,
    "",
    ...detailLines.map((line) => `- ${line}`),
    "",
    closing,
  ].join("\n");
}

function didBookingScheduleChange(current, next) {
  const currentStart = toIsoOrNull(current?.startISO ?? current?.startAtISO);
  const nextStart = toIsoOrNull(next?.startISO ?? next?.startAtISO);
  const currentEnd = toIsoOrNull(current?.endISO);
  const nextEnd = toIsoOrNull(next?.endISO);
  const currentBarber = normalizeUsername(current?.barberUsername ?? current?.ownerUsername);
  const nextBarber = normalizeUsername(next?.barberUsername ?? next?.ownerUsername);
  const currentService = String(current?.serviceName ?? current?.serviceTitle ?? "").trim();
  const nextService = String(next?.serviceName ?? next?.serviceTitle ?? "").trim();

  return currentStart !== nextStart
    || currentEnd !== nextEnd
    || currentBarber !== nextBarber
    || currentService !== nextService;
}

function buildBookingEmailPayloads(
  db,
  { type, booking, previousBooking = null, shop = null, barber = null, owner = null, manageLink = "", cancellationNote = "", source = "" }
) {
  const bookingRecord = normalizeObjectRecord(booking);
  if (Object.keys(bookingRecord).length === 0) return [];
  const previousBookingRecord = normalizeObjectRecord(previousBooking);
  const priorBooking = Object.keys(previousBookingRecord).length > 0 ? previousBookingRecord : null;

  const shopContext = buildShopNotificationContext(db, bookingRecord, shop);
  const barberContext = buildProviderNotificationContext(
    db,
    bookingRecord,
    barber,
    bookingRecord?.barberUsername ?? bookingRecord?.ownerUsername
  );
  const ownerContext = buildProviderNotificationContext(db, bookingRecord, owner, "");
  const shopName = shopContext.name || "Slotzy Shop";
  const barberName = barberContext.displayName || "Barber";
  const serviceName = String(bookingRecord?.serviceName ?? bookingRecord?.serviceTitle ?? "Service").trim() || "Service";
  const clientName = normalizeUsername(bookingRecord?.clientName) || "there";
  const scheduleText = formatBookingSchedule(bookingRecord);
  const previousScheduleText = priorBooking ? formatBookingSchedule(priorBooking) : "";
  const confirmationCode = getConfirmationCode(bookingRecord?.id);
  const priceText = formatMoneyLabel(bookingRecord?.price);
  const durationMinutes = normalizeDuration(bookingRecord?.durationMinutes ?? bookingRecord?.duration, 30);
  const manageLinkText = normalizeUsername(manageLink);
  const cancellationPolicyText = getCancellationPolicyNote(shopContext, cancellationNote);
  const depositText = bookingRecord?.depositRequired
    ? `Deposit: ${formatMoneyLabel(bookingRecord?.depositAmount)} (${String(bookingRecord?.depositStatus ?? "unpaid").trim() || "unpaid"})`
    : "Deposit: not required";

  const clientDetailLines = [
    `Shop: ${shopName}`,
    `Barber: ${barberName}`,
    `Service: ${serviceName}`,
  ];
  const providerDetailLines = [
    `Client: ${clientName}`,
    `Client contact: ${normalizeUsername(bookingRecord?.clientContact) || "Not provided"}`,
    `Shop: ${shopName}`,
    `Barber: ${barberName}`,
    `Service: ${serviceName}`,
  ];

  if (type === "booking_rescheduled") {
    pushDetailLine(clientDetailLines, "Previous time", previousScheduleText);
    pushDetailLine(clientDetailLines, "New time", scheduleText);
    pushDetailLine(providerDetailLines, "Previous time", previousScheduleText);
    pushDetailLine(providerDetailLines, "New time", scheduleText);
  } else if (type === "booking_cancelled") {
    pushDetailLine(clientDetailLines, "Original time", previousScheduleText || scheduleText);
    pushDetailLine(clientDetailLines, "Cancellation policy", cancellationPolicyText);
    pushDetailLine(providerDetailLines, "Original time", previousScheduleText || scheduleText);
    pushDetailLine(providerDetailLines, "Cancellation policy", cancellationPolicyText);
  } else {
    pushDetailLine(clientDetailLines, "Date & time", scheduleText);
    pushDetailLine(providerDetailLines, "Date & time", scheduleText);
  }

  pushDetailLine(clientDetailLines, "Duration", `${durationMinutes} min`);
  pushDetailLine(clientDetailLines, "Price", priceText);
  pushDetailLine(clientDetailLines, "Confirmation", confirmationCode);
  pushDetailLine(clientDetailLines, "Manage link", manageLinkText);
  pushDetailLine(clientDetailLines, "Deposit", depositText.replace(/^Deposit:\s*/i, ""));

  pushDetailLine(providerDetailLines, "Duration", `${durationMinutes} min`);
  pushDetailLine(providerDetailLines, "Price", priceText);
  pushDetailLine(providerDetailLines, "Confirmation", confirmationCode);
  pushDetailLine(providerDetailLines, "Deposit", depositText.replace(/^Deposit:\s*/i, ""));

  let clientSubject = `Slotzy Booking Confirmed: ${serviceName}`;
  let providerSubject = `New booking: ${serviceName}`;
  let clientHeadline = "Booking confirmed";
  let providerHeadline = "New booking";
  let clientIntro = `Your ${serviceName} appointment with ${barberName} is confirmed.`;
  let providerIntro = `${clientName} booked ${serviceName} with ${barberName}.`;

  if (type === "booking_cancelled") {
    clientSubject = `Slotzy Booking Cancelled: ${serviceName}`;
    providerSubject = `Booking cancelled: ${serviceName}`;
    clientHeadline = "Booking cancelled";
    providerHeadline = "Booking cancelled";
    clientIntro = `Your ${serviceName} appointment with ${barberName} has been cancelled.`;
    providerIntro = `${clientName} cancelled ${serviceName} with ${barberName}.`;
  } else if (type === "booking_rescheduled") {
    clientSubject = `Slotzy Booking Rescheduled: ${serviceName}`;
    providerSubject = `Booking rescheduled: ${serviceName}`;
    clientHeadline = "Booking rescheduled";
    providerHeadline = "Booking rescheduled";
    clientIntro = `Your ${serviceName} appointment with ${barberName} has been moved to a new time.`;
    providerIntro = `${clientName} rescheduled ${serviceName} with ${barberName}.`;
  }

  const payloads = [];
  const clientTo = resolveClientEmailTarget(bookingRecord);
  if (clientTo) {
    payloads.push({
      to: clientTo,
      subject: clientSubject,
      html: buildEmailHtml({
        headline: clientHeadline,
        greeting: `Hi ${clientName},`,
        intro: clientIntro,
        detailLines: clientDetailLines,
        closing: "Thanks for booking with Slotzy.",
      }),
      text: buildEmailText({
        greeting: `Hi ${clientName},`,
        intro: clientIntro,
        detailLines: clientDetailLines,
        closing: "Thanks for booking with Slotzy.",
      }),
      tags: [type, "client"],
      meta: {
        bookingId: bookingRecord?.id ?? null,
        shopId: shopContext.id ?? null,
        recipient: "client",
        eventType: type,
        manageLink: manageLinkText || null,
        source: normalizeUsername(source) || null,
      },
    });
  }

  const providerRecipients = getProviderNotificationRecipients(shopContext, barberContext, ownerContext);
  providerRecipients.forEach((recipient) => {
    payloads.push({
      to: recipient.to,
      subject: providerSubject,
      html: buildEmailHtml({
        headline: providerHeadline,
        greeting: `Hi ${shopName},`,
        intro: providerIntro,
        detailLines: providerDetailLines,
        closing: "This message was generated by Slotzy.",
      }),
      text: buildEmailText({
        greeting: `Hi ${shopName},`,
        intro: providerIntro,
        detailLines: providerDetailLines,
        closing: "This message was generated by Slotzy.",
      }),
      tags: [type, recipient.kind],
      meta: {
        bookingId: bookingRecord?.id ?? null,
        shopId: shopContext.id ?? null,
        recipient: recipient.kind,
        eventType: type,
        source: normalizeUsername(source) || null,
      },
    });
  });

  return payloads;
}

async function dispatchBookingEmails(emails, { suppressErrors = true } = {}) {
  const results = [];
  const errors = [];

  for (const email of emails) {
    try {
      results.push(await sendEmail(email));
    } catch (error) {
      const message = String(error?.message ?? error ?? "email_send_failed");
      errors.push({
        to: email?.to ?? "",
        subject: email?.subject ?? "",
        message,
      });
      console.warn("[Slotzy:email] Could not dispatch notification.", { error: message });
      if (!suppressErrors) {
        throw new Error(message);
      }
    }
  }

  return { results, errors };
}

async function sendBookingNotifications(db, payload, options = {}) {
  const emails = buildBookingEmailPayloads(db, payload);
  const dispatched = await dispatchBookingEmails(emails, options);
  return {
    emails,
    ...dispatched,
  };
}

async function handleBookingNotifyRequest(req, res, type) {
  const booking = normalizeObjectRecord(req.body?.booking);
  if (Object.keys(booking).length === 0) {
    return res.status(400).json({
      ok: false,
      mode: getEmailMode(),
      error: "booking is required",
    });
  }

  try {
    const result = await sendBookingNotifications(null, {
      type,
      booking,
      previousBooking: (() => {
        const previous = normalizeObjectRecord(req.body?.previousBooking);
        return Object.keys(previous).length > 0 ? previous : null;
      })(),
      shop: normalizeObjectRecord(req.body?.shop),
      barber: normalizeObjectRecord(req.body?.barber),
      owner: normalizeObjectRecord(req.body?.owner),
      manageLink: normalizeUsername(req.body?.manageLink),
      cancellationNote: normalizeUsername(req.body?.cancellationNote),
      source: normalizeUsername(req.body?.source),
    }, { suppressErrors: false });

    return res.json({
      ok: true,
      mode: getEmailMode(),
      sent: result.results.length,
    });
  } catch (error) {
    return res.json({
      ok: false,
      mode: getEmailMode(),
      error: String(error?.message ?? error ?? "notification_failed"),
    });
  }
}

function verifyBearerUsername(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return "";
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const username = normalizeUsername(payload?.username);
    if (!username) {
      res.status(401).json({ error: "invalid token payload" });
      return "";
    }
    return username;
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
    return "";
  }
}

function logAuthStorageFailure(error, { operation, authHeaderPresent, jwtVerified, usernamePresent }) {
  console.error("[Slotzy:auth] Protected storage read failed", {
    storage: STORAGE_ADAPTER,
    operation,
    statusCode: 503,
    authHeaderPresent,
    jwtVerified,
    storageReadSuccess: false,
    storageErrorCode: String(error?.code ?? ""),
    storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
    usernamePresent,
    userFound: false,
    membershipPresent: false,
    shopPresent: false,
  });
}

function normalizedAuthenticatedUser(user) {
  return {
    ...user,
    username: normalizeUsername(user.username),
    role: normalizeRole(user.role),
  };
}

async function requireSessionAuth(req, res, next) {
  const username = verifyBearerUsername(req, res);
  if (!username) return;
  try {
    const user = await readUserByUsername(username);
    if (!user) return res.status(401).json({ error: "user not found for token" });
    req.user = normalizedAuthenticatedUser(user);
    return next();
  } catch (error) {
    logAuthStorageFailure(error, {
      operation: "read auth user",
      authHeaderPresent: true,
      jwtVerified: true,
      usernamePresent: true,
    });
    return res.status(503).json({ error: "authentication service temporarily unavailable", code: "auth_storage_unavailable" });
  }
}

async function requireAuth(req, res, next) {
  const username = verifyBearerUsername(req, res);
  if (!username) return;
  try {
    const user = await readUserByUsername(username);
    if (!user) return res.status(401).json({ error: "user not found for token" });
    req.user = normalizedAuthenticatedUser(user);
    return next();
  } catch (error) {
    logAuthStorageFailure(error, {
      operation: "read authenticated identity",
      authHeaderPresent: true,
      jwtVerified: true,
      usernamePresent: true,
    });
    return res.status(503).json({ error: "authentication service temporarily unavailable", code: "auth_storage_unavailable" });
  }
}

async function requireRouteStore(req, res, next) {
  try {
    req.db = await readStore();
    return next();
  } catch (error) {
    console.error("[Slotzy:storage] Protected route storage read failed", {
      storage: STORAGE_ADAPTER,
      operation: "read protected route snapshot",
      statusCode: 503,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      userFound: Boolean(req.user),
      membershipPresent: Boolean(req.user?.shopId),
      shopPresent: Boolean(req.user?.shopId),
    });
    return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
  }
}

async function requireAdmin(req, res, next) {
  if (!isAdminEnabled()) {
    return res.status(503).json({ error: "admin disabled" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "missing bearer token" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    if (String(payload?.scope ?? "").trim() !== "admin") {
      return res.status(401).json({ error: "invalid admin token" });
    }

    req.db = await readStore();
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired admin token" });
  }
}

function getShopProviderUsers(db, shopId) {
  const normalizedShopId = normalizeUsername(shopId);
  if (!normalizedShopId) return [];
  return db.users.filter((user) => {
    if (!isProviderRole(user?.role)) return false;
    return getUserShopId(db, user) === normalizedShopId;
  });
}

function getShopOwnerUser(db, shop) {
  const ownerUsername = normalizeUsername(shop?.ownerUsername);
  if (ownerUsername) {
    return findUserByUsername(db, ownerUsername);
  }
  const shopId = normalizeUsername(shop?.id);
  return db.users.find((user) => isOwner(user) && getUserShopId(db, user) === shopId) || null;
}

function getShopBookings(db, shopId) {
  const normalizedShopId = normalizeUsername(shopId);
  if (!normalizedShopId) return [];
  return db.bookings.filter((booking) => resolveBookingShopId(db, booking) === normalizedShopId);
}

function buildAdminShopExport(db, shopId) {
  const shop = findShopById(db, shopId);
  if (!shop) return null;

  const providers = getShopProviderUsers(db, shopId);
  const providerUsernames = new Set(providers.map((user) => normalizeUsername(user.username)));
  const owner = getShopOwnerUser(db, shop);
  if (owner) {
    providerUsernames.add(normalizeUsername(owner.username));
  }

  const bookings = getShopBookings(db, shopId);
  const users = db.users.filter((user) => {
    if (normalizeUsername(user?.shopId) === normalizeUsername(shopId)) return true;
    return providerUsernames.has(normalizeUsername(user?.username));
  });
  const services = db.services.filter((service) => normalizeUsername(service?.shopId) === normalizeUsername(shopId));
  const availability = Object.fromEntries(
    Object.entries(db.availability || {}).filter(([username]) => providerUsernames.has(normalizeUsername(username)))
  );

  return {
    exportedAtISO: new Date().toISOString(),
    shop,
    users,
    services,
    availability,
    bookings,
  };
}

function buildAdminShopSummary(db, shop) {
  const shopId = normalizeUsername(shop?.id);
  const providers = getShopProviderUsers(db, shopId);
  const bookings = getShopBookings(db, shopId);
  return {
    id: shopId,
    name: normalizeUsername(shop?.name ?? shop?.businessName) || "Shop",
    slug: normalizeUsername(shop?.slug),
    createdAtISO: normalizeUsername(shop?.createdAtISO ?? shop?.createdAt),
    barberCount: providers.filter((user) => isBarber(user)).length + (getShopOwnerUser(db, shop) ? 1 : 0),
    bookingCount: bookings.length,
  };
}

async function seedAdminDemoShop() {
  const db = await readStore();
  const now = new Date();
  const createdAt = now.toISOString();
  const suffix = String(now.getTime()).slice(-6);
  const shopId = `shop_admin_demo_${suffix}`;
  const ownerUsername = `pilot_owner_${suffix}`;
  const barberUsername = `pilot_barber_${suffix}`;
  const shopName = `Pilot Demo ${suffix}`;
  const shopSlug = createSlug(shopName);
  const passwordHash = await bcrypt.hash("demo", 10);

  db.users.push({
    id: randomUUID(),
    username: ownerUsername,
    displayName: `Pilot Owner ${suffix}`,
    passwordHash,
    role: ROLE_OWNER,
    shopId,
    createdAt,
  });
  db.users.push({
    id: randomUUID(),
    username: barberUsername,
    displayName: `Pilot Barber ${suffix}`,
    passwordHash,
    role: ROLE_BARBER,
    shopId,
    createdAt,
  });
  db.shops.push({
    id: shopId,
    name: shopName,
    businessName: shopName,
    slug: shopSlug,
    ownerUsername,
    createdAtISO: createdAt,
    updatedAtISO: createdAt,
    bookingPolicy: normalizeBookingPolicy(DEFAULT_BOOKING_POLICY),
  });
  db.services.push({
    id: randomUUID(),
    name: "Demo Haircut",
    title: "Demo Haircut",
    price: 35,
    durationMinutes: 30,
    duration: 30,
    barberUsername,
    ownerUsername: barberUsername,
    shopId,
    active: true,
    createdAtISO: createdAt,
  });
  db.availability[ownerUsername] = createDefaultAvailability();
  db.availability[barberUsername] = createDefaultAvailability();

  await writeStore(db);
  return findShopById(db, shopId);
}

app.post("/api/auth/register", async (req, res) => {
  let registrationStage = "validation";
  let duplicateUsername = false;
  let userCreated = false;
  let tokenIssued = false;
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password ?? "");
    const requestedRole = String(req.body?.role ?? "").trim().toLowerCase();
    const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : "";
    const displayName = normalizeUsername(req.body?.displayName) || username;
    const requestedShopId = normalizeUsername(req.body?.shopId);

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }
    if (!role) {
      return res.status(400).json({ error: "role must be owner, barber, or customer" });
    }

    registrationStage = "duplicate_check";
    duplicateUsername = Boolean(await readUserByUsername(username));
    if (duplicateUsername) {
      return res.status(409).json({ error: "username already exists" });
    }

    if (role === ROLE_BARBER && requestedShopId) {
      registrationStage = "shop_validation";
      const db = await readStore();
      const shopExists = db.shops.some((shop) => normalizeUsername(shop?.id) === requestedShopId);
      if (!shopExists) {
        return res.status(400).json({ error: "shopId does not exist for barber account" });
      }
    }

    registrationStage = "password_hash";
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      username,
      displayName,
      passwordHash,
      role,
      shopId: role === ROLE_CUSTOMER ? null : (requestedShopId || null),
      createdAt: now,
    };

    registrationStage = "user_write";
    await writeUser(user);
    userCreated = true;

    registrationStage = "token_issue";
    const token = signToken(user);
    tokenIssued = true;
    const authUser = buildAuthUser(user);
    return res.status(201).json({ token, user: authUser });
  } catch (error) {
    const storageErrorCode = String(error?.code ?? "");
    const uniqueConflict = registrationStage === "user_write" && storageErrorCode === "23505";
    // Never log request bodies or arbitrary error messages: registration input
    // contains a password and may later contain private contact information.
    console.error("[Slotzy:auth] POST /api/auth/register failed", {
      route: "/api/auth/register",
      storage: STORAGE_ADAPTER,
      operation: registrationStage,
      errorName: String(error?.name ?? "Error"),
      storageErrorCode,
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      duplicateUsername: duplicateUsername || uniqueConflict,
      duplicateEmail: false,
      storageReadFailed: registrationStage === "duplicate_check" || registrationStage === "shop_validation",
      storageWriteFailed: registrationStage === "user_write",
      passwordHashFailed: registrationStage === "password_hash",
      userCreated,
      tokenIssued,
    });
    if (uniqueConflict) return res.status(409).json({ error: "username already exists" });
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  let operation = "validation";
  let userFound = false;
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    operation = "credential_lookup";
    const user = await readLoginCredentialByUsername(username);
    userFound = Boolean(user);
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    operation = "password_compare";
    const ok = await bcrypt.compare(password, String(user.passwordHash ?? ""));
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    operation = "token_issue";
    const token = signToken(user);
    return res.json({ token, user: buildAuthUser(user) });
  } catch (error) {
    const storageFailure = operation === "credential_lookup";
    console.error("[Slotzy:auth] POST /api/auth/login failed", {
      storage: STORAGE_ADAPTER,
      operation,
      statusCode: storageFailure ? 503 : 500,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      userFound,
      membershipPresent: false,
      shopPresent: false,
    });
    if (storageFailure) {
      return res.status(503).json({ error: "authentication service temporarily unavailable", code: "auth_storage_unavailable" });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

app.get("/api/public/booking-context", async (req, res) => {
  let operation = "read public booking context";
  try {
    const requestedShopId = normalizeUsername(req.query.shopId);
    const requestedSlug = String(req.query.shop ?? "").trim().toLowerCase();
    const db = await readPublicBookingStore({ shopId: requestedShopId, slug: requestedSlug });
    const isDirectLookup = Boolean(requestedShopId || requestedSlug);
    let shops = isDirectLookup
      ? [...db.shops]
      : db.shops.filter((shop) => !isSyntheticE2eShop(shop));

    if (requestedShopId) {
      shops = shops.filter((shop) => normalizeUsername(shop?.id) === requestedShopId);
    } else if (requestedSlug) {
      shops = shops.filter((shop) => String(shop?.slug ?? "").trim().toLowerCase() === requestedSlug);
    }
    if ((requestedShopId || requestedSlug) && shops.length === 0) {
      return res.status(404).json({ error: "shop not found", code: "invalid_shop" });
    }

    const shopIds = new Set(shops.map((shop) => normalizeUsername(shop?.id)).filter(Boolean));
    const providers = db.users
      .filter((user) => isProviderRole(user?.role))
      .map((user) => ({
        username: normalizeUsername(user?.username),
        displayName: String(user?.displayName ?? user?.username ?? "").trim(),
        role: normalizeRole(user?.role),
        shopId: getUserShopId(db, user),
      }))
      .filter((user) => shopIds.has(user.shopId));
    const providerNames = new Set(providers.map((provider) => provider.username));
    const services = db.services
      .filter((service) => service?.active !== false)
      .filter((service) => shopIds.has(normalizeUsername(service?.shopId)))
      .filter((service) => providerNames.has(normalizeUsername(service?.barberUsername ?? service?.ownerUsername)))
      .map((service) => ({
        id: normalizeUsername(service?.id),
        name: String(service?.name ?? service?.title ?? "Service").trim(),
        title: String(service?.title ?? service?.name ?? "Service").trim(),
        price: normalizePrice(service?.price, 0),
        durationMinutes: normalizeDuration(service?.durationMinutes ?? service?.duration, 30),
        duration: normalizeDuration(service?.durationMinutes ?? service?.duration, 30),
        shopId: normalizeUsername(service?.shopId),
        barberUsername: normalizeUsername(service?.barberUsername ?? service?.ownerUsername),
        ownerUsername: normalizeUsername(service?.barberUsername ?? service?.ownerUsername),
        active: true,
      }));
    const availabilityByBarber = Object.fromEntries(
      providers.map((provider) => [provider.username, normalizeAvailabilityEntry(db.availability?.[provider.username])])
    );
    const bookings = db.bookings
      .filter((booking) => shopIds.has(resolveBookingShopId(db, booking)))
      .filter((booking) => {
        const status = normalizeBookingStatus(booking?.status);
        return status === "booked" || status === "confirmed";
      })
      .map((booking) => ({
        shopId: resolveBookingShopId(db, booking),
        ownerUsername: normalizeUsername(booking?.ownerUsername ?? booking?.barberUsername),
        barberUsername: normalizeUsername(booking?.barberUsername ?? booking?.ownerUsername),
        startISO: toIsoOrNull(booking?.startISO ?? booking?.startAtISO),
        endISO: toIsoOrNull(booking?.endISO),
        durationMinutes: normalizeDuration(booking?.durationMinutes, 30),
        status: normalizeBookingStatus(booking?.status),
      }));

    return res.json({
      shops: shops.map((shop) => ({
        id: normalizeUsername(shop?.id),
        name: String(shop?.name ?? shop?.businessName ?? "Shop").trim(),
        businessName: String(shop?.businessName ?? shop?.name ?? "Shop").trim(),
        slug: String(shop?.slug ?? "").trim(),
        active: shop?.active !== false,
        shopPhone: String(shop?.shopPhone ?? shop?.phone ?? "").trim(),
        address: String(shop?.address ?? "").trim(),
        logo: String(shop?.logo ?? shop?.logoDataUrl ?? "").trim(),
        cover: String(shop?.cover ?? shop?.coverDataUrl ?? "").trim(),
        branding: shop?.branding && typeof shop.branding === "object" ? shop.branding : {},
        bookingPolicy: normalizeBookingPolicy(shop?.bookingPolicy),
      })),
      providers,
      services,
      availabilityByBarber,
      bookings,
    });
  } catch (error) {
    console.error("[Slotzy:booking] Public context read failed", {
      storage: STORAGE_ADAPTER,
      operation,
      statusCode: 500,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      shopCount: 0,
      serviceCount: 0,
      providerCount: 0,
    });
    return res.status(500).json({ error: "booking page is temporarily unavailable", code: "booking_context_unavailable" });
  }
});

app.get("/api/auth/me", requireSessionAuth, (req, res) => {
  return res.json({ user: buildAuthUser(req.user) });
});

app.get("/api/shops", requireAuth, async (req, res) => {
  const user = req.user;
  try {
    if (isOwner(user) || isBarber(user)) {
      return res.json({ shops: await listShopsForAuthenticatedUser(user) });
    }
    return res.json({ shops: (await readStore()).shops });
  } catch (error) {
    console.error("[Slotzy:shops] GET /api/shops read failed", {
      storage: STORAGE_ADAPTER,
      operation: isOwner(user) || isBarber(user) ? "read authenticated shops" : "read customer shop snapshot",
      statusCode: 503,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      shopCount: 0,
      availabilityCount: 0,
      bookingCount: 0,
    });
    return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
  }
});

app.post("/api/shops", requireAuth, requireRouteStore, async (req, res) => {
  try {
    const db = req.db;
    const user = req.user;
    if (!isOwner(user)) {
      return res.status(403).json({ error: "only owners can create shops" });
    }

    const existingShopId = getUserShopId(db, user);
    if (existingShopId) {
      return res.status(409).json({ error: "owner already has a shop" });
    }

    const name = String(req.body?.name ?? req.body?.businessName ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "shop name is required" });
    }

    const now = new Date().toISOString();
    const bookingPolicy = normalizeBookingPolicy(req.body?.bookingPolicy);
    const shop = {
      id: randomUUID(),
      name,
      businessName: name,
      slug: createSlug(req.body?.slug ?? name),
      ownerUsername: user.username,
      createdAtISO: now,
      updatedAtISO: now,
      bookingPolicy,
    };

    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (
        key === "id" ||
        key === "name" ||
        key === "businessName" ||
        key === "slug" ||
        key === "ownerUsername" ||
        key === "createdAtISO" ||
        key === "updatedAtISO" ||
        key === "bookingPolicy"
      ) {
        return;
      }
      shop[key] = value;
    });

    db.shops.push(shop);
    const ownerRecord = findUserByUsername(db, user.username);
    if (ownerRecord) {
      ownerRecord.shopId = shop.id;
    }

    // Creating one shop must not reconcile the complete hosted document. The
    // narrow shop snapshot also includes only this owner's membership, keeping
    // unrelated services, schedules, bookings, and branding out of the write.
    await writeShop(shop, db);
    return res.status(201).json({ shop });
  } catch (error) {
    logStagingShopFailure("POST /api/shops failed", {
      status: 500,
      storage: STORAGE_ADAPTER,
      code: String(error?.code ?? ""),
      operation: String(error?.storageDiagnostic?.operation ?? "unknown"),
      userCount: Array.isArray(req.db?.users) ? req.db.users.length : 0,
      shopCount: Array.isArray(req.db?.shops) ? req.db.shops.length : 0,
      serviceCount: Array.isArray(req.db?.services) ? req.db.services.length : 0,
      bookingCount: Array.isArray(req.db?.bookings) ? req.db.bookings.length : 0,
      availabilityProviderCount: req.db?.availability && typeof req.db.availability === "object"
        ? Object.keys(req.db.availability).length
        : 0,
    });
    return res.status(500).json({ error: "internal server error" });
  }
});

app.patch("/api/shops/:shopId", requireAuth, requireRouteStore, async (req, res) => {
  try {
    const db = req.db;
    const user = req.user;
    const shopId = normalizeUsername(req.params.shopId);
    const index = db.shops.findIndex((shop) => normalizeUsername(shop?.id) === shopId);
    if (index < 0) {
      return res.status(404).json({ error: "shop not found" });
    }
    if (!canOwnerManageShop(db, user, shopId)) {
      return res.status(403).json({ error: "not allowed to update this shop" });
    }

    const current = db.shops[index];
    const next = { ...current };

    if (req.body?.name !== undefined || req.body?.businessName !== undefined) {
      const name = String(req.body?.name ?? req.body?.businessName ?? "").trim();
      if (!name) return res.status(400).json({ error: "shop name cannot be empty" });
      next.name = name;
      next.businessName = name;
    }

    if (req.body?.slug !== undefined) {
      const slug = String(req.body.slug ?? "").trim();
      next.slug = createSlug(slug || next.name);
    }

    if (req.body?.bookingPolicy !== undefined) {
      const mergedPolicy = {
        ...normalizeBookingPolicy(current.bookingPolicy),
        ...normalizeBookingPolicy(req.body.bookingPolicy),
      };
      next.bookingPolicy = normalizeBookingPolicy(mergedPolicy);
    } else if (current.bookingPolicy) {
      next.bookingPolicy = normalizeBookingPolicy(current.bookingPolicy);
    }

    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (
        key === "id" ||
        key === "ownerUsername" ||
        key === "createdAtISO" ||
        key === "createdAt" ||
        key === "updatedAtISO" ||
        key === "name" ||
        key === "businessName" ||
        key === "slug" ||
        key === "bookingPolicy"
      ) {
        return;
      }
      next[key] = value;
    });

    next.updatedAtISO = new Date().toISOString();
    db.shops[index] = next;
    await writeShop(next, db);

    return res.json({ shop: next });
  } catch (error) {
    logStagingShopFailure("PATCH /api/shops/:shopId failed", {
      status: 500,
      storage: STORAGE_ADAPTER,
      code: String(error?.code ?? ""),
      message: String(error?.message ?? "unknown error"),
      storageDiagnostic: error?.storageDiagnostic ?? null,
    });
    return res.status(500).json({ error: "internal server error" });
  }
});

function logStagingShopFailure(marker, fields) {
  const environment = String(process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (environment !== "staging" && environment !== "development") return;
  console.error(`[Slotzy:shops] ${marker}`, fields);
}

async function optionalAuth(req, res, next) {
  try {
    const db = await readStore();
    const token = getBearerToken(req);
    req.db = db;
    req.user = null;
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET);
    const username = normalizeUsername(payload?.username);
    const user = username ? findUserByUsername(db, username) : null;
    if (!user) {
      return res.status(401).json({ error: "invalid or expired token", code: "invalid_auth" });
    }
    req.user = {
      ...user,
      username: normalizeUsername(user.username),
      role: normalizeRole(user.role),
    };
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token", code: "invalid_auth" });
  }
}

app.get("/api/services", requireAuth, async (req, res) => {
  const user = req.user;
  const queryShopId = normalizeUsername(req.query.shopId);
  const queryBarberUsername = normalizeUsername(req.query.barberUsername);
  const queryActive = String(req.query.active ?? "").trim().toLowerCase();
  let services;
  try {
    if (isOwner(user) || isBarber(user)) {
      services = await listServicesForAuthenticatedUser(user);
    } else {
      // Customer behavior remains the legacy all-service listing until that
      // route receives its own authorization/read projection package.
      const db = await readStore();
      services = [...db.services];
    }
  } catch (error) {
    console.error("[Slotzy:services] GET /api/services read failed", {
      storage: STORAGE_ADAPTER,
      operation: isOwner(user) || isBarber(user) ? "read authenticated services" : "read customer service snapshot",
      statusCode: 503,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      shopCount: 0,
      serviceCount: 0,
      providerCount: 0,
    });
    return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
  }

  if (queryShopId) {
    services = services.filter((service) => normalizeUsername(service?.shopId) === queryShopId);
  }
  if (queryBarberUsername) {
    services = services.filter((service) =>
      usernamesEqual(service?.barberUsername ?? service?.ownerUsername, queryBarberUsername)
    );
  }
  if (queryActive === "true" || queryActive === "false") {
    const active = queryActive === "true";
    services = services.filter((service) => Boolean(service?.active !== false) === active);
  }

  return res.json({ services });
});

function logStagingServicePersistenceFailure(error, context) {
  const environment = String(process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (environment !== "staging" && environment !== "development") return;
  const diagnostic = error?.storageDiagnostic && typeof error.storageDiagnostic === "object"
    ? error.storageDiagnostic
    : {};
  console.error("[Slotzy:services] POST /api/services persistence failed", {
    storage: STORAGE_ADAPTER,
    code: String(error?.code ?? "") || "unclassified",
    operation: String(diagnostic.operation ?? "") || "unknown",
    networkFailurePresent: Object.keys(diagnostic).some((key) => /^network/i.test(key) || /network/i.test(String(diagnostic[key] ?? ""))),
    authenticatedUserPresent: Boolean(context?.authenticatedUserPresent),
    ownerShopPresent: Boolean(context?.ownerShopPresent),
    requestedShopPresent: Boolean(context?.requestedShopPresent),
    providerPresent: Boolean(context?.providerPresent),
    providerShopPresent: Boolean(context?.providerShopPresent),
    providerMembershipMatched: Boolean(context?.providerMembershipMatched),
    serviceCountBeforeWrite: Math.max(0, Number(context?.serviceCountBeforeWrite) || 0),
  });
}

app.post("/api/services", requireAuth, requireRouteStore, async (req, res) => {
  let persistenceContext = null;
  try {
    const db = req.db;
    const user = req.user;

    if (isCustomer(user)) {
      return res.status(403).json({ error: "customers cannot create services" });
    }

    const rawName = String(req.body?.name ?? req.body?.title ?? "").trim();
    if (!rawName) {
      return res.status(400).json({ error: "service name is required" });
    }

    let targetBarberUsername = normalizeUsername(req.body?.barberUsername ?? req.body?.ownerUsername);
    if (isBarber(user)) {
      targetBarberUsername = user.username;
    } else if (!targetBarberUsername) {
      targetBarberUsername = user.username;
    }

    const targetBarber = findUserByUsername(db, targetBarberUsername);
    if (!targetBarber || !isProviderRole(targetBarber.role)) {
      return res.status(400).json({ error: "barberUsername must reference a barber/owner account" });
    }

    const requestedShopId = normalizeUsername(req.body?.shopId);
    const barberShopId = getUserShopId(db, targetBarber);
    let shopId = requestedShopId || barberShopId;

    if (isOwner(user)) {
      const ownerShopId = getUserShopId(db, user);
      if (!ownerShopId) {
        return res.status(400).json({ error: "owner must have a shop before creating services" });
      }
      if (!isUserManageableByOwner(db, user, targetBarber.username)) {
        return res.status(403).json({ error: "owner can only manage providers in their own shop" });
      }
      if (!shopId) shopId = ownerShopId;
      if (shopId !== ownerShopId) {
        return res.status(403).json({ error: "service shopId must match owner's shop" });
      }
    } else {
      const myShopId = getUserShopId(db, user);
      if (!myShopId) {
        return res.status(400).json({ error: "barber must belong to a shop before creating services" });
      }
      if (!usernamesEqual(targetBarber.username, user.username)) {
        return res.status(403).json({ error: "barber can only create services for self" });
      }
      if (!shopId) shopId = myShopId;
      if (shopId !== myShopId) {
        return res.status(403).json({ error: "service shopId must match barber's shop" });
      }
    }

    const durationMinutes = normalizeDuration(
      req.body?.durationMinutes ?? req.body?.duration,
      30
    );
    const price = normalizePrice(req.body?.price, 0);
    const now = new Date().toISOString();

    const service = {
      ...req.body,
      id: randomUUID(),
      name: rawName,
      title: rawName,
      price,
      durationMinutes,
      duration: durationMinutes,
      barberUsername: targetBarber.username,
      ownerUsername: targetBarber.username,
      shopId,
      active: req.body?.active !== false,
      createdAtISO: String(req.body?.createdAtISO ?? req.body?.createdAt ?? now),
      updatedAtISO: now,
    };

    persistenceContext = {
      authenticatedUserPresent: Boolean(user),
      ownerShopPresent: Boolean(getUserShopId(db, user)),
      requestedShopPresent: Boolean(requestedShopId),
      providerPresent: Boolean(targetBarber),
      providerShopPresent: Boolean(barberShopId),
      providerMembershipMatched: userBelongsToShop(db, targetBarber.username, shopId),
      serviceCountBeforeWrite: db.services.length,
    };
    db.services.push(service);
    // Persist only the new service and its provider membership. Replaying the
    // full hosted document here grows with unrelated pilot data and can exceed
    // the database statement timeout before the browser receives a response.
    await writeService(service, db);
    return res.status(201).json({ service });
  } catch (error) {
    logStagingServicePersistenceFailure(error, persistenceContext);
    return res.status(500).json({ error: "internal server error", code: "service_persistence_failed" });
  }
});

app.patch("/api/services/:serviceId", requireAuth, requireRouteStore, async (req, res) => {
  try {
    const db = req.db;
    const user = req.user;
    if (isCustomer(user)) {
      return res.status(403).json({ error: "customers cannot update services" });
    }

    const serviceId = normalizeUsername(req.params.serviceId);
    const index = db.services.findIndex((item) => normalizeUsername(item?.id) === serviceId);
    if (index < 0) {
      return res.status(404).json({ error: "service not found" });
    }

    const current = db.services[index];
    const canManage = isOwner(user)
      ? canOwnerManageService(db, user, current)
      : canBarberManageService(user, current);
    if (!canManage) {
      return res.status(403).json({ error: "not allowed to update this service" });
    }

    let targetBarberUsername = normalizeUsername(
      req.body?.barberUsername ?? req.body?.ownerUsername ?? current.barberUsername ?? current.ownerUsername
    );
    if (!targetBarberUsername) targetBarberUsername = normalizeUsername(user.username);

    if (isBarber(user) && !usernamesEqual(targetBarberUsername, user.username)) {
      return res.status(403).json({ error: "barber can only assign services to self" });
    }

    const targetBarber = findUserByUsername(db, targetBarberUsername);
    if (!targetBarber || !isProviderRole(targetBarber.role)) {
      return res.status(400).json({ error: "barberUsername must reference a barber/owner account" });
    }

    let shopId = normalizeUsername(req.body?.shopId ?? current.shopId);
    if (!shopId) {
      shopId = getUserShopId(db, targetBarber);
    }

    if (isOwner(user)) {
      const ownerShopId = getUserShopId(db, user);
      if (!isUserManageableByOwner(db, user, targetBarber.username)) {
        return res.status(403).json({ error: "owner can only assign providers in their own shop" });
      }
      if (shopId !== ownerShopId) {
        return res.status(403).json({ error: "service shopId must remain in owner's shop" });
      }
    } else {
      const myShopId = getUserShopId(db, user);
      if (shopId !== myShopId) {
        return res.status(403).json({ error: "service shopId must remain in barber's shop" });
      }
    }

    const next = { ...current };
    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (
        key === "id" ||
        key === "createdAtISO" ||
        key === "createdAt" ||
        key === "updatedAtISO" ||
        key === "name" ||
        key === "title" ||
        key === "price" ||
        key === "durationMinutes" ||
        key === "duration" ||
        key === "barberUsername" ||
        key === "ownerUsername" ||
        key === "shopId"
      ) {
        return;
      }
      next[key] = value;
    });

    if (req.body?.name !== undefined || req.body?.title !== undefined) {
      const nextName = String(req.body?.name ?? req.body?.title ?? "").trim();
      if (!nextName) {
        return res.status(400).json({ error: "service name cannot be empty" });
      }
      next.name = nextName;
      next.title = nextName;
    } else {
      const keptName = String(current?.name ?? current?.title ?? "").trim() || "Service";
      next.name = keptName;
      next.title = keptName;
    }

    next.price = req.body?.price !== undefined
      ? normalizePrice(req.body.price, next.price ?? 0)
      : normalizePrice(next.price, 0);

    const durationInput = req.body?.durationMinutes ?? req.body?.duration;
    next.durationMinutes = durationInput !== undefined
      ? normalizeDuration(durationInput, next.durationMinutes ?? next.duration ?? 30)
      : normalizeDuration(next.durationMinutes ?? next.duration, 30);
    next.duration = next.durationMinutes;

    if (req.body?.active !== undefined) {
      next.active = Boolean(req.body.active);
    } else if (next.active === undefined) {
      next.active = true;
    }

    next.barberUsername = targetBarber.username;
    next.ownerUsername = targetBarber.username;
    next.shopId = shopId;
    next.updatedAtISO = new Date().toISOString();

    db.services[index] = next;
    await writeStore(db);

    return res.json({ service: next });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.delete("/api/services/:serviceId", requireAuth, requireRouteStore, async (req, res) => {
  try {
    const db = req.db;
    const user = req.user;
    if (isCustomer(user)) {
      return res.status(403).json({ error: "customers cannot delete services" });
    }

    const serviceId = normalizeUsername(req.params.serviceId);
    const index = db.services.findIndex((item) => normalizeUsername(item?.id) === serviceId);
    if (index < 0) {
      return res.status(404).json({ error: "service not found" });
    }

    const service = db.services[index];
    const canManage = isOwner(user)
      ? canOwnerManageService(db, user, service)
      : canBarberManageService(user, service);
    if (!canManage) {
      return res.status(403).json({ error: "not allowed to delete this service" });
    }

    db.services.splice(index, 1);
    await writeStore(db);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.get("/api/availability", requireAuth, async (req, res) => {
  const user = req.user;
  const requestedUsername = normalizeUsername(req.query.barberUsername);

  if (isOwner(user) || isBarber(user)) {
    try {
      const result = await readAvailabilityForAuthenticatedUser(user, { barberUsername: requestedUsername });
      if (result?.outcome === "not_allowed") {
        return res.status(403).json({ error: isOwner(user) ? "owner can only view availability for own shop providers" : "barber can only view own availability" });
      }
      if (result?.outcome === "single") {
        return res.json({ barberUsername: result.barberUsername, availability: normalizeAvailabilityEntry(result.availability) });
      }
      return res.json({ availability: Object.fromEntries(Object.entries(result?.availability ?? {}).map(([username, availability]) => [username, normalizeAvailabilityEntry(availability)])) });
    } catch (error) {
      console.error("[Slotzy:availability] GET /api/availability read failed", {
        storage: STORAGE_ADAPTER,
        operation: "read authenticated availability",
        statusCode: 503,
        storageErrorCode: String(error?.code ?? ""),
        storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
        shopCount: 0,
        availabilityCount: 0,
        bookingCount: 0,
      });
      return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
    }
  }

  let db;
  try {
    db = await readStore();
  } catch (error) {
    console.error("[Slotzy:availability] GET /api/availability customer read failed", {
      storage: STORAGE_ADAPTER, operation: "read customer availability snapshot", statusCode: 503,
      storageErrorCode: String(error?.code ?? ""), storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      shopCount: 0, availabilityCount: 0, bookingCount: 0,
    });
    return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
  }

  if (!db.availability || typeof db.availability !== "object" || Array.isArray(db.availability)) {
    db.availability = {};
  }

  if (requestedUsername) {
    const provider = findUserByUsername(db, requestedUsername);
    if (!provider || !isProviderRole(provider.role)) {
      return res.status(404).json({ error: "provider not found" });
    }
    return res.json({
      barberUsername: provider.username,
      availability: normalizeAvailabilityEntry(db.availability[provider.username]),
    });
  }

  const availability = {};
  db.users
    .filter((entry) => isProviderRole(entry?.role))
    .forEach((provider) => {
      const username = normalizeUsername(provider.username);
      if (!username) return;
      availability[username] = normalizeAvailabilityEntry(db.availability[username]);
    });

  return res.json({ availability });
});

function logStagingAvailabilityPersistenceFailure(error, context) {
  const environment = String(process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (environment !== "staging" && environment !== "development") return;
  const diagnostic = error?.storageDiagnostic && typeof error.storageDiagnostic === "object"
    ? error.storageDiagnostic
    : {};
  console.error("[Slotzy:availability] PUT /api/availability persistence failed", {
    storage: STORAGE_ADAPTER,
    code: String(error?.code ?? "") || "unclassified",
    operation: String(diagnostic.operation ?? "") || "unknown",
    networkFailurePresent: Object.keys(diagnostic).some((key) => /^network/i.test(key) || /network/i.test(String(diagnostic[key] ?? ""))),
    authenticatedUserPresent: Boolean(context?.authenticatedUserPresent),
    authenticatedUserHasShop: Boolean(context?.authenticatedUserHasShop),
    providerPresent: Boolean(context?.providerPresent),
    providerHasShop: Boolean(context?.providerHasShop),
    providerMembershipMatched: Boolean(context?.providerMembershipMatched),
    availabilityObjectPresent: Boolean(context?.availabilityObjectPresent),
    timezonePresent: Boolean(context?.timezonePresent),
    weeklyObjectPresent: Boolean(context?.weeklyObjectPresent),
    weeklyDayCount: Math.max(0, Number(context?.weeklyDayCount) || 0),
    timeOffArrayPresent: Boolean(context?.timeOffArrayPresent),
    recurringBlocksArrayPresent: Boolean(context?.recurringBlocksArrayPresent),
    serviceCountBeforeWrite: Math.max(0, Number(context?.serviceCountBeforeWrite) || 0),
    availabilityProviderCountBeforeWrite: Math.max(0, Number(context?.availabilityProviderCountBeforeWrite) || 0),
  });
}

app.put("/api/availability", requireAuth, requireRouteStore, async (req, res) => {
  let persistenceContext = null;
  try {
    const db = req.db;
    const user = req.user;
    if (isCustomer(user)) {
      return res.status(403).json({ error: "customers cannot update availability" });
    }

    if (!db.availability || typeof db.availability !== "object" || Array.isArray(db.availability)) {
      db.availability = {};
    }

    let targetUsername = normalizeUsername(req.body?.barberUsername);
    if (isBarber(user)) {
      if (targetUsername && !usernamesEqual(targetUsername, user.username)) {
        return res.status(403).json({ error: "barber can only update own availability" });
      }
      targetUsername = user.username;
    } else {
      if (!targetUsername) targetUsername = user.username;
      if (!isUserManageableByOwner(db, user, targetUsername)) {
        return res.status(403).json({ error: "owner can only update availability for own shop providers" });
      }
    }

    const payload = req.body?.availability !== undefined ? req.body.availability : req.body;
    const targetProvider = findUserByUsername(db, targetUsername);
    const targetShopId = targetProvider ? getUserShopId(db, targetProvider) : "";
    persistenceContext = {
      authenticatedUserPresent: Boolean(user),
      authenticatedUserHasShop: Boolean(getUserShopId(db, user)),
      providerPresent: Boolean(targetProvider),
      providerHasShop: Boolean(targetShopId),
      providerMembershipMatched: Boolean(targetProvider && userBelongsToShop(db, targetUsername, targetShopId)),
      availabilityObjectPresent: Boolean(payload && typeof payload === "object" && !Array.isArray(payload)),
      timezonePresent: Boolean(String(payload?.timezone ?? "").trim()),
      weeklyObjectPresent: Boolean(payload?.weekly && typeof payload.weekly === "object" && !Array.isArray(payload.weekly)),
      weeklyDayCount: payload?.weekly && typeof payload.weekly === "object" && !Array.isArray(payload.weekly)
        ? Object.keys(payload.weekly).length
        : 0,
      timeOffArrayPresent: Array.isArray(payload?.timeOff),
      recurringBlocksArrayPresent: Array.isArray(payload?.recurringBlocks),
      serviceCountBeforeWrite: Array.isArray(db.services) ? db.services.length : 0,
      availabilityProviderCountBeforeWrite: Object.keys(db.availability).length,
    };
    const availability = normalizeAvailabilityEntry(payload);
    db.availability[targetUsername] = availability;
    await writeAvailability(targetUsername, availability, db);

    return res.json({
      barberUsername: targetUsername,
      availability,
    });
  } catch (error) {
    logStagingAvailabilityPersistenceFailure(error, persistenceContext);
    return res.status(500).json({ error: "internal server error", code: "availability_persistence_failed" });
  }
});

app.get("/api/bookings", requireAuth, async (req, res) => {
  const user = req.user;
  const queryStatus = String(req.query.status ?? "").trim().toLowerCase();
  const queryShopId = normalizeUsername(req.query.shopId);
  const queryBarberUsername = normalizeUsername(req.query.barberUsername);
  const queryCustomerUsername = normalizeUsername(req.query.customerUsername);

  let bookings;
  let compatibilityDb = null;
  try {
    if (isOwner(user) || isBarber(user)) {
      bookings = await listBookingsForAuthenticatedUser(user, { status: queryStatus ? normalizeBookingStatus(queryStatus) : "" });
    } else {
      compatibilityDb = await readStore();
      bookings = compatibilityDb.bookings.filter((booking) => canCustomerViewBooking(user, booking));
    }
  } catch (error) {
    console.error("[Slotzy:bookings] GET /api/bookings read failed", {
      storage: STORAGE_ADAPTER,
      operation: isOwner(user) || isBarber(user) ? "read authenticated bookings" : "read customer booking snapshot",
      statusCode: 503,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      shopCount: 0,
      availabilityCount: 0,
      bookingCount: 0,
    });
    return res.status(503).json({ error: "service temporarily unavailable", code: "storage_unavailable" });
  }

  if (queryStatus) {
    const normalizedStatus = normalizeBookingStatus(queryStatus);
    bookings = bookings.filter((booking) => normalizeBookingStatus(booking?.status) === normalizedStatus);
  }
  if (queryShopId) {
    bookings = bookings.filter((booking) => (compatibilityDb ? resolveBookingShopId(compatibilityDb, booking) : normalizeUsername(booking?.shopId)) === queryShopId);
  }
  if (queryBarberUsername) {
    bookings = bookings.filter((booking) =>
      usernamesEqual(booking?.barberUsername ?? booking?.ownerUsername, queryBarberUsername)
    );
  }
  if (queryCustomerUsername) {
    bookings = bookings.filter((booking) => usernamesEqual(booking?.customerUsername, queryCustomerUsername));
  }

  return res.json({ bookings });
});

// These routes intentionally accept no contact, shop, booking id, or account
// identifiers. Possession of the opaque token is the complete public authority.
app.get("/api/public/manage", async (req, res) => {
  try {
    const token = String(req.get("X-Slotzy-Manage-Token") ?? "").trim();
    if (!token || token.length < 32) {
      return res.status(404).json({ error: "This manage link is invalid or has expired.", code: "invalid_manage_token" });
    }
    const db = await readStore();
    const booking = db.bookings.find((entry) => hasManageToken(entry, token));
    if (!booking) {
      return res.status(404).json({ error: "This manage link is invalid or has expired.", code: "invalid_manage_token" });
    }
    const shop = findShopById(db, resolveBookingShopId(db, booking));
    if (!shop) return res.status(404).json({ error: "This manage link is invalid or has expired.", code: "invalid_manage_token" });
    return res.json({ booking: publicManageBooking(booking), shop: {
      id: shop.id, name: String(shop.name ?? shop.businessName ?? "Shop"), slug: String(shop.slug ?? ""),
      bookingPolicy: normalizeBookingPolicy(shop.bookingPolicy),
    } });
  } catch {
    return res.status(500).json({ error: "We could not load this appointment. Try again.", code: "manage_lookup_failed" });
  }
});

app.patch("/api/public/manage/cancel", async (req, res) => {
  let operation = "token_validation";
  let tokenPresent = false;
  let bookingFound = false;
  let statusBefore = "";
  let statusAfter = "";
  let eventCreated = false;
  try {
    const token = String(req.get("X-Slotzy-Manage-Token") ?? "").trim();
    tokenPresent = Boolean(token);
    if (!token || token.length < 32) {
      return res.status(404).json({ error: "This manage link is invalid or has expired.", code: "invalid_manage_token" });
    }

    operation = "atomic_manage_cancellation";
    const result = await cancelBookingByManageTokenHash(hashManageToken(token));
    bookingFound = result?.bookingFound === true;
    statusBefore = String(result?.statusBefore ?? "").trim().toLowerCase();
    statusAfter = String(result?.statusAfter ?? "").trim().toLowerCase();
    eventCreated = result?.eventCreated === true;
    const httpResult = buildPublicManageCancelHttpResult({
      ...result,
      booking: publicManageBooking(result?.booking),
    });
    if (httpResult.status !== 200) return res.status(httpResult.status).json(httpResult.body);

    operation = "notification_dispatch";
    try {
      await sendBookingNotifications(null, {
        type: "booking_cancelled",
        booking: result.booking,
        previousBooking: result.previousBooking,
        shop: result.shop,
        barber: result.barber,
        owner: result.owner,
      });
    } catch {
      // Cancellation persistence is authoritative; notification delivery is
      // deliberately best-effort and must not turn a saved cancellation into
      // an error response.
    }
    return res.status(httpResult.status).json(httpResult.body);
  } catch (error) {
    console.error("[Slotzy:manage] PATCH /api/public/manage/cancel failed", {
      storage: STORAGE_ADAPTER,
      operation,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      tokenPresent,
      bookingFound,
      statusBefore,
      statusAfter,
      eventCreated,
    });
    return res.status(500).json({ error: "Could not cancel this appointment. Please try again.", code: "manage_cancel_failed" });
  }
});

// Request context only identifies a notification target; it is never public
// appointment authority and the response is intentionally non-enumerating.
app.post("/api/public/manage/recover", async (req, res) => {
  const genericResponse = () => res.json({ ok: true, message: "If we find a matching booking, we'll send the manage link to the contact used for the booking." });
  try {
    const contact = normalizeUsername(req.body?.contact);
    const shopReference = normalizeUsername(req.body?.shopId);
    const appointmentDate = normalizeUsername(req.body?.appointmentDate);
    if (!contact || !shopReference || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !isRecoveryRequestAllowed(contact)) return genericResponse();
    const db = await readStore();
    const requestedShop = db.shops.find((shop) => {
      const reference = shopReference.toLowerCase();
      return [shop?.id, shop?.slug, shop?.name, shop?.businessName]
        .some((value) => normalizeUsername(value).toLowerCase() === reference);
    });
    const shopId = normalizeUsername(requestedShop?.id);
    if (!shopId) return genericResponse();
    const normalizedContact = normalizeRecoveryContact(contact);
    const booking = db.bookings.find((entry) => {
      const start = getBookingStartDate(entry);
      return normalizeUsername(entry?.shopId) === shopId
        && normalizeRecoveryContact(entry?.clientContact) === normalizedContact
        && start?.toISOString().slice(0, 10) === appointmentDate
        && ["booked", "confirmed"].includes(normalizeBookingStatus(entry?.status));
    });
    if (!booking || !resolveClientEmailTarget(booking)) return genericResponse();
    const token = createManageToken();
    const manageLink = buildManageLinkForRecovery(req, token);
    if (!manageLink) return genericResponse();
    const nextBooking = { ...booking, manageTokenHash: hashManageToken(token), updatedAtISO: new Date().toISOString() };
    const index = db.bookings.findIndex((entry) => String(entry?.id) === String(booking.id));
    if (index < 0) return genericResponse();
    db.bookings[index] = nextBooking;
    await writeStore(db);
    if (STORAGE_ADAPTER === "postgres") await storeManageToken(nextBooking.id, nextBooking.manageTokenHash, new Date(new Date(nextBooking.endISO).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString());
    await dispatchBookingEmails([{
      to: resolveClientEmailTarget(nextBooking), subject: "Slotzy: your private manage link",
      html: buildEmailHtml({ headline: "Your private manage link", greeting: `Hi ${normalizeUsername(nextBooking.clientName) || "there"},`, intro: "Use this private link to view or cancel your appointment.", detailLines: [`Manage link: ${manageLink}`], closing: "If you did not request this, you can ignore this message." }),
      text: buildEmailText({ greeting: `Hi ${normalizeUsername(nextBooking.clientName) || "there"},`, intro: "Use this private link to view or cancel your appointment.", detailLines: [`Manage link: ${manageLink}`], closing: "If you did not request this, you can ignore this message." }),
      tags: ["manage_link_recovery", "client"], meta: { bookingId: nextBooking.id ?? null, shopId, recipient: "client", eventType: "manage_link_recovery" },
    }]);
    return genericResponse();
  } catch {
    return genericResponse();
  }
});

app.post("/api/bookings", optionalAuth, async (req, res) => {
  let bookingStage = "validation";
  let validationPassed = false;
  let conflictCheckPassed = false;
  let bookingWriteStarted = false;
  let bookingCreated = false;
  let emailOutboxCreatedCount = 0;
  try {
    const db = req.db;
    const user = req.user;
    const isAnonymous = !user;

    let targetBarberUsername = normalizeUsername(req.body?.barberUsername ?? req.body?.ownerUsername);
    if (user && isBarber(user)) {
      targetBarberUsername = user.username;
    } else if (user && isOwner(user) && !targetBarberUsername) {
      targetBarberUsername = user.username;
    }
    if (!targetBarberUsername) {
      return res.status(400).json({ error: "barberUsername is required", code: "invalid_provider" });
    }

    const provider = findUserByUsername(db, targetBarberUsername);
    if (!provider || !isProviderRole(provider.role)) {
      return res.status(400).json({ error: "selected provider is unavailable", code: "invalid_provider" });
    }

    const requestedShopId = normalizeUsername(req.body?.shopId);
    const providerShopId = getUserShopId(db, provider);
    let shopId = requestedShopId || providerShopId;

    if (user && isOwner(user)) {
      const ownerShopId = getUserShopId(db, user);
      if (!ownerShopId) {
        return res.status(400).json({ error: "owner must have a shop before creating bookings" });
      }
      if (!isUserManageableByOwner(db, user, provider.username)) {
        return res.status(403).json({ error: "owner can only create bookings for own shop providers" });
      }
      if (!shopId) shopId = ownerShopId;
      if (shopId !== ownerShopId) {
        return res.status(403).json({ error: "booking shopId must match owner's shop" });
      }
    } else if (user && isBarber(user)) {
      const barberShopId = getUserShopId(db, user);
      if (!usernamesEqual(provider.username, user.username)) {
        return res.status(403).json({ error: "barber can only create bookings for self" });
      }
      if (!shopId) shopId = barberShopId;
      if (shopId !== barberShopId) {
        return res.status(403).json({ error: "booking shopId must match barber's shop" });
      }
    } else if (requestedShopId && providerShopId && requestedShopId !== providerShopId) {
      return res.status(400).json({ error: "shop does not match selected provider", code: "invalid_shop" });
    }

    if (!shopId) {
      return res.status(400).json({ error: "unable to resolve shop for booking", code: "invalid_shop" });
    }

    const shop = findShopById(db, shopId);
    if (!shop) {
      return res.status(400).json({ error: "selected shop is unavailable", code: "invalid_shop" });
    }

    const serviceId = normalizeUsername(req.body?.serviceId);
    const service = db.services.find((entry) => normalizeUsername(entry?.id) === serviceId) || null;
    if (isAnonymous) {
      const serviceProvider = normalizeUsername(service?.barberUsername ?? service?.ownerUsername);
      if (
        !service
        || service?.active === false
        || normalizeUsername(service?.shopId) !== shopId
        || !usernamesEqual(serviceProvider, provider.username)
      ) {
        return res.status(400).json({ error: "selected service is unavailable", code: "invalid_service" });
      }
      if (!String(req.body?.clientName ?? "").trim() || !String(req.body?.clientContact ?? "").trim()) {
        return res.status(400).json({ error: "customer details are required", code: "invalid_booking" });
      }
    }

    const startISO = toIsoOrNull(req.body?.startISO ?? req.body?.start);
    const endISO = toIsoOrNull(req.body?.endISO ?? req.body?.end);
    if (req.body?.startISO !== undefined && !startISO) {
      return res.status(400).json({ error: "startISO must be a valid date", code: "invalid_booking" });
    }
    if (req.body?.endISO !== undefined && !endISO) {
      return res.status(400).json({ error: "endISO must be a valid date", code: "invalid_booking" });
    }
    if (isAnonymous && (!startISO || !endISO || new Date(startISO) >= new Date(endISO))) {
      return res.status(400).json({ error: "a valid appointment time is required", code: "invalid_booking" });
    }
    if (isAnonymous && new Date(startISO).getTime() <= Date.now()) {
      return res.status(409).json({ error: "selected time is no longer available", code: "slot_unavailable" });
    }

    const canonicalDuration = service
      ? normalizeDuration(service?.durationMinutes ?? service?.duration, 30)
      : normalizeDuration(req.body?.durationMinutes, 30);
    if (isAnonymous && new Date(endISO).getTime() - new Date(startISO).getTime() !== canonicalDuration * 60 * 1000) {
      return res.status(400).json({ error: "appointment duration does not match service", code: "invalid_service" });
    }

    const policy = normalizeBookingPolicy(shop?.bookingPolicy);
    const requestedStart = startISO ? new Date(startISO) : null;
    const requestedEnd = endISO ? new Date(endISO) : null;
    if (isAnonymous && requestedStart && requestedEnd) {
      if (!isBookingAllowedByAvailability(normalizeAvailabilityEntry(db.availability?.[provider.username]), requestedStart, requestedEnd)) {
        return res.status(409).json({ error: "selected time is no longer available", code: "slot_unavailable" });
      }
      const conflict = db.bookings.some((existing) => {
        const status = normalizeBookingStatus(existing?.status);
        if (status !== "booked" && status !== "confirmed") return false;
        if (!usernamesEqual(existing?.barberUsername ?? existing?.ownerUsername, provider.username)) return false;
        const existingStart = getBookingStartDate(existing);
        const existingEnd = getBookingEndDate(existing);
        if (!existingStart || !existingEnd) return false;
        const bufferMs = policy.bufferMinutes * 60 * 1000;
        return requestedStart.getTime() < existingEnd.getTime() + bufferMs
          && requestedEnd.getTime() > existingStart.getTime() - bufferMs;
      });
      if (conflict) {
        return res.status(409).json({ error: "selected time is no longer available", code: "booking_conflict" });
      }
      conflictCheckPassed = true;
    }

    let customerUsername = normalizeUsername(req.body?.customerUsername);
    if (isAnonymous) {
      customerUsername = "";
    } else if (isCustomer(user)) {
      customerUsername = user.username;
    }

    const now = new Date().toISOString();
    const deposit = isAnonymous
      ? normalizeDepositFields({
        depositRequired: policy.requireDeposit && policy.depositAmount > 0,
        depositAmount: policy.depositAmount,
        depositStatus: policy.requireDeposit && policy.depositAmount > 0 ? "unpaid" : "not_required",
      })
      : normalizeDepositFields(req.body);
    const status = isAnonymous ? "booked" : normalizeBookingStatus(req.body?.status);

    const manageToken = isAnonymous ? createManageToken() : "";
    const booking = {
      ...req.body,
      id: randomUUID(),
      shopId,
      ownerUsername: provider.username,
      barberUsername: provider.username,
      customerUsername: customerUsername || null,
      status,
      ...(service ? {
        serviceId: normalizeUsername(service.id),
        serviceName: String(service?.name ?? service?.title ?? "Service").trim(),
        serviceTitle: String(service?.title ?? service?.name ?? "Service").trim(),
        durationMinutes: canonicalDuration,
        price: normalizePrice(service?.price, 0),
      } : {}),
      ...deposit,
      createdAtISO: String(req.body?.createdAtISO ?? req.body?.createdAt ?? now),
      updatedAtISO: now,
      ...(manageToken ? { manageTokenHash: hashManageToken(manageToken) } : {}),
    };

    if (startISO) booking.startISO = startISO;
    if (endISO) booking.endISO = endISO;
    if (!booking.serviceName && booking.serviceTitle) booking.serviceName = String(booking.serviceTitle);
    if (!booking.serviceTitle && booking.serviceName) booking.serviceTitle = String(booking.serviceName);
    booking.confirmationCode = getConfirmationCode(booking.id);
    booking.timezone = normalizeAvailabilityEntry(db.availability?.[provider.username]).timezone;
    booking.policySnapshot = policy;
    booking.serviceSnapshot = service ? {
      id: normalizeUsername(service.id),
      name: booking.serviceName,
      durationMinutes: canonicalDuration,
      price: booking.price,
    } : {};
    booking.manageTokenExpiresAt = manageToken
      ? new Date(new Date(endISO).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    booking.requestId = booking.id;
    validationPassed = true;

    bookingStage = "booking_write";
    bookingWriteStarted = true;
    if (isAnonymous && STORAGE_ADAPTER === "postgres") {
      const created = await writeBooking(booking);
      const persistedId = normalizeUsername(created?.booking?.id);
      if (!persistedId) throw new Error("atomic booking write returned no booking id");
      booking.id = persistedId;
      db.bookings.push(booking);
    } else {
      db.bookings.push(booking);
      await writeStore(db);
    }
    bookingCreated = true;

    bookingStage = "notification_dispatch";
    const notificationResult = await sendBookingNotifications(db, {
      type: "booking_created",
      booking,
      // The raw token is available only during this request. When a hosted
      // app origin is configured, include its fragment link in the client
      // confirmation; provider messages intentionally receive no token.
      manageLink: buildManageLinkForRecovery(req, manageToken),
    });
    emailOutboxCreatedCount = getEmailMode() === "outbox" ? notificationResult.results.length : 0;

    // The token is returned once and is never included in logs, owner reads, or
    // subsequent booking responses. The browser turns it into the receipt URL.
    return res.status(201).json({ booking: publicManageBooking(booking), manageToken });
  } catch (error) {
    const code = String(error?.code ?? "").toLowerCase();
    const message = String(error?.message ?? "").toLowerCase();
    console.error("[Slotzy:bookings] POST /api/bookings failed", {
      route: "/api/bookings",
      storage: STORAGE_ADAPTER,
      operation: bookingStage,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
      networkFailurePresent: Object.keys(error?.storageDiagnostic ?? {}).some((key) => key.toLowerCase().includes("network")),
      validationPassed,
      conflictCheckPassed,
      bookingWriteStarted,
      bookingCreated,
      emailOutboxCreatedCount,
    });
    if (code.includes("23p01") || message.includes("booking_overlap")) {
      return res.status(409).json({ error: "selected time is no longer available", code: "booking_conflict" });
    }
    if (message.includes("slot_unavailable")) {
      return res.status(409).json({ error: "selected time is no longer available", code: "slot_unavailable" });
    }
    return res.status(500).json({ error: "booking could not be saved", code: "booking_save_failed" });
  }
});

app.patch("/api/bookings/:bookingId", requireAuth, requireRouteStore, async (req, res) => {
  let updateStage = "validate";
  try {
    const db = req.db;
    const user = req.user;
    const bookingId = normalizeUsername(req.params.bookingId);
    const index = db.bookings.findIndex((entry) => normalizeUsername(entry?.id) === bookingId);
    if (index < 0) {
      return res.status(404).json({ error: "booking not found" });
    }

    const current = db.bookings[index];
    if (isCustomer(user)) {
      return res.status(403).json({ error: "customers can only view or create bookings" });
    }

    const canManage = isOwner(user)
      ? canOwnerManageBooking(db, user, current)
      : canBarberManageBooking(user, current);
    if (!canManage) {
      return res.status(403).json({ error: "not allowed to update this booking" });
    }

    let targetBarberUsername = normalizeUsername(
      req.body?.barberUsername ?? req.body?.ownerUsername ?? current.barberUsername ?? current.ownerUsername
    );
    if (!targetBarberUsername) targetBarberUsername = normalizeUsername(user.username);

    if (isBarber(user) && !usernamesEqual(targetBarberUsername, user.username)) {
      return res.status(403).json({ error: "barber can only assign bookings to self" });
    }

    const provider = findUserByUsername(db, targetBarberUsername);
    if (!provider || !isProviderRole(provider.role)) {
      return res.status(400).json({ error: "barberUsername must reference a barber/owner account" });
    }

    let shopId = normalizeUsername(req.body?.shopId ?? current.shopId);
    if (!shopId) shopId = getUserShopId(db, provider);
    if (!shopId) {
      return res.status(400).json({ error: "unable to resolve shopId for booking" });
    }

    if (isOwner(user)) {
      const ownerShopId = getUserShopId(db, user);
      if (!isUserManageableByOwner(db, user, provider.username) || shopId !== ownerShopId) {
        return res.status(403).json({ error: "owner can only update bookings in own shop" });
      }
    } else {
      const barberShopId = getUserShopId(db, user);
      if (!usernamesEqual(provider.username, user.username) || shopId !== barberShopId) {
        return res.status(403).json({ error: "barber can only update bookings for self in own shop" });
      }
    }

    const next = { ...current };
    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (
        key === "id" ||
        key === "createdAtISO" ||
        key === "createdAt" ||
        key === "updatedAtISO" ||
        key === "status" ||
        key === "shopId" ||
        key === "barberUsername" ||
        key === "ownerUsername" ||
        key === "depositRequired" ||
        key === "depositAmount" ||
        key === "depositStatus"
      ) {
        return;
      }
      next[key] = value;
    });

    if (req.body?.status !== undefined) {
      next.status = normalizeBookingStatus(req.body.status);
    } else {
      next.status = normalizeBookingStatus(current.status);
    }

    if (req.body?.startISO !== undefined) {
      const startISO = toIsoOrNull(req.body.startISO);
      if (!startISO) return res.status(400).json({ error: "startISO must be a valid date" });
      next.startISO = startISO;
    }
    if (req.body?.endISO !== undefined) {
      const endISO = toIsoOrNull(req.body.endISO);
      if (!endISO) return res.status(400).json({ error: "endISO must be a valid date" });
      next.endISO = endISO;
    }

    const deposit = normalizeDepositFields({
      depositRequired: req.body?.depositRequired ?? current.depositRequired,
      depositAmount: req.body?.depositAmount ?? current.depositAmount,
      depositStatus: req.body?.depositStatus ?? current.depositStatus,
    });
    next.depositRequired = deposit.depositRequired;
    next.depositAmount = deposit.depositAmount;
    next.depositStatus = deposit.depositStatus;

    if (req.body?.customerUsername !== undefined) {
      next.customerUsername = normalizeUsername(req.body.customerUsername) || null;
    } else if (next.customerUsername !== undefined) {
      next.customerUsername = normalizeUsername(next.customerUsername) || null;
    }

    if (!next.serviceName && next.serviceTitle) next.serviceName = String(next.serviceTitle);
    if (!next.serviceTitle && next.serviceName) next.serviceTitle = String(next.serviceName);

    next.barberUsername = provider.username;
    next.ownerUsername = provider.username;
    next.shopId = shopId;
    next.updatedAtISO = new Date().toISOString();

    const requestKeys = Object.keys(req.body || {});
    const isStatusOnlyUpdate = requestKeys.length === 1 && requestKeys[0] === "status";
    updateStage = isStatusOnlyUpdate ? "persist status" : "persist booking";
    if (isStatusOnlyUpdate) {
      const persisted = await updateBookingStatus(current.id, next.status, next.updatedAtISO);
      if (!persisted) return res.status(404).json({ error: "booking not found" });
    } else {
      db.bookings[index] = next;
      await writeStore(db);
    }

    const currentStatus = normalizeBookingStatus(current?.status);
    const nextStatus = normalizeBookingStatus(next?.status);
    if (currentStatus !== "cancelled" && nextStatus === "cancelled") {
      await sendBookingNotifications(db, {
        type: "booking_cancelled",
        booking: next,
        previousBooking: current,
      });
    } else if (didBookingScheduleChange(current, next) && nextStatus !== "cancelled") {
      await sendBookingNotifications(db, {
        type: "booking_rescheduled",
        booking: next,
        previousBooking: current,
      });
    }

    return res.json({ booking: next });
  } catch (error) {
    console.error("[Slotzy:bookings] PATCH /api/bookings/:bookingId failed", {
      storage: STORAGE_ADAPTER,
      operation: updateStage,
      statusCode: 500,
      storageErrorCode: String(error?.code ?? ""),
      storageOperation: String(error?.storageDiagnostic?.operation ?? ""),
    });
    return res.status(500).json({ error: "appointment update could not be saved", code: "booking_update_failed" });
  }
});

app.get("/api/admin/shops", requireAdmin, (req, res) => {
  const db = req.db;
  const shops = db.shops
    .map((shop) => buildAdminShopSummary(db, shop))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), undefined, { sensitivity: "base" }));
  return res.json({ shops });
});

app.get("/api/admin/shops/:shopId/export", requireAdmin, (req, res) => {
  const db = req.db;
  const shopId = normalizeUsername(req.params.shopId);
  const payload = buildAdminShopExport(db, shopId);
  if (!payload) {
    return res.status(404).json({ error: "shop not found" });
  }
  return res.json(payload);
});

app.post("/api/admin/shops/:shopId/reset", requireAdmin, async (req, res) => {
  try {
    const db = req.db;
    const shopId = normalizeUsername(req.params.shopId);
    const shop = findShopById(db, shopId);
    if (!shop) {
      return res.status(404).json({ error: "shop not found" });
    }

    const owner = getShopOwnerUser(db, shop);
    const providerUsers = getShopProviderUsers(db, shopId);
    const usernamesToClear = new Set(providerUsers.map((user) => normalizeUsername(user.username)));
    if (owner) usernamesToClear.add(normalizeUsername(owner.username));
    const bookingIdsToRemove = new Set(
      getShopBookings(db, shopId).map((booking) => normalizeUsername(booking?.id)).filter(Boolean)
    );

    db.users = db.users.filter((user) => {
      const username = normalizeUsername(user?.username);
      if (!normalizeUsername(user?.shopId) || normalizeUsername(user?.shopId) !== shopId) {
        return true;
      }
      if (owner && usernamesEqual(username, owner.username)) {
        return true;
      }
      return !isBarber(user);
    });
    db.services = db.services.filter((service) => normalizeUsername(service?.shopId) !== shopId);
    db.bookings = db.bookings.filter((booking) => !bookingIdsToRemove.has(normalizeUsername(booking?.id)));
    Object.keys(db.availability || {}).forEach((username) => {
      if (usernamesToClear.has(normalizeUsername(username))) {
        delete db.availability[username];
      }
    });

    await writeStore(db);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/admin/seed-demo-shop", requireAdmin, async (_req, res) => {
  try {
    const shop = await seedAdminDemoShop();
    return res.status(201).json({ shop });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/admin/clear-all", requireAdmin, async (_req, res) => {
  if (IS_PRODUCTION) {
    return res.status(403).json({ error: "clear all is disabled in production" });
  }

  try {
    await writeStore(EMPTY_DB);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Slotzy API server listening on http://localhost:${PORT}`);
  void logStagingSupabaseDnsProbe();
});
