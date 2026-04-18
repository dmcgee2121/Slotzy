const API_BASE = "http://localhost:3001/api";
const NOTIFY_TIMEOUT_MS = 1400;

const ENDPOINTS = {
  booking: "/notify/booking",
  cancel: "/notify/cancel",
  reschedule: "/notify/reschedule",
};

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeUsername(value) {
  return normalizeString(value);
}

function normalizeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Number(amount.toFixed(2)));
}

function normalizeDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  return Math.max(1, Math.round(minutes));
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(value));
}

function toIsoString(value) {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

function normalizeBooking(booking) {
  const source = booking && typeof booking === "object" && !Array.isArray(booking) ? booking : {};
  const startISO = toIsoString(source.startISO ?? source.startAtISO);
  const endISO = toIsoString(source.endISO);
  return {
    id: normalizeString(source.id),
    shopId: normalizeString(source.shopId),
    shopName: normalizeString(source.shopName),
    ownerUsername: normalizeUsername(source.ownerUsername),
    barberUsername: normalizeUsername(source.barberUsername ?? source.ownerUsername),
    barberDisplayName: normalizeString(source.barberDisplayName),
    serviceId: normalizeString(source.serviceId),
    serviceName: normalizeString(source.serviceName ?? source.serviceTitle) || "Service",
    durationMinutes: normalizeDuration(source.durationMinutes ?? source.duration),
    price: normalizeMoney(source.price),
    clientName: normalizeString(source.clientName),
    clientContact: normalizeString(source.clientContact),
    status: normalizeString(source.status) || "booked",
    startISO,
    endISO,
    startAtISO: startISO,
    date: normalizeString(source.date),
    time: normalizeString(source.time),
    depositRequired: Boolean(source.depositRequired),
    depositAmount: normalizeMoney(source.depositAmount),
    depositStatus: normalizeString(source.depositStatus) || "not_required",
    createdAtISO: normalizeString(source.createdAtISO ?? source.createdAt),
  };
}

function normalizeShop(shop) {
  const source = shop && typeof shop === "object" && !Array.isArray(shop) ? shop : {};
  const cancelHoursRaw = Number(source?.bookingPolicy?.cancelHours);
  return {
    id: normalizeString(source.id),
    name: normalizeString(source.name ?? source.businessName) || "Slotzy Shop",
    slug: normalizeString(source.slug),
    shopEmail: looksLikeEmail(source.shopEmail) ? normalizeString(source.shopEmail) : "",
    bookingPolicy: {
      cancelHours: Number.isFinite(cancelHoursRaw) ? Math.max(0, Math.round(cancelHoursRaw)) : 24,
    },
  };
}

function findUser(users, username) {
  const key = normalizeUsername(username).toLowerCase();
  if (!key) return null;
  return (Array.isArray(users) ? users : []).find(
    (user) => normalizeUsername(user?.username).toLowerCase() === key
  ) || null;
}

function findProfile(profiles, username) {
  const key = normalizeUsername(username);
  if (!key || !profiles || typeof profiles !== "object" || Array.isArray(profiles)) return null;
  const profile = profiles[key];
  return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : null;
}

function normalizePerson({ user = null, profile = null, username = "", displayName = "", email = "" } = {}) {
  const resolvedUsername = normalizeUsername(username ?? user?.username);
  const resolvedDisplayName = normalizeString(displayName ?? user?.displayName ?? user?.username) || resolvedUsername;
  const candidateEmail = normalizeString(email ?? user?.email ?? profile?.email);
  return {
    username: resolvedUsername,
    displayName: resolvedDisplayName,
    email: looksLikeEmail(candidateEmail) ? candidateEmail : "",
  };
}

function buildPolicyNote(shop) {
  const cancelHours = Number(shop?.bookingPolicy?.cancelHours);
  const hours = Number.isFinite(cancelHours) ? Math.max(0, Math.round(cancelHours)) : 24;
  return `Cancellations must be made at least ${hours} hours before.`;
}

export function buildBookingNotificationPayload({
  booking,
  previousBooking = null,
  shop = null,
  users = [],
  profiles = {},
  manageLink = "",
  cancellationNote = "",
  source = "",
} = {}) {
  const nextBooking = normalizeBooking(booking);
  const nextPreviousBooking = previousBooking ? normalizeBooking(previousBooking) : null;
  const nextShop = normalizeShop(shop);
  const barberUser = findUser(users, nextBooking.barberUsername || nextBooking.ownerUsername);
  const barberProfile = findProfile(profiles, barberUser?.username ?? nextBooking.barberUsername ?? nextBooking.ownerUsername);
  const ownerUser = (Array.isArray(users) ? users : []).find((user) => {
    const role = normalizeString(user?.role).toLowerCase();
    if (role !== "owner") return false;
    return normalizeString(user?.shopId) === nextShop.id;
  }) || null;
  const ownerProfile = findProfile(profiles, ownerUser?.username);

  const barber = normalizePerson({
    user: barberUser,
    profile: barberProfile,
    username: nextBooking.barberUsername || nextBooking.ownerUsername,
    displayName: nextBooking.barberDisplayName || barberUser?.displayName,
  });
  const owner = ownerUser
    ? normalizePerson({
      user: ownerUser,
      profile: ownerProfile,
      username: ownerUser.username,
      displayName: ownerUser.displayName,
    })
    : null;

  return {
    booking: nextBooking,
    previousBooking: nextPreviousBooking,
    shop: nextShop,
    barber,
    owner,
    manageLink: normalizeString(manageLink),
    cancellationNote: normalizeString(cancellationNote) || buildPolicyNote(nextShop),
    source: normalizeString(source),
  };
}

export async function postBookingNotification(kind, payload) {
  const eventKind = normalizeString(kind).toLowerCase();
  const path = ENDPOINTS[eventKind];
  if (!path) {
    return {
      ok: false,
      mode: "",
      sent: 0,
      error: "Unsupported booking notification type.",
      offline: false,
    };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => {
    controller?.abort();
  }, NOTIFY_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
      signal: controller?.signal,
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: Boolean(response.ok && data?.ok),
      mode: normalizeString(data?.mode),
      sent: Number(data?.sent ?? 0),
      error: normalizeString(data?.error),
      offline: false,
    };
  } catch {
    return {
      ok: false,
      mode: "",
      sent: 0,
      error: "Email not sent (server offline).",
      offline: true,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
