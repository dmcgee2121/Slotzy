import * as dataStore from "./dataStore.js";

export const SETUP_SESSION_KEYS = {
  STEP: "Slotzy_setupStep",
  SHOP_ID: "Slotzy_setupShopId",
  COMPLETE: "Slotzy_setupComplete",
  COMPLETE_BY_SHOP: "Slotzy_setupCompleteByShop",
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCompletionMap() {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(SETUP_SESSION_KEYS.COMPLETE_BY_SHOP) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCompletionMap(map) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(SETUP_SESSION_KEYS.COMPLETE_BY_SHOP, JSON.stringify(map && typeof map === "object" ? map : {}));
}

function hasEnabledWeeklyHours(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const weekly = entry.weekly;
  if (!weekly || typeof weekly !== "object" || Array.isArray(weekly)) return false;
  return DAY_KEYS.some((dayKey) => Boolean(weekly?.[dayKey]?.enabled));
}

function resolveOwnerRecord(users, username) {
  const key = String(username ?? "").trim();
  return users.find((user) => {
    const candidateUsername = String(user?.username ?? "").trim();
    const role = String(user?.role ?? "").trim().toLowerCase();
    return candidateUsername === key && role === "owner";
  }) || null;
}

function resolveSetupShop({ owner, shops, username }) {
  const ownerShopId = String(owner?.shopId ?? "").trim();
  if (ownerShopId) {
    const directShop = shops.find((shop) => String(shop?.id ?? "").trim() === ownerShopId) || null;
    if (directShop) return directShop;
  }
  const fallback = dataStore.getShopForUser(String(username ?? "").trim());
  return fallback || null;
}

function getShopStaff(users, shopId, ownerUsername) {
  if (!shopId) {
    return ownerUsername
      ? [{
          username: ownerUsername,
          role: "owner",
          displayName: ownerUsername,
          shopId: "",
          email: "",
        }]
      : [];
  }

  return users
    .filter((user) => String(user?.shopId ?? "").trim() === shopId)
    .filter((user) => {
      const role = String(user?.role ?? "").trim().toLowerCase();
      return role === "owner" || role === "barber";
    })
    .map((user) => ({
      username: String(user?.username ?? "").trim(),
      role: String(user?.role ?? "").trim().toLowerCase(),
      displayName: String(user?.displayName ?? user?.username ?? "").trim() || String(user?.username ?? "").trim(),
      shopId: String(user?.shopId ?? "").trim(),
      email: String(user?.email ?? "").trim(),
    }))
    .filter((user) => Boolean(user.username));
}

function getScopedServices(services, { shopId, username }) {
  return services.filter((service) => {
    if (shopId) {
      return String(service?.shopId ?? "").trim() === shopId;
    }
    const barberUsername = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim();
    return barberUsername === String(username ?? "").trim();
  });
}

export function hasCompletedSetup(shopId) {
  const key = String(shopId ?? "").trim();
  if (!key) return false;
  const completionMap = readCompletionMap();
  return Boolean(completionMap[key]);
}

function buildSetupStatus({ username, owner, shop, users, services, availabilityMap }) {
  const shopId = String(shop?.id ?? owner?.shopId ?? "").trim();
  const staff = getShopStaff(users, shopId, String(username ?? "").trim());
  const additionalBarbers = staff.filter((user) => user.role === "barber");
  const hasAdditionalBarbers = additionalBarbers.length > 0;
  const scopedServices = getScopedServices(services, { shopId, username });
  const hasServices = scopedServices.length > 0;
  const hasAvailability = staff.some((user) => hasEnabledWeeklyHours(availabilityMap?.[user.username]));
  const shopName = String(shop?.name ?? shop?.businessName ?? "").trim();
  const hasNamedShop = shopName.length >= 2;
  const progress = readSetupProgress();
  const progressShopId = String(progress.shopId ?? "").trim();
  const hasCoreSetup = hasNamedShop && hasServices && hasAvailability;
  const completionRecorded = hasCompletedSetup(shopId);
  const hasInProgressSetup = !progress.isComplete
    && progress.step > 1
    && !hasCoreSetup
    && (!shopId || !progressShopId || progressShopId === shopId);
  const needsWizard = !hasCoreSetup || hasInProgressSetup;

  return {
    username: String(username ?? "").trim(),
    owner,
    shop,
    shopId,
    shopName,
    staff,
    additionalBarbers,
    services: scopedServices,
    hasNamedShop,
    hasAdditionalBarbers,
    hasServices,
    hasAvailability,
    completionRecorded,
    hasInProgressSetup,
    needsWizard,
  };
}

export function readSetupProgress() {
  const storage = getSessionStorage();
  if (!storage) {
    return { step: 1, shopId: "", isComplete: false };
  }

  const rawStep = Number(storage.getItem(SETUP_SESSION_KEYS.STEP) ?? "1");
  return {
    step: Number.isFinite(rawStep) ? Math.max(1, Math.min(5, Math.round(rawStep))) : 1,
    shopId: String(storage.getItem(SETUP_SESSION_KEYS.SHOP_ID) ?? "").trim(),
    isComplete: String(storage.getItem(SETUP_SESSION_KEYS.COMPLETE) ?? "").trim() === "true",
  };
}

export function writeSetupProgress({ step, shopId } = {}) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (step !== undefined) {
    const nextStep = Number(step);
    storage.setItem(
      SETUP_SESSION_KEYS.STEP,
      String(Number.isFinite(nextStep) ? Math.max(1, Math.min(5, Math.round(nextStep))) : 1)
    );
  }

  if (shopId !== undefined) {
    storage.setItem(SETUP_SESSION_KEYS.SHOP_ID, String(shopId ?? "").trim());
  }
}

export function markSetupComplete({ shopId } = {}) {
  const storage = getSessionStorage();
  if (storage) {
    storage.setItem(SETUP_SESSION_KEYS.COMPLETE, "true");
  }
  const key = String(shopId ?? "").trim();
  if (key) {
    const completionMap = readCompletionMap();
    completionMap[key] = new Date().toISOString();
    writeCompletionMap(completionMap);
  }
  if (shopId !== undefined) {
    storage?.setItem(SETUP_SESSION_KEYS.SHOP_ID, key);
  }
}

export function clearSetupProgress() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(SETUP_SESSION_KEYS.STEP);
  storage.removeItem(SETUP_SESSION_KEYS.SHOP_ID);
  storage.removeItem(SETUP_SESSION_KEYS.COMPLETE);
}

export async function getOwnerSetupStatus(username) {
  const [users, shops, services, availabilityMap] = await Promise.all([
    dataStore.getUsersAsync(),
    dataStore.getShopsAsync(),
    dataStore.getServicesAsync(),
    dataStore.getAvailabilityMapAsync(),
  ]);

  const normalizedUsers = Array.isArray(users) ? users : [];
  const normalizedShops = Array.isArray(shops) ? shops : [];
  const normalizedServices = Array.isArray(services) ? services : [];
  const normalizedAvailability = availabilityMap && typeof availabilityMap === "object" && !Array.isArray(availabilityMap)
    ? availabilityMap
    : {};

  const owner = resolveOwnerRecord(normalizedUsers, username);
  if (!owner) {
    return {
      username: String(username ?? "").trim(),
      owner: null,
      shop: null,
      shopId: "",
      shopName: "",
      staff: [],
      additionalBarbers: [],
      services: [],
      hasNamedShop: false,
      hasAdditionalBarbers: false,
      hasServices: false,
      hasAvailability: false,
      hasInProgressSetup: false,
      needsWizard: false,
    };
  }

  const shop = resolveSetupShop({
    owner,
    shops: normalizedShops,
    username,
  });

  return buildSetupStatus({
    username,
    owner,
    shop,
    users: normalizedUsers,
    services: normalizedServices,
    availabilityMap: normalizedAvailability,
  });
}

export async function shouldShowOwnerSetupWizard(username) {
  const status = await getOwnerSetupStatus(username);
  return Boolean(status?.needsWizard);
}
