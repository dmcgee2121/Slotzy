import { initBookingEngine } from "./booking-engine.js";
import * as dataStore from "./dataStore.js";

const rootEl = document.querySelector("main.owner-layout");
const params = new URLSearchParams(window.location.search);

initBookingEngine({
  mode: "public",
  shopId: params.get("shopId") || "",
  rootEl,
  getContext: async () => ({
    requestedShopSlug: params.get("shop"),
    requestedShopId: params.get("shopId"),
    sessionUser: dataStore.getSessionUser(),
    legacyShop: dataStore.getShop(),
    shops: dataStore.getShops(),
    users: dataStore.getUsers(),
    services: dataStore.getServices(),
    getShopById: (shopId) => dataStore.getShopById(shopId),
    getBarbersForShop: (shopId, options) => dataStore.getBarbersForShop(shopId, options),
    getAvailabilityForBarber: (username) => dataStore.getAvailabilityForBarber(username),
    getBookings: () => dataStore.getBookings(),
    saveBookings: (bookings) => dataStore.saveBookings(bookings),
  }),
});
