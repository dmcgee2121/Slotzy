const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_owner_setup";
const OWNER_USERNAME = "owner_setup";
const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/l8RGoQAAAABJRU5ErkJggg==";

function buildAvailability({ start = "09:00", end = "17:00" } = {}) {
  return {
    [OWNER_USERNAME]: {
      timezone: "America/Chicago",
      bufferMinutes: 0,
      weekly: {
        mon: { enabled: true, start, end },
        tue: { enabled: true, start, end },
        wed: { enabled: true, start, end },
        thu: { enabled: true, start, end },
        fri: { enabled: true, start, end },
        sat: { enabled: true, start, end },
        sun: { enabled: false, start, end },
      },
      timeOff: [],
    },
  };
}

function buildSeed({
  shopName = "Fresh Start Studio",
  shopSlug = "fresh-start-studio",
  services = [],
  availability = {},
  sessionUser = { username: OWNER_USERNAME, role: "owner" },
} = {}) {
  const nowIso = new Date().toISOString();
  return {
    local: {
      Slotzy_users: [
        {
          username: OWNER_USERNAME,
          password: "pass1234",
          role: "owner",
          displayName: "Owner Setup",
          shopId: SHOP_ID,
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: shopName,
        name: shopName,
        shopId: SHOP_ID,
      },
      Slotzy_shops: [
        {
          id: SHOP_ID,
          name: shopName,
          slug: shopSlug,
          createdAtISO: nowIso,
        },
      ],
      Slotzy_services: services,
      Slotzy_staff: [],
      Slotzy_bookings: [],
      Slotzy_availability: availability,
    },
    session: {
      Slotzy_user: sessionUser,
    },
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

test("fresh owner is guided through onboarding and gets a working public booking link", async ({ page }) => {
  await seedStorage(page, buildSeed());

  await page.goto("/pages/business-owner.html");

  await expect(page).toHaveURL(/\/pages\/owner-setup\.html$/);
  await expect(page.locator("#setupStepSummary")).toHaveText("Step 1 of 5");
  await expect(page.locator("h1")).toContainText("Get your shop live in a few minutes");

  await page.setInputFiles("#setupShopLogoInput", {
    name: "setup-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"),
  });
  await expect(page.locator("#setupShopLogoPreview")).toHaveAttribute("src", /data:image\/png;base64,/);

  await page.fill("#setupShopName", "North Loop Cuts");
  await page.getByRole("button", { name: "Save and Continue" }).click();

  await expect(page.locator("#setupStepSummary")).toHaveText("Step 2 of 5");
  await page.fill("#setupOwnerDisplayName", "Jordan Owner");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#setupStepSummary")).toHaveText("Step 3 of 5");
  await page.selectOption("#setupServiceBarber", OWNER_USERNAME);
  await page.fill("#setupServiceName", "Classic Cut");
  await page.fill("#setupServicePrice", "35");
  await page.fill("#setupServiceDuration", "30");
  await page.getByRole("button", { name: "Add Service" }).click();
  await expect(page.locator("#setupServiceList")).toContainText("Classic Cut");

  await page.fill("#setupServiceName", "Beard Trim");
  await page.fill("#setupServicePrice", "20");
  await page.fill("#setupServiceDuration", "15");
  await page.getByRole("button", { name: "Add Service" }).click();
  await expect(page.locator("#setupServiceList")).toContainText("Beard Trim");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#setupStepSummary")).toHaveText("Step 4 of 5");
  await expect(page.locator("input[data-day='mon'][data-field='enabled']")).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#setupStepSummary")).toHaveText("Step 5 of 5");
  await expect(page.locator("#setupReadyShopName")).toHaveText("North Loop Cuts");
  await expect(page.locator("#setupBookingLink")).toHaveValue(/\/pages\/book\.html\?shop=north-loop-cuts$/);
  await expect(page.locator("#setupBookingQrImage")).toHaveAttribute("src", /data:image\/png;base64,/);

  const setupState = await page.evaluate(() => ({
    step: sessionStorage.getItem("Slotzy_setupStep"),
    shopId: sessionStorage.getItem("Slotzy_setupShopId"),
    complete: sessionStorage.getItem("Slotzy_setupComplete"),
    services: JSON.parse(localStorage.getItem("Slotzy_services") || "[]"),
    availability: JSON.parse(localStorage.getItem("Slotzy_availability") || "{}"),
    shops: JSON.parse(localStorage.getItem("Slotzy_shops") || "[]"),
  }));

  expect(setupState.step).toBe("5");
  expect(setupState.shopId).toBe(SHOP_ID);
  expect(setupState.complete).toBe("true");
  expect(Array.isArray(setupState.services)).toBeTruthy();
  expect(setupState.services).toHaveLength(2);
  expect(setupState.availability?.[OWNER_USERNAME]?.weekly?.mon?.enabled).toBeTruthy();
  expect(setupState.shops[0]?.name).toBe("North Loop Cuts");
  expect(setupState.shops[0]?.slug).toBe("north-loop-cuts");
  expect(setupState.shops[0]?.logoDataUrl || "").toContain("data:image/png;base64,");

  const bookingLink = await page.locator("#setupBookingLink").inputValue();
  const storageSnapshot = await page.evaluate(() => ({
    local: Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key) ?? ""])),
    session: Object.fromEntries(Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key) ?? ""])),
  }));
  const publicPage = await page.context().newPage();
  await publicPage.addInitScript((snapshot) => {
    localStorage.clear();
    sessionStorage.clear();
    Object.entries(snapshot.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, String(value ?? ""));
    });
    Object.entries(snapshot.session || {}).forEach(([key, value]) => {
      sessionStorage.setItem(key, String(value ?? ""));
    });
  }, storageSnapshot);
  await publicPage.goto(bookingLink);
  await expect(publicPage.locator("#publicShopName")).toHaveText("North Loop Cuts");
  await expect(publicPage.locator("#publicShopLogo")).toHaveAttribute("src", /data:image\/png;base64,/);
  await expect(publicPage.locator("#barberSelect")).toBeEnabled();
  await publicPage.close();
});

test("configured owners bypass onboarding and land on the dashboard", async ({ page }) => {
  await seedStorage(page, buildSeed({
    shopName: "Ready Shop",
    shopSlug: "ready-shop",
    services: [
      {
        id: "svc_owner_setup_ready",
        name: "Signature Cut",
        title: "Signature Cut",
        price: 40,
        duration: 30,
        durationMinutes: 30,
        active: true,
        createdAtISO: new Date().toISOString(),
        shopId: SHOP_ID,
        barberUsername: OWNER_USERNAME,
        ownerUsername: OWNER_USERNAME,
      },
    ],
    availability: buildAvailability(),
  }));

  await page.goto("/pages/business-owner.html");

  await expect(page).toHaveURL(/\/pages\/business-owner\.html$/);
  await expect(page.locator("#ownerHeroTitle")).toContainText("Ready Shop");
  await expect(page.locator("#ownerTodayGlanceCard")).toBeVisible();
});
