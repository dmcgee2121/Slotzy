const { test, expect } = require("@playwright/test");

const NORTH_SHOP_ID = "shop_directory_north";
const NORTH_OWNER = "owner_directory_north";
const NORTH_SERVICE_ID = "svc_directory_north";
const SOUTH_SHOP_ID = "shop_directory_south";
const SOUTH_OWNER = "owner_directory_south";
const SOUTH_SERVICE_ID = "svc_directory_south";
const HIDDEN_SHOP_ID = "shop_directory_hidden";
const HIDDEN_OWNER = "owner_directory_hidden";

function toYmd(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildAvailability(username) {
  return {
    [username]: {
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
    },
  };
}

function buildSeed() {
  const nowIso = new Date().toISOString();
  return {
    local: {
      Slotzy_users: [
        {
          username: NORTH_OWNER,
          password: "pass1234",
          role: "owner",
          displayName: "North Owner",
          shopId: NORTH_SHOP_ID,
        },
        {
          username: SOUTH_OWNER,
          password: "pass1234",
          role: "owner",
          displayName: "Downtown Owner",
          shopId: SOUTH_SHOP_ID,
        },
        {
          username: HIDDEN_OWNER,
          password: "pass1234",
          role: "owner",
          displayName: "Hidden Owner",
          shopId: HIDDEN_SHOP_ID,
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: "Northside Studio",
        name: "Northside Studio",
        shopId: NORTH_SHOP_ID,
      },
      Slotzy_shops: [
        {
          id: NORTH_SHOP_ID,
          name: "Northside Studio",
          slug: "northside-studio",
          createdAtISO: nowIso,
        },
        {
          id: SOUTH_SHOP_ID,
          name: "Downtown Clips",
          slug: "downtown-clips",
          createdAtISO: nowIso,
        },
        {
          id: HIDDEN_SHOP_ID,
          name: "Hidden Shop",
          slug: "hidden-shop",
          active: false,
          createdAtISO: nowIso,
        },
      ],
      Slotzy_services: [
        {
          id: NORTH_SERVICE_ID,
          name: "Northside Cut",
          title: "Northside Cut",
          price: 35,
          duration: 30,
          durationMinutes: 30,
          active: true,
          createdAtISO: nowIso,
          shopId: NORTH_SHOP_ID,
          barberUsername: NORTH_OWNER,
          ownerUsername: NORTH_OWNER,
        },
        {
          id: SOUTH_SERVICE_ID,
          name: "Downtown Fade",
          title: "Downtown Fade",
          price: 40,
          duration: 30,
          durationMinutes: 30,
          active: true,
          createdAtISO: nowIso,
          shopId: SOUTH_SHOP_ID,
          barberUsername: SOUTH_OWNER,
          ownerUsername: SOUTH_OWNER,
        },
      ],
      Slotzy_staff: [],
      Slotzy_bookings: [],
      Slotzy_availability: {
        ...buildAvailability(NORTH_OWNER),
        ...buildAvailability(SOUTH_OWNER),
        ...buildAvailability(HIDDEN_OWNER),
      },
    },
    session: {},
  };
}

async function seedStorage(page, seed) {
  await page.addInitScript((seedPayload) => {
    localStorage.clear();
    sessionStorage.clear();

    Object.entries(seedPayload.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    Object.entries(seedPayload.session || {}).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      sessionStorage.setItem(key, JSON.stringify(value));
    });
  }, seed);
}

test("public booking without a slug shows directory search and selecting a shop updates the booking flow", async ({ page }) => {
  await seedStorage(page, buildSeed());

  await page.goto("/pages/book.html");

  await expect(page.locator("#publicShopPickerSection")).toBeVisible();
  await expect(page.locator("#bookingPanel")).toBeHidden();
  await expect(page.locator("#publicShopPickerList")).toContainText("Northside Studio");
  await expect(page.locator("#publicShopPickerList")).toContainText("Downtown Clips");
  await expect(page.locator("#publicShopPickerList")).not.toContainText("Hidden Shop");

  await page.fill("#publicShopSearch", "down");
  await expect(page.locator("#publicShopPickerList")).toContainText("Downtown Clips");
  await expect(page.locator("#publicShopPickerList")).not.toContainText("Northside Studio");

  await page.locator(".public-shop-directory-card").filter({ hasText: "Downtown Clips" }).click();

  await expect(page).toHaveURL(/\/pages\/book\.html\?shop=downtown-clips$/);
  await expect(page.locator("#publicShopPickerSection")).toBeHidden();
  await expect(page.locator("#publicShopName")).toHaveText("Downtown Clips");
  await expect(page.locator("#bookingPanel")).toBeVisible();
  await expect(page.locator("#barberSelect")).toHaveValue(SOUTH_OWNER);

  await page.selectOption("#serviceSelect", SOUTH_SERVICE_ID);
  await page.fill("#clientName", "Directory Booker");
  await page.fill("#clientContact", "directory@example.com");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page.fill("#bookingDate", toYmd(tomorrow));
  await expect(page.locator("#time-slot-select")).toBeVisible();

  const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
  const slotValue = await firstSlot.getAttribute("value");
  expect(slotValue).toBeTruthy();
  await page.selectOption("#time-slot-select", String(slotValue));

  await page.getByRole("button", { name: "Book Appointment" }).click();
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  await expect(page.locator("#bookingReceiptShop")).toContainText("Downtown Clips");
  await expect(page.locator("#booking-receipt-section")).toContainText("Downtown Fade");
});

test("public booking with a slug skips the directory picker", async ({ page }) => {
  await seedStorage(page, buildSeed());

  await page.goto("/pages/book.html?shop=northside-studio");

  await expect(page.locator("#publicShopPickerSection")).toBeHidden();
  await expect(page.locator("#publicShopName")).toHaveText("Northside Studio");
  await expect(page.locator("#bookingPanel")).toBeVisible();
  await expect(page.locator("#barberSelect")).toHaveValue(NORTH_OWNER);
});
