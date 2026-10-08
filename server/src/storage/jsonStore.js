import { promises as fs } from "fs";
import { timingSafeEqual } from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "db.json");

const EMPTY_STORE = {
  users: [],
  shops: [],
  services: [],
  availability: {},
  bookings: [],
  emails: [],
};

const PROVIDER_ROLES = new Set(["owner", "barber"]);
const ACTIVE_BOOKING_STATUSES = new Set(["booked", "confirmed"]);

function normalizedText(value) {
  return String(value ?? "").trim();
}

function isSyntheticE2eShop(shop) {
  const names = [shop?.name, shop?.businessName].map(normalizedText).filter(Boolean);
  if (names.some((value) => /^e2e\s/i.test(value) || /e2e-/i.test(value))) return true;
  return [shop?.slug, shop?.id].map(normalizedText).filter(Boolean)
    .some((value) => /(^|[-_])e2e(?:[-_]|$)/i.test(value));
}

function isProviderRole(role) {
  return PROVIDER_ROLES.has(normalizedText(role).toLowerCase());
}

export function createEmptyStore() {
  return {
    users: [],
    shops: [],
    services: [],
    availability: {},
    bookings: [],
    emails: [],
  };
}

export function normalizeStoreShape(store) {
  const next = store && typeof store === "object" && !Array.isArray(store)
    ? store
    : createEmptyStore();

  if (!Array.isArray(next.users)) next.users = [];
  if (!Array.isArray(next.shops)) next.shops = [];
  if (!Array.isArray(next.services)) next.services = [];
  if (!Array.isArray(next.bookings)) next.bookings = [];
  if (!Array.isArray(next.emails)) next.emails = [];
  if (!next.availability || typeof next.availability !== "object" || Array.isArray(next.availability)) {
    next.availability = {};
  }

  return next;
}

export function createJsonStore({ filePath = DB_PATH } = {}) {
  async function writeStore(store) {
    const normalized = normalizeStoreShape(store);
    await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  async function writeUser(user) {
    const store = await readStore();
    const key = String(user?.username ?? "").trim().toLowerCase();
    if (store.users.some((candidate) => String(candidate?.username ?? "").trim().toLowerCase() === key)) {
      const error = new Error("username already exists");
      error.code = "23505";
      throw error;
    }
    store.users.push(user);
    await writeStore(store);
  }

  async function readStore() {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return normalizeStoreShape(JSON.parse(raw));
    } catch (error) {
      if (error && error.code === "ENOENT") {
        await writeStore(EMPTY_STORE);
        return createEmptyStore();
      }
      throw error;
    }
  }

  async function readUserByUsername(username) {
    const key = String(username ?? "").trim().toLowerCase();
    if (!key) return null;
    const store = await readStore();
    const user = store.users.find((candidate) => String(candidate?.username ?? "").trim().toLowerCase() === key);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      shopId: user.shopId ?? null,
      createdAt: user.createdAt,
    };
  }

  async function readLoginCredentialByUsername(username) {
    const key = String(username ?? "").trim().toLowerCase();
    if (!key) return null;
    const store = await readStore();
    const user = store.users.find((candidate) => String(candidate?.username ?? "").trim().toLowerCase() === key);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      shopId: user.shopId ?? null,
      createdAt: user.createdAt,
      passwordHash: user.passwordHash,
    };
  }

  // JSON remains document-backed locally, but this method returns the same
  // restricted, public booking projection as Postgres: never credentials,
  // customer contacts, manage-token hashes, or email/outbox data.
  async function readPublicBookingStore({ shopId = "", slug = "" } = {}) {
    const store = await readStore();
    const requestedShopId = normalizedText(shopId);
    const requestedSlug = normalizedText(slug).toLowerCase();
    const directLookup = Boolean(requestedShopId || requestedSlug);
    const selectedShops = store.shops.filter((shop) => {
      if (requestedShopId) return normalizedText(shop?.id) === requestedShopId;
      if (requestedSlug) return normalizedText(shop?.slug).toLowerCase() === requestedSlug;
      return !isSyntheticE2eShop(shop);
    });
    const shops = selectedShops.map((shop) => ({
      id: shop.id, name: shop.name, businessName: shop.businessName, slug: shop.slug,
      active: shop.active, shopPhone: shop.shopPhone ?? shop.phone, address: shop.address,
      logo: shop.logo ?? shop.logoDataUrl, cover: shop.cover ?? shop.coverDataUrl,
      branding: shop.branding && typeof shop.branding === "object" ? shop.branding : {},
      bookingPolicy: shop.bookingPolicy,
      ownerUsername: shop.ownerUsername,
    }));
    const shopIds = new Set(shops.map((shop) => normalizedText(shop?.id)).filter(Boolean));
    const users = store.users
      .filter((user) => shopIds.has(normalizedText(user?.shopId)) && isProviderRole(user?.role))
      .map((user) => ({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, shopId: user.shopId ?? null, createdAt: user.createdAt }));
    const usernames = new Set(users.map((user) => normalizedText(user.username)).filter(Boolean));
    const services = store.services
      .filter((service) => service?.active !== false)
      .filter((service) => shopIds.has(normalizedText(service?.shopId)))
      .filter((service) => usernames.has(normalizedText(service?.barberUsername ?? service?.ownerUsername)))
      .map((service) => ({
        id: service.id, name: service.name, title: service.title, price: service.price,
        durationMinutes: service.durationMinutes, duration: service.duration,
        shopId: service.shopId, barberUsername: service.barberUsername ?? service.ownerUsername,
        ownerUsername: service.ownerUsername ?? service.barberUsername, active: service.active !== false,
      }));
    const availability = Object.fromEntries(users.map((user) => [user.username, store.availability?.[user.username] ?? {}]));
    const bookings = store.bookings
      .filter((booking) => shopIds.has(normalizedText(booking?.shopId)))
      .filter((booking) => ACTIVE_BOOKING_STATUSES.has(normalizedText(booking?.status).toLowerCase()))
      .map((booking) => ({
        shopId: booking.shopId,
        ownerUsername: booking.ownerUsername ?? booking.barberUsername,
        barberUsername: booking.barberUsername ?? booking.ownerUsername,
        startISO: booking.startISO ?? booking.startAtISO,
        endISO: booking.endISO,
        durationMinutes: booking.durationMinutes ?? booking.duration,
        status: booking.status,
      }));
    return { users, shops, services, availability, bookings, emails: [], directLookup };
  }

  async function listServicesForAuthenticatedUser(user) {
    const store = await readStore();
    const role = normalizedText(user?.role).toLowerCase();
    if (role === "owner") {
      return store.services.filter((service) => normalizedText(service?.shopId) === normalizedText(user?.shopId));
    }
    if (role === "barber") {
      return store.services.filter((service) => normalizedText(service?.barberUsername ?? service?.ownerUsername).toLowerCase() === normalizedText(user?.username).toLowerCase());
    }
    return null;
  }

  async function listShopsForAuthenticatedUser(user) {
    const store = await readStore();
    const role = normalizedText(user?.role).toLowerCase();
    if (role !== "owner" && role !== "barber") return null;
    const shopId = normalizedText(user?.shopId);
    return store.shops.filter((shop) => normalizedText(shop?.id) === shopId);
  }

  async function readAvailabilityForAuthenticatedUser(user, { barberUsername = "" } = {}) {
    const store = await readStore();
    const role = normalizedText(user?.role).toLowerCase();
    const requested = normalizedText(barberUsername);
    if (role === "owner") {
      const shopId = normalizedText(user?.shopId);
      const providers = store.users.filter((entry) => isProviderRole(entry?.role) && normalizedText(entry?.shopId) === shopId);
      if (requested) {
        const provider = providers.find((entry) => normalizedText(entry?.username).toLowerCase() === requested.toLowerCase());
        if (!provider) return { outcome: "not_allowed" };
        return { outcome: "single", barberUsername: provider.username, availability: store.availability?.[provider.username] ?? {} };
      }
      return { outcome: "list", availability: Object.fromEntries(providers.map((provider) => [provider.username, store.availability?.[provider.username] ?? {}])) };
    }
    if (role === "barber") {
      if (requested && requested.toLowerCase() !== normalizedText(user?.username).toLowerCase()) return { outcome: "not_allowed" };
      return { outcome: "single", barberUsername: user.username, availability: store.availability?.[user.username] ?? {} };
    }
    return null;
  }

  async function listBookingsForAuthenticatedUser(user, filters = {}) {
    const store = await readStore();
    const role = normalizedText(user?.role).toLowerCase();
    if (role === "owner") {
      return store.bookings.filter((booking) => normalizedText(booking?.shopId) === normalizedText(user?.shopId));
    }
    if (role === "barber") {
      const username = normalizedText(user?.username).toLowerCase();
      return store.bookings.filter((booking) => normalizedText(booking?.barberUsername ?? booking?.ownerUsername).toLowerCase() === username);
    }
    return null;
  }

  async function appendOutboxEmail(email) {
    const store = await readStore();
    store.emails.push(email);
    await writeStore(store);
    return email;
  }

  async function listOutboxEmails(limit = 50) {
    const store = await readStore();
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 50;
    return [...store.emails]
      .sort((left, right) => String(right?.createdAtISO ?? "").localeCompare(String(left?.createdAtISO ?? "")))
      .slice(0, safeLimit);
  }

  async function clearOutboxEmails() {
    const store = await readStore();
    const cleared = Array.isArray(store.emails) ? store.emails.length : 0;
    store.emails = [];
    await writeStore(store);
    return { cleared };
  }

  async function writeShop(_shop, store) {
    await writeStore(store);
  }

  async function writeService(_service, store) {
    await writeStore(store);
  }

  async function writeAvailability(_username, _availability, store) {
    await writeStore(store);
  }

  async function writeBooking(booking, store = null) {
    const next = store ?? await readStore();
    if (!next.bookings.some((entry) => String(entry?.id ?? "") === String(booking?.id ?? ""))) {
      next.bookings.push(booking);
    }
    await writeStore(next);
    return { booking };
  }

  async function cancelBookingByManageTokenHash(tokenHash) {
    const expectedHash = String(tokenHash ?? "").trim();
    const store = await readStore();
    const index = store.bookings.findIndex((booking) => {
      const storedHash = String(booking?.manageTokenHash ?? "").trim();
      if (!storedHash || storedHash.length !== expectedHash.length) return false;
      return timingSafeEqual(Buffer.from(storedHash), Buffer.from(expectedHash));
    });
    if (index < 0) return { outcome: "invalid_token", bookingFound: false, eventCreated: false };

    const previousBooking = { ...store.bookings[index] };
    const statusBefore = String(previousBooking?.status ?? "booked").trim().toLowerCase();
    if (statusBefore !== "booked" && statusBefore !== "confirmed") {
      return { outcome: "cancellation_unavailable", bookingFound: true, statusBefore, statusAfter: statusBefore, eventCreated: false };
    }

    const shop = store.shops.find((entry) => String(entry?.id ?? "") === String(previousBooking?.shopId ?? "")) || null;
    const cancelHoursValue = Number(shop?.bookingPolicy?.cancelHours ?? 24);
    const cancelHours = Number.isFinite(cancelHoursValue) && cancelHoursValue >= 0 ? Math.floor(cancelHoursValue) : 24;
    const startAt = new Date(String(previousBooking?.startISO ?? previousBooking?.startAtISO ?? ""));
    if (!shop || !Number.isFinite(startAt.getTime())) {
      return { outcome: "cancellation_unavailable", bookingFound: true, statusBefore, statusAfter: statusBefore, eventCreated: false };
    }
    if (Date.now() >= startAt.getTime() - cancelHours * 60 * 60 * 1000) {
      return { outcome: "cancellation_policy", bookingFound: true, cancelHours, statusBefore, statusAfter: statusBefore, eventCreated: false };
    }

    const now = new Date().toISOString();
    const booking = { ...previousBooking, status: "cancelled", cancelledAtISO: now, updatedAtISO: now };
    store.bookings[index] = booking;
    if (!Array.isArray(store.bookingEvents)) store.bookingEvents = [];
    store.bookingEvents.push({
      id: `event_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      bookingId: booking.id,
      eventType: "cancelled",
      actorType: "public_client",
      beforeState: previousBooking,
      afterState: booking,
      occurredAtISO: now,
    });
    await writeStore(store);

    const providerUsername = String(booking?.barberUsername ?? booking?.ownerUsername ?? "").trim();
    const barber = store.users.find((entry) => String(entry?.username ?? "").trim() === providerUsername) || null;
    const owner = store.users.find((entry) => String(entry?.username ?? "").trim() === String(shop?.ownerUsername ?? "").trim()) || null;
    // The persisted credential remains authoritative, but storage callers do
    // not need it after lookup and must never receive or serialize the hash.
    const { manageTokenHash: _bookingTokenHash, ...safeBooking } = booking;
    const { manageTokenHash: _previousTokenHash, ...safePreviousBooking } = previousBooking;
    return {
      outcome: "cancelled", bookingFound: true, statusBefore, statusAfter: "cancelled", eventCreated: true,
      booking: safeBooking, previousBooking: safePreviousBooking, shop, barber, owner,
    };
  }

  return {
    readStore,
    readUserByUsername,
    readLoginCredentialByUsername,
    readPublicBookingStore,
    listServicesForAuthenticatedUser,
    listShopsForAuthenticatedUser,
    readAvailabilityForAuthenticatedUser,
    listBookingsForAuthenticatedUser,
    writeStore,
    writeUser,
    writeShop,
    writeService,
    writeAvailability,
    writeBooking,
    cancelBookingByManageTokenHash,
    appendOutboxEmail,
    listOutboxEmails,
    clearOutboxEmails,
    async storeManageToken() {},
  };
}

const defaultJsonStore = createJsonStore();

export const readStore = defaultJsonStore.readStore;
export const readUserByUsername = defaultJsonStore.readUserByUsername;
export const readLoginCredentialByUsername = defaultJsonStore.readLoginCredentialByUsername;
export const readPublicBookingStore = defaultJsonStore.readPublicBookingStore;
export const listServicesForAuthenticatedUser = defaultJsonStore.listServicesForAuthenticatedUser;
export const listShopsForAuthenticatedUser = defaultJsonStore.listShopsForAuthenticatedUser;
export const readAvailabilityForAuthenticatedUser = defaultJsonStore.readAvailabilityForAuthenticatedUser;
export const listBookingsForAuthenticatedUser = defaultJsonStore.listBookingsForAuthenticatedUser;
export const writeStore = defaultJsonStore.writeStore;
export const writeUser = defaultJsonStore.writeUser;
export const writeShop = defaultJsonStore.writeShop;
export const writeService = defaultJsonStore.writeService;
export const writeAvailability = defaultJsonStore.writeAvailability;
export const writeBooking = defaultJsonStore.writeBooking;
export const cancelBookingByManageTokenHash = defaultJsonStore.cancelBookingByManageTokenHash;
export const appendOutboxEmail = defaultJsonStore.appendOutboxEmail;
export const listOutboxEmails = defaultJsonStore.listOutboxEmails;
export const clearOutboxEmails = defaultJsonStore.clearOutboxEmails;
export const storeManageToken = defaultJsonStore.storeManageToken;
