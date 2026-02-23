export const KEYS = {
  SESSION_USER: "Slotzy_user",
  USERS: "Slotzy_users",
  PROFILES: "Slotzy_profiles",
  SHOP: "Slotzy_shop",
  SERVICES: "Slotzy_services",
  STAFF: "Slotzy_staff",
  BOOKINGS: "Slotzy_bookings",
};

export let DATA_MODE = "local"; // later can switch to "api"

const DEFAULT_BOOKING_POLICY = {
  allowSameDay: true,
  maxDaysAdvance: 30,
  cancelHours: 24,
  bufferMinutes: 0,
};

export function setDataMode(mode) {
  const normalized = String(mode ?? "").trim().toLowerCase();
  if (normalized !== "local" && normalized !== "api") {
    throw new Error("Invalid data mode");
  }
  DATA_MODE = normalized;
}

function runAsync(localFn) {
  if (DATA_MODE === "api") {
    return Promise.reject(new Error("API mode not implemented yet"));
  }
  return Promise.resolve(localFn());
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

export function getSessionUser() {
  const parsed = readSession(KEYS.SESSION_USER, null);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function setSessionUser(user) {
  writeSession(KEYS.SESSION_USER, user);
}

export function clearSessionUser() {
  sessionStorage.removeItem(KEYS.SESSION_USER);
}

export function getSessionUserAsync() {
  return runAsync(() => getSessionUser());
}

export function setSessionUserAsync(user) {
  return runAsync(() => setSessionUser(user));
}

export function clearSessionUserAsync() {
  return runAsync(() => clearSessionUser());
}

export function getUsers() {
  const parsed = readLocal(KEYS.USERS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveUsers(users) {
  writeLocal(KEYS.USERS, users);
}

export function getUsersAsync() {
  return runAsync(() => getUsers());
}

export function saveUsersAsync(users) {
  return runAsync(() => saveUsers(users));
}

export function getProfiles() {
  const parsed = readLocal(KEYS.PROFILES, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

export function saveProfiles(map) {
  writeLocal(KEYS.PROFILES, map);
}

export function getProfile(username) {
  const key = String(username ?? "").trim();
  if (!key) return null;
  const profiles = getProfiles();
  const profile = profiles[key];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  return profile;
}

export function saveProfile(username, profileObj) {
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

export function getShop() {
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
  writeLocal(KEYS.SHOP, shopObj);
}

export function getShopAsync() {
  return runAsync(() => getShop());
}

export function saveShopAsync(shopObj) {
  return runAsync(() => saveShop(shopObj));
}

export function getServices() {
  const parsed = readLocal(KEYS.SERVICES, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveServices(arr) {
  writeLocal(KEYS.SERVICES, arr);
}

export function getServicesAsync() {
  return runAsync(() => getServices());
}

export function saveServicesAsync(arr) {
  return runAsync(() => saveServices(arr));
}

export function getStaff() {
  const parsed = readLocal(KEYS.STAFF, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveStaff(arr) {
  writeLocal(KEYS.STAFF, arr);
}

export function getStaffAsync() {
  return runAsync(() => getStaff());
}

export function saveStaffAsync(arr) {
  return runAsync(() => saveStaff(arr));
}

export function getBookings() {
  const parsed = readLocal(KEYS.BOOKINGS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveBookings(arr) {
  writeLocal(KEYS.BOOKINGS, arr);
}

export function getBookingsAsync() {
  return runAsync(() => getBookings());
}

export function saveBookingsAsync(arr) {
  return runAsync(() => saveBookings(arr));
}
