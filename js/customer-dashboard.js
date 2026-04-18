import { initBookingEngine } from "./booking-engine.js";
import * as dataStore from "./dataStore.js";

const rootEl = document.querySelector("main.owner-layout");
const sessionUser = dataStore.getSessionUser();
const currentUserRecord = dataStore.getUsers().find(
  (user) => String(user?.username ?? "").trim() === String(sessionUser?.username ?? "").trim()
);
const requestedShopId = String(currentUserRecord?.shopId ?? "").trim();

initBookingEngine({
  mode: "customer",
  shopId: requestedShopId,
  rootEl,
  getContext: async () => ({
    requestedShopId,
    sessionUser,
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
