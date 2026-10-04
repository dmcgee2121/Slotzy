import { initBookingEngine } from "./booking-engine.js";
import * as dataStore from "./dataStore.js";

const rootEl = document.querySelector("main.owner-layout");
const params = new URLSearchParams(window.location.search);
const PUBLIC_BOOKING_BUILD = "slotzy-shell-v4";

document.documentElement.dataset.publicBookingBuild = PUBLIC_BOOKING_BUILD;

async function getBookingContext() {
  const requestedShopSlug = params.get("shop") || "";
  const requestedShopId = params.get("shopId") || "";

  if (dataStore.shouldUsePublicBookingApi()) {
    const payload = await dataStore.getPublicBookingContextAsync({
      shopSlug: requestedShopSlug,
      shopId: requestedShopId,
    });
    const shops = Array.isArray(payload?.shops) ? payload.shops : [];
    const users = Array.isArray(payload?.providers) ? payload.providers : [];
    const services = Array.isArray(payload?.services) ? payload.services : [];
    const bookings = Array.isArray(payload?.bookings) ? payload.bookings : [];
    const availabilityByBarber = payload?.availabilityByBarber && typeof payload.availabilityByBarber === "object"
      ? payload.availabilityByBarber
      : {};

    return {
      requestedShopSlug,
      requestedShopId,
      sessionUser: null,
      legacyShop: shops[0] || null,
      shops,
      users,
      services,
      bookings,
      availabilityByBarber,
      getShopById: (shopId) => shops.find((shop) => String(shop?.id ?? "") === String(shopId ?? "")) || null,
      getBarbersForShop: (shopId) => users.filter((user) => String(user?.shopId ?? "") === String(shopId ?? "")),
      getAvailabilityForBarber: (username) => availabilityByBarber[String(username ?? "")] || null,
      getBookings: () => bookings,
      saveBookings: (nextBookings) => dataStore.createPublicBookingAsync(nextBookings.at(-1)),
      frontendCacheVersion: PUBLIC_BOOKING_BUILD,
    };
  }

  return {
    requestedShopSlug,
    requestedShopId,
    sessionUser: dataStore.getSessionUser(),
    legacyShop: dataStore.getShop(),
    shops: dataStore.getShops(),
    users: dataStore.getUsers(),
    services: dataStore.getServices(),
    getShopById: (shopId) => dataStore.getShopById(shopId),
    getBarbersForShop: (shopId, options) => dataStore.getBarbersForShop(shopId, options),
    getAvailabilityForBarber: (username) => dataStore.getAvailabilityForBarber(username),
    getBookings: () => dataStore.getBookings(),
    saveBookings: (bookings) => dataStore.saveBookingsAsync(bookings, { fallbackOnError: false }),
    frontendCacheVersion: PUBLIC_BOOKING_BUILD,
  };
}

initBookingEngine({
  mode: "public",
  shopId: params.get("shopId") || "",
  rootEl,
  getContext: getBookingContext,
});
