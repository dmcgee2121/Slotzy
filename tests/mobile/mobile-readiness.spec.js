const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_mobile_pilot";
const OWNER_USERNAME = "owner_mobile_pilot";
const SERVICE_ID = "service_mobile_pilot";
const SHOP_SLUG = "mobile-pilot-shop";
const CUSTOMER_CONTACT = "555-010-6677";

function toYmd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSeed({ configuredOwner = false } = {}) {
  const now = new Date().toISOString();
  const policy = {
    allowSameDay: true,
    maxDaysAdvance: 30,
    cancelHours: 24,
    bufferMinutes: 0,
    requireDeposit: false,
    depositAmount: 0,
    lateGraceMinutes: 10,
    noShowStrikeLimit: 2,
  };
  const weekly = Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      .map((day) => [day, { enabled: true, start: "09:00", end: "17:00" }])
  );
  const owner = {
    username: OWNER_USERNAME,
    password: "synthetic-mobile-only",
    role: "owner",
    displayName: "E2E Mobile Owner",
    shopId: configuredOwner ? SHOP_ID : null,
  };
  const shops = configuredOwner ? [{
    id: SHOP_ID,
    name: "E2E Mobile Pilot Shop",
    businessName: "E2E Mobile Pilot Shop",
    slug: SHOP_SLUG,
    ownerUsername: OWNER_USERNAME,
    bookingPolicy: policy,
    createdAtISO: now,
  }] : [];
  const services = configuredOwner ? [{
    id: SERVICE_ID,
    name: "E2E Mobile Cut",
    title: "E2E Mobile Cut",
    price: 35,
    duration: 30,
    durationMinutes: 30,
    active: true,
    shopId: SHOP_ID,
    barberUsername: OWNER_USERNAME,
    ownerUsername: OWNER_USERNAME,
    createdAtISO: now,
  }] : [];
  return {
    local: {
      Slotzy_users: [owner],
      Slotzy_profiles: {},
      Slotzy_shop: configuredOwner ? {
        shopId: SHOP_ID,
        name: "E2E Mobile Pilot Shop",
        businessName: "E2E Mobile Pilot Shop",
        bookingPolicy: policy,
      } : {},
      Slotzy_shops: shops,
      Slotzy_services: services,
      Slotzy_staff: [],
      Slotzy_bookings: [],
      Slotzy_availability: configuredOwner ? {
        [OWNER_USERNAME]: { timezone: "America/Chicago", bufferMinutes: 0, weekly, timeOff: [] },
      } : {},
    },
    session: { Slotzy_user: owner },
  };
}

async function seedStorage(page, seed, { includeSession = false } = {}) {
  await page.addInitScript(({ payload, withSession }) => {
    if (localStorage.getItem("Slotzy_mobile_readiness_seeded") === "1") return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("Slotzy_api_mode", "0");
    Object.entries(payload.local).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    if (withSession) {
      sessionStorage.setItem("Slotzy_user", JSON.stringify(payload.session.Slotzy_user));
    }
    localStorage.setItem("Slotzy_mobile_readiness_seeded", "1");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    });
  }, { payload: seed, withSession: includeSession });
}

async function expectNoPageOverflow(page, label) {
  await expect.poll(async () => page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth || 0,
  })), { message: `${label} must not overflow the mobile viewport` }).toEqual(expect.objectContaining({
    viewport: page.viewportSize().width,
    documentWidth: page.viewportSize().width,
    bodyWidth: page.viewportSize().width,
  }));
}

async function expectControlFits(page, target, { minHeight = 44 } = {}) {
  const locator = typeof target === "string" ? page.locator(target).first() : target.first();
  const label = typeof target === "string" ? target : "mobile control";
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds, `${label} should have measurable bounds`).toBeTruthy();
  expect(bounds.x, `${label} starts outside the viewport`).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width, `${label} is clipped horizontally`).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(bounds.height, `${label} is too short to tap comfortably`).toBeGreaterThanOrEqual(minHeight);
}

async function expectMobileWeeklyHours(page) {
  const rows = page.locator("#availability-weekly-body tr");
  await expect(rows).toHaveCount(7);

  const rowStates = await rows.evaluateAll((weeklyRows) => weeklyRows.map((row) => {
    const day = row.querySelector(".availability-day-cell");
    const enabled = row.querySelector(".availability-enabled-control");
    const start = row.querySelector("input[data-field='start']");
    const end = row.querySelector("input[data-field='end']");
    const bounds = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    };
    const dayStyle = getComputedStyle(day);
    return {
      dayText: day.textContent.trim(),
      dayWhiteSpace: dayStyle.whiteSpace,
      dayWordBreak: dayStyle.wordBreak,
      dayFits: day.scrollWidth <= day.clientWidth,
      row: bounds(row),
      enabled: bounds(enabled),
      start: bounds(start),
      end: bounds(end),
      viewportWidth: window.innerWidth,
    };
  }));

  for (const state of rowStates) {
    expect(state.dayText, "weekly-hours day label should be readable").toMatch(/^[A-Za-z]+$/);
    expect(state.dayWhiteSpace, `${state.dayText} must stay on one line`).toBe("nowrap");
    expect(state.dayWordBreak, `${state.dayText} must not break letter-by-letter`).not.toBe("break-all");
    expect(state.dayFits, `${state.dayText} must fit its day row`).toBe(true);
    for (const [controlName, box] of Object.entries({ enabled: state.enabled, start: state.start, end: state.end })) {
      expect(box.left, `${state.dayText} ${controlName} starts outside its row`).toBeGreaterThanOrEqual(state.row.left - 1);
      expect(box.right, `${state.dayText} ${controlName} is clipped by its row`).toBeLessThanOrEqual(state.row.right + 1);
      expect(box.right, `${state.dayText} ${controlName} is clipped by the viewport`).toBeLessThanOrEqual(state.viewportWidth + 1);
      expect(box.height, `${state.dayText} ${controlName} is too short to tap`).toBeGreaterThanOrEqual(44);
    }
  }
}

test("login and registration modal fit the mobile viewport", async ({ page }) => {
  await page.goto("/pages/index.html");
  await page.locator(".mobile-nav-toggle").click();
  await page.locator("#btn-login").click();
  await page.locator("#show-register").click();
  await expect(page.locator("#modal-title")).toHaveText("Register");
  await expectNoPageOverflow(page, "authentication page");
  await expectControlFits(page, "#auth-username");
  await expectControlFits(page, "#auth-password");
  await expectControlFits(page, "#auth-role");
  await expectControlFits(page, "#submit-btn");
  const modalState = await page.locator("#modal-panel").evaluate((panel) => ({
    viewportHeight: window.innerHeight,
    top: panel.getBoundingClientRect().top,
    bottom: panel.getBoundingClientRect().bottom,
    scrollable: panel.scrollHeight <= panel.clientHeight || getComputedStyle(panel).overflowY === "auto",
  }));
  expect(modalState.top).toBeGreaterThanOrEqual(0);
  expect(modalState.bottom).toBeLessThanOrEqual(modalState.viewportHeight);
  expect(modalState.scrollable).toBe(true);
});

test("public booking receipt and manage cancellation work on mobile", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expect(page.locator("#serviceSelect")).toBeEnabled();
  await page.locator("#serviceSelect").selectOption(SERVICE_ID);

  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));
  await expect(page.locator("#time-slot-select")).toBeVisible();
  const firstSlotValue = await page.locator("#time-slot-select option[value]:not([value=''])").first().getAttribute("value");
  expect(firstSlotValue).toBeTruthy();
  await page.locator("#time-slot-select").selectOption(String(firstSlotValue));
  await page.locator("#clientName").fill("E2E Mobile Client");
  await page.locator("#clientContact").fill(CUSTOMER_CONTACT);

  await expectNoPageOverflow(page, "public booking page");
  await expectControlFits(page, "#bookBtn");
  await page.locator("#bookBtn").click();
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  await expectNoPageOverflow(page, "booking receipt");
  await expectControlFits(page, "#btn-receipt-open-manage-link");

  const manageLink = await page.locator("#bookingReceiptManageLink").getAttribute("href");
  expect(manageLink).toBeTruthy();
  await page.goto(manageLink);
  const managedCard = page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" });
  await expect(managedCard).toBeVisible();
  await expectNoPageOverflow(page, "manage booking page");
  await expectControlFits(page, "button[data-action='cancel-appointment']");
  await managedCard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectControlFits(page, "button[data-action='confirm-cancel-appointment']");
  await managedCard.getByRole("button", { name: "Confirm Cancel", exact: true }).click();
  await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Cancelled");
  await expect(managedCard.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" }).locator(".appointment-actions .badge")).toHaveText("Cancelled");
});

test("invalid manage link and owner setup states fit mobile", async ({ page }) => {
  await seedStorage(page, buildSeed(), { includeSession: true });
  await page.goto("/pages/manage.html?shop=missing-mobile-shop&contact=e2e-mobile-invalid%40example.test");
  await expect(page.locator("#manageStatus")).toContainText("could not find a shop");
  await expectNoPageOverflow(page, "invalid manage link page");

  await page.goto("/pages/owner-setup.html");
  const activeSetupPanel = page.locator("[data-step-panel]:not(.hidden)");
  await expect(activeSetupPanel).toBeVisible();
  await expectNoPageOverflow(page, "owner setup page");
  await expectControlFits(page, activeSetupPanel.locator("input:visible, select:visible"));
  await expectControlFits(page, activeSetupPanel.locator("button:visible"));
});

test("owner critical controls remain usable across mobile pages", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  const surfaces = [
    { path: "/pages/business-owner.html", ready: "#pilotBookingLink", controls: ["#pilotCopyBookingBtn", "#pilotOpenBookingBtn", "#availability-save-weekly"] },
    { path: "/pages/manage-services.html", ready: "#serviceList", controls: ["#serviceName", "#addServiceBtn"] },
    { path: "/pages/manage-appointments.html", ready: "#appointment-list", controls: ["#appointment-search", "#addWalkinBtn", "#exportAppointmentsCsvBtn"] },
    { path: "/pages/settings.html", ready: "#settingsMain", controls: ["#publicBookingLinkInput", "#copyPublicBookingLinkBtn", "#saveShopBtn"] },
  ];

  for (const surface of surfaces) {
    await page.goto(surface.path);
    await expect(page.locator(surface.ready)).toBeVisible();
    await expectNoPageOverflow(page, surface.path);
    for (const selector of surface.controls) {
      await expectControlFits(page, selector);
    }
    if (surface.path === "/pages/business-owner.html") {
      await expectMobileWeeklyHours(page);
      for (const selector of [
        "#availability-timezone",
        "#availability-buffer",
        "#availability-quick-date",
        "#availability-timeoff-start",
        "#availability-timeoff-end",
        "#availability-add-timeoff",
      ]) {
        await expectControlFits(page, selector);
      }
    }
  }
});
