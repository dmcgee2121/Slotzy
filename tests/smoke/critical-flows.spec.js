const fs = require("fs/promises");
const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_smoke_1";
const OWNER_USERNAME = "owner_smoke";
const SECOND_BARBER_USERNAME = "barber_smoke";
const CUSTOMER_USERNAME = "customer_smoke";
const SERVICE_ID = "svc_smoke_1";
const SERVICE_NAME = "Smoke Haircut";
const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/l8RGoQAAAABJRU5ErkJggg==";
const DEFAULT_BOOKING_POLICY = {
  allowSameDay: true,
  maxDaysAdvance: 30,
  cancelHours: 24,
  bufferMinutes: 0,
  requireDeposit: false,
  depositAmount: 0,
  lateGraceMinutes: 10,
  noShowStrikeLimit: 2,
};

function toYmd(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHhmm(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toDayKey(date) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
}

function makeFutureSlot({ dayOffset = 1, hour = 10, minute = 0, durationMinutes = 30 }) {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startAtISO: start.toISOString(),
    date: toYmd(start),
    time: toHhmm(start),
    durationMinutes,
  };
}

function makeBookingPolicy(overrides = {}) {
  return {
    ...DEFAULT_BOOKING_POLICY,
    ...overrides,
  };
}

function buildSeed({ sessionUser, services = [], bookings = [], bookingPolicy = {} }) {
  const nowIso = new Date().toISOString();
  const resolvedPolicy = makeBookingPolicy(bookingPolicy);
  const users = [
    {
      username: OWNER_USERNAME,
      password: "pass1234",
      role: "owner",
      displayName: "Owner Smoke",
      shopId: SHOP_ID,
    },
      {
        username: SECOND_BARBER_USERNAME,
        password: "pass1234",
        role: "barber",
        displayName: "Barber Smoke",
        shopId: SHOP_ID,
      },
      {
        username: CUSTOMER_USERNAME,
        password: "pass1234",
        role: "customer",
      displayName: "Customer Smoke",
      shopId: null,
    },
  ];

  const shops = [
    {
      id: SHOP_ID,
      name: "Smoke Shop",
      slug: "smoke-shop",
      createdAtISO: nowIso,
      bookingPolicy: resolvedPolicy,
    },
  ];

  const legacyShop = {
    businessName: "Smoke Shop",
    name: "Smoke Shop",
    shopId: SHOP_ID,
    bookingPolicy: {
      ...resolvedPolicy,
    },
  };

  const availability = {
    [OWNER_USERNAME]: {
      timezone: "America/Chicago",
      bufferMinutes: 0,
      weekly: {
        mon: { enabled: true, start: "09:00", end: "17:00" },
        tue: { enabled: true, start: "09:00", end: "17:00" },
        wed: { enabled: true, start: "09:00", end: "17:00" },
        thu: { enabled: true, start: "09:00", end: "17:00" },
        fri: { enabled: true, start: "09:00", end: "17:00" },
        sat: { enabled: true, start: "09:00", end: "17:00" },
        sun: { enabled: true, start: "09:00", end: "17:00" },
      },
      timeOff: [],
    },
  };

  return {
    local: {
      Slotzy_users: users,
      Slotzy_profiles: {},
      Slotzy_shop: legacyShop,
      Slotzy_shops: shops,
      Slotzy_services: services,
      Slotzy_staff: [],
      Slotzy_bookings: bookings,
      Slotzy_availability: availability,
    },
    session: {
      Slotzy_user: sessionUser || null,
    },
  };
}

async function seedStorage(page, seed) {
  await page.addInitScript((seedPayload) => {
    localStorage.clear();
    sessionStorage.clear();

    // Disable API mode to use localStorage
    localStorage.setItem("Slotzy_api_mode", "0");

    Object.entries(seedPayload.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    Object.entries(seedPayload.session || {}).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      sessionStorage.setItem(key, JSON.stringify(value));
    });
  }, seed);
}

async function readLocalJson(page, key) {
  return page.evaluate((targetKey) => {
    const raw = localStorage.getItem(targetKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, key);
}

async function readLocalStorageSnapshot(page) {
  return page.evaluate(() => {
    const localKeys = [
      "Slotzy_users",
      "Slotzy_profiles",
      "Slotzy_shop",
      "Slotzy_shops",
      "Slotzy_services",
      "Slotzy_staff",
      "Slotzy_bookings",
      "Slotzy_availability",
    ];
    const local = {};
    localKeys.forEach((key) => {
      const raw = localStorage.getItem(key);
      local[key] = raw ? JSON.parse(raw) : null;
    });
    return { local };
  });
}

async function readDownloadText(download) {
  const filePath = await download.path();
  const raw = await fs.readFile(filePath, "utf8");
  return raw.replace(/^\uFEFF/, "");
}

test.describe("Slotzy critical smoke flows", () => {
  test("home page loads and auth modal opens/closes", async ({ page }) => {
    await page.goto("/pages/index.html");

    await expect(page.getByRole("heading", { name: "Welcome to Slotzy" })).toBeVisible();
    await page.locator("#btn-login").click();
    await expect(page.locator("#modal-title")).toHaveText("Login");

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
  });

  test("auth falls back to local mode when the backend is offline", async ({ page }) => {
    await page.route("http://localhost:3001/**", (route) => route.abort());
    await page.goto("/pages/index.html");

    await page.locator("#btn-login").click();
    await expect(page.locator("#auth-mode-note")).toContainText("Backend offline — using local demo login.");

    await page.locator("#show-register").click();
    await expect(page.locator("#auth-role")).not.toContainText("Customer");
    await page.fill("#auth-username", "local_smoke");
    await page.fill("#auth-password", "pass1234");
    await page.selectOption("#auth-role", "owner");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/pages\/business-owner\.html$/);
    await expect(page.getByRole("heading", { name: "Today at a Glance" })).toBeVisible();

    const sessionUser = await page.evaluate(() => {
      const raw = sessionStorage.getItem("Slotzy_user");
      return raw ? JSON.parse(raw) : null;
    });
    expect(sessionUser).toMatchObject({
      username: "local_smoke",
      role: "owner",
    });

    const users = await readLocalJson(page, "Slotzy_users");
    expect(Array.isArray(users)).toBeTruthy();
    expect(users.some((user) => (
      user?.username === "local_smoke"
      && user?.password === "pass1234"
      && user?.role === "owner"
    ))).toBeTruthy();

    await page.evaluate(() => {
      sessionStorage.removeItem("Slotzy_user");
    });

    await page.goto("/pages/index.html");
    await page.locator("#btn-login").click();
    await expect(page.locator("#auth-mode-note")).toContainText("Backend offline — using local demo login.");
    await page.fill("#auth-username", "local_smoke");
    await page.fill("#auth-password", "pass1234");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/pages\/business-owner\.html$/);
    await expect(page.getByRole("heading", { name: "Today at a Glance" })).toBeVisible();
  });

  test("auth uses server mode when backend health is online", async ({ page }) => {
    await page.route("http://localhost:3001/api/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, service: "slotzy-api" }),
      });
    });
    await page.route("http://localhost:3001/api/auth/register", async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "server-smoke-token",
          user: {
            username: payload.username,
            role: payload.role,
          },
        }),
      });
    });

    await page.goto("/pages/index.html");
    await page.locator("#btn-login").click();
    await expect(page.locator("#auth-mode-note")).toBeHidden();

    await page.locator("#show-register").click();
    await expect(page.locator("#auth-role")).not.toContainText("Customer");
    await page.fill("#auth-username", "server_smoke");
    await page.fill("#auth-password", "pass1234");
    await page.selectOption("#auth-role", "owner");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/pages\/business-owner\.html$/);
    await expect(page.getByRole("heading", { name: "Today at a Glance" })).toBeVisible();

    const sessionUser = await page.evaluate(() => {
      const raw = sessionStorage.getItem("Slotzy_user");
      return raw ? JSON.parse(raw) : null;
    });
    expect(sessionUser).toMatchObject({
      username: "server_smoke",
      role: "owner",
    });

    const authToken = await page.evaluate(() => localStorage.getItem("Slotzy_auth_token"));
    expect(authToken).toBe("server-smoke-token");
  });

  test("customer login is blocked with a friendly inline message", async ({ page }) => {
    const seed = buildSeed({
      sessionUser: null,
      services: [],
      bookings: [],
    });
    await seedStorage(page, seed);
    await page.route("http://localhost:3001/**", (route) => route.abort());
    await page.goto("/pages/index.html");

    await page.locator("#btn-login").click();
    await page.fill("#auth-username", CUSTOMER_USERNAME);
    await page.fill("#auth-password", "pass1234");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.locator("#auth-error")).toContainText("Customer logins are not enabled. Use your booking link instead.");
    await expect(page).toHaveURL(/\/pages\/index\.html$/);

    const sessionUser = await page.evaluate(() => {
      const raw = sessionStorage.getItem("Slotzy_user");
      return raw ? JSON.parse(raw) : null;
    });
    expect(sessionUser).toBeNull();
  });

  test("retired customer dashboard redirects back to home", async ({ page }) => {
    await page.goto("/pages/customer-dashboard.html");
    await expect(page).toHaveURL(/\/index\.html$/, { timeout: 4000 });
    await expect(page.getByText("Customer logins are not enabled. Use your booking link instead.")).toBeVisible();
  });

  test("owner can add a service from dashboard quick add", async ({ page }) => {
    const seed = buildSeed({
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
      services: [],
      bookings: [],
    });
    await seedStorage(page, seed);

    await page.goto("/pages/business-owner.html");
    await page.getByRole("button", { name: "+ Add Service" }).click();

    await page.fill("#serviceNameQuick", "Smoke Test Service");
    await page.fill("#servicePriceQuick", "45");
    await page.fill("#serviceDurationQuick", "60");
    await page.getByRole("button", { name: "Create" }).click();

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("Slotzy_services");
      if (!raw) return false;
      try {
        const rows = JSON.parse(raw);
        return Array.isArray(rows) && rows.some((row) => row?.name === "Smoke Test Service");
      } catch {
        return false;
      }
    });

    const services = await readLocalJson(page, "Slotzy_services");
    expect(Array.isArray(services)).toBeTruthy();
    expect(services.some((service) => service?.name === "Smoke Test Service")).toBeTruthy();
  });

  test("owner availability updates public booking slots", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const seed = buildSeed({
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
      services: [service],
      bookings: [],
    });
    await seedStorage(page, seed);

    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDayKey = toDayKey(bookingDate);

    await page.goto("/pages/business-owner.html");
    await page.fill(`input[data-day="${bookingDayKey}"][data-field="start"]`, "10:00");
    await page.fill(`input[data-day="${bookingDayKey}"][data-field="end"]`, "13:00");
    await page.click("#availability-save-weekly");

    await page.waitForFunction((username, dayKey) => {
      const raw = localStorage.getItem("Slotzy_availability");
      if (!raw) return false;
      try {
        const rows = JSON.parse(raw);
        const row = rows?.[username]?.weekly?.[dayKey];
        return row?.enabled === true && row?.start === "10:00" && row?.end === "13:00";
      } catch {
        return false;
      }
    }, OWNER_USERNAME, bookingDayKey);

    const availability = await readLocalJson(page, "Slotzy_availability");
    expect(availability?.[OWNER_USERNAME]?.weekly?.[bookingDayKey]).toMatchObject({
      enabled: true,
      start: "10:00",
      end: "13:00",
    });

    const storageSnapshot = await readLocalStorageSnapshot(page);
    const publicPage = await page.context().newPage();
    await publicPage.addInitScript((snapshot) => {
      localStorage.clear();
      sessionStorage.clear();
      Object.entries(snapshot.local || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        localStorage.setItem(key, JSON.stringify(value));
      });
    }, storageSnapshot);

    await publicPage.goto("/pages/book.html?shop=smoke-shop");
    await publicPage.selectOption("#barberSelect", OWNER_USERNAME);
    await publicPage.selectOption("#serviceSelect", SERVICE_ID);
    await publicPage.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, toYmd(bookingDate));

    const slotOptions = await publicPage.locator("#time-slot-select option").evaluateAll((options) =>
      options
        .map((option) => ({
          value: option.value || "",
          text: (option.textContent || "").trim(),
        }))
        .filter((option) => option.value)
    );
    expect(slotOptions.some((option) => option.text.startsWith("9:00"))).toBeFalsy();
    expect(slotOptions.some((option) => option.text.startsWith("10:00"))).toBeTruthy();
    expect(slotOptions.some((option) => option.text.startsWith("12:30"))).toBeTruthy();
    expect(slotOptions.some((option) => option.text.startsWith("1:00"))).toBeFalsy();
    await publicPage.close();
  });

  test("owner logo persists and appears on public booking and QR print", async ({ page }) => {
    const seed = buildSeed({
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
      services: [],
      bookings: [],
    });
    await seedStorage(page, seed);

    await page.goto("/pages/settings.html");
    await page.setInputFiles("#shopLogoInput", {
      name: "shop-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"),
    });

    await expect(page.locator("#shopLogoPreview")).toHaveAttribute("src", /data:image\/png;base64,/);
    await page.getByRole("button", { name: "Save Shop Settings" }).click();
    await expect(page.locator("#shopStatus")).toContainText("Shop settings saved successfully.");

    const shops = await readLocalJson(page, "Slotzy_shops");
    const savedShop = Array.isArray(shops) ? shops.find((shop) => shop?.id === SHOP_ID) : null;
    expect(String(savedShop?.logoDataUrl ?? "")).toContain("data:image/png;base64,");

    await expect(page.locator("#printPublicBookingQrBtn")).toBeEnabled();
    await page.evaluate(() => {
      window.__qrPrintMarkup = "";
      window.open = () => {
        const doc = {
          open() {},
          write(html) {
            window.__qrPrintMarkup += String(html ?? "");
          },
          close() {},
        };
        return {
          document: doc,
          focus() {},
          print() {},
        };
      };
    });
    await page.click("#printPublicBookingQrBtn");
    const qrPrintMarkup = await page.evaluate(() => String(window.__qrPrintMarkup ?? ""));
    expect(qrPrintMarkup).toContain('class="shop-logo"');
    expect(qrPrintMarkup).toContain("data:image/png;base64,");

    const storageSnapshot = await page.evaluate(() => {
      const localKeys = [
        "Slotzy_users",
        "Slotzy_profiles",
        "Slotzy_shop",
        "Slotzy_shops",
        "Slotzy_services",
        "Slotzy_staff",
        "Slotzy_bookings",
        "Slotzy_availability",
      ];
      const local = {};
      localKeys.forEach((key) => {
        const raw = localStorage.getItem(key);
        local[key] = raw ? JSON.parse(raw) : null;
      });
      return { local };
    });

    const publicPage = await page.context().newPage();
    await publicPage.addInitScript((snapshot) => {
      localStorage.clear();
      sessionStorage.clear();
      Object.entries(snapshot.local || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        localStorage.setItem(key, JSON.stringify(value));
      });
    }, storageSnapshot);
    await publicPage.goto("/pages/book.html?shop=smoke-shop");
    await expect(publicPage.locator("#publicShopLogo")).toHaveAttribute("src", /data:image\/png;base64,/);
    await publicPage.close();
  });

  test("public booking can book an appointment", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const seed = buildSeed({
      sessionUser: null,
      services: [service],
      bookings: [],
    });
    await page.goto("/pages/book.html?shop=smoke-shop");

    // Set localStorage after page load
    await page.evaluate((seed) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("Slotzy_api_mode", "0");
      Object.entries(seed.local || {}).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      Object.entries(seed.session || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        sessionStorage.setItem(key, JSON.stringify(value));
      });
    }, seed);

    // Reload the page to pick up the localStorage
    await page.reload();

    await page.addInitScript(() => {
      window.__copiedReceiptSummary = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__copiedReceiptSummary = String(value ?? "");
          },
        },
      });
    });

    await page.selectOption("#barberSelect", OWNER_USERNAME);
    await page.selectOption("#serviceSelect", SERVICE_ID);
    await page.fill("#clientName", "Customer Smoke");
    await page.fill("#clientContact", "customer-smoke@example.com");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill("#bookingDate", toYmd(tomorrow));

    await expect(page.locator("#time-slot-select")).toBeVisible();
    const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
    const firstSlotValue = await firstSlot.getAttribute("value");
    expect(firstSlotValue).toBeTruthy();
    await page.selectOption("#time-slot-select", String(firstSlotValue));

    await page.getByRole("button", { name: "Book Appointment" }).click();
    await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
    await expect(page.locator("#booking-receipt-section")).toContainText("Smoke Haircut");
    await expect(page.locator("#bookingReceiptShop")).toContainText("Smoke Shop");
    await expect(page.locator("#bookingReceiptBarber")).toContainText("Owner Smoke");
    await expect(page.locator("#btn-receipt-calendar")).toBeVisible();
    await expect(page.locator("#btn-receipt-copy-summary")).toBeVisible();

    const confirmationCode = String(await page.locator("#bookingReceiptConfirmationCode").textContent() || "").trim();
    await page.click("#btn-receipt-copy-summary");
    await expect(page.locator("#toast")).toContainText("Confirmation summary copied.");
    const copiedSummary = await page.evaluate(() => String(window.__copiedReceiptSummary ?? ""));
    expect(copiedSummary).toContain(`Slotzy booking confirmed: ${SERVICE_NAME} with Owner Smoke`);
    expect(copiedSummary).toContain(`Confirmation: ${confirmationCode}`);

    const bookings = await readLocalJson(page, "Slotzy_bookings");
    expect(Array.isArray(bookings)).toBeTruthy();
    expect(bookings).toHaveLength(1);
    expect(bookings.some((booking) => booking?.serviceName === SERVICE_NAME)).toBeTruthy();

    const storageSnapshot = await readLocalStorageSnapshot(page);
    const ownerPage = await page.context().newPage();
    await ownerPage.addInitScript((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      Object.entries(payload.snapshot.local || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        localStorage.setItem(key, JSON.stringify(value));
      });
      sessionStorage.setItem("Slotzy_user", JSON.stringify(payload.sessionUser));
    }, {
      snapshot: storageSnapshot,
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
    });
    await ownerPage.goto("/pages/manage-appointments.html");
    await ownerPage.getByRole("button", { name: "All" }).click();
    await expect(ownerPage.locator("#appointment-list")).toContainText(SERVICE_NAME);
    await expect(ownerPage.locator("#appointment-list")).toContainText("customer-smoke@example.com");
    await ownerPage.close();
  });

  test("public booking enforces shop date bounds", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const seed = buildSeed({
      sessionUser: null,
      services: [service],
      bookings: [],
      bookingPolicy: {
        allowSameDay: false,
        maxDaysAdvance: 5,
      },
    });
    await seedStorage(page, seed);

    await page.goto("/pages/book.html?shop=smoke-shop");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 5);
    const tooFarDate = new Date();
    tooFarDate.setDate(tooFarDate.getDate() + 6);
    const todayYmd = toYmd(new Date());
    const tomorrowYmd = toYmd(tomorrow);
    const tooFarYmd = toYmd(tooFarDate);

    await expect(page.locator("#bookingDate")).toHaveAttribute("min", tomorrowYmd);
    await expect(page.locator("#bookingDate")).toHaveAttribute("max", toYmd(maxDate));

    await page.selectOption("#barberSelect", OWNER_USERNAME);
    await page.selectOption("#serviceSelect", SERVICE_ID);
    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, tomorrowYmd);

    await expect(page.locator("#time-slot-select")).toBeVisible();
    const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
    const firstSlotValue = await firstSlot.getAttribute("value");
    expect(firstSlotValue).toBeTruthy();
    await page.selectOption("#time-slot-select", String(firstSlotValue));
    await expect(page.locator("#bookBtn")).toBeEnabled();

    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, todayYmd);

    await expect(page.locator("#bookingStatus")).toContainText("Same-day bookings are not available");
    await expect(page.locator("#slotList")).toContainText("Date unavailable");
    await expect(page.locator("#bookBtn")).toBeDisabled();

    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, tooFarYmd);

    await expect(page.locator("#bookingStatus")).toContainText(`Choose a date between ${tomorrowYmd} and ${toYmd(maxDate)}.`);
    await expect(page.locator("#slotList")).toContainText("Date unavailable");
    await expect(page.locator("#bookBtn")).toBeDisabled();
  });

  test("manage page cancellation uses cancelHours", async ({ page }) => {
    const start = new Date(Date.now() + 23 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const bookingId = "bk_cancel_window_smoke";
    const booking = {
      id: bookingId,
      shopId: SHOP_ID,
      ownerUsername: OWNER_USERNAME,
      barberUsername: OWNER_USERNAME,
      barberDisplayName: "Owner Smoke",
      shopName: "Smoke Shop",
      serviceId: SERVICE_ID,
      serviceName: SERVICE_NAME,
      price: 30,
      durationMinutes: 30,
      clientName: "Customer Smoke",
      clientContact: "customer-smoke@example.com",
      customerUsername: CUSTOMER_USERNAME,
      status: "booked",
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      startAtISO: start.toISOString(),
      date: toYmd(start),
      time: toHhmm(start),
      createdAt: new Date().toISOString(),
    };
    const seed = buildSeed({
      sessionUser: null,
      services: [],
      bookings: [booking],
      bookingPolicy: {
        cancelHours: 24,
      },
    });
    await seedStorage(page, seed);

    await page.goto("/pages/manage.html?shop=smoke-shop&contact=customer-smoke%40example.com");

    const cancelBtn = page.locator(`button[data-action="cancel-appointment"][data-id="${bookingId}"]`);
    await expect(cancelBtn).toHaveCount(0);
    await expect(page.locator("#manageUpcomingList")).toContainText("Cancellations must be made at least 24 hours before.");
  });

  test("public booking page uses shop policy for booking and cancellation", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const seed = buildSeed({
      sessionUser: null,
      services: [service],
      bookings: [],
      bookingPolicy: {
        allowSameDay: false,
        maxDaysAdvance: 5,
        cancelHours: 48,
        requireDeposit: true,
        depositAmount: 10,
      },
    });
    await seedStorage(page, seed);

    await page.goto("/pages/book.html?shop=smoke-shop");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 5);
    const tooFarDate = new Date();
    tooFarDate.setDate(tooFarDate.getDate() + 6);
    const todayYmd = toYmd(new Date());
    const tomorrowYmd = toYmd(tomorrow);
    const tooFarYmd = toYmd(tooFarDate);

    await expect(page.locator("#bookingDate")).toHaveAttribute("min", tomorrowYmd);
    await expect(page.locator("#bookingDate")).toHaveAttribute("max", toYmd(maxDate));

    await page.selectOption("#barberSelect", OWNER_USERNAME);
    await page.selectOption("#serviceSelect", SERVICE_ID);
    await page.fill("#clientName", "Public Booker");
    await page.fill("#clientContact", "public-booker@example.com");
    await expect(page.locator("#depositNotice")).toBeVisible();
    await expect(page.locator("#depositNoticeText")).toContainText("$10.00 deposit");
    await page.check("#depositAcknowledge");

    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, todayYmd);
    await expect(page.locator("#bookingStatus")).toContainText("Same-day bookings are not available");

    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, tooFarYmd);
    await expect(page.locator("#bookingStatus")).toContainText(`Choose a date between ${tomorrowYmd} and ${toYmd(maxDate)}.`);
    await expect(page.locator("#slotList")).toContainText("Date unavailable");
    await expect(page.locator("#bookBtn")).toBeDisabled();

    await page.locator("#bookingDate").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, tomorrowYmd);

    await expect(page.locator("#time-slot-select")).toBeVisible();
    const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
    const firstSlotValue = await firstSlot.getAttribute("value");
    expect(firstSlotValue).toBeTruthy();
    await page.selectOption("#time-slot-select", String(firstSlotValue));

    await page.getByRole("button", { name: "Book Appointment" }).click();
    await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
    const publicBookings = await readLocalJson(page, "Slotzy_bookings");
    expect(Array.isArray(publicBookings)).toBeTruthy();
    expect(publicBookings).toHaveLength(1);
    await expect(page.locator("#btn-receipt-calendar")).toBeVisible();
    await expect(page.locator("#btn-receipt-copy-summary")).toBeVisible();
    await expect(page.locator("#bookingReceiptDepositNotice")).toContainText("A $10.00 deposit is required for this appointment. Status: Unpaid.");
    await expect(page.locator("#btn-receipt-cancel")).toBeDisabled();
    await expect(page.locator("#booking-receipt-section")).toContainText("Cancellations must be made at least 48 hours before.");

    await page.locator("#btn-receipt-cancel").evaluate((button) => button.removeAttribute("disabled"));
    await page.click("#btn-receipt-cancel");
    await expect(page.locator("#booking-receipt-error")).toContainText("Cancellations must be made at least 48 hours before.");

    const storageSnapshot = await readLocalStorageSnapshot(page);
    const ownerPage = await page.context().newPage();
    await ownerPage.addInitScript((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      Object.entries(payload.snapshot.local || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        localStorage.setItem(key, JSON.stringify(value));
      });
      sessionStorage.setItem("Slotzy_user", JSON.stringify(payload.sessionUser));
    }, {
      snapshot: storageSnapshot,
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
    });
    await ownerPage.goto("/pages/manage-appointments.html");
    await ownerPage.getByRole("button", { name: "All" }).click();
    await expect(ownerPage.locator("#appointment-list")).toContainText(SERVICE_NAME);
    await expect(ownerPage.locator("#appointment-list")).toContainText("Public Booker");
    await ownerPage.close();
  });

  test("owner can reschedule then cancel an appointment", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const slot = makeFutureSlot({ dayOffset: 1, hour: 11, minute: 0, durationMinutes: 30 });
    const bookingId = "bk_smoke_1";
    const booking = {
      id: bookingId,
      shopId: SHOP_ID,
      ownerUsername: OWNER_USERNAME,
      barberUsername: OWNER_USERNAME,
      barberDisplayName: "Owner Smoke",
      shopName: "Smoke Shop",
      serviceId: SERVICE_ID,
      serviceName: SERVICE_NAME,
      price: 30,
      durationMinutes: 30,
      clientName: "Customer Smoke",
      clientContact: "customer-smoke@example.com",
      customerUsername: CUSTOMER_USERNAME,
      status: "booked",
      ...slot,
      createdAt: new Date().toISOString(),
    };

    const seed = buildSeed({
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
      services: [service],
      bookings: [booking],
    });
    await seedStorage(page, seed);

    await page.goto("/pages/manage-appointments.html");

    await page.getByRole("button", { name: "All" }).click();
    const rescheduleBtn = page.locator(`button[data-action="reschedule"][data-booking-id="${bookingId}"]`);
    await expect(rescheduleBtn).toBeVisible();
    await rescheduleBtn.click();

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 2);
    await page.fill("#reschedule-date", toYmd(newDate));
    await expect(page.locator("#reschedule-slot")).toBeEnabled();

    const firstRescheduleOption = page.locator("#reschedule-slot option[value]:not([value=''])").first();
    const selectedSlotValue = await firstRescheduleOption.getAttribute("value");
    expect(selectedSlotValue).toBeTruthy();
    await page.selectOption("#reschedule-slot", String(selectedSlotValue));
    await page.getByRole("button", { name: "Confirm Reschedule" }).click();

    await expect(page.locator("#appointment-status")).toContainText("Appointment rescheduled.");

    page.once("dialog", (dialog) => dialog.accept());
    const cancelBtn = page.locator(`button[data-action="cancel"][data-booking-id="${bookingId}"]`);
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page.locator("#appointment-status")).toContainText("Appointment cancelled.");

    const bookings = await readLocalJson(page, "Slotzy_bookings");
    const updated = Array.isArray(bookings) ? bookings.find((item) => item?.id === bookingId) : null;
    expect(updated).toBeTruthy();
    expect(String(updated.status)).toBe("cancelled");
  });

  test("owner can export filtered bookings and clients as CSV", async ({ page }) => {
    const service = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      title: SERVICE_NAME,
      price: 30,
      duration: 30,
      durationMinutes: 30,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: SHOP_ID,
      barberUsername: OWNER_USERNAME,
      ownerUsername: OWNER_USERNAME,
    };
    const alicePastSlot = makeFutureSlot({ dayOffset: -5, hour: 10, minute: 0, durationMinutes: 30 });
    const aliceUpcomingSlot = makeFutureSlot({ dayOffset: 1, hour: 11, minute: 30, durationMinutes: 30 });
    const bobUpcomingSlot = makeFutureSlot({ dayOffset: 2, hour: 14, minute: 0, durationMinutes: 30 });
    const caseyUpcomingSlot = makeFutureSlot({ dayOffset: 3, hour: 15, minute: 30, durationMinutes: 30 });
    const bookings = [
      {
        id: "bk_csv_alice_past",
        shopId: SHOP_ID,
        ownerUsername: OWNER_USERNAME,
        barberUsername: OWNER_USERNAME,
        barberDisplayName: "Owner Smoke",
        serviceId: SERVICE_ID,
        serviceName: SERVICE_NAME,
        price: 30,
        durationMinutes: 30,
        clientName: "Alice Example",
        clientContact: "alice@example.com",
        customerUsername: CUSTOMER_USERNAME,
        status: "no-show",
        ...alicePastSlot,
        createdAt: new Date().toISOString(),
      },
      {
        id: "bk_csv_alice_future",
        shopId: SHOP_ID,
        ownerUsername: OWNER_USERNAME,
        barberUsername: OWNER_USERNAME,
        barberDisplayName: "Owner Smoke",
        serviceId: SERVICE_ID,
        serviceName: SERVICE_NAME,
        price: 30,
        durationMinutes: 30,
        clientName: "Alice Example",
        clientContact: "alice@example.com",
        customerUsername: CUSTOMER_USERNAME,
        status: "booked",
        ...aliceUpcomingSlot,
        createdAt: new Date().toISOString(),
      },
      {
        id: "bk_csv_bob_future",
        shopId: SHOP_ID,
        ownerUsername: OWNER_USERNAME,
        barberUsername: OWNER_USERNAME,
        barberDisplayName: "Owner Smoke",
        serviceId: SERVICE_ID,
        serviceName: SERVICE_NAME,
        price: 30,
        durationMinutes: 30,
        clientName: "Bob Example",
        clientContact: "bob@example.com",
        customerUsername: CUSTOMER_USERNAME,
        status: "booked",
        ...bobUpcomingSlot,
        createdAt: new Date().toISOString(),
      },
      {
        id: "bk_csv_casey_future",
        shopId: SHOP_ID,
        ownerUsername: SECOND_BARBER_USERNAME,
        barberUsername: SECOND_BARBER_USERNAME,
        barberDisplayName: "Barber Smoke",
        serviceId: SERVICE_ID,
        serviceName: SERVICE_NAME,
        price: 30,
        durationMinutes: 30,
        clientName: "Casey Example",
        clientContact: "casey@example.com",
        customerUsername: CUSTOMER_USERNAME,
        status: "confirmed",
        ...caseyUpcomingSlot,
        createdAt: new Date().toISOString(),
      },
    ];
    const seed = buildSeed({
      sessionUser: { username: OWNER_USERNAME, role: "owner" },
      services: [service],
      bookings,
    });
    await seedStorage(page, seed);

    await page.goto("/pages/manage-appointments.html");
    await page.getByRole("button", { name: "All" }).click();
    await page.selectOption("#appointment-owner-filter", "specific");
    await page.selectOption("#appointment-owner-select", SECOND_BARBER_USERNAME);
    await expect(page.locator("#appointment-list")).toContainText("Casey Example");
    await expect(page.locator("#appointment-list")).not.toContainText("Alice Example");

    const specificBarberDownloadPromise = page.waitForEvent("download");
    await page.click("#exportAppointmentsCsvBtn");
    const specificBarberDownload = await specificBarberDownloadPromise;
    expect(await specificBarberDownload.suggestedFilename()).toMatch(/^slotzy-appointments-\d{4}-\d{2}-\d{2}\.csv$/);
    const specificBarberCsv = await readDownloadText(specificBarberDownload);
    expect(specificBarberCsv).toContain("\"id\",\"status\",\"date\",\"startTime\"");
    expect(specificBarberCsv).toContain("Casey Example");
    expect(specificBarberCsv).not.toContain("Alice Example");

    await page.selectOption("#appointment-owner-filter", "all");
    await page.fill("#appointment-search", "Alice");
    await expect(page.locator("#appointment-list")).toContainText("Alice Example");
    await expect(page.locator("#appointment-list")).not.toContainText("Bob Example");
    await expect(page.locator("#appointment-list")).not.toContainText("Casey Example");

    const appointmentsDownloadPromise = page.waitForEvent("download");
    await page.click("#exportAppointmentsCsvBtn");
    const appointmentsDownload = await appointmentsDownloadPromise;
    expect(await appointmentsDownload.suggestedFilename()).toMatch(/^slotzy-appointments-\d{4}-\d{2}-\d{2}\.csv$/);
    const appointmentsCsv = await readDownloadText(appointmentsDownload);
    expect(appointmentsCsv).toContain("\"id\",\"status\",\"date\",\"startTime\",\"endTime\",\"serviceName\",\"price\",\"durationMinutes\",\"barberUsername\",\"clientName\",\"clientContact\",\"createdAt\"");
    expect(appointmentsCsv).toContain("Alice Example");
    expect(appointmentsCsv).not.toContain("Bob Example");
    expect(appointmentsCsv).not.toContain("Casey Example");
    expect(appointmentsCsv.trim().split(/\r?\n/)).toHaveLength(3);

    await page.goto("/pages/client-history-overview.html");
    await page.fill("#client-search", "Alice");
    await expect(page.locator("#client-list")).toContainText("Alice Example");
    await expect(page.locator("#client-list")).not.toContainText("Bob Example");

    const clientsDownloadPromise = page.waitForEvent("download");
    await page.click("#exportClientsCsvBtn");
    const clientsDownload = await clientsDownloadPromise;
    expect(await clientsDownload.suggestedFilename()).toMatch(/^slotzy-clients-\d{4}-\d{2}-\d{2}\.csv$/);
    const clientsCsv = await readDownloadText(clientsDownload);
    expect(clientsCsv).toContain("\"clientName\",\"clientContact\",\"totalVisits\",\"lastVisitDate\",\"noShowCount\",\"cancelledCount\"");
    expect(clientsCsv).toContain("Alice Example");
    expect(clientsCsv).not.toContain("Bob Example");
    expect(clientsCsv).toContain("\"2\"");
    expect(clientsCsv).toContain("\"1\"");
    expect(clientsCsv).toContain("\"0\"");
    expect(clientsCsv.trim().split(/\r?\n/)).toHaveLength(2);
  });
});

