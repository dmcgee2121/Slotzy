const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_mobile_pilot";
const OWNER_USERNAME = "owner_mobile_pilot";
const BARBER_USERNAME = "barber_mobile_pilot";
const SERVICE_ID = "service_mobile_pilot";
const SHOP_SLUG = "mobile-pilot-shop";
const CUSTOMER_CONTACT = "555-010-6677";

function toYmd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSeed({ configuredOwner = false, role = "owner" } = {}) {
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
  const username = role === "barber" ? BARBER_USERNAME : OWNER_USERNAME;
  const owner = {
    username,
    password: "synthetic-mobile-only",
    role,
    displayName: role === "barber" ? "E2E Mobile Barber" : "E2E Mobile Owner",
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
        [username]: { timezone: "America/Chicago", bufferMinutes: 0, weekly, timeOff: [] },
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

async function expectMobileWeeklyHours(page, expectedSurface = "dashboard") {
  const rows = page.locator("#availability-weekly-body tr");
  await expect(rows).toHaveCount(7);

  const layout = await page.locator(".availability-table-wrap").evaluate((container) => {
    const weeklyRows = Array.from(container.querySelectorAll("#availability-weekly-body tr"));
    const tableHeaders = Array.from(container.querySelectorAll("thead th"));
    const tableHead = container.querySelector("thead");
    const bounds = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    };
    return {
      currentPath: window.location.pathname,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      containerWidth: container.getBoundingClientRect().width,
      containerClientWidth: container.clientWidth,
      containerScrollWidth: container.scrollWidth,
      rowCount: weeklyRows.length,
      visibleTextSamples: weeklyRows.slice(0, 2).map((row) => row.innerText.trim()),
      tableHead: {
        ...bounds(tableHead),
        overflow: getComputedStyle(tableHead).overflow,
      },
      headerStates: tableHeaders.map((header) => ({
        text: header.textContent.trim(),
        width: header.getBoundingClientRect().width,
        height: header.getBoundingClientRect().height,
      })),
      rows: weeklyRows.map((row) => {
        const dayCell = row.querySelector(".availability-day-cell");
        const enabled = row.querySelector(".availability-enabled-control");
        const enabledLabel = row.querySelector(".availability-mobile-label");
        const start = row.querySelector("input[data-field='start']");
        const end = row.querySelector("input[data-field='end']");
        const dayStyle = getComputedStyle(dayCell);
        const enabledLabelStyle = getComputedStyle(enabledLabel);
        return {
          dayText: dayCell.textContent.trim(),
          dayWhiteSpace: dayStyle.whiteSpace,
          dayWordBreak: dayStyle.wordBreak,
          dayFits: dayCell.scrollWidth <= dayCell.clientWidth,
          enabledLabelText: enabledLabel.textContent.trim(),
          enabledLabelWhiteSpace: enabledLabelStyle.whiteSpace,
          enabledLabelFits: enabledLabel.scrollWidth <= enabledLabel.clientWidth,
          row: bounds(row),
          enabled: bounds(enabled),
          start: bounds(start),
          end: bounds(end),
        };
      }),
    };
  });

  const diagnostics = JSON.stringify({
    surface: expectedSurface,
    viewport: `${layout.viewportWidth}x${layout.viewportHeight}`,
    currentPath: layout.currentPath,
    containerWidth: layout.containerWidth,
    containerClientWidth: layout.containerClientWidth,
    containerScrollWidth: layout.containerScrollWidth,
    rowCount: layout.rowCount,
    visibleTextSamples: layout.visibleTextSamples,
  });
  expect(layout.currentPath, `authenticated ${expectedSurface} path; ${diagnostics}`).toBe("/pages/business-owner.html");
  expect(layout.containerScrollWidth, `Weekly Hours must not scroll horizontally; ${diagnostics}`).toBeLessThanOrEqual(layout.containerClientWidth + 1);
  expect(layout.headerStates.map(({ text }) => text), `Weekly Hours headers must remain semantic; ${diagnostics}`).toEqual(["Day", "Enabled", "Start", "End"]);
  expect(layout.tableHead.width, `Day/Enabled header row should be visually collapsed on mobile; ${diagnostics}`).toBeLessThanOrEqual(1);
  expect(layout.tableHead.height, `Day/Enabled header row should not letter-stack; ${diagnostics}`).toBeLessThanOrEqual(1);
  expect(layout.tableHead.overflow, `collapsed Weekly Hours headers must not leak; ${diagnostics}`).toBe("hidden");

  for (const state of layout.rows) {
    expect(state.dayText, `weekly-hours day label should be readable; ${diagnostics}`).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/);
    expect(state.dayWhiteSpace, `${state.dayText} must stay on one line; ${diagnostics}`).toBe("nowrap");
    expect(state.dayWordBreak, `${state.dayText} must not break letter-by-letter; ${diagnostics}`).not.toBe("break-all");
    expect(state.dayFits, `${state.dayText} must fit its day row; ${diagnostics}`).toBe(true);
    expect(state.enabledLabelText, `Enabled label missing for ${state.dayText}; ${diagnostics}`).toBe("Enabled");
    expect(state.enabledLabelWhiteSpace, `Enabled must stay on one line; ${diagnostics}`).toBe("nowrap");
    expect(state.enabledLabelFits, `Enabled must fit its control; ${diagnostics}`).toBe(true);
    for (const [controlName, box] of Object.entries({ enabled: state.enabled, start: state.start, end: state.end })) {
      expect(box.left, `${state.dayText} ${controlName} starts outside its row; ${diagnostics}`).toBeGreaterThanOrEqual(state.row.left - 1);
      expect(box.right, `${state.dayText} ${controlName} is clipped by its row; ${diagnostics}`).toBeLessThanOrEqual(state.row.right + 1);
      expect(box.right, `${state.dayText} ${controlName} is clipped by the viewport; ${diagnostics}`).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(box.height, `${state.dayText} ${controlName} is too short to tap; ${diagnostics}`).toBeGreaterThanOrEqual(44);
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

test("logged-in barber dashboard weekly hours use the mobile card layout", async ({ page }) => {
  await page.route("http://localhost:3001/**", (route) => route.abort());
  await seedStorage(page, buildSeed({ configuredOwner: true, role: "barber" }));
  await page.goto("/pages/index.html");

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => (
    !("serviceWorker" in navigator) || Boolean(navigator.serviceWorker.controller)
  )), { message: "installed mobile shell should control the barber login page" }).toBe(true);

  await page.locator(".mobile-nav-toggle").click();
  await page.locator("#btn-login").click();
  await expect(page.locator("#auth-mode-note")).toContainText("local demo login");
  await page.locator("#auth-username").fill(BARBER_USERNAME);
  await page.locator("#auth-password").fill("synthetic-mobile-only");
  await page.locator("#submit-btn").click();

  await expect(page).toHaveURL(/\/pages\/business-owner\.html$/);
  await expect(page.locator("#userBadge")).toContainText(BARBER_USERNAME);
  await expect(page.locator("#owner-availability")).toBeVisible();
  await expectMobileWeeklyHours(page, "logged-in barber dashboard");
  await expectNoPageOverflow(page, "logged-in barber dashboard Availability");
  await expectControlFits(page, "#availability-save-weekly");
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
