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

async function expectReadableStatus(page, selector) {
  const status = page.locator(selector);
  await expect(status).toBeVisible();
  const state = await status.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      left: bounds.left,
      right: bounds.right,
      width: bounds.width,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      fontSize: Number.parseFloat(styles.fontSize),
      lineHeight: Number.parseFloat(styles.lineHeight),
      role: element.getAttribute("role"),
    };
  });
  expect(state.left, `${selector} starts outside the viewport`).toBeGreaterThanOrEqual(0);
  expect(state.right, `${selector} is clipped horizontally`).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(state.scrollWidth, `${selector} text overflows its message`).toBeLessThanOrEqual(state.clientWidth + 1);
  expect(state.fontSize, `${selector} text is too small`).toBeGreaterThanOrEqual(14);
  expect(state.lineHeight, `${selector} needs readable line spacing`).toBeGreaterThanOrEqual(19);
  expect(state.role).toBe("alert");
}

async function installCalendarToolbarStub(page) {
  await page.route("**/fullcalendar@6.1.8/index.global.min.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.FullCalendar={Calendar:class{constructor(el,options){this.el=el;this.options=options;this.date=new Date(options.initialDate||Date.now())}getDate(){return this.date}destroy(){this.el.innerHTML=''}render(){const update=()=>{const title=this.date.toLocaleString(undefined,{month:'long',year:'numeric'});this.el.innerHTML='<div class="fc"><div class="fc-header-toolbar"><div class="fc-toolbar-chunk"><button type="button" class="fc-prev-button">Previous</button><button type="button" class="fc-next-button">Next</button></div><div class="fc-toolbar-chunk"><h2 class="fc-toolbar-title">'+title+'</h2></div><div class="fc-toolbar-chunk"><button type="button" class="fc-today-button">Today</button></div></div><table><tbody><tr><td class="fc-daygrid-day" data-ymd="2026-10-02"><div class="fc-daygrid-day-top"></div></td></tr></tbody></table></div>';this.el.querySelector('.fc-prev-button').onclick=()=>{this.date.setMonth(this.date.getMonth()-1);update()};this.el.querySelector('.fc-next-button').onclick=()=>{this.date.setMonth(this.date.getMonth()+1);update()};this.el.querySelector('.fc-today-button').onclick=()=>{this.date=new Date();update()};this.options.datesSet&&this.options.datesSet({view:{currentStart:new Date(this.date.getFullYear(),this.date.getMonth(),1)}})};update()}}};`,
  }));
  await page.route("**/fullcalendar@6.1.8/index.global.min.css", (route) => route.fulfill({ contentType: "text/css", body: "" }));
}

async function expectMobileWeeklyHours(page, expectedSurface = "dashboard", {
  bodySelector = "#availability-weekly-body",
  expectedPath = "/pages/business-owner.html",
} = {}) {
  const rows = page.locator(`${bodySelector} tr`);
  await expect(rows).toHaveCount(7);

  const layout = await page.locator(bodySelector).locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' availability-table-wrap ')][1]").evaluate((container, selector) => {
    const weeklyRows = Array.from(container.querySelectorAll(`${selector} tr`));
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
  }, bodySelector);

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
  expect(layout.currentPath, `authenticated ${expectedSurface} path; ${diagnostics}`).toBe(expectedPath);
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

test("public booking loading and retry error states fit mobile without a fake receipt", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));

  let releaseContext;
  const contextGate = new Promise((resolve) => { releaseContext = resolve; });
  await page.route("**/api/public/booking-context**", async (route) => {
    await contextGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "synthetic unavailable" }),
    });
  });

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expect(page.locator("#publicBookingLoadState")).toContainText("Loading this shop");
  await expectNoPageOverflow(page, "public booking loading state");
  releaseContext();

  await expect(page.locator("#publicBookingLoadState")).toContainText("We could not load this shop");
  await expectControlFits(page, "#publicBookingRetryBtn");
  await expectNoPageOverflow(page, "public booking retry state");
  await expect(page.getByRole("heading", { name: "Booked!" })).toHaveCount(0);
});

test("public booking no-services state stays actionable on mobile", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_services = [];
  await seedStorage(page, seed);
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);

  await expect(page.getByRole("heading", { name: "No services available" })).toBeVisible();
  await expectControlFits(page, "#noServicesBrowseShopsLink");
  await expectNoPageOverflow(page, "public booking no-services state");
});

test("public booking no-times state offers a mobile-safe next action", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  Object.values(seed.local.Slotzy_availability[OWNER_USERNAME].weekly).forEach((day) => {
    day.enabled = false;
  });
  await seedStorage(page, seed);
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await page.locator("#serviceSelect").selectOption(SERVICE_ID);
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));

  await expect(page.getByRole("heading", { name: "No available times" })).toBeVisible();
  await expectControlFits(page, "#noTimesChangeBarberBtn");
  await expectNoPageOverflow(page, "public booking no-times state");
});

test("public booking receipt and manage cancellation work on mobile", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expect(page.locator("#publicShopName")).toHaveText("E2E Mobile Pilot Shop");
  await expect(page.getByRole("heading", { name: "Choose what works for you" })).toBeVisible();
  await expectNoPageOverflow(page, "public booking initial state");
  await expect(page.getByRole("heading", { name: "Select service and date" })).toBeVisible();
  const barberSelect = page.locator("#barberSelect");
  if (await barberSelect.isVisible()) {
    await expectControlFits(page, barberSelect);
  } else {
    await expect(barberSelect).toHaveValue(OWNER_USERNAME);
  }
  for (const selector of ["#serviceSelect", "#bookingDate", "#clientName", "#clientContact", "#bookBtn"]) {
    await expectControlFits(page, selector);
  }
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
  await expectControlFits(page, "#btn-receipt-copy-manage-link");
  await expectControlFits(page, "#bookingReceiptManageLink");
  await expect(page.locator(".booking-receipt-manage-link-panel")).toContainText("private manage link");

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

test("dashboard public link creates an authoritative anonymous booking under service-worker control", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });

  const policy = buildSeed({ configuredOwner: true }).local.Slotzy_shops[0].bookingPolicy;
  const weekly = Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      .map((day) => [day, { enabled: true, start: "09:00", end: "17:00" }])
  );
  const publicContextPayload = {
    shops: [
      { id: "shop_public_mobile_fixture", name: "Pilot Neighborhood Barbers", businessName: "Pilot Neighborhood Barbers", slug: "pilot-neighborhood-barbers", bookingPolicy: policy },
      { id: SHOP_ID, name: "E2E Mobile Pilot Shop", businessName: "E2E Mobile Pilot Shop", slug: SHOP_SLUG, bookingPolicy: policy },
    ],
    providers: [{ username: OWNER_USERNAME, displayName: "E2E Mobile Owner", role: "owner", shopId: SHOP_ID }],
    services: [{ id: SERVICE_ID, name: "E2E Mobile Cut", title: "E2E Mobile Cut", price: 35, duration: 30, durationMinutes: 30, active: true, shopId: SHOP_ID, barberUsername: OWNER_USERNAME, ownerUsername: OWNER_USERNAME }],
    availabilityByBarber: { [OWNER_USERNAME]: { timezone: "America/Chicago", bufferMinutes: 0, weekly, timeOff: [] } },
    bookings: [],
  };

  let bookingPostAttempted = false;
  let bookingPostHadAuthorization = false;
  let bookingShouldConflict = false;
  let safeFailureDiagnostic = null;
  let authoritativeBooking = null;
  page.on("console", async (message) => {
    if (message.type() !== "error" || !message.text().includes("[Slotzy:public-booking] Save failed")) return;
    safeFailureDiagnostic = await message.args()[1]?.jsonValue().catch(() => null);
  });
  await page.route("**/api/public/booking-context**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicContextPayload) });
  });
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bookings: authoritativeBooking ? [authoritativeBooking] : [] }),
      });
      return;
    }
    if (route.request().method() !== "POST") return route.continue();
    bookingPostAttempted = true;
    bookingPostHadAuthorization = Boolean(route.request().headers().authorization);
    const submitted = route.request().postDataJSON();
    if (bookingShouldConflict) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "selected time is no longer available", code: "booking_conflict" }),
      });
      return;
    }
    authoritativeBooking = { ...submitted, id: "11111111-1111-4111-8111-111111111111", status: "booked" };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ booking: authoritativeBooking }),
    });
  });

  await page.goto("/pages/index.html");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/pages/business-owner.html");
  const bookingLink = await page.locator("#pilotBookingLink").inputValue();
  expect(bookingLink).toContain(`/pages/book.html?shop=${SHOP_SLUG}`);

  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem("Slotzy_auth_token");
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_mobile_readiness_seeded", "1");
  });
  await page.goto("/pages/book.html");
  await expect(page.locator("#publicShopPickerSection")).toBeVisible();
  await expect(page.locator("#publicShopPickerList")).toContainText("Pilot Neighborhood Barbers");
  await expect(page.locator("#publicShopPickerList")).not.toContainText("E2E Mobile Pilot Shop");

  await page.goto(bookingLink);
  await expect(page.locator("#publicShopName")).toHaveText("E2E Mobile Pilot Shop");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("slotzy-shell-v3"))).toBe(true);

  await page.locator("#serviceSelect").selectOption(SERVICE_ID);
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));
  const firstSlotValue = await page.locator("#time-slot-select option[value]:not([value=''])").first().getAttribute("value");
  expect(firstSlotValue).toBeTruthy();
  await page.locator("#time-slot-select").selectOption(String(firstSlotValue));
  await page.locator("#clientName").fill("E2E Anonymous Mobile Client");
  await page.locator("#clientContact").fill("anonymous-mobile@example.test");

  const saveResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/bookings"
  ));
  await page.locator("#bookBtn").click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(201);
  expect(bookingPostAttempted).toBe(true);
  expect(bookingPostHadAuthorization).toBe(false);
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  await expect(page.locator("#bookingReceiptManageLink")).toHaveAttribute("href", /\/pages\/manage\.html\?shop=/);
  await expectControlFits(page, "#bookingReceiptManageLink");
  await expectNoPageOverflow(page, "authoritative anonymous booking receipt");

  bookingShouldConflict = true;
  await page.goto(bookingLink);
  await page.locator("#serviceSelect").selectOption(SERVICE_ID);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));
  const conflictSlot = await page.locator("#time-slot-select option[value]:not([value=''])").first().getAttribute("value");
  await page.locator("#time-slot-select").selectOption(String(conflictSlot));
  await page.locator("#clientName").fill("E2E Diagnostic Client");
  await page.locator("#clientContact").fill("diagnostic-client@example.test");
  await page.locator("#bookBtn").click();
  await expect(page.locator("#bookingStatus")).toHaveText("That time was just taken. Choose another time.");
  await expectReadableStatus(page, "#bookingStatus");
  await expect.poll(() => safeFailureDiagnostic).toEqual(expect.objectContaining({
    postAttempted: true,
    endpointPath: "/api/bookings",
    httpStatus: 409,
    responseKeys: ["code", "error"],
    errorCode: "booking_conflict",
    selectedProviderExists: true,
    selectedServiceExists: true,
    selectedDatePresent: true,
    selectedTimePresent: true,
    selectedSlotShape: "iso-utc",
    serviceWorkerControlled: true,
    frontendCacheVersion: "slotzy-shell-v3",
  }));
  expect(JSON.stringify(safeFailureDiagnostic)).not.toContain("E2E Diagnostic Client");
  expect(JSON.stringify(safeFailureDiagnostic)).not.toContain("diagnostic-client@example.test");

  await page.evaluate((owner) => {
    localStorage.setItem("Slotzy_bookings", "[]");
    localStorage.setItem("Slotzy_auth_token", "synthetic-mobile-owner-token");
    sessionStorage.setItem("Slotzy_user", JSON.stringify(owner));
  }, buildSeed({ configuredOwner: true }).session.Slotzy_user);
  const ownerBookingsResponse = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).pathname === "/api/bookings"
  ));
  await page.goto("/pages/manage-appointments.html");
  expect((await ownerBookingsResponse).status()).toBe(200);
  await page.getByRole("button", { name: "All", exact: true }).click();
  const ownerAppointment = page.locator(".appointment-row").filter({ hasText: "E2E Mobile Cut" });
  await expect(ownerAppointment).toContainText("E2E Anonymous Mobile Client");
  await expect(ownerAppointment.locator(".appointment-actions .badge")).toContainText("Booked");
});

test("invalid manage link state fits mobile", async ({ page }) => {
  await seedStorage(page, buildSeed());
  await page.goto("/pages/manage.html?shop=missing-mobile-shop&contact=e2e-mobile-invalid%40example.test");
  await expect(page.locator("#manageStatus")).toContainText("could not find a shop");
  await expectReadableStatus(page, "#manageStatus");
  await expectNoPageOverflow(page, "invalid manage link page");
});

test("owner appointments refresh error keeps an empty state and tappable retry", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-mobile-owner-token");
  });
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "synthetic unavailable" }),
    });
  });

  await page.goto("/pages/manage-appointments.html");
  await expect(page.locator("#appointment-status")).toContainText("Could not refresh appointments");
  await expectReadableStatus(page, "#appointment-status");
  await expect(page.getByRole("heading", { name: "You do not have appointments for this view yet" })).toBeVisible();
  await expectControlFits(page, "#appointment-retry");
  await expectNoPageOverflow(page, "owner appointments retry state");
});

test("owner setup is guided and usable through completion on mobile", async ({ page }) => {
  const setupSeed = buildSeed();
  setupSeed.local.Slotzy_users[0].shopId = SHOP_ID;
  setupSeed.local.Slotzy_shop = { shopId: SHOP_ID, name: "A", businessName: "A" };
  setupSeed.local.Slotzy_shops = [{ id: SHOP_ID, name: "A", businessName: "A", slug: "a", ownerUsername: OWNER_USERNAME }];
  await seedStorage(page, setupSeed, { includeSession: true });

  await page.goto("/pages/owner-setup.html");
  await expect(page.locator("#setupIntroText")).toHaveText("Name your shop and choose an optional logo for the page clients will see.");
  await expect(page.locator(".setup-step")).toHaveCount(5);
  await expect(page.locator('.setup-step[aria-current="step"]')).toContainText("Shop");
  await expect(page.getByRole("heading", { name: "Name your shop" })).toBeVisible();
  await expect(page.locator("[data-step-panel='1'] .setup-later-note")).toContainText("later");
  await expectNoPageOverflow(page, "owner setup shop step");
  for (const selector of ["#setupShopName", "#setupShopLogoInput", "#setupRemoveShopLogoBtn", "#setupStep1Next"]) {
    await expectControlFits(page, selector);
  }

  await page.locator("#setupStep1Next").click();
  await expect(page.locator("#setupShopStatus")).toContainText("at least 2 characters");
  await expectReadableStatus(page, "#setupShopStatus");
  await page.locator("#setupShopName").fill("E2E Mobile Setup Shop");
  await page.locator("#setupStep1Next").click();

  await expect(page.getByRole("heading", { name: "Choose your booking team" })).toBeVisible();
  await expect(page.locator('.setup-step[aria-current="step"]')).toContainText("Team");
  await expectNoPageOverflow(page, "owner setup team step");
  await expectControlFits(page, ".setup-toggle-card");
  await expectControlFits(page, "#setupOwnerDisplayName");
  await expectControlFits(page, "#setupStep2Back");
  await expectControlFits(page, "#setupStep2Next");

  await page.locator("#setupOnlyBarberCheckbox").uncheck();
  await expectNoPageOverflow(page, "owner setup optional team fields");
  for (const selector of ["#setupBarberDisplayName", "#setupBarberUsername", "#setupBarberPassword", "#setupBarberEmail", "#setupAddBarberBtn"]) {
    await expectControlFits(page, selector);
  }
  await page.locator("#setupStep2Next").click();
  await expect(page.locator("#setupBarberStatus")).toContainText("I work by myself");
  await expectReadableStatus(page, "#setupBarberStatus");
  await page.locator("#setupOnlyBarberCheckbox").check();
  await page.locator("#setupStep2Next").click();

  await expect(page.getByRole("heading", { name: "Add your services" })).toBeVisible();
  await expect(page.locator('.setup-step[aria-current="step"]')).toContainText("Services");
  await expectNoPageOverflow(page, "owner setup services step");
  for (const selector of ["#setupServiceBarber", "#setupServiceName", "#setupServicePrice", "#setupServiceDuration", "#setupAddServiceBtn", "#setupStep3Back", "#setupStep3Next"]) {
    await expectControlFits(page, selector);
  }

  const addService = async (name, price, duration) => {
    await page.locator("#setupServiceName").fill(name);
    await page.locator("#setupServicePrice").fill(price);
    await page.locator("#setupServiceDuration").fill(duration);
    await page.locator("#setupAddServiceBtn").click();
    await expect(page.locator("#setupServiceList")).toContainText(name);
  };
  await addService("E2E Mobile Cut", "35", "30");
  await page.locator("#setupStep3Next").click();
  await expect(page.locator("#setupServiceStatus")).toContainText("at least 2 services");
  await expectReadableStatus(page, "#setupServiceStatus");
  await addService("E2E Mobile Trim", "20", "20");
  await page.locator("#setupStep3Next").click();

  await expect(page.getByRole("heading", { name: "Set your booking hours" })).toBeVisible();
  await expect(page.locator('.setup-step[aria-current="step"]')).toContainText("Hours");
  await expectNoPageOverflow(page, "owner setup availability step");
  for (const selector of ["#setupAvailabilityBarber", "#setupTimezone", "#setupBufferMinutes", "#setupSaveAvailabilityBtn", "#setupStep4Back", "#setupStep4Next"]) {
    await expectControlFits(page, selector);
  }
  await expectMobileWeeklyHours(page, "owner setup", {
    bodySelector: "#setupAvailabilityWeeklyBody",
    expectedPath: "/pages/owner-setup.html",
  });

  await page.locator('#setupAvailabilityWeeklyBody input[data-field="enabled"]').evaluateAll((checkboxes) => {
    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) return;
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  await page.locator("#setupStep4Next").click();
  await expect(page.locator("#setupAvailabilityStatus")).toContainText("Enable at least one day");
  await expectReadableStatus(page, "#setupAvailabilityStatus");
  await page.locator('input[data-day="mon"][data-field="enabled"]').check();
  await page.locator("#setupStep4Next").click();

  await expect(page.getByRole("heading", { name: "Your booking page is ready" })).toBeVisible();
  await expect(page.locator('.setup-step[aria-current="step"]')).toContainText("Ready");
  await expect(page.locator("#setupReadyStatus")).toContainText("Setup complete");
  await expectNoPageOverflow(page, "owner setup ready step");
  await expectControlFits(page, "#setupBookingLink");
  for (const selector of ["#setupGoDashboard", "#setupCopyBookingLink", "#setupPrintBookingQr", "#setupOpenBookingPage"]) {
    await expectControlFits(page, selector);
  }
  await expect(page.locator("#setupGoDashboard")).toHaveText("Finish and Open Dashboard");
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
  await expect(page.locator("#userBadge")).toHaveCount(0);
  await expect(page.locator("#ownerHeroTitle")).toContainText("Welcome");
  const dashboardJumpNav = page.locator(".owner-dashboard-jump-nav");
  await expect(dashboardJumpNav).toBeVisible();
  await expectNoPageOverflow(page, "logged-in barber dashboard navigation");

  const jumpTargets = [
    { name: "Today", target: "#owner-today-section" },
    { name: "Booking Link", target: "#pilotModeBanner" },
    { name: "Appointments", target: "#owner-upcoming-section" },
    { name: "Services", target: "#owner-services-section" },
    { name: "Availability", target: "#owner-availability" },
  ];

  for (const { name, target } of jumpTargets) {
    const link = dashboardJumpNav.getByRole("link", { name, exact: true });
    await expectControlFits(page, link);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target)).toBeFocused();
    await expect(page.locator(target)).toBeInViewport();
  }

  const settingsLink = dashboardJumpNav.getByRole("link", { name: "Settings", exact: true });
  await expectControlFits(page, settingsLink);
  await expect(settingsLink).toHaveAttribute("href", "settings.html");
  await expectControlFits(page, "#pilotCopyBookingBtn");
  await expectControlFits(page, "#pilotOpenBookingBtn");
  await expect(page.locator("#owner-availability")).toBeVisible();
  await expectMobileWeeklyHours(page, "logged-in barber dashboard");
  await expectNoPageOverflow(page, "logged-in barber dashboard Availability");
  await expectControlFits(page, "#availability-save-weekly");
});

test("owner dashboard navigation and calendar toolbar stay polished on mobile", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await installCalendarToolbarStub(page);

  await page.goto("/pages/business-owner.html");
  await expect(page.locator("#pilotBookingLink")).toBeVisible();
  await expect(page.locator(".owner-dashboard-header-nav #userBadge")).toHaveCount(0);
  await expect(page.locator("#ownerHeroTitle")).toContainText("Welcome");

  const dashboardNav = page.locator(".owner-dashboard-header-nav");
  await expect(dashboardNav).toBeVisible();
  for (const name of ["Dashboard", "Appointments", "Services", "Team", "Settings", "Logout"]) {
    await expectControlFits(page, dashboardNav.getByRole(name === "Logout" ? "button" : "link", { name, exact: true }));
  }
  const dashboardNavBounds = await dashboardNav.evaluate((nav) => ({
    clientWidth: nav.clientWidth,
    scrollWidth: nav.scrollWidth,
  }));
  expect(dashboardNavBounds.scrollWidth, "dashboard navigation must not scroll horizontally").toBeLessThanOrEqual(dashboardNavBounds.clientWidth + 1);
  await expectNoPageOverflow(page, "owner dashboard header navigation");

  await page.goto("/pages/manage-appointments.html", { waitUntil: "domcontentloaded" });
  const calendar = page.locator("#calendar");
  await expect(calendar.locator(".fc-header-toolbar")).toBeVisible();
  for (const selector of [".fc-prev-button", ".fc-next-button", ".fc-today-button"]) {
    await expectControlFits(page, calendar.locator(selector));
  }

  const toolbar = await calendar.locator(".fc-header-toolbar").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    gridTemplateAreas: getComputedStyle(element).gridTemplateAreas,
  }));
  expect(toolbar.scrollWidth, "calendar controls must not scroll horizontally").toBeLessThanOrEqual(toolbar.clientWidth + 1);
  expect(toolbar.gridTemplateAreas).toContain("title title");

  await calendar.locator(".fc-prev-button").click();
  await calendar.locator(".fc-next-button").click();
  await calendar.locator(".fc-today-button").click();
  await expectNoPageOverflow(page, "owner appointments calendar controls");
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
