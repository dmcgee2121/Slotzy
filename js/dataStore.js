export const KEYS = {
  SESSION_USER: "Slotzy_user",
  AUTH_TOKEN: "Slotzy_auth_token",
  USERS: "Slotzy_users",
  PROFILES: "Slotzy_profiles",
  SHOP: "Slotzy_shop",
  SHOPS: "Slotzy_shops",
  SERVICES: "Slotzy_services",
  STAFF: "Slotzy_staff",
  BOOKINGS: "Slotzy_bookings",
  AVAILABILITY: "Slotzy_availability",
};

export const EVENTS = {
  BOOKINGS_UPDATED: "slotzy:bookings-updated",
};

const API_MODE_KEY = "Slotzy_api_mode";
const API_DEFAULT_BASE_URL = "http://localhost:3001/api";
const DEMO_MODE_KEY = "Slotzy_demoMode";
const DEMO_SEEDED_KEY = "Slotzy_demoSeeded";
const LEGACY_DEMO_MODE_KEYS = ["Slotzy_demo_mode"];
const LEGACY_DEMO_SEEDED_KEYS = ["Slotzy_demo_seed_version"];
const BACKUP_PREFIX = "Slotzy_";
const BACKUP_FORMAT = "slotzy-backup";
const BACKUP_VERSION = 1;

const DEMO_IDS = {
  shopId: "shop_demo_1",
  ownerUsername: "owner_demo",
  barberJordanUsername: "jordan_demo",
  barberAlexUsername: "alex_demo",
  customerUsername: "client_demo",
};

function readInitialApiEnabled() {
  try {
    return String(localStorage.getItem(API_MODE_KEY) ?? "").trim() === "1";
  } catch {
    return false;
  }
}

function persistApiEnabled(enabled) {
  try {
    localStorage.setItem(API_MODE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

const API_CONFIG = {
  enabled: readInitialApiEnabled(),
  baseUrl: API_DEFAULT_BASE_URL,
};

export let DATA_MODE = API_CONFIG.enabled ? "api" : "local";

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
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const BUFFER_OPTIONS = new Set([0, 5, 10, 15]);
const LEGACY_TOKEN_KEYS = ["Slotzy_token"];
let didEnsureDataModel = false;

function normalizeApiBaseUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return API_DEFAULT_BASE_URL;
  return input.replace(/\/+$/, "");
}

function isApiModeEnabled() {
  return DATA_MODE === "api" && API_CONFIG.enabled;
}

export function setApiEnabled(enabled) {
  const next = Boolean(enabled);
  API_CONFIG.enabled = next;
  DATA_MODE = next ? "api" : "local";
  persistApiEnabled(next);
}

export function configureApi(options = {}) {
  if (options && typeof options === "object" && !Array.isArray(options)) {
    if (Object.prototype.hasOwnProperty.call(options, "enabled")) {
      setApiEnabled(Boolean(options.enabled));
    }
    if (Object.prototype.hasOwnProperty.call(options, "baseUrl")) {
      API_CONFIG.baseUrl = normalizeApiBaseUrl(options.baseUrl);
    }
  }
  return {
    enabled: API_CONFIG.enabled,
    baseUrl: API_CONFIG.baseUrl,
    mode: DATA_MODE,
  };
}

export function setDataMode(mode) {
  const normalized = String(mode ?? "").trim().toLowerCase();
  if (normalized !== "local" && normalized !== "api") {
    throw new Error("Invalid data mode");
  }
  DATA_MODE = normalized;
  API_CONFIG.enabled = normalized === "api";
  persistApiEnabled(API_CONFIG.enabled);
}

function warnApiFallback(label, error) {
  console.warn(
    `[Slotzy:dataStore] API ${label} failed; falling back to localStorage.`,
    error
  );
}

function runAsync(localFn, options = {}) {
  const localTask = () => Promise.resolve(localFn());
  if (!isApiModeEnabled()) return localTask();

  const apiFn = typeof options === "function"
    ? options
    : (options && typeof options.apiFn === "function" ? options.apiFn : null);
  if (!apiFn) return localTask();

  const label = typeof options === "object" && options
    ? String(options.label ?? "operation")
    : "operation";

  return Promise.resolve()
    .then(() => apiFn())
    .catch((error) => {
      warnApiFallback(label, error);
      return localTask();
    });
}

function isObjectRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toRecordId(value) {
  return String(value ?? "").trim();
}

function upsertUserInList(users, user) {
  const username = String(user?.username ?? "").trim();
  if (!username) return users;
  const next = Array.isArray(users) ? [...users] : [];
  const index = next.findIndex(
    (entry) => String(entry?.username ?? "").trim().toLowerCase() === username.toLowerCase()
  );
  const current = index >= 0 ? next[index] : {};
  const role = normalizeRole(user?.role ?? current?.role);

  const merged = {
    ...current,
    username,
    role,
    displayName: String(user?.displayName ?? current?.displayName ?? username).trim() || username,
  };

  const shopId = String(user?.shopId ?? current?.shopId ?? "").trim();
  if (role === "customer") {
    merged.shopId = null;
  } else if (shopId) {
    merged.shopId = shopId;
  }

  if (index >= 0) next[index] = merged;
  else next.push(merged);
  return next;
}

function buildApiUrl(path) {
  const base = normalizeApiBaseUrl(API_CONFIG.baseUrl);
  const suffix = String(path ?? "").replace(/^\/+/, "");
  if (!suffix) return base;
  return `${base}/${suffix}`;
}

function getApiErrorMessage(payload, fallback) {
  if (isObjectRecord(payload)) {
    const error = String(payload.error ?? "").trim();
    if (error) return error;
    const message = String(payload.message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Missing auth token for API request");
  }

  let response;
  try {
    response = await fetch(buildApiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(String(error?.message ?? "Network request failed"));
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `API ${method} ${path} failed`));
  }

  return payload ?? {};
}

export function safeParse(json, fallback) {
  try {
    if (!json) return fallback;
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function readLocal(key, fallback) {
  return safeParse(localStorage.getItem(key), fallback);
}

export function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readSession(key, fallback) {
  return safeParse(sessionStorage.getItem(key), fallback);
}

export function writeSession(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function listSlotzyStorageEntries(storage) {
  const entries = {};
  if (!storage || typeof storage.length !== "number") return entries;

  for (let index = 0; index < storage.length; index += 1) {
    const key = String(storage.key(index) ?? "").trim();
    if (!key.startsWith(BACKUP_PREFIX)) continue;
    entries[key] = String(storage.getItem(key) ?? "");
  }

  return entries;
}

function clearSlotzyStorageEntries(storage) {
  if (!storage || typeof storage.length !== "number") return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = String(storage.key(index) ?? "").trim();
    if (!key.startsWith(BACKUP_PREFIX)) continue;
    keys.push(key);
  }
  keys.forEach((key) => removeStorageRecord(storage, key));
}

function countRecordKeys(record) {
  return record && typeof record === "object" && !Array.isArray(record)
    ? Object.keys(record).length
    : 0;
}

function syncApiModeFromStorage() {
  API_CONFIG.enabled = readInitialApiEnabled();
  DATA_MODE = API_CONFIG.enabled ? "api" : "local";
}

export function createSlotzyBackup() {
  ensureDataModel();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtISO: new Date().toISOString(),
    mode: {
      dataMode: DATA_MODE,
      apiEnabled: API_CONFIG.enabled,
      apiBaseUrl: API_CONFIG.baseUrl,
    },
    localStorage: listSlotzyStorageEntries(localStorage),
    sessionStorage: listSlotzyStorageEntries(sessionStorage),
  };
}

export function getSlotzyBackupSummary(payload) {
  const backup = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};

  return {
    format: String(backup.format ?? "").trim(),
    version: Number(backup.version ?? 0),
    exportedAtISO: String(backup.exportedAtISO ?? "").trim(),
    localKeyCount: countRecordKeys(backup.localStorage),
    sessionKeyCount: countRecordKeys(backup.sessionStorage),
  };
}

export function restoreSlotzyBackup(payload, options = {}) {
  const backup = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : null;
  if (!backup) {
    throw new Error("Backup file is invalid.");
  }
  if (String(backup.format ?? "").trim() !== BACKUP_FORMAT) {
    throw new Error("Backup file is not a Slotzy export.");
  }

  const localEntries = backup.localStorage;
  const sessionEntries = backup.sessionStorage;
  if (!isObjectRecord(localEntries) || !isObjectRecord(sessionEntries)) {
    throw new Error("Backup file is missing storage data.");
  }

  const replaceExisting = options?.replaceExisting !== false;
  if (replaceExisting) {
    clearSlotzyStorageEntries(localStorage);
    clearSlotzyStorageEntries(sessionStorage);
  }

  Object.entries(localEntries).forEach(([key, value]) => {
    if (!String(key).startsWith(BACKUP_PREFIX)) return;
    localStorage.setItem(String(key), String(value ?? ""));
  });
  Object.entries(sessionEntries).forEach(([key, value]) => {
    if (!String(key).startsWith(BACKUP_PREFIX)) return;
    sessionStorage.setItem(String(key), String(value ?? ""));
  });

  didEnsureDataModel = false;
  syncApiModeFromStorage();
  ensureDataModel();
  dispatchClientEvent(EVENTS.BOOKINGS_UPDATED, { source: "backup-restore" });

  return getSlotzyBackupSummary(backup);
}

function dispatchClientEvent(name, detail = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(new CustomEvent(String(name ?? ""), { detail }));
  } catch {
    // ignore custom-event failures
  }
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function toSlug(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `shop-${Date.now()}`;
}

function normalizeRole(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "customer") return "customer";
  if (normalized === "barber") return "barber";
  return "owner";
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
    id: String(block?.id ?? createId("to")),
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
      enabled: Boolean(daySource.enabled ?? fallback.enabled),
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

  return {
    timezone,
    bufferMinutes,
    weekly,
    timeOff,
  };
}

function normalizeStatus(statusValue) {
  const status = String(statusValue ?? "booked").trim().toLowerCase();
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
  return "booked";
}

function normalizeShopRecord(shop, index) {
  const source = isObjectRecord(shop) ? shop : {};
  const policy = isObjectRecord(source.bookingPolicy) ? source.bookingPolicy : {};
  const logoDataUrl = String(source.logoDataUrl ?? "").trim();
  const coverDataUrl = String(source.coverDataUrl ?? "").trim();
  const name = String(shop?.name ?? shop?.businessName ?? "").trim() || `Shop ${index + 1}`;
  return {
    ...source,
    id: String(shop?.id ?? createId("shop")),
    name,
    slug: toSlug(shop?.slug ?? name),
    logoDataUrl: logoDataUrl || null,
    coverDataUrl: coverDataUrl || null,
    createdAtISO: String(shop?.createdAtISO ?? shop?.createdAt ?? new Date().toISOString()),
    bookingPolicy: {
      ...DEFAULT_BOOKING_POLICY,
      ...policy,
    },
  };
}

function getLegacyShopName() {
  const legacyShop = readLocal(KEYS.SHOP, null);
  if (!legacyShop || typeof legacyShop !== "object" || Array.isArray(legacyShop)) {
    return "My Shop";
  }
  return String(legacyShop.businessName ?? legacyShop.name ?? "My Shop").trim() || "My Shop";
}

function getPrimaryOwnerUsername(users) {
  const owner = users.find((user) => user.role === "owner");
  if (owner) return owner.username;
  const barber = users.find((user) => user.role === "barber");
  if (barber) return barber.username;
  return "";
}

function getShopIdForUser(usersByUsername, username, fallbackShopId) {
  const key = String(username ?? "").trim().toLowerCase();
  if (!key) return fallbackShopId;
  const match = usersByUsername.get(key);
  const shopId = String(match?.shopId ?? "").trim();
  return shopId || fallbackShopId;
}

function normalizeServiceRecord(service, usersByUsername, fallbackShopId, fallbackOwnerUsername) {
  const name = String(service?.name ?? service?.title ?? "").trim() || "Service";
  const id = String(service?.id ?? createId("svc"));
  const barberUsername = String(
    service?.barberUsername ??
    service?.ownerUsername ??
    fallbackOwnerUsername
  ).trim();
  const shopId = String(
    service?.shopId ??
    getShopIdForUser(usersByUsername, barberUsername, fallbackShopId)
  ).trim() || fallbackShopId;

  const priceRaw = Number(service?.price ?? 0);
  const durationRaw = Number(service?.durationMinutes ?? service?.duration ?? 0);

  return {
    ...service,
    id,
    name,
    title: name,
    price: Number.isFinite(priceRaw) ? Number(priceRaw.toFixed(2)) : 0,
    durationMinutes: Number.isFinite(durationRaw) ? Math.max(1, Math.round(durationRaw)) : 30,
    duration: Number.isFinite(durationRaw) ? Math.max(1, Math.round(durationRaw)) : 30,
    barberUsername,
    ownerUsername: barberUsername,
    shopId,
    createdAtISO: String(service?.createdAtISO ?? service?.createdAt ?? new Date().toISOString()),
    active: service?.active !== false,
  };
}

function normalizeBookingRecord(booking, usersByUsername, fallbackShopId, fallbackOwnerUsername) {
  const ownerUsername = String(
    booking?.ownerUsername ??
    booking?.barberUsername ??
    fallbackOwnerUsername
  ).trim();
  const shopId = String(
    booking?.shopId ??
    getShopIdForUser(usersByUsername, ownerUsername, fallbackShopId)
  ).trim() || fallbackShopId;

  const next = {
    ...booking,
    id: String(booking?.id ?? createId("bk")),
    ownerUsername,
    barberUsername: ownerUsername,
    shopId,
    status: normalizeStatus(booking?.status),
  };

  const depositRequired = Boolean(booking?.depositRequired);
  const depositAmountRaw = Number(booking?.depositAmount ?? 0);
  const depositAmount = Number.isFinite(depositAmountRaw) && depositAmountRaw > 0
    ? Number(depositAmountRaw.toFixed(2))
    : 0;
  next.depositRequired = depositRequired;
  next.depositAmount = depositRequired ? depositAmount : 0;
  next.depositStatus = depositRequired
    ? String(booking?.depositStatus ?? "unpaid").trim().toLowerCase() || "unpaid"
    : "not_required";

  if (!next.customerUsername && booking?.clientName) {
    next.customerUsername = String(booking.clientName);
  }
  return next;
}

function jsonChanged(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function ensureLegacyShopCompatibility(shops) {
  const primaryShop = Array.isArray(shops) && shops.length > 0 ? shops[0] : null;
  if (!primaryShop) return;

  const legacy = readLocal(KEYS.SHOP, null);
  const legacySource = legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy : {};
  const policy = primaryShop?.bookingPolicy && typeof primaryShop.bookingPolicy === "object" && !Array.isArray(primaryShop.bookingPolicy)
    ? primaryShop.bookingPolicy
    : (legacySource?.bookingPolicy && typeof legacySource.bookingPolicy === "object" && !Array.isArray(legacySource.bookingPolicy)
      ? legacySource.bookingPolicy
      : {});
  const address = primaryShop?.address && typeof primaryShop.address === "object" && !Array.isArray(primaryShop.address)
    ? primaryShop.address
    : (legacySource?.address && typeof legacySource.address === "object" && !Array.isArray(legacySource.address)
      ? legacySource.address
      : {});
  const logoDataUrl = Object.prototype.hasOwnProperty.call(primaryShop, "logoDataUrl")
    ? (String(primaryShop?.logoDataUrl ?? "").trim() || null)
    : (String(legacySource?.logoDataUrl ?? "").trim() || null);
  const coverDataUrl = Object.prototype.hasOwnProperty.call(primaryShop, "coverDataUrl")
    ? (String(primaryShop?.coverDataUrl ?? "").trim() || null)
    : (String(legacySource?.coverDataUrl ?? "").trim() || null);
  const shopPhone = Object.prototype.hasOwnProperty.call(primaryShop, "shopPhone")
    ? String(primaryShop?.shopPhone ?? "").trim()
    : String(legacySource?.shopPhone ?? "").trim();
  const shopEmail = Object.prototype.hasOwnProperty.call(primaryShop, "shopEmail")
    ? String(primaryShop?.shopEmail ?? "").trim()
    : String(legacySource?.shopEmail ?? "").trim();
  const name = String(primaryShop?.name ?? legacySource?.businessName ?? legacySource?.name ?? "My Shop").trim() || "My Shop";
  const nextLegacy = {
    ...legacySource,
    businessName: name,
    name,
    shopId: String(primaryShop.id ?? legacySource?.shopId ?? ""),
    logoDataUrl,
    coverDataUrl,
    shopPhone,
    shopEmail,
    address: { ...address },
    bookingPolicy: {
      ...DEFAULT_BOOKING_POLICY,
      ...policy,
    },
  };

  if (jsonChanged(legacy, nextLegacy)) {
    writeLocal(KEYS.SHOP, nextLegacy);
  }
}

function migrateLegacyData() {
  const rawUsers = readLocal(KEYS.USERS, []);
  const rawShops = readLocal(KEYS.SHOPS, []);
  const usersInput = Array.isArray(rawUsers) ? rawUsers : [];
  const shopsInput = Array.isArray(rawShops) ? rawShops : [];

  const normalizedShops = (shopsInput.length > 0
    ? shopsInput
    : [{ name: getLegacyShopName() }]
  ).map((shop, index) => normalizeShopRecord(shop, index));

  const fallbackShopId = normalizedShops[0]?.id || createId("shop");

  const seenUsernames = new Set();
  const normalizedUsers = [];
  usersInput.forEach((user) => {
    const username = String(user?.username ?? "").trim();
    if (!username) return;
    const lower = username.toLowerCase();
    if (seenUsernames.has(lower)) return;
    seenUsernames.add(lower);

    const role = normalizeRole(user?.role);
    const isClient = role === "customer";
    const shopId = isClient
      ? null
      : String(user?.shopId ?? fallbackShopId).trim() || fallbackShopId;
    const displayName = String(user?.displayName ?? username).trim() || username;
    normalizedUsers.push({
      ...user,
      username,
      password: String(user?.password ?? ""),
      role,
      shopId,
      displayName,
    });
  });

  if (!normalizedUsers.some((user) => user.role === "owner") && normalizedUsers.length > 0) {
    const firstNonCustomer = normalizedUsers.find((user) => user.role !== "customer");
    if (firstNonCustomer) firstNonCustomer.role = "owner";
  }

  const usersByUsername = new Map(
    normalizedUsers.map((user) => [String(user.username).toLowerCase(), user])
  );
  const fallbackOwnerUsername = getPrimaryOwnerUsername(normalizedUsers);

  const rawServices = readLocal(KEYS.SERVICES, []);
  const servicesInput = Array.isArray(rawServices) ? rawServices : [];
  const normalizedServices = servicesInput.map((service) =>
    normalizeServiceRecord(service, usersByUsername, fallbackShopId, fallbackOwnerUsername)
  );

  const rawAvailability = readLocal(KEYS.AVAILABILITY, {});
  let availabilityMap = {};
  const isLegacySingleAvailability = rawAvailability
    && typeof rawAvailability === "object"
    && !Array.isArray(rawAvailability)
    && Object.prototype.hasOwnProperty.call(rawAvailability, "weekly");

  if (isLegacySingleAvailability) {
    if (fallbackOwnerUsername) {
      availabilityMap[fallbackOwnerUsername] = normalizeAvailabilityEntry(rawAvailability);
    }
  } else if (rawAvailability && typeof rawAvailability === "object" && !Array.isArray(rawAvailability)) {
    Object.entries(rawAvailability).forEach(([username, entry]) => {
      const key = String(username ?? "").trim();
      if (!key) return;
      availabilityMap[key] = normalizeAvailabilityEntry(entry);
    });
  }

  normalizedUsers
    .filter((user) => user.role === "owner" || user.role === "barber")
    .forEach((user) => {
      if (!availabilityMap[user.username]) {
        availabilityMap[user.username] = createDefaultAvailability();
      }
    });

  const rawBookings = readLocal(KEYS.BOOKINGS, []);
  const bookingsInput = Array.isArray(rawBookings) ? rawBookings : [];
  const normalizedBookings = bookingsInput.map((booking) =>
    normalizeBookingRecord(booking, usersByUsername, fallbackShopId, fallbackOwnerUsername)
  );

  if (jsonChanged(rawShops, normalizedShops)) writeLocal(KEYS.SHOPS, normalizedShops);
  if (jsonChanged(rawUsers, normalizedUsers)) writeLocal(KEYS.USERS, normalizedUsers);
  if (jsonChanged(rawServices, normalizedServices)) writeLocal(KEYS.SERVICES, normalizedServices);
  if (jsonChanged(rawAvailability, availabilityMap)) writeLocal(KEYS.AVAILABILITY, availabilityMap);
  if (jsonChanged(rawBookings, normalizedBookings)) writeLocal(KEYS.BOOKINGS, normalizedBookings);

  ensureLegacyShopCompatibility(normalizedShops);
}

export function ensureDataModel() {
  if (didEnsureDataModel) return;
  didEnsureDataModel = true;
  migrateLegacyData();
}

export function getSessionUser() {
  ensureDataModel();
  const parsed = readSession(KEYS.SESSION_USER, null);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function getAuthToken() {
  ensureDataModel();

  const primary = String(localStorage.getItem(KEYS.AUTH_TOKEN) ?? "").trim();
  if (primary) return primary;

  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    const legacyLocal = String(localStorage.getItem(legacyKey) ?? "").trim();
    if (legacyLocal) return legacyLocal;
    const legacySession = String(sessionStorage.getItem(legacyKey) ?? "").trim();
    if (legacySession) return legacySession;
  }

  return "";
}

export function setAuthToken(token) {
  ensureDataModel();
  const value = String(token ?? "").trim();
  if (!value) {
    clearAuthToken();
    return;
  }

  localStorage.setItem(KEYS.AUTH_TOKEN, value);
  sessionStorage.removeItem(KEYS.AUTH_TOKEN);

  LEGACY_TOKEN_KEYS.forEach((legacyKey) => {
    localStorage.removeItem(legacyKey);
    sessionStorage.removeItem(legacyKey);
  });
}

export function clearAuthToken() {
  ensureDataModel();
  localStorage.removeItem(KEYS.AUTH_TOKEN);
  sessionStorage.removeItem(KEYS.AUTH_TOKEN);
  LEGACY_TOKEN_KEYS.forEach((legacyKey) => {
    localStorage.removeItem(legacyKey);
    sessionStorage.removeItem(legacyKey);
  });
}

export function setSessionUser(user) {
  ensureDataModel();
  writeSession(KEYS.SESSION_USER, user);
}

export function clearSessionUser() {
  ensureDataModel();
  sessionStorage.removeItem(KEYS.SESSION_USER);
}

function normalizeApiAuthUser(user) {
  if (!isObjectRecord(user)) return null;
  const username = String(user.username ?? "").trim();
  if (!username) return null;
  return {
    username,
    role: normalizeRole(user.role),
    displayName: String(user.displayName ?? username).trim() || username,
    shopId: String(user.shopId ?? "").trim() || null,
  };
}

function syncApiAuthUserToLocalState(authUser) {
  const normalizedUser = normalizeApiAuthUser(authUser);
  if (!normalizedUser) return null;

  const sessionUser = {
    username: normalizedUser.username,
    role: normalizedUser.role,
  };
  setSessionUser(sessionUser);

  const users = upsertUserInList(getUsers(), normalizedUser);
  saveUsers(users);
  return sessionUser;
}

function normalizeAvailabilityMapFromApi(payload) {
  if (!isObjectRecord(payload)) return {};

  const availability = payload.availability;
  if (isObjectRecord(availability) && Object.prototype.hasOwnProperty.call(availability, "weekly")) {
    const barberUsername = String(payload.barberUsername ?? "").trim();
    if (!barberUsername) return {};
    return {
      [barberUsername]: normalizeAvailabilityEntry(availability),
    };
  }

  if (!isObjectRecord(availability)) return {};
  const map = {};
  Object.entries(availability).forEach(([username, entry]) => {
    const key = String(username ?? "").trim();
    if (!key) return;
    map[key] = normalizeAvailabilityEntry(entry);
  });
  return map;
}

async function apiGetSessionUser() {
  const payload = await apiRequest("/auth/me");
  const sessionUser = syncApiAuthUserToLocalState(payload?.user);
  if (!sessionUser) {
    throw new Error("Invalid user payload from auth/me");
  }
  return sessionUser;
}

async function apiGetUsers() {
  await apiGetSessionUser();
  return getUsers();
}

async function apiSaveUsers(users) {
  await apiGetSessionUser();
  saveUsers(users);
  return getUsers();
}

async function apiGetShops() {
  const payload = await apiRequest("/shops");
  const shops = Array.isArray(payload?.shops) ? payload.shops : [];
  saveShops(shops);
  return shops;
}

async function apiSaveShops(shopsInput) {
  const nextShops = Array.isArray(shopsInput) ? shopsInput : [];
  const current = await apiGetShops();
  const currentIds = new Set(
    current.map((shop) => toRecordId(shop?.id)).filter(Boolean)
  );

  for (const shop of nextShops) {
    const id = toRecordId(shop?.id);
    const payload = { ...shop };
    delete payload.id;

    if (id && currentIds.has(id)) {
      await apiRequest(`/shops/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: payload,
      });
    } else {
      await apiRequest("/shops", {
        method: "POST",
        body: payload,
      });
    }
  }

  const refreshed = await apiGetShops();
  ensureLegacyShopCompatibility(refreshed);
  return refreshed;
}

function toLegacyShopShape(shop) {
  if (!isObjectRecord(shop)) return null;
  const policy = isObjectRecord(shop.bookingPolicy) ? shop.bookingPolicy : {};
  const name = String(shop.name ?? shop.businessName ?? "My Shop").trim() || "My Shop";
  return {
    ...shop,
    name,
    businessName: String(shop.businessName ?? name).trim() || name,
    shopId: String(shop.id ?? "").trim(),
    bookingPolicy: {
      ...DEFAULT_BOOKING_POLICY,
      ...policy,
    },
  };
}

async function apiGetShop() {
  const shops = await apiGetShops();
  const primary = toLegacyShopShape(shops[0] ?? null);
  if (primary) saveShop(primary);
  return primary;
}

async function apiSaveShop(shopObj) {
  const payload = isObjectRecord(shopObj) ? { ...shopObj } : {};
  const candidateName = String(payload.name ?? payload.businessName ?? "").trim();
  if (candidateName) {
    payload.name = candidateName;
    payload.businessName = candidateName;
  }

  const requestedId = toRecordId(payload.id ?? payload.shopId);
  delete payload.id;
  delete payload.shopId;

  if (requestedId) {
    await apiRequest(`/shops/${encodeURIComponent(requestedId)}`, {
      method: "PATCH",
      body: payload,
    });
  } else {
    const shops = await apiGetShops();
    const first = shops[0];
    const firstId = toRecordId(first?.id);
    if (firstId) {
      await apiRequest(`/shops/${encodeURIComponent(firstId)}`, {
        method: "PATCH",
        body: payload,
      });
    } else {
      await apiRequest("/shops", {
        method: "POST",
        body: payload,
      });
    }
  }

  const refreshed = await apiGetShop();
  if (refreshed) saveShop(refreshed);
  return refreshed;
}

async function apiGetServices() {
  const payload = await apiRequest("/services");
  const services = Array.isArray(payload?.services) ? payload.services : [];
  saveServices(services);
  return services;
}

async function apiSaveServices(servicesInput) {
  const nextServices = Array.isArray(servicesInput) ? servicesInput : [];
  const current = await apiGetServices();
  const currentById = new Map(
    current
      .map((service) => [toRecordId(service?.id), service])
      .filter(([id]) => Boolean(id))
  );
  const nextIds = new Set();

  for (const service of nextServices) {
    const id = toRecordId(service?.id);
    const payload = { ...service };
    delete payload.id;

    if (id && currentById.has(id)) {
      await apiRequest(`/services/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: payload,
      });
      nextIds.add(id);
    } else {
      const created = await apiRequest("/services", {
        method: "POST",
        body: service,
      });
      const createdId = toRecordId(created?.service?.id);
      if (createdId) nextIds.add(createdId);
    }
  }

  for (const service of current) {
    const id = toRecordId(service?.id);
    if (!id || nextIds.has(id)) continue;
    await apiRequest(`/services/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  return apiGetServices();
}

async function apiGetBookings() {
  const payload = await apiRequest("/bookings");
  const bookings = Array.isArray(payload?.bookings) ? payload.bookings : [];
  saveBookings(bookings);
  return bookings;
}

async function apiSaveBookings(bookingsInput, options = {}) {
  const nextBookings = Array.isArray(bookingsInput) ? bookingsInput : [];
  const current = await apiGetBookings();
  const requestHeaders = options?.manualNotify
    ? { "X-Slotzy-Notify-Mode": "manual" }
    : undefined;
  const currentById = new Map(
    current
      .map((booking) => [toRecordId(booking?.id), booking])
      .filter(([id]) => Boolean(id))
  );

  const nextIds = new Set();
  for (const booking of nextBookings) {
    const id = toRecordId(booking?.id);
    const payload = { ...booking };
    delete payload.id;

    if (id && currentById.has(id)) {
      await apiRequest(`/bookings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: payload,
        headers: requestHeaders,
      });
      nextIds.add(id);
    } else {
      const created = await apiRequest("/bookings", {
        method: "POST",
        body: booking,
        headers: requestHeaders,
      });
      const createdId = toRecordId(created?.booking?.id);
      if (createdId) nextIds.add(createdId);
    }
  }

  const removedCount = current
    .map((booking) => toRecordId(booking?.id))
    .filter((id) => id && !nextIds.has(id))
    .length;
  if (removedCount > 0) {
    console.warn(
      "[Slotzy:dataStore] Booking delete sync is not available via API; keeping existing remote bookings."
    );
  }

  return apiGetBookings();
}

async function apiGetAvailabilityMap() {
  const payload = await apiRequest("/availability");
  const nextMap = normalizeAvailabilityMapFromApi(payload);
  saveAvailabilityMap(nextMap);
  return nextMap;
}

async function apiSaveAvailabilityMap(mapInput) {
  const map = isObjectRecord(mapInput) ? mapInput : {};
  for (const [username, availability] of Object.entries(map)) {
    const key = String(username ?? "").trim();
    if (!key) continue;
    await apiRequest("/availability", {
      method: "PUT",
      body: {
        barberUsername: key,
        availability: normalizeAvailabilityEntry(availability),
      },
    });
  }
  return apiGetAvailabilityMap();
}

async function apiGetAvailabilityForBarber(username) {
  const key = String(username ?? "").trim();
  if (!key) {
    return createDefaultAvailability();
  }
  const payload = await apiRequest(`/availability?barberUsername=${encodeURIComponent(key)}`);
  const map = normalizeAvailabilityMapFromApi(payload);
  const availability = normalizeAvailabilityEntry(
    map[key] ?? payload?.availability
  );
  const current = getAvailabilityMap();
  current[key] = availability;
  saveAvailabilityMap(current);
  return availability;
}

async function apiSaveAvailabilityForBarber(username, availability) {
  const key = String(username ?? "").trim();
  if (!key) return createDefaultAvailability();
  await apiRequest("/availability", {
    method: "PUT",
    body: {
      barberUsername: key,
      availability: normalizeAvailabilityEntry(availability),
    },
  });
  return apiGetAvailabilityForBarber(key);
}

export function getSessionUserAsync() {
  return runAsync(
    () => getSessionUser(),
    { apiFn: () => apiGetSessionUser(), label: "session restore" }
  );
}

export function getAuthTokenAsync() {
  return runAsync(() => getAuthToken());
}

export function setSessionUserAsync(user) {
  return runAsync(() => setSessionUser(user));
}

export function setAuthTokenAsync(token) {
  return runAsync(() => setAuthToken(token));
}

export function clearSessionUserAsync() {
  return runAsync(() => clearSessionUser());
}

export function clearAuthTokenAsync() {
  return runAsync(() => clearAuthToken());
}

export function getUsers() {
  ensureDataModel();
  const parsed = readLocal(KEYS.USERS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveUsers(users) {
  ensureDataModel();
  writeLocal(KEYS.USERS, users);
}

export function getUsersAsync() {
  return runAsync(
    () => getUsers(),
    { apiFn: () => apiGetUsers(), label: "users read" }
  );
}

export function saveUsersAsync(users) {
  return runAsync(
    () => saveUsers(users),
    { apiFn: () => apiSaveUsers(users), label: "users write" }
  );
}

export function getProfiles() {
  ensureDataModel();
  const parsed = readLocal(KEYS.PROFILES, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

export function saveProfiles(map) {
  ensureDataModel();
  writeLocal(KEYS.PROFILES, map);
}

export function getProfile(username) {
  ensureDataModel();
  const key = String(username ?? "").trim();
  if (!key) return null;
  const profiles = getProfiles();
  const profile = profiles[key];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  return profile;
}

export function saveProfile(username, profileObj) {
  ensureDataModel();
  const key = String(username ?? "").trim();
  if (!key) return;
  const profiles = getProfiles();
  profiles[key] = profileObj;
  saveProfiles(profiles);
}

export function getProfilesAsync() {
  return runAsync(() => getProfiles());
}

export function saveProfilesAsync(map) {
  return runAsync(() => saveProfiles(map));
}

export function getProfileAsync(username) {
  return runAsync(() => getProfile(username));
}

export function saveProfileAsync(username, profileObj) {
  return runAsync(() => saveProfile(username, profileObj));
}

export function getShops() {
  ensureDataModel();
  const parsed = readLocal(KEYS.SHOPS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveShops(shops) {
  ensureDataModel();
  writeLocal(KEYS.SHOPS, shops);
  ensureLegacyShopCompatibility(Array.isArray(shops) ? shops : []);
}

export function getShopById(shopId) {
  const id = String(shopId ?? "").trim();
  if (!id) return null;
  return getShops().find((shop) => String(shop?.id ?? "") === id) || null;
}

export function getShopForUser(username) {
  const key = String(username ?? "").trim();
  if (!key) return getShops()[0] || null;
  const user = getUsers().find((item) => String(item?.username ?? "") === key);
  if (!user) return getShops()[0] || null;
  const shopId = String(user?.shopId ?? "").trim();
  return getShopById(shopId) || getShops()[0] || null;
}

export function getShop() {
  ensureDataModel();
  const parsed = readLocal(KEYS.SHOP, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const policy = parsed.bookingPolicy && typeof parsed.bookingPolicy === "object" && !Array.isArray(parsed.bookingPolicy)
    ? parsed.bookingPolicy
    : {};
  return {
    ...parsed,
    bookingPolicy: {
      ...DEFAULT_BOOKING_POLICY,
      ...policy,
    },
  };
}

export function saveShop(shopObj) {
  ensureDataModel();
  writeLocal(KEYS.SHOP, shopObj);
}

export function getShopAsync() {
  return runAsync(
    () => getShop(),
    { apiFn: () => apiGetShop(), label: "shop read" }
  );
}

export function saveShopAsync(shopObj) {
  return runAsync(
    () => saveShop(shopObj),
    { apiFn: () => apiSaveShop(shopObj), label: "shop write" }
  );
}

export function getShopsAsync() {
  return runAsync(
    () => getShops(),
    { apiFn: () => apiGetShops(), label: "shops read" }
  );
}

export function saveShopsAsync(shops) {
  return runAsync(
    () => saveShops(shops),
    { apiFn: () => apiSaveShops(shops), label: "shops write" }
  );
}

export function getServices() {
  ensureDataModel();
  const parsed = readLocal(KEYS.SERVICES, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveServices(arr) {
  ensureDataModel();
  writeLocal(KEYS.SERVICES, arr);
}

export function getServicesAsync() {
  return runAsync(
    () => getServices(),
    { apiFn: () => apiGetServices(), label: "services read" }
  );
}

export function saveServicesAsync(arr) {
  return runAsync(
    () => saveServices(arr),
    { apiFn: () => apiSaveServices(arr), label: "services write" }
  );
}

export function getStaff() {
  ensureDataModel();
  const parsed = readLocal(KEYS.STAFF, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveStaff(arr) {
  ensureDataModel();
  writeLocal(KEYS.STAFF, arr);
}

export function getStaffAsync() {
  return runAsync(() => getStaff());
}

export function saveStaffAsync(arr) {
  return runAsync(() => saveStaff(arr));
}

export function getBookings() {
  ensureDataModel();
  const parsed = readLocal(KEYS.BOOKINGS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveBookings(arr) {
  ensureDataModel();
  const bookings = Array.isArray(arr) ? arr : [];
  writeLocal(KEYS.BOOKINGS, bookings);
  dispatchClientEvent(EVENTS.BOOKINGS_UPDATED, {
    total: bookings.length,
    updatedAtISO: new Date().toISOString(),
  });
}

export function getBookingsAsync() {
  return runAsync(
    () => getBookings(),
    { apiFn: () => apiGetBookings(), label: "bookings read" }
  );
}

export function saveBookingsAsync(arr, options = {}) {
  return runAsync(
    () => saveBookings(arr),
    { apiFn: () => apiSaveBookings(arr, options), label: "bookings write" }
  );
}

export function getAvailabilityMap() {
  ensureDataModel();
  const parsed = readLocal(KEYS.AVAILABILITY, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

export function saveAvailabilityMap(map) {
  ensureDataModel();
  writeLocal(KEYS.AVAILABILITY, map);
}

export function getAvailabilityMapAsync() {
  return runAsync(
    () => getAvailabilityMap(),
    { apiFn: () => apiGetAvailabilityMap(), label: "availability read" }
  );
}

export function saveAvailabilityMapAsync(map) {
  return runAsync(
    () => saveAvailabilityMap(map),
    { apiFn: () => apiSaveAvailabilityMap(map), label: "availability write" }
  );
}

export function getAvailabilityForBarber(username) {
  ensureDataModel();
  const key = String(username ?? "").trim();
  if (!key) return createDefaultAvailability();
  const map = getAvailabilityMap();
  return normalizeAvailabilityEntry(map[key]);
}

export function saveAvailabilityForBarber(username, availability) {
  ensureDataModel();
  const key = String(username ?? "").trim();
  if (!key) return;
  const map = getAvailabilityMap();
  map[key] = normalizeAvailabilityEntry(availability);
  saveAvailabilityMap(map);
}

export function getAvailabilityForBarberAsync(username) {
  return runAsync(
    () => getAvailabilityForBarber(username),
    { apiFn: () => apiGetAvailabilityForBarber(username), label: "availability barber read" }
  );
}

export function saveAvailabilityForBarberAsync(username, availability) {
  return runAsync(
    () => saveAvailabilityForBarber(username, availability),
    { apiFn: () => apiSaveAvailabilityForBarber(username, availability), label: "availability barber write" }
  );
}

export function getBarbersForShop(shopId, { includeOwners = true } = {}) {
  const targetShopId = String(shopId ?? "").trim();
  if (!targetShopId) return [];
  return getUsers()
    .filter((user) => String(user?.shopId ?? "") === targetShopId)
    .filter((user) => {
      const role = String(user?.role ?? "").toLowerCase();
      if (role === "barber") return true;
      if (includeOwners && role === "owner") return true;
      return false;
    })
    .map((user) => ({
      username: String(user?.username ?? ""),
      role: String(user?.role ?? ""),
      displayName: String(user?.displayName ?? user?.username ?? "").trim() || String(user?.username ?? ""),
      shopId: String(user?.shopId ?? ""),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
}

export function isDemoMode() {
  try {
    return String(sessionStorage.getItem(DEMO_MODE_KEY) ?? "").trim() === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(enabled) {
  const next = Boolean(enabled);
  try {
    if (next) {
      sessionStorage.setItem(DEMO_MODE_KEY, "1");
    } else {
      sessionStorage.removeItem(DEMO_MODE_KEY);
    }
    LEGACY_DEMO_MODE_KEYS.forEach((legacyKey) => {
      localStorage.removeItem(legacyKey);
      sessionStorage.removeItem(legacyKey);
    });
  } catch {
    // ignore storage failures
  }
}

export function isDemoSeeded() {
  try {
    return String(localStorage.getItem(DEMO_SEEDED_KEY) ?? "").trim() === "1";
  } catch {
    return false;
  }
}

function setDemoSeeded(nextValue) {
  const next = Boolean(nextValue);
  try {
    if (next) {
      localStorage.setItem(DEMO_SEEDED_KEY, "1");
    } else {
      localStorage.removeItem(DEMO_SEEDED_KEY);
    }
    LEGACY_DEMO_SEEDED_KEYS.forEach((legacyKey) => {
      localStorage.removeItem(legacyKey);
      sessionStorage.removeItem(legacyKey);
    });
  } catch {
    // ignore storage failures
  }
}

function clearDemoFlags() {
  try {
    sessionStorage.removeItem(DEMO_MODE_KEY);
    localStorage.removeItem(DEMO_SEEDED_KEY);
    LEGACY_DEMO_MODE_KEYS.forEach((legacyKey) => {
      localStorage.removeItem(legacyKey);
      sessionStorage.removeItem(legacyKey);
    });
    LEGACY_DEMO_SEEDED_KEYS.forEach((legacyKey) => {
      localStorage.removeItem(legacyKey);
      sessionStorage.removeItem(legacyKey);
    });
  } catch {
    // ignore storage failures
  }
}

function removeStorageRecord(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

export function resetSlotzyData({ demoOnly = false } = {}) {
  // Full reset is used for a predictable demo reseed and to avoid mixed local states.
  const slotzyKeys = [
    KEYS.SESSION_USER,
    KEYS.AUTH_TOKEN,
    KEYS.USERS,
    KEYS.PROFILES,
    KEYS.SHOP,
    KEYS.SHOPS,
    KEYS.SERVICES,
    KEYS.STAFF,
    KEYS.BOOKINGS,
    KEYS.AVAILABILITY,
    DEMO_MODE_KEY,
    DEMO_SEEDED_KEY,
  ];

  const allKeys = new Set([...slotzyKeys, ...LEGACY_TOKEN_KEYS, ...LEGACY_DEMO_MODE_KEYS, ...LEGACY_DEMO_SEEDED_KEYS]);
  allKeys.forEach((key) => {
    removeStorageRecord(localStorage, key);
    removeStorageRecord(sessionStorage, key);
  });

  if (demoOnly) {
    // Currently demo reset intentionally clears all Slotzy keys for consistency.
  }

  didEnsureDataModel = false;
  return { reset: true, demoOnly: Boolean(demoOnly) };
}

function toStartOfDay(date) {
  const value = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function getMondayOfWeek(date) {
  const day = toStartOfDay(date);
  const weekday = day.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + offsetToMonday);
  return day;
}

function addDays(date, days) {
  const base = toStartOfDay(date);
  base.setDate(base.getDate() + Number(days || 0));
  return base;
}

function setTime(date, hour, minute) {
  const next = toStartOfDay(date);
  next.setHours(Number(hour || 0), Number(minute || 0), 0, 0);
  return next;
}

function findTomorrowTimeOffStart(referenceDate) {
  const tomorrow = addDays(referenceDate, 1);
  return setTime(tomorrow, 12, 0);
}

function isSunday(date) {
  return toStartOfDay(date).getDay() === 0;
}

function pickTodayBookingStart(referenceDate) {
  const today = toStartOfDay(referenceDate);
  if (isSunday(today)) return null;

  if (today.getDay() === 6) {
    return setTime(today, 10, 30);
  }
  return setTime(today, 11, 0);
}

function parseRoleLabel(username) {
  const key = String(username ?? "").trim();
  if (key === DEMO_IDS.barberJordanUsername) return "Jordan";
  if (key === DEMO_IDS.barberAlexUsername) return "Alex";
  if (key === DEMO_IDS.ownerUsername) return "Shop Owner";
  return key;
}

function createDemoBooking({
  id,
  shopId,
  service,
  barberUsername,
  clientName,
  clientContact,
  status,
  start,
  customerUsername = "",
}) {
  const durationMinutes = Number(service?.durationMinutes ?? 30);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    id,
    shopId,
    ownerUsername: barberUsername,
    barberUsername,
    barberDisplayName: parseRoleLabel(barberUsername),
    serviceId: String(service?.id ?? ""),
    serviceName: String(service?.name ?? "Service"),
    durationMinutes,
    price: Number(service?.price ?? 0),
    clientName,
    clientContact,
    status,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startAtISO: start.toISOString(),
    date: toYmdLocal(start),
    time: toHhmmLocal(start),
    customerUsername: customerUsername || clientName,
    depositRequired: false,
    depositAmount: 0,
    depositStatus: "not_required",
    createdAt: new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  };
}

function getServiceByName(services, name) {
  const target = String(name ?? "").trim().toLowerCase();
  return services.find((service) => String(service?.name ?? "").trim().toLowerCase() === target) || null;
}

function getNextOpenDay(baseDate, { includeToday = true } = {}) {
  const start = includeToday ? toStartOfDay(baseDate) : addDays(baseDate, 1);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = addDays(start, offset);
    if (!isSunday(candidate)) return candidate;
  }
  return toStartOfDay(baseDate);
}

function getPreviousOpenDay(baseDate, openDaysBack = 1) {
  let cursor = toStartOfDay(baseDate);
  let remaining = Math.max(1, Number(openDaysBack || 1));
  while (remaining > 0) {
    cursor = addDays(cursor, -1);
    if (!isSunday(cursor)) remaining -= 1;
  }
  return cursor;
}

function getJordanStart(date, preferredHour = 11, preferredMinute = 0) {
  if (toStartOfDay(date).getDay() === 6) {
    return setTime(date, 10, 30);
  }
  return setTime(date, preferredHour, preferredMinute);
}

function getAlexStart(date, preferredHour = 13, preferredMinute = 0) {
  if (toStartOfDay(date).getDay() === 6) {
    return setTime(date, 12, 30);
  }
  return setTime(date, preferredHour, preferredMinute);
}

function buildDemoSeedData(referenceDate = new Date()) {
  const createdAtISO = new Date().toISOString();
  const shopId = DEMO_IDS.shopId;

  const users = [
    {
      username: DEMO_IDS.ownerUsername,
      password: "demo",
      role: "owner",
      shopId,
      displayName: "Shop Owner",
    },
    {
      username: DEMO_IDS.barberJordanUsername,
      password: "demo",
      role: "barber",
      shopId,
      displayName: "Jordan",
    },
    {
      username: DEMO_IDS.barberAlexUsername,
      password: "demo",
      role: "barber",
      shopId,
      displayName: "Alex",
    },
  ];

  const shop = {
    id: shopId,
    name: "Slotzy Barbershop",
    slug: "slotzy-barbershop",
    createdAtISO,
  };

  const legacyShop = {
    businessName: "Slotzy Barbershop",
    name: "Slotzy Barbershop",
    shopId,
    bookingPolicy: {
      ...DEFAULT_BOOKING_POLICY,
      bufferMinutes: 10,
    },
    updatedAt: createdAtISO,
  };

  const services = [
    {
      id: "svc_demo_jordan_haircut",
      name: "Haircut",
      title: "Haircut",
      price: 30,
      durationMinutes: 45,
      duration: 45,
      barberUsername: DEMO_IDS.barberJordanUsername,
      ownerUsername: DEMO_IDS.barberJordanUsername,
      shopId,
      active: true,
      createdAtISO,
    },
    {
      id: "svc_demo_jordan_beard_trim",
      name: "Beard Trim",
      title: "Beard Trim",
      price: 20,
      durationMinutes: 30,
      duration: 30,
      barberUsername: DEMO_IDS.barberJordanUsername,
      ownerUsername: DEMO_IDS.barberJordanUsername,
      shopId,
      active: true,
      createdAtISO,
    },
    {
      id: "svc_demo_jordan_combo",
      name: "Combo",
      title: "Combo",
      price: 45,
      durationMinutes: 75,
      duration: 75,
      barberUsername: DEMO_IDS.barberJordanUsername,
      ownerUsername: DEMO_IDS.barberJordanUsername,
      shopId,
      active: true,
      createdAtISO,
    },
    {
      id: "svc_demo_alex_fade",
      name: "Fade",
      title: "Fade",
      price: 35,
      durationMinutes: 45,
      duration: 45,
      barberUsername: DEMO_IDS.barberAlexUsername,
      ownerUsername: DEMO_IDS.barberAlexUsername,
      shopId,
      active: true,
      createdAtISO,
    },
    {
      id: "svc_demo_alex_kids_cut",
      name: "Kids Cut",
      title: "Kids Cut",
      price: 20,
      durationMinutes: 30,
      duration: 30,
      barberUsername: DEMO_IDS.barberAlexUsername,
      ownerUsername: DEMO_IDS.barberAlexUsername,
      shopId,
      active: true,
      createdAtISO,
    },
  ];

  const tomorrowTimeOffStart = findTomorrowTimeOffStart(referenceDate);
  const tomorrowTimeOffEnd = new Date(tomorrowTimeOffStart.getTime() + 2 * 60 * 60 * 1000);

  const availabilityMap = {
    [DEMO_IDS.barberJordanUsername]: {
      timezone: "America/Chicago",
      bufferMinutes: 10,
      weekly: {
        mon: { enabled: true, start: "09:00", end: "17:00" },
        tue: { enabled: true, start: "09:00", end: "17:00" },
        wed: { enabled: true, start: "09:00", end: "17:00" },
        thu: { enabled: true, start: "09:00", end: "17:00" },
        fri: { enabled: true, start: "09:00", end: "17:00" },
        sat: { enabled: true, start: "10:00", end: "14:00" },
        sun: { enabled: false, start: "09:00", end: "17:00" },
      },
      timeOff: [
        {
          id: "to_demo_jordan_tomorrow_midday",
          startISO: tomorrowTimeOffStart.toISOString(),
          endISO: tomorrowTimeOffEnd.toISOString(),
          note: "Demo break",
        },
      ],
    },
    [DEMO_IDS.barberAlexUsername]: {
      timezone: "America/Chicago",
      bufferMinutes: 10,
      weekly: {
        mon: { enabled: true, start: "09:00", end: "17:00" },
        tue: { enabled: true, start: "09:00", end: "17:00" },
        wed: { enabled: true, start: "09:00", end: "17:00" },
        thu: { enabled: true, start: "09:00", end: "17:00" },
        fri: { enabled: true, start: "09:00", end: "17:00" },
        sat: { enabled: true, start: "12:00", end: "16:00" },
        sun: { enabled: false, start: "09:00", end: "17:00" },
      },
      timeOff: [],
    },
    [DEMO_IDS.ownerUsername]: {
      timezone: "America/Chicago",
      bufferMinutes: 10,
      weekly: {
        mon: { enabled: true, start: "09:00", end: "17:00" },
        tue: { enabled: true, start: "09:00", end: "17:00" },
        wed: { enabled: true, start: "09:00", end: "17:00" },
        thu: { enabled: true, start: "09:00", end: "17:00" },
        fri: { enabled: true, start: "09:00", end: "17:00" },
        sat: { enabled: false, start: "09:00", end: "17:00" },
        sun: { enabled: false, start: "09:00", end: "17:00" },
      },
      timeOff: [],
    },
  };

  const weekStart = getMondayOfWeek(referenceDate);
  const todayStart = toStartOfDay(referenceDate);
  const todayBookingStart = pickTodayBookingStart(referenceDate);
  const todayOrNextOpenDate = todayBookingStart
    ? todayStart
    : getNextOpenDay(todayStart, { includeToday: false });
  const currentWeekDate = getNextOpenDay(addDays(weekStart, 4), { includeToday: true });
  const upcomingJordanDate = getNextOpenDay(addDays(todayStart, 2), { includeToday: true });
  const upcomingAlexDate = getNextOpenDay(addDays(todayStart, 3), { includeToday: true });
  const completedRecentDate = getPreviousOpenDay(todayStart, 1);
  const completedOlderDate = getPreviousOpenDay(todayStart, 4);

  const serviceHaircut = getServiceByName(services, "Haircut");
  const serviceBeard = getServiceByName(services, "Beard Trim");
  const serviceCombo = getServiceByName(services, "Combo");
  const serviceFade = getServiceByName(services, "Fade");
  const serviceKids = getServiceByName(services, "Kids Cut");

  const bookings = [];
  if (serviceHaircut) {
    bookings.push(createDemoBooking({
      id: "bk_demo_today",
      shopId,
      service: serviceHaircut,
      barberUsername: DEMO_IDS.barberJordanUsername,
      clientName: "Taylor Green",
      clientContact: "(555) 101-2001",
      status: "booked",
      start: todayBookingStart || getJordanStart(todayOrNextOpenDate, 11, 0),
      customerUsername: DEMO_IDS.customerUsername,
    }));
  }

  if (serviceFade) {
    bookings.push(createDemoBooking({
      id: "bk_demo_current_week_confirmed",
      shopId,
      service: serviceFade,
      barberUsername: DEMO_IDS.barberAlexUsername,
      clientName: "Morgan Lee",
      clientContact: "(555) 101-2002",
      status: "confirmed",
      start: getAlexStart(currentWeekDate, 13, 0),
    }));
  }

  if (serviceBeard) {
    bookings.push(createDemoBooking({
      id: "bk_demo_current_week_completed",
      shopId,
      service: serviceBeard,
      barberUsername: DEMO_IDS.barberJordanUsername,
      clientName: "Chris Cole",
      clientContact: "(555) 101-2003",
      status: "completed",
      start: getJordanStart(completedRecentDate, 9, 30),
    }));
  }

  if (serviceKids) {
    bookings.push(createDemoBooking({
      id: "bk_demo_previous_week_completed",
      shopId,
      service: serviceKids,
      barberUsername: DEMO_IDS.barberAlexUsername,
      clientName: "Robin Vale",
      clientContact: "(555) 101-2004",
      status: "completed",
      start: getAlexStart(completedOlderDate, 14, 0),
    }));
  }

  if (serviceCombo) {
    bookings.push(createDemoBooking({
      id: "bk_demo_upcoming_booked",
      shopId,
      service: serviceCombo,
      barberUsername: DEMO_IDS.barberJordanUsername,
      clientName: "Jamie Knox",
      clientContact: "(555) 101-2005",
      status: "booked",
      start: getJordanStart(upcomingJordanDate, 15, 0),
      customerUsername: DEMO_IDS.customerUsername,
    }));
  }

  if (serviceFade) {
    bookings.push(createDemoBooking({
      id: "bk_demo_upcoming_cancelled",
      shopId,
      service: serviceFade,
      barberUsername: DEMO_IDS.barberAlexUsername,
      clientName: "Riley Hart",
      clientContact: "(555) 101-2006",
      status: "cancelled",
      start: getAlexStart(upcomingAlexDate, 10, 30),
    }));
  }

  while (bookings.length < 6 && serviceHaircut) {
    const fallbackDate = getNextOpenDay(addDays(todayStart, bookings.length + 1), { includeToday: true });
    const fallbackStart = getJordanStart(fallbackDate, 11, 0);
    bookings.push(createDemoBooking({
      id: `bk_demo_fallback_${bookings.length + 1}`,
      shopId,
      service: serviceHaircut,
      barberUsername: DEMO_IDS.barberJordanUsername,
      clientName: `Demo Client ${bookings.length + 1}`,
      clientContact: `(555) 101-20${String(bookings.length + 10)}`,
      status: "booked",
      start: fallbackStart,
    }));
  }

  return {
    shop,
    legacyShop,
    users,
    services,
    availabilityMap,
    bookings: bookings.slice(0, 6),
  };
}

function hasRequiredDemoSeedShape() {
  const hasShop = getShops().some((shop) => String(shop?.id ?? "").trim() === DEMO_IDS.shopId);
  const users = getUsers();
  const hasOwner = users.some((user) => String(user?.username ?? "").trim() === DEMO_IDS.ownerUsername);
  const hasJordan = users.some((user) => String(user?.username ?? "").trim() === DEMO_IDS.barberJordanUsername);
  const hasAlex = users.some((user) => String(user?.username ?? "").trim() === DEMO_IDS.barberAlexUsername);

  const services = getServices();
  const requiredServices = new Set([
    "svc_demo_jordan_haircut",
    "svc_demo_jordan_beard_trim",
    "svc_demo_jordan_combo",
    "svc_demo_alex_fade",
    "svc_demo_alex_kids_cut",
  ]);
  const hasAllServices = services.filter((service) => requiredServices.has(String(service?.id ?? "").trim())).length >= 5;

  const bookings = getBookings();
  const demoBookingCount = bookings.filter((booking) => String(booking?.id ?? "").trim().startsWith("bk_demo_")).length;

  return hasShop && hasOwner && hasJordan && hasAlex && hasAllServices && demoBookingCount >= 6;
}

export function seedDemoDataIfMissing({ force = false } = {}) {
  ensureDataModel();
  const hasShops = getShops().length > 0;
  const markerPresent = isDemoSeeded();

  if (!force && hasShops && markerPresent && hasRequiredDemoSeedShape()) {
    setDemoMode(true);
    return { seeded: false, reason: "already_seeded" };
  }

  const demo = buildDemoSeedData(new Date());
  writeLocal(KEYS.SHOPS, [demo.shop]);
  writeLocal(KEYS.SHOP, demo.legacyShop);
  writeLocal(KEYS.USERS, demo.users);
  writeLocal(KEYS.SERVICES, demo.services);
  writeLocal(KEYS.AVAILABILITY, demo.availabilityMap);
  writeLocal(KEYS.BOOKINGS, demo.bookings);

  // Keep profiles/staff deterministic and empty for demo bootstrap compatibility.
  writeLocal(KEYS.PROFILES, {});
  writeLocal(KEYS.STAFF, []);

  removeStorageRecord(sessionStorage, KEYS.SESSION_USER);
  removeStorageRecord(sessionStorage, KEYS.AUTH_TOKEN);
  removeStorageRecord(localStorage, KEYS.AUTH_TOKEN);
  LEGACY_TOKEN_KEYS.forEach((legacyKey) => {
    removeStorageRecord(localStorage, legacyKey);
    removeStorageRecord(sessionStorage, legacyKey);
  });

  setDemoMode(true);
  setDemoSeeded(true);

  didEnsureDataModel = false;
  ensureDataModel();
  return { seeded: true };
}

export function resetDemoData({ reseed = false } = {}) {
  resetSlotzyData({ demoOnly: false });

  if (reseed) {
    setDemoMode(true);
    return seedDemoDataIfMissing({ force: true });
  }

  clearDemoFlags();
  return { reset: true };
}

function getDemoSeedVersion() {
  // legacy no-op shim retained for compatibility with older imports.
  return isDemoSeeded() ? "1" : "";
}

function setDemoSeedVersion(version) {
  setDemoSeeded(String(version ?? "").trim() === "1");
}

function clearDemoSeedVersion() {
  setDemoSeeded(false);
}

function toYmdLocal(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHhmmLocal(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildLocalDateAtOffset(referenceDate, daysOffset, hour, minute) {
  const anchor = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const local = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0, 0);
  local.setDate(local.getDate() + Number(daysOffset || 0));
  local.setHours(Number(hour || 0), Number(minute || 0), 0, 0);
  return local;
}

function createWeeklyAvailability({ start, end, enabledDays }) {
  const enabled = new Set(Array.isArray(enabledDays) ? enabledDays : []);
  return DAY_KEYS.reduce((acc, dayKey) => {
    acc[dayKey] = {
      enabled: enabled.has(dayKey),
      start,
      end,
    };
    return acc;
  }, {});
}

function buildDemoSeedDataLegacy(referenceDate = new Date()) {
  // legacy shim removed; use buildDemoSeedData
  return buildDemoSeedData(referenceDate);
}

function hasDemoSeedShape() {
  return hasRequiredDemoSeedShape();
}

function clearDemoSeedVersionLegacy() {
  clearDemoSeedVersion();
}

function setDemoSeedVersionLegacy(version) {
  setDemoSeedVersion(version);
}

function getDemoSeedVersionLegacy() {
  return getDemoSeedVersion();
}

function legacyDemoReset() {
  return resetDemoData({ reseed: false });
}

function legacySeedDemoDataIfMissing(options = {}) {
  return seedDemoDataIfMissing(options);
}

function legacySetDemoMode(enabled) {
  setDemoMode(enabled);
}

function legacyIsDemoMode() {
  return isDemoMode();
}

function legacyResetSlotzyData(options = {}) {
  return resetSlotzyData(options);
}

function legacyIsDemoSeeded() {
  return isDemoSeeded();
}

function legacySetDemoSeeded(nextValue) {
  setDemoSeeded(nextValue);
}

function legacyClearDemoFlags() {
  clearDemoFlags();
}

function legacyBuildDemoSeedData(referenceDate = new Date()) {
  return buildDemoSeedData(referenceDate);
}

function legacyHasRequiredDemoSeedShape() {
  return hasRequiredDemoSeedShape();
}

function legacyCreateDemoBooking(payload) {
  return createDemoBooking(payload);
}

function legacyParseRoleLabel(username) {
  return parseRoleLabel(username);
}

function legacyPickTodayBookingStart(referenceDate) {
  return pickTodayBookingStart(referenceDate);
}

function legacyFindTomorrowTimeOffStart(referenceDate) {
  return findTomorrowTimeOffStart(referenceDate);
}

function legacySetTime(date, hour, minute) {
  return setTime(date, hour, minute);
}

function legacyAddDays(date, days) {
  return addDays(date, days);
}

function legacyGetMondayOfWeek(date) {
  return getMondayOfWeek(date);
}

function legacyToStartOfDay(date) {
  return toStartOfDay(date);
}

function legacyRemoveStorageRecord(storage, key) {
  removeStorageRecord(storage, key);
}

function legacyGetServiceByName(services, name) {
  return getServiceByName(services, name);
}

function legacyIsSunday(date) {
  return isSunday(date);
}

function legacyResetDemoData(options = {}) {
  return resetDemoData(options);
}

function legacyClearDemoSeedVersion() {
  clearDemoSeedVersion();
}

function legacySetDemoSeedVersion(version) {
  setDemoSeedVersion(version);
}

function legacyGetDemoSeedVersion() {
  return getDemoSeedVersion();
}

function legacyBuildLocalDateAtOffset(referenceDate, daysOffset, hour, minute) {
  return buildLocalDateAtOffset(referenceDate, daysOffset, hour, minute);
}

function legacyCreateWeeklyAvailability(config) {
  return createWeeklyAvailability(config);
}

function legacyToYmdLocal(date) {
  return toYmdLocal(date);
}

function legacyToHhmmLocal(date) {
  return toHhmmLocal(date);
}

ensureDataModel();
