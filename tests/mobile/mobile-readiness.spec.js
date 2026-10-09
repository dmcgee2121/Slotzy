const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_mobile_pilot";
const OWNER_USERNAME = "owner_mobile_pilot";
const BARBER_USERNAME = "barber_mobile_pilot";
const SERVICE_ID = "service_mobile_pilot";
const SHOP_SLUG = "mobile-pilot-shop";
const CUSTOMER_CONTACT = "555-010-6677";
const VALID_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BUFFER.toString("base64")}`;

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

async function expectRenderedDataImage(locator, mimePrefix) {
  await expect(locator).toBeVisible();
  await expect.poll(async () => locator.evaluate((image, prefix) => {
    const bounds = image.getBoundingClientRect();
    const source = String(image.getAttribute("src") ?? "");
    return {
      hasExpectedPrefix: source.startsWith(prefix),
      approximateBytes: source.length,
      loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      hasPaintedArea: bounds.width > 0 && bounds.height > 0,
    };
  }, mimePrefix)).toEqual({
    hasExpectedPrefix: true,
    approximateBytes: expect.any(Number),
    loaded: true,
    hasPaintedArea: true,
  });
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
    body: `window.FullCalendar={Calendar:class{constructor(el,options){this.el=el;this.options=options;this.date=new Date(options.initialDate||Date.now())}getDate(){return this.date}destroy(){this.el.innerHTML=''}render(){const update=()=>{const title=this.date.toLocaleString(undefined,{month:'long',year:'numeric'});const cells=Array.from({length:7},(_,i)=>'<td class="fc-daygrid-day" data-ymd="2026-10-0'+(i+1)+'"><div class="fc-daygrid-day-frame"><div class="fc-daygrid-day-top">'+(i+1)+'</div></div></td>').join('');this.el.innerHTML='<div class="fc"><div class="fc-header-toolbar"><div class="fc-toolbar-chunk"><button type="button" class="fc-prev-button">Previous</button><button type="button" class="fc-next-button">Next</button></div><div class="fc-toolbar-chunk"><h2 class="fc-toolbar-title">'+title+'</h2></div><div class="fc-toolbar-chunk"><button type="button" class="fc-today-button">Today</button></div></div><table class="fc-scrollgrid"><tbody><tr>'+cells+'</tr></tbody></table></div>';this.el.querySelector('.fc-prev-button').onclick=()=>{this.date.setMonth(this.date.getMonth()-1);update()};this.el.querySelector('.fc-next-button').onclick=()=>{this.date.setMonth(this.date.getMonth()+1);update()};this.el.querySelector('.fc-today-button').onclick=()=>{this.date=new Date();update()};this.options.datesSet&&this.options.datesSet({view:{currentStart:new Date(this.date.getFullYear(),this.date.getMonth(),1)}})};update()}}};`,
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

test("public shop chooser keeps booking details hidden until its context loads", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed);
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));

  let releaseContext;
  const contextGate = new Promise((resolve) => { releaseContext = resolve; });
  await page.route("**/api/public/booking-context**", async (route) => {
    await contextGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shops: seed.local.Slotzy_shops,
        providers: seed.local.Slotzy_users,
        services: seed.local.Slotzy_services,
        bookings: [],
        availabilityByBarber: seed.local.Slotzy_availability,
      }),
    });
  });

  await page.goto("/pages/book.html");
  await expect(page.locator("#publicBookingLoadState")).toBeVisible();
  await expect(page.locator("#publicShopHero")).toBeHidden();
  await expect(page.locator("#bookingPanel")).toBeHidden();

  releaseContext();
  await expect(page.locator("#publicShopPickerSection")).toBeVisible();
  await expect(page.locator("#bookingPanel")).toBeHidden();
  await expect(page.locator("#publicManageRecoveryCard")).toBeVisible();
  await expect(page.getByRole("button", { name: "Recover manage link" })).toBeVisible();
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

test.describe("local-calendar public booking slots", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("public booking generates future-date slots from a local calendar date", async ({ page }) => {
    const seed = buildSeed({ configuredOwner: true });
    Object.entries(seed.local.Slotzy_availability[OWNER_USERNAME].weekly).forEach(([dayKey, day]) => {
      day.enabled = false;
    });
    await seedStorage(page, seed);
    await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
    const futureDate = await page.evaluate(() => {
      const date = new Date();
      date.setDate(date.getDate() + 2);
      const ymd = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      return { ymd, day: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] };
    });
    await page.evaluate(({ day }) => {
      const availability = JSON.parse(localStorage.getItem("Slotzy_availability") || "{}");
      Object.entries(availability["owner_mobile_pilot"].weekly).forEach(([dayKey, value]) => {
        value.enabled = dayKey === day;
      });
      localStorage.setItem("Slotzy_availability", JSON.stringify(availability));
    }, futureDate);
    await page.reload();
    await page.locator("#serviceSelect").selectOption(SERVICE_ID);
    await page.locator("#bookingDate").fill(futureDate.ymd);

    await expect(page.locator("#time-slot-select option[value]:not([value=''])").first()).toBeAttached();
  });
});

test("public booking receipt and manage cancellation work on mobile", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expect(page.locator("#publicShopName")).toHaveText("E2E Mobile Pilot Shop");
  await expect(page.getByRole("heading", { name: "Choose what works for you" })).toBeVisible();
  await expect(page.locator(".booking-flow-guidance")).toContainText("Available times appear after you choose a barber, service, and date.");
  await expect(page.locator(".booking-submit-help")).toContainText("Confirmation appears next.");
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
  await expect(page.locator("#publicManageRecoveryCard")).toBeHidden();
  await expectNoPageOverflow(page, "booking receipt");
  await expectControlFits(page, "#btn-receipt-open-manage-link");
  await expectControlFits(page, "#btn-receipt-copy-manage-link");
  await expectControlFits(page, "#btn-receipt-share-manage-link");
  await expectControlFits(page, "#bookingReceiptManageLink");
  await expect(page.locator(".booking-receipt-manage-link-panel")).toContainText("Save this private link. You will need it to cancel your appointment.");

  const manageLink = await page.locator("#bookingReceiptManageLink").getAttribute("href");
  expect(manageLink).toBeTruthy();
  await page.goto(manageLink);
  const managedCard = page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" });
  await expect(managedCard).toBeVisible();
  await expect(page.locator(".manage-access-card")).toContainText("Keep it private");
  await expectNoPageOverflow(page, "manage booking page");
  await expectControlFits(page, "button[data-action='cancel-appointment']");
  await managedCard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectControlFits(page, "button[data-action='confirm-cancel-appointment']");
  await managedCard.getByRole("button", { name: "Confirm Cancel", exact: true }).click();
  await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Cancelled");
  await expect(page.locator("#manageStatus")).toContainText("Appointment cancelled. Your appointment list has been updated.");
  await expect(page.locator("#manageStatus")).toHaveAttribute("role", "status");
  await expect(managedCard.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" }).locator(".appointment-actions .badge")).toHaveText("Cancelled");
});

test("hosted manage-link recovery stays generic and never renders a token", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));
  let recoveryRequest = null;
  await page.route("**/api/public/manage/recover", async (route) => {
    recoveryRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, message: "If we find a matching booking, we'll send the manage link to the contact used for the booking." }) });
  });
  await page.goto("/pages/manage.html");
  await page.locator("#manageRecoveryContact").fill("client@example.test");
  await page.locator("#manageRecoveryShop").fill("E2E Mobile Pilot Shop");
  await page.locator("#manageRecoveryDate").fill("2026-12-01");
  await page.locator("#manageRecoveryForm button").click();
  await expect(page.locator("#manageRecoveryStatus")).toContainText("If we find a matching booking");
  expect(recoveryRequest).toEqual({ contact: "client@example.test", shopId: "E2E Mobile Pilot Shop", appointmentDate: "2026-12-01" });
  await expect(page.locator("body")).not.toContainText("token=");
});

test("public booking recovery remains available after chooser and direct-shop context loads", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed);
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));
  const shop = seed.local.Slotzy_shops[0];
  await page.route("**/api/public/booking-context**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ shops: [shop], providers: [], services: [], bookings: [], availabilityByBarber: {} }),
  }));
  let recoveryRequest = null;
  await page.route("**/api/public/manage/recover", async (route) => {
    recoveryRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "If we find a matching booking, we'll send the manage link to the contact used for the booking." }),
    });
  });

  await page.goto("/pages/book.html");
  await expect(page.locator("#publicShopPickerSection")).toBeVisible();
  await expect(page.locator("#publicManageRecoveryCard")).toBeVisible();
  await page.getByRole("button", { name: "Recover manage link" }).click();
  await expect(page.locator("#publicManageRecoveryForm")).toBeVisible();
  await page.locator("#publicManageRecoveryContact").fill("client@example.test");
  await page.locator("#publicManageRecoveryShop").fill(shop.name);
  await page.locator("#publicManageRecoveryDate").fill("2026-12-01");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.locator("#publicManageRecoveryStatus")).toHaveText("If we find a matching booking, we'll send the manage link to the contact used for the booking.");
  expect(recoveryRequest).toEqual({ contact: "client@example.test", shopId: shop.name, appointmentDate: "2026-12-01" });
  await expect(page.locator("body")).not.toContainText("token=");

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expect(page.locator("#publicShopHero")).toBeVisible();
  await expect(page.locator("#publicManageRecoveryCard")).toBeVisible();
  await page.getByRole("button", { name: "Recover manage link" }).click();
  await expect(page.locator("#publicManageRecoveryForm")).toBeVisible();
  await expect(page.locator("#publicManageRecoveryShop")).toHaveValue(shop.name);
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

  let bookingPostAttempts = 0;
  let bookingPostHadAuthorization = false;
  const manageToken = "x".repeat(48);
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
    bookingPostAttempts += 1;
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
      body: JSON.stringify({ booking: authoritativeBooking, manageToken }),
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
  await expectNoPageOverflow(page, "public shop chooser");
  await expectControlFits(page, page.locator(".public-shop-directory-card-action").first().locator("xpath=.."));

  await page.goto(bookingLink);
  await expect(page.locator("#publicShopName")).toHaveText("E2E Mobile Pilot Shop");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("slotzy-shell-v5"))).toBe(true);

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
  await page.locator("#bookBtn").evaluate((button) => {
    button.click();
    button.click();
  });
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(201);
  expect(bookingPostAttempts).toBe(1);
  expect(bookingPostHadAuthorization).toBe(false);
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  const receiptManageLink = page.locator("#bookingReceiptManageLink");
  await expect(receiptManageLink).toHaveAttribute("href", /\/pages\/manage\.html#token=/);
  const receiptManageShape = await receiptManageLink.evaluate((link) => {
    const url = new URL(link.href);
    return {
      queryKeys: Array.from(url.searchParams.keys()),
      hasTokenFragment: new URLSearchParams(url.hash.slice(1)).has("token"),
    };
  });
  expect(receiptManageShape.queryKeys).not.toContain("contact");
  expect(receiptManageShape.queryKeys).not.toContain("shop");
  expect(receiptManageShape.hasTokenFragment).toBe(true);
  await expectControlFits(page, "#bookingReceiptManageLink");
  await expectNoPageOverflow(page, "authoritative anonymous booking receipt");
  const receiptPanel = page.locator(".booking-receipt-manage-link-panel");
  const receiptPanelBounds = await receiptPanel.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(receiptPanelBounds.scrollWidth, "manage link card must not scroll horizontally").toBeLessThanOrEqual(receiptPanelBounds.clientWidth + 1);

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
    frontendCacheVersion: "slotzy-shell-v5",
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

test("token manage page renders customer details and persists cancellation", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));

  const token = "x".repeat(48);
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 3);
  startsAt.setHours(10, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  const booking = {
    id: "22222222-2222-4222-8222-222222222222",
    shopId: SHOP_ID,
    ownerUsername: OWNER_USERNAME,
    barberUsername: OWNER_USERNAME,
    barberDisplayName: "E2E Mobile Owner",
    clientName: "E2E Token Client",
    serviceName: "E2E Mobile Cut",
    durationMinutes: 30,
    price: 35,
    startISO: startsAt.toISOString(),
    endISO: endsAt.toISOString(),
    status: "booked",
  };
  const shop = buildSeed({ configuredOwner: true }).local.Slotzy_shops[0];
  let currentStatus = "booked";
  let tokenHeaderPresent = false;
  let cancelRequestCount = 0;

  await page.route("**/api/public/manage**", async (route) => {
    const request = route.request();
    tokenHeaderPresent = tokenHeaderPresent || Boolean(request.headers()["x-slotzy-manage-token"]);
    if (request.method() === "PATCH") {
      cancelRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      currentStatus = "cancelled";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ booking: { ...booking, status: currentStatus } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ booking: { ...booking, status: currentStatus }, shop }),
    });
  });

  await page.goto(`/pages/manage.html#token=${token}`);
  const managedCard = page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" });
  await expect(managedCard).toContainText("Booked for E2E Token Client");
  await expect(managedCard.locator(".appointment-datetime span").first()).toBeVisible();
  await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Booked");
  await expect(managedCard.getByRole("button", { name: "Reschedule", exact: true })).toHaveCount(0);
  await expect(managedCard).toContainText("Rescheduling is not available yet. Please cancel and rebook.");
  await expectControlFits(page, managedCard.getByRole("button", { name: "Cancel", exact: true }));
  await expectNoPageOverflow(page, "token manage booking page");

  await managedCard.getByRole("button", { name: "Cancel", exact: true }).click();
  await managedCard.getByRole("button", { name: "Confirm Cancel", exact: true }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Cancelled");
  expect(tokenHeaderPresent).toBe(true);
  expect(cancelRequestCount).toBe(1);
  await expect(managedCard.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" }).locator(".appointment-actions .badge")).toHaveText("Cancelled");
});

test("token manage cancellation failure does not show local-only success", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));

  const token = "y".repeat(48);
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 3);
  startsAt.setHours(10, 0, 0, 0);
  const booking = {
    id: "33333333-3333-4333-8333-333333333333",
    shopId: SHOP_ID,
    ownerUsername: OWNER_USERNAME,
    barberUsername: OWNER_USERNAME,
    barberDisplayName: "E2E Mobile Owner",
    clientName: "E2E Token Client",
    serviceName: "E2E Mobile Cut",
    durationMinutes: 30,
    price: 35,
    startISO: startsAt.toISOString(),
    endISO: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
    status: "booked",
  };
  const shop = buildSeed({ configuredOwner: true }).local.Slotzy_shops[0];
  await page.route("**/api/public/manage**", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ booking, shop }),
    });
  });

  await page.goto(`/pages/manage.html#token=${token}`);
  const managedCard = page.locator(".client-manage-card").filter({ hasText: "E2E Mobile Cut" });
  await managedCard.getByRole("button", { name: "Cancel", exact: true }).click();
  await managedCard.getByRole("button", { name: "Confirm Cancel", exact: true }).click();

  await expect(page.locator("#manageStatus")).toContainText("Could not cancel this appointment");
  await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Booked");
  await expect(managedCard.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
});

test("owner logout clears session credentials and returns to an unauthenticated state", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/settings.html");
  await page.evaluate(() => {
    localStorage.setItem("Slotzy_auth_token", "synthetic-token-never-logged");
    localStorage.setItem("Slotzy_token", "synthetic-legacy-token-never-logged");
    sessionStorage.setItem("Slotzy_auth_token", "synthetic-session-token-never-logged");
  });
  await page.locator("#logoutBtn").click();
  await expect(page).toHaveURL(/\/index\.html$/);
  const state = await page.evaluate(() => ({
    user: sessionStorage.getItem("Slotzy_user"),
    sessionToken: sessionStorage.getItem("Slotzy_auth_token"),
    legacySessionToken: sessionStorage.getItem("Slotzy_token"),
    localToken: localStorage.getItem("Slotzy_auth_token"),
    legacyLocalToken: localStorage.getItem("Slotzy_token"),
  }));
  expect(state).toEqual({ user: null, sessionToken: null, legacySessionToken: null, localToken: null, legacyLocalToken: null });
  await page.goto("/pages/settings.html");
  await expect(page.getByRole("heading", { name: "Please sign in to access settings." })).toBeVisible();
});

test("invalid manage link state fits mobile", async ({ page }) => {
  await seedStorage(page, buildSeed());
  await page.goto("/pages/manage.html#token=invalid");
  await expect(page.locator("#manageStatus")).toContainText("invalid or has expired");
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

test("manage appointments mobile filters, empty state, and cards stay contained without relying on Calendar", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const endsAt = new Date(tomorrow);
  endsAt.setMinutes(endsAt.getMinutes() + 30);
  seed.local.Slotzy_bookings = [{
    id: "booking_mobile_appointments_layout",
    shopId: SHOP_ID,
    ownerUsername: OWNER_USERNAME,
    barberUsername: OWNER_USERNAME,
    barberDisplayName: "E2E Mobile Owner",
    serviceId: SERVICE_ID,
    serviceName: "E2E Mobile Cut",
    clientName: "E2E Appointment Client",
    clientContact: CUSTOMER_CONTACT,
    startISO: tomorrow.toISOString(),
    endISO: endsAt.toISOString(),
    durationMinutes: 30,
    price: 35,
    status: "booked",
    createdAtISO: new Date().toISOString(),
  }];
  await seedStorage(page, seed, { includeSession: true });
  await installCalendarToolbarStub(page);
  await page.goto("/pages/manage-appointments.html", { waitUntil: "domcontentloaded" });

  const filterChips = page.locator(".appointments-filter-panel .segment-btn");
  await expect(filterChips).toHaveCount(5);
  for (const chip of await filterChips.all()) {
    await expectControlFits(page, chip);
  }
  const chipContainer = page.locator(".appointments-filter-panel .appointment-view-segments");
  const chipLayout = await chipContainer.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(chipLayout.scrollWidth, "appointment filter chips must not create a horizontal scroll strip").toBeLessThanOrEqual(chipLayout.clientWidth + 1);
  expect(chipLayout.overflowX).not.toBe("auto");
  await expectControlFits(page, "#appointment-search");
  await expectControlFits(page, "#appointment-owner-filter");
  await expectNoPageOverflow(page, "manage appointments filters and empty state");

  await expect(page.getByRole("heading", { name: "You do not have appointments for this view yet" })).toBeVisible();
  await expectControlFits(page, "#appointment-list .empty-state-cta[data-action='open-walkin']");
  await expectControlFits(page, "#appointment-list .empty-state-cta[href='book.html']");

  await page.getByRole("button", { name: "All", exact: true }).click();
  const appointmentCard = page.locator(".appointment-row").filter({ hasText: "E2E Appointment Client" });
  await expect(appointmentCard).toBeVisible();
  const cardLayout = await appointmentCard.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  });
  expect(cardLayout.left, "appointment card starts within the viewport").toBeGreaterThanOrEqual(0);
  expect(cardLayout.right, "appointment card fits within the viewport").toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(cardLayout.scrollWidth, "appointment card must not scroll horizontally").toBeLessThanOrEqual(cardLayout.clientWidth + 1);
  await expectControlFits(page, appointmentCard.getByRole("button", { name: "Confirm", exact: true }));
  await expectNoPageOverflow(page, "manage appointments card list");
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

test("hosted owner setup leaves Step 1 from the authoritative shop create result", async ({ page }) => {
  const seed = buildSeed();
  const owner = { ...seed.local.Slotzy_users[0], shopId: null, role: "owner" };
  const createdShop = {
    id: "authoritative-new-shop-id",
    name: "Authoritative New Shop",
    businessName: "Authoritative New Shop",
    slug: "authoritative-new-shop",
    ownerUsername: owner.username,
  };
  let shopCreated = false;
  let shopPostCount = 0;
  let availabilityGetCount = 0;

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
    sessionStorage.setItem("Slotzy_setupStep", "1");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { ...owner, shopId: shopCreated ? createdShop.id : null } }) });
      return;
    }
    if (path.endsWith("/shops") && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shops: shopCreated ? [createdShop] : [] }) });
      return;
    }
    if (path.endsWith("/shops") && request.method() === "POST") {
      shopPostCount += 1;
      shopCreated = true;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ shop: createdShop }) });
      return;
    }
    if (path.endsWith("/services") || path.endsWith("/availability")) {
      if (path.endsWith("/availability")) availabilityGetCount += 1;
      const body = path.endsWith("/services") ? { services: [] } : { availability: {} };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/owner-setup.html");
  await expect(page.getByRole("heading", { name: "Name your shop" })).toBeVisible();
  await expect.poll(() => availabilityGetCount).toBeGreaterThan(0);
  await page.locator("#setupShopName").fill(createdShop.name);
  await page.locator("#setupStep1Next").click();

  await expect(page.getByRole("heading", { name: "Choose your booking team" })).toBeVisible();
  await expect(page.locator("#setupStep1Next")).not.toHaveAttribute("aria-busy", "true");
  expect(shopPostCount).toBe(1);
});

test("hosted owner setup initializes protected reads sequentially", async ({ page }) => {
  const seed = buildSeed();
  const owner = { ...seed.local.Slotzy_users[0], shopId: null, role: "owner" };
  let activeProtectedReads = 0;
  let maximumProtectedReads = 0;
  let availabilityReadCompleted = false;

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
    sessionStorage.setItem("Slotzy_setupStep", "1");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    activeProtectedReads += 1;
    maximumProtectedReads = Math.max(maximumProtectedReads, activeProtectedReads);
    await new Promise((resolve) => setTimeout(resolve, 25));
    activeProtectedReads -= 1;

    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: owner }) });
      return;
    }
    if (path.endsWith("/shops")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shops: [] }) });
      return;
    }
    if (path.endsWith("/services")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) });
      return;
    }
    if (path.endsWith("/availability")) {
      availabilityReadCompleted = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ availability: {} }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/owner-setup.html");
  await expect(page.getByRole("heading", { name: "Name your shop" })).toBeVisible();
  await expect.poll(() => availabilityReadCompleted).toBe(true);
  await expect(page.locator("#setupStep1Next")).toBeEnabled();
  expect(maximumProtectedReads).toBe(1);
});

test("owner dashboard guard fails closed to setup when authoritative setup state is unavailable", async ({ page }) => {
  const seed = buildSeed();
  const owner = { ...seed.local.Slotzy_users[0], shopId: null, role: "owner" };
  seed.local.Slotzy_users = [owner];

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: owner }) });
      return;
    }
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid or expired token" }) });
  });

  await page.goto("/pages/business-owner.html");
  await expect(page).toHaveURL(/\/pages\/owner-setup\.html$/);
  await expect(page.getByRole("heading", { name: "Name your shop" })).toBeVisible();
  await expect(page.locator("#setupStatus")).toContainText("Setup is unavailable right now");
});

test("hosted owner setup renders a created service before an empty refresh catches up", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_services = [];
  seed.local.Slotzy_availability = {};
  let serviceGetCount = 0;
  let servicePostCount = 0;
  let releasePostCreateRefresh;
  const postCreateRefreshGate = new Promise((resolve) => {
    releasePostCreateRefresh = resolve;
  });

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
    sessionStorage.setItem("Slotzy_setupStep", "3");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: seed.local.Slotzy_users[0] }) });
      return;
    }
    if (path.endsWith("/shops")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shops: seed.local.Slotzy_shops }) });
      return;
    }
    if (path.endsWith("/services") && request.method() === "GET") {
      serviceGetCount += 1;
      if (serviceGetCount >= 3) await postCreateRefreshGate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) });
      return;
    }
    if (path.endsWith("/services") && request.method() === "POST") {
      servicePostCount += 1;
      const submitted = request.postDataJSON();
      const created = { ...submitted, id: "authoritative-setup-service-id" };
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ service: created }) });
      return;
    }
    if (path.endsWith("/availability")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ availability: {} }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/owner-setup.html");
  await expect(page.getByRole("heading", { name: "Add your services" })).toBeVisible();
  await page.locator("#setupServiceName").fill("Authoritative Setup Service");
  await page.locator("#setupServicePrice").fill("35");
  await page.locator("#setupServiceDuration").fill("30");
  await page.locator("#setupAddServiceBtn").click();

  await expect(page.locator("#setupServiceList")).toContainText("Authoritative Setup Service");
  await expect(page.locator("#setupServiceStatus")).toContainText("Service added.");
  await expect(page.getByRole("heading", { name: "No services yet", exact: true })).toHaveCount(0);
  await expect.poll(() => serviceGetCount).toBeGreaterThanOrEqual(3);

  const emptyRefreshResponse = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).pathname.endsWith("/api/services")
  ));
  releasePostCreateRefresh();
  await emptyRefreshResponse;

  await expect(page.locator("#setupServiceList")).toContainText("Authoritative Setup Service");
  await expect(page.getByRole("heading", { name: "No services yet", exact: true })).toHaveCount(0);
  expect(servicePostCount).toBe(1);
});

test("hosted owner setup service failure clears stale success without creating a local-only row", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_services = [];
  seed.local.Slotzy_availability = {};
  const serverServices = [];
  let servicePostCount = 0;
  let releaseFailedCreate;
  const failedCreateGate = new Promise((resolve) => {
    releaseFailedCreate = resolve;
  });

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
    sessionStorage.setItem("Slotzy_setupStep", "3");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: seed.local.Slotzy_users[0] }) });
      return;
    }
    if (path.endsWith("/shops")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shops: seed.local.Slotzy_shops }) });
      return;
    }
    if (path.endsWith("/services") && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: serverServices }) });
      return;
    }
    if (path.endsWith("/services") && request.method() === "POST") {
      servicePostCount += 1;
      if (servicePostCount === 1) {
        const submitted = request.postDataJSON();
        const created = { ...submitted, id: "first-authoritative-setup-service-id" };
        serverServices.push(created);
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ service: created }) });
        return;
      }
      await failedCreateGate;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
      return;
    }
    if (path.endsWith("/availability")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ availability: {} }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/owner-setup.html");
  await page.locator("#setupServiceName").fill("First Hosted Setup Service");
  await page.locator("#setupServicePrice").fill("35");
  await page.locator("#setupServiceDuration").fill("30");
  await page.locator("#setupAddServiceBtn").click();
  await expect(page.locator("#setupServiceList")).toContainText("First Hosted Setup Service");
  await expect(page.locator("#setupServiceStatus")).toContainText("Service added.");

  await page.locator("#setupServiceName").fill("Must Not Persist In Setup");
  await page.locator("#setupServicePrice").fill("45");
  await page.locator("#setupServiceDuration").fill("45");
  await page.locator("#setupAddServiceBtn").click();
  await expect.poll(() => servicePostCount).toBe(2);
  await expect(page.locator("#setupServiceStatus")).toHaveText("");
  await expect(page.locator("#setupServiceStatus")).not.toHaveClass(/status-success/);

  releaseFailedCreate();
  await expect(page.locator("#setupServiceStatus")).toContainText("Could not save this service");
  await expect(page.locator("#setupServiceStatus")).toHaveClass(/status-error/);
  await expect(page.locator("#setupServiceName")).toHaveValue("Must Not Persist In Setup");
  await expect(page.locator("#setupServiceList")).toContainText("First Hosted Setup Service");
  await expect(page.locator("#setupServiceList")).not.toContainText("Must Not Persist In Setup");
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("Slotzy_services") || "[]")
      .some((service) => service.name === "Must Not Persist In Setup")
  ))).toBe(false);
});

test("hosted owner setup write failure does not create a local-only team member", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_services = [];
  seed.local.Slotzy_availability = {};
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
    sessionStorage.setItem("Slotzy_setupStep", "2");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: seed.local.Slotzy_users[0] }) });
      return;
    }
    if (path.endsWith("/shops")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shops: seed.local.Slotzy_shops }) });
      return;
    }
    if (path.endsWith("/services")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) });
      return;
    }
    if (path.endsWith("/availability")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ availability: {} }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/owner-setup.html");
  await expect(page.getByRole("heading", { name: "Add your services" })).toBeVisible();
  await page.locator("#setupStep3Back").click();
  await expect(page.getByRole("heading", { name: "Choose your booking team" })).toBeVisible();
  await page.locator("#setupOnlyBarberCheckbox").uncheck();
  await page.locator("#setupBarberDisplayName").fill("Must Not Persist");
  await page.locator("#setupBarberUsername").fill("must-not-persist");
  await page.locator("#setupBarberPassword").fill("synthetic-only");
  await page.locator("#setupAddBarberBtn").click();

  await expect(page.locator("#setupBarberStatus")).toContainText("Could not save changes");
  await expect(page.locator("#setupBarberList")).not.toContainText("Must Not Persist");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_users") || "[]").length)).toBe(1);
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
  await expect(page.locator("#userBadge")).toContainText("Welcome");
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

  await expectControlFits(page, "#pilotCopyBookingBtn");
  await expectControlFits(page, "#pilotOpenBookingBtn");
  await expect(page.locator("#owner-availability")).toBeVisible();
  await expectMobileWeeklyHours(page, "logged-in barber dashboard");
  await expectNoPageOverflow(page, "logged-in barber dashboard Availability");
  await expectControlFits(page, "#availability-save-weekly");
});

test("owner weekly hours validation, save state, refresh, and booking times stay mobile-safe", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/business-owner.html");

  await expectMobileWeeklyHours(page, "owner availability save state");
  await expectNoPageOverflow(page, "owner availability weekly hours");
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    await expectControlFits(page, page.locator(`input[data-day='${day}'][data-field='enabled']`).locator("xpath=.."));
    await expectControlFits(page, `input[data-day='${day}'][data-field='start']`);
    await expectControlFits(page, `input[data-day='${day}'][data-field='end']`);
  }

  await page.locator("input[data-day='mon'][data-field='end']").fill("09:00");
  await page.locator("#availability-save-weekly").click();
  await expect(page.locator("#availability-weekly-error")).toContainText("Monday needs an end time later");
  await expectReadableStatus(page, "#availability-weekly-error");
  await expectNoPageOverflow(page, "owner availability validation state");

  await page.locator("input[data-day='mon'][data-field='start']").fill("10:00");
  await page.locator("input[data-day='mon'][data-field='end']").fill("17:00");
  await page.locator("#availability-save-weekly").click();
  await expect(page.locator("#availability-weekly-status")).toContainText("Saved.");
  await page.reload();
  await expect(page.locator("input[data-day='mon'][data-field='start']")).toHaveValue("10:00");
  await expect(page.locator("input[data-day='mon'][data-field='end']")).toHaveValue("17:00");

  const bookingDate = new Date();
  const daysUntilMonday = (8 - bookingDate.getDay()) % 7 || 7;
  bookingDate.setDate(bookingDate.getDate() + daysUntilMonday);
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await page.locator("#serviceSelect").selectOption(SERVICE_ID);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));
  const slots = page.locator("#time-slot-select option[value]:not([value=''])");
  await expect(slots).not.toHaveCount(0);
  await page.locator("#time-slot-select").selectOption(await slots.first().getAttribute("value"));
  await expect(page.locator("#time-slot-select")).not.toHaveValue("");
  await expectNoPageOverflow(page, "public booking with saved weekly hours");
});

test("owner dashboard navigation and calendar toolbar stay polished on mobile", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await installCalendarToolbarStub(page);

  await page.goto("/pages/business-owner.html");
  await expect(page.locator("#pilotBookingLink")).toBeVisible();
  await expect(page.locator(".owner-dashboard-header-nav #userBadge")).toContainText("Welcome");
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

  await expect(page.locator("#ownerUpcomingStatus")).toHaveAttribute("role", "status");
  await expect(page.locator("#quickServiceStatus")).toHaveAttribute("role", "status");

  const dashboardQuickActions = page.locator(".owner-dashboard-jump-nav");
  await expect(dashboardQuickActions).toBeVisible();
  await expect(dashboardQuickActions.getByRole("link")).toHaveCount(5);
  for (const name of ["Today", "Appointments", "Services", "Availability", "Booking Link"]) {
    await expectControlFits(page, dashboardQuickActions.getByRole("link", { name, exact: true }));
  }
  await expect(page.locator(".owner-dashboard-jump-link-wide")).toHaveCount(1);
  await expect(page.locator(".owner-dashboard-section-action")).toHaveText("Open Appointments");
  await expectControlFits(page, ".owner-dashboard-section-action");
  await expectNoPageOverflow(page, "owner dashboard quick-action cards");

  await page.goto("/pages/manage-appointments.html", { waitUntil: "domcontentloaded" });
  const calendar = page.locator("#calendar");
  await expect(calendar.locator(".fc-header-toolbar")).toBeVisible();
  await expect(calendar.locator(".fc-daygrid-day")).toHaveCount(7);
  const calendarGrid = await calendar.locator(".fc-scrollgrid").evaluate((grid) => ({
    height: grid.getBoundingClientRect().height,
    clientWidth: grid.clientWidth,
    scrollWidth: grid.scrollWidth,
  }));
  expect(calendarGrid.height, "mobile calendar must render a readable grid below its controls").toBeGreaterThan(100);
  expect(calendarGrid.scrollWidth, "mobile calendar grid must not overflow horizontally").toBeLessThanOrEqual(calendarGrid.clientWidth + 1);
  for (const selector of [".fc-prev-button", ".fc-next-button", ".fc-today-button"]) {
    await expectControlFits(page, calendar.locator(selector));
  }

  const toolbar = await calendar.locator(".fc-header-toolbar").evaluate((element) => {
    const calendarCard = element.closest(".appointments-calendar-panel");
    const monthLabel = element.querySelector(".fc-toolbar-title");
    const bounds = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      calendarClientWidth: element.parentElement.clientWidth,
      calendarScrollWidth: element.parentElement.scrollWidth,
      cardClientWidth: calendarCard.clientWidth,
      cardScrollWidth: calendarCard.scrollWidth,
      calendar: bounds(element.parentElement),
      monthLabel: bounds(monthLabel),
      gridTemplateAreas: getComputedStyle(element).gridTemplateAreas,
    };
  });
  expect(toolbar.scrollWidth, "calendar controls must not scroll horizontally").toBeLessThanOrEqual(toolbar.clientWidth + 1);
  expect(toolbar.calendarScrollWidth, "calendar control container must not scroll horizontally").toBeLessThanOrEqual(toolbar.calendarClientWidth + 1);
  expect(toolbar.cardScrollWidth, "calendar card must not scroll horizontally").toBeLessThanOrEqual(toolbar.cardClientWidth + 1);
  expect(toolbar.monthLabel.left, "calendar month label needs comfortable left padding").toBeGreaterThanOrEqual(toolbar.calendar.left + 8);
  expect(toolbar.monthLabel.right, "calendar month label must not be clipped").toBeLessThanOrEqual(toolbar.calendar.right - 8);
  expect(toolbar.gridTemplateAreas).toContain("today today");

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

test("business profile settings give clear mobile save, validation, and share-link feedback", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/settings.html");

  await expect(page.locator("#shopSettingsCard")).toBeVisible();
  for (const selector of [
    "#publicBookingLinkInput",
    "#copyPublicBookingLinkBtn",
    "#openPublicBookingLinkBtn",
    "#businessNameInput",
    "#cancelHoursInput",
    "#saveShopBtn",
  ]) {
    await expectControlFits(page, selector);
  }
  await expectNoPageOverflow(page, "business profile settings");

  await page.locator("#businessNameInput").fill("A");
  await page.locator("#saveShopBtn").click();
  const validation = page.locator("#shopStatus");
  await expect(validation).toContainText("Business name must be at least 2 characters");
  await expect(validation).toBeVisible();
  const validationBounds = await validation.boundingBox();
  expect(validationBounds.x + validationBounds.width, "settings validation must stay within the viewport")
    .toBeLessThanOrEqual(page.viewportSize().width + 1);

  await page.locator("#businessNameInput").fill("E2E Mobile Profile Shop");
  await page.locator("#cancelHoursInput").fill("36");
  await page.locator("#saveShopBtn").click();
  await expect(validation).toContainText("Shop settings saved successfully.");

  await page.locator("#copyPublicBookingLinkBtn").click();
  await expect(page.locator("#publicBookingLinkStatus")).toContainText("Link copied");

  const popupPromise = page.waitForEvent("popup");
  await page.locator("#openPublicBookingLinkBtn").click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup).toHaveURL(/\/pages\/book\.html\?shop=e2e-mobile-profile-shop$/);

  await page.goto("/pages/book.html?shop=e2e-mobile-profile-shop");
  await expect(page.locator("#bookingPolicyCancel")).toContainText("36 hours before");
  await expectNoPageOverflow(page, "public booking after business profile save");
});

test("branding accepts hosted-safe images and clearly rejects larger files", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/settings.html");

  await expect(page.locator("#shopLogoInput")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await page.locator("#shopLogoInput").setInputFiles({
    name: "phone-photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(512 * 1024),
  });
  await expect(page.locator("#shopLogoInputStatus")).toContainText("ready to save");

  await page.locator("#shopCoverInput").setInputFiles({
    name: "too-large.webp",
    mimeType: "image/webp",
    buffer: Buffer.alloc((1024 * 1024) + 1),
  });
  await expect(page.locator("#shopCoverInputStatus")).toContainText("1 MB or smaller");
});

test("saved shop branding appears in the public chooser and selected booking page", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/settings.html");
  await page.locator("#businessNameInput").fill("Pilot Neighborhood Barbers");

  await page.locator("#shopLogoInput").setInputFiles({
    name: "shop-logo.png",
    mimeType: "image/png",
    buffer: VALID_PNG_BUFFER,
  });
  await page.locator("#shopCoverInput").setInputFiles({
    name: "shop-cover.png",
    mimeType: "image/png",
    buffer: VALID_PNG_BUFFER,
  });
  await page.locator("#saveShopBtn").click();
  await expect(page.locator("#shopStatus")).toContainText("Shop settings saved successfully.");

  await page.goto("/pages/book.html");
  const shopCard = page.locator(".public-shop-directory-card").filter({ hasText: "Pilot Neighborhood Barbers" });
  await expectRenderedDataImage(shopCard.locator("img"), "data:image/png;base64,");
  await shopCard.click();
  await expectRenderedDataImage(page.locator("#publicShopLogo"), "data:image/png;base64,");
  const publicLogoLayout = await page.locator("#publicShopLogo").evaluate((logo) => {
    const styles = getComputedStyle(logo);
    const bounds = logo.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      objectFit: styles.objectFit,
      objectPosition: styles.objectPosition,
      borderRadius: Number.parseFloat(styles.borderTopLeftRadius),
    };
  });
  expect(publicLogoLayout.width).toBeGreaterThan(40);
  expect(Math.abs(publicLogoLayout.width - publicLogoLayout.height), "public logo frame should be aligned, not stretched").toBeLessThanOrEqual(1);
  expect(publicLogoLayout.objectFit).toBe("contain");
  expect(["center", "50% 50%"].includes(publicLogoLayout.objectPosition)).toBe(true);
  expect(publicLogoLayout.borderRadius).toBeGreaterThan(0);
  await expect(page.locator("#publicShopHero")).toHaveClass(/has-shop-cover/);
  await expectRenderedDataImage(page.locator("#publicShopCover"), "data:image/png;base64,");
  await expectNoPageOverflow(page, "selected booking page with saved branding");
});

test("hosted shop settings sends canonical branding and renders it in public contexts", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const owner = seed.session.Slotzy_user;
  let savedShop = { ...seed.local.Slotzy_shops[0] };
  let savedRequestDiagnostic = null;

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(({ sessionOwner }) => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-hosted-branding-token");
    sessionStorage.setItem("Slotzy_user", JSON.stringify(sessionOwner));
  }, { sessionOwner: owner });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (method === "GET" && path === "/api/auth/me") return json({ user: owner });
    if (method === "GET" && path === "/api/shops") return json({ shops: [savedShop] });
    if (method === "PATCH" && path === `/api/shops/${SHOP_ID}`) {
      const raw = request.postData() || "";
      const payload = JSON.parse(raw);
      savedRequestDiagnostic = {
        approximatePayloadBytes: Buffer.byteLength(raw),
        keys: Object.keys(payload).sort(),
        logoIsDataUrl: String(payload.logo || "").startsWith("data:image/png;base64,"),
        coverIsDataUrl: String(payload.cover || "").startsWith("data:image/png;base64,"),
        hasBrandingAlias: ["logoDataUrl", "coverDataUrl", "logoImageDataUrl", "coverImageDataUrl"]
          .some((key) => Object.prototype.hasOwnProperty.call(payload, key)),
      };
      savedShop = { ...savedShop, ...payload, id: SHOP_ID };
      return json({ shop: savedShop });
    }
    if (method === "GET" && path === "/api/public/booking-context") {
      return json({
        shops: [savedShop],
        providers: seed.local.Slotzy_users,
        services: seed.local.Slotzy_services,
        bookings: [],
        availabilityByBarber: seed.local.Slotzy_availability,
      });
    }
    if (method === "GET" && path === "/api/services") return json({ services: seed.local.Slotzy_services });
    if (method === "GET" && path === "/api/availability") return json({ availability: seed.local.Slotzy_availability });
    if (method === "GET" && path === "/api/bookings") return json({ bookings: [] });
    return json({ error: "unexpected synthetic API request" }, 404);
  });

  await page.goto("/pages/settings.html");
  await page.locator("#businessNameInput").fill("Hosted Branding Test Shop");
  await page.locator("#shopLogoInput").setInputFiles({
    name: "hosted-logo.png",
    mimeType: "image/png",
    buffer: VALID_PNG_BUFFER,
  });
  await page.locator("#shopCoverInput").setInputFiles({
    name: "hosted-cover.png",
    mimeType: "image/png",
    buffer: VALID_PNG_BUFFER,
  });
  await page.locator("#saveShopBtn").click();
  await expect(page.locator("#shopStatus")).toContainText("Shop settings saved successfully.");
  expect(savedRequestDiagnostic).toEqual(expect.objectContaining({
    logoIsDataUrl: true,
    coverIsDataUrl: true,
    hasBrandingAlias: false,
  }));
  expect(savedRequestDiagnostic.approximatePayloadBytes).toBeGreaterThan(100);
  expect(JSON.stringify(savedRequestDiagnostic)).not.toContain("base64,");

  await page.goto("/pages/book.html");
  const shopCard = page.locator(".public-shop-directory-card").filter({ hasText: savedShop.name });
  await expectRenderedDataImage(shopCard.locator("img"), "data:image/png;base64,");
  await page.goto(`/pages/book.html?shop=${encodeURIComponent(savedShop.slug)}`);
  await expectRenderedDataImage(page.locator("#publicShopLogo"), "data:image/png;base64,");
  await expect(page.locator("#publicShopHero")).toHaveClass(/has-shop-cover/);
  await expectRenderedDataImage(page.locator("#publicShopCover"), "data:image/png;base64,");
  await expectNoPageOverflow(page, "direct hosted booking link with canonical cover");
});

test("public booking keeps the Slotzy cover fallback when a shop has no cover", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }));
  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);

  await expect(page.locator("#publicShopHero")).toBeVisible();
  await expect(page.locator("#publicShopHero")).not.toHaveClass(/has-shop-cover/);
  await expect(page.locator("#publicShopCover")).toBeHidden();
  expect(await page.locator("#publicShopCover").getAttribute("src")).toBeNull();
  await expectNoPageOverflow(page, "direct booking link with fallback cover");
});

test("hosted shop settings reports payload limits without logging image data", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const owner = seed.session.Slotzy_user;
  const consoleErrors = [];
  page.on("console", async (message) => {
    if (message.type() !== "error" || !message.text().includes("Failed to save shop settings")) return;
    const values = await Promise.all(message.args().map((arg) => arg.jsonValue().catch(() => null)));
    consoleErrors.push(values);
  });

  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(({ sessionOwner }) => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-hosted-payload-token");
    sessionStorage.setItem("Slotzy_user", JSON.stringify(sessionOwner));
  }, { sessionOwner: owner });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "GET" && path === "/api/auth/me") return json({ user: owner });
    if (request.method() === "GET" && path === "/api/shops") return json({ shops: seed.local.Slotzy_shops });
    if (request.method() === "PATCH" && path === `/api/shops/${SHOP_ID}`) {
      return json({ error: "request payload too large", code: "payload_too_large" }, 413);
    }
    if (request.method() === "GET" && path === "/api/services") return json({ services: seed.local.Slotzy_services });
    if (request.method() === "GET" && path === "/api/availability") return json({ availability: seed.local.Slotzy_availability });
    if (request.method() === "GET" && path === "/api/bookings") return json({ bookings: [] });
    return json({ error: "unexpected synthetic API request" }, 404);
  });

  await page.goto("/pages/settings.html");
  await page.locator("#shopCoverInput").setInputFiles({
    name: "payload-limited-cover.webp",
    mimeType: "image/webp",
    buffer: Buffer.alloc(128 * 1024, 3),
  });
  await page.locator("#saveShopBtn").click();
  await expect(page.locator("#shopStatus")).toContainText("Shop photos are too large to save together.");
  await expect.poll(() => consoleErrors.length).toBe(1);
  const serializedDiagnostics = JSON.stringify(consoleErrors);
  expect(serializedDiagnostics).toContain('"httpStatus":413');
  expect(serializedDiagnostics).toContain('"payloadBytes":');
  expect(serializedDiagnostics).not.toContain("data:image");
  expect(serializedDiagnostics).not.toContain("base64,");
});

test("public booking recognizes API logo and cover branding fields", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed);
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));
  await page.route("**/api/public/booking-context**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shops: [{
          ...seed.local.Slotzy_shops[0],
          name: "API Branded Shop",
          businessName: "API Branded Shop",
          logo: VALID_PNG_DATA_URL,
          cover: VALID_PNG_DATA_URL,
        }],
        providers: seed.local.Slotzy_users,
        services: seed.local.Slotzy_services,
        bookings: [],
        availabilityByBarber: seed.local.Slotzy_availability,
      }),
    });
  });

  await page.goto("/pages/book.html");
  const apiShopCard = page.locator(".public-shop-directory-card").filter({ hasText: "API Branded Shop" });
  await expectRenderedDataImage(apiShopCard.locator("img"), "data:image/png;base64,");

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await expectRenderedDataImage(page.locator("#publicShopLogo"), "data:image/png;base64,");
  await expect(page.locator("#publicShopHero")).toHaveClass(/has-shop-cover/);
  await expectRenderedDataImage(page.locator("#publicShopCover"), "data:image/png;base64,");
  await expectNoPageOverflow(page, "direct API booking link with canonical cover");
});

test("hosted account settings separate identity, public shop fields, profile editing, and recovery help", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.addInitScript(() => localStorage.setItem("Slotzy_api_mode", "1"));

  await page.goto("/pages/settings.html");

  await expect(page.getByRole("heading", { name: "Sign-in details" })).toBeVisible();
  await expect(page.locator("#accountUsernameInput")).toHaveValue(OWNER_USERNAME);
  await expect(page.locator("#accountUsernameInput")).toHaveAttribute("readonly", "");
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await expect(page.locator("#fullNameInput")).toBeDisabled();
  await expect(page.locator("#emailInput")).toBeDisabled();
  await expect(page.locator("#phoneInput")).toBeDisabled();
  await expect(page.locator("#profileStatus")).toHaveText("Hosted profile editing is read-only during beta. Update public business details in Shop settings.");
  await expect(page.getByText("Public business name, phone, email, address, booking rules, and branding are edited in Shop settings above.")).toBeVisible();
  const recoveryButton = page.locator("#ownerRecoveryHelpBtn");
  await expectControlFits(page, recoveryButton);
  await recoveryButton.click();
  const recoveryMessage = page.locator("#ownerRecoveryHelpMessage");
  await expect(recoveryMessage).toContainText("operator-assisted during beta");
  await expect(recoveryMessage).not.toContainText(/token=|jwt|internal id/i);
  await expectNoPageOverflow(page, "hosted owner account settings");
});

test("owner login recovery help is generic and performs no account lookup", async ({ page }) => {
  let recoveryRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/.*(recover|reset|password)/i.test(request.url())) recoveryRequests += 1;
  });
  await page.goto("/pages/index.html");
  await page.locator(".mobile-nav-toggle").click();
  await page.locator("#btn-login").click();
  await page.locator("#owner-recovery-help").click();
  const message = page.locator("#owner-recovery-message");
  await expect(message).toContainText("cannot confirm whether an account exists");
  await expect(message).not.toContainText(/token=|jwt|internal id/i);
  expect(recoveryRequests).toBe(0);
  await expectControlFits(page, "#owner-recovery-help");
});

test("team provider page is honest for the pilot and preserves public provider booking", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/manage-barbers.html");

  await expect(page.getByRole("heading", { name: "Provider management is coming later" })).toBeVisible();
  await expect(page.getByText("Customers can continue booking with the provider created during setup.")).toBeVisible();
  await expect(page.getByText("Only the shop owner can add team members during the pilot.")).toBeVisible();
  await expect(page.locator("#barberName, #addBarberBtn, #barberList, button[data-action]")).toHaveCount(0);
  await expectControlFits(page, page.getByRole("link", { name: "Review Hours" }));
  await expectControlFits(page, page.getByRole("link", { name: "Open Booking Link" }));
  await expectNoPageOverflow(page, "team provider pilot page");

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  const barberSelect = page.locator("#barberSelect");
  await expect(barberSelect).toHaveValue(OWNER_USERNAME);
  await expect(page.locator("#serviceSelect")).toBeEnabled();
  await expectNoPageOverflow(page, "public booking after team provider page");
});

test("owner services add, validation, edit, and public booking selection stay mobile-safe", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_services.push({
    ...seed.local.Slotzy_services[0],
    id: "service_mobile_pilot_second",
    name: "E2E Mobile Trim",
    title: "E2E Mobile Trim",
    price: 20,
    duration: 20,
    durationMinutes: 20,
  });
  await seedStorage(page, seed, { includeSession: true });
  await page.goto("/pages/manage-services.html");

  await expect(page.getByRole("heading", { name: "E2E Mobile Cut", exact: true })).toBeVisible();
  await expectControlFits(page, "#serviceName");
  await expectControlFits(page, "#servicePrice");
  await expectControlFits(page, "#serviceDuration");
  await expectControlFits(page, "#addServiceBtn");
  await expectNoPageOverflow(page, "owner services page");

  await page.locator("#addServiceBtn").click();
  await expectReadableStatus(page, "#add-service-errors");
  await expectNoPageOverflow(page, "owner service validation state");

  const serviceName = "Mobile Signature Service";
  await page.locator("#serviceName").fill(serviceName);
  await page.locator("#servicePrice").fill("42.50");
  await page.locator("#serviceDuration").fill("45");
  await page.locator("#addServiceBtn").click();

  await expect(page.getByRole("heading", { name: serviceName, exact: true })).toBeVisible();
  await expect(page.locator("#serviceFormStatus")).toContainText("Saved.");
  await expect(page.locator("#serviceName")).toHaveValue("");
  await expect(page.locator("#servicePrice")).toHaveValue("");
  await expect(page.locator("#serviceDuration")).toHaveValue("");
  await expectNoPageOverflow(page, "saved owner service list");
  const savedCard = page.locator(".owner-service-card").filter({ hasText: serviceName });
  await expectControlFits(page, savedCard.locator("button[data-action='edit']"));
  await expectControlFits(page, savedCard.locator("button[data-action='delete']"));

  await savedCard.locator("button[data-action='edit']").click();
  await expect(page.getByRole("heading", { name: "Edit Service", exact: true })).toBeVisible();
  for (const selector of ["input[data-field='name']", "input[data-field='price']", "input[data-field='durationMinutes']", "button[data-action='save-edit']", "button[data-action='cancel-edit']"]) {
    await expectControlFits(page, selector);
  }
  await expectNoPageOverflow(page, "owner service edit form");

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  const matchingOption = page.locator("#serviceSelect option").filter({ hasText: serviceName });
  await expect(matchingOption).toHaveCount(1);
  await page.locator("#serviceSelect").selectOption(await matchingOption.getAttribute("value"));
  await expect(page.locator("#serviceSelect")).not.toHaveValue("");
  await expectNoPageOverflow(page, "public booking with saved owner service");
});

test("hosted service write failure does not create local-only success", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/services**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: seed.local.Slotzy_services }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/manage-services.html");
  const initialCount = await page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_services") || "[]").length);
  await page.locator("#serviceName").fill("Must Not Persist");
  await page.locator("#servicePrice").fill("30");
  await page.locator("#serviceDuration").fill("30");
  await page.locator("#addServiceBtn").click();

  await expect(page.locator("#serviceFormStatus")).toContainText("save this service");
  await expect(page.locator("#addServiceBtn")).toBeEnabled();
  await expect(page.locator("#serviceName")).toHaveValue("Must Not Persist");
  await expect(page.getByRole("heading", { name: "Must Not Persist", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_services") || "[]").length)).toBe(initialCount);
});

test("hosted dashboard quick add requires an authoritative service create", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const initialServices = seed.local.Slotzy_services.length;
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/services", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/business-owner.html");
  await page.locator("#quickAddServiceBtn").click();
  await page.locator("#serviceNameQuick").fill("Must Not Persist Quick");
  await page.locator("#servicePriceQuick").fill("30");
  await page.locator("#serviceDurationQuick").fill("30");
  await page.locator("#createQuickServiceBtn").click();

  await expect(page.locator("#quickServiceStatus")).toContainText("Could not save this service");
  await expect(page.locator("#quickServiceModal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_services") || "[]").length)).toBe(initialServices);
});

test("hosted dashboard quick add shows success only after the authoritative response", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  let postCount = 0;
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/services", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: seed.local.Slotzy_services }) });
      return;
    }
    postCount += 1;
    const submitted = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ service: { ...submitted, id: "authoritative-quick-service" } }),
    });
  });

  await page.goto("/pages/business-owner.html");
  await page.locator("#quickAddServiceBtn").click();
  await page.locator("#serviceNameQuick").fill("Authoritative Quick Service");
  await page.locator("#servicePriceQuick").fill("30");
  await page.locator("#serviceDurationQuick").fill("30");
  await page.locator("#createQuickServiceBtn").click();

  await expect(page.locator("#createQuickServiceBtn")).toHaveText("Saving…");
  await expect(page.locator("#quickServiceStatus")).toContainText("Service created successfully");
  expect(postCount).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_services") || "[]").some((service) => service?.id === "authoritative-quick-service"))).toBe(true);
});

test("hosted dashboard cancellation does not mutate local bookings after an API failure", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const start = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
  const end = new Date(start.getTime() + (30 * 60 * 1000));
  seed.local.Slotzy_bookings = [{
    id: "hosted-dashboard-cancel",
    shopId: SHOP_ID,
    ownerUsername: OWNER_USERNAME,
    barberUsername: OWNER_USERNAME,
    serviceName: "E2E Mobile Cut",
    clientName: "Synthetic Client",
    clientContact: "555-010-0000",
    status: "booked",
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  }];
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/bookings/hosted-dashboard-cancel", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/business-owner.html");
  await page.locator('[data-action="cancel-owner-booking"]').click();

  await expect(page.locator("#ownerUpcomingStatus")).toContainText("Could not cancel this appointment");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("Slotzy_bookings") || "[]")[0]?.status)).toBe("booked");
  await expect(page.locator('[data-action="cancel-owner-booking"]')).toBeVisible();
});

test("hosted service create acknowledges one authoritative result without refresh", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const serverServices = [...seed.local.Slotzy_services];
  let createCount = 0;
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/services**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: serverServices }) });
      return;
    }
    if (route.request().method() === "POST") {
      createCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const submitted = route.request().postDataJSON();
      const created = { ...submitted, id: "authoritative-service-id" };
      serverServices.push(created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ service: created }) });
      return;
    }
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "unexpected" }) });
  });

  await page.goto("/pages/manage-services.html");
  await page.locator("#serviceName").fill("Authoritative Mobile Service");
  await page.locator("#servicePrice").fill("35");
  await page.locator("#serviceDuration").fill("30");
  await page.locator("#addServiceBtn").evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.locator("#addServiceBtn")).toHaveText("Adding service…");
  await expect(page.getByRole("heading", { name: "Authoritative Mobile Service", exact: true })).toBeVisible();
  expect(createCount).toBe(1);
  await expect(page.locator("#serviceFormStatus")).toContainText("Saved.");
  await expect(page.locator("#serviceName")).toHaveValue("");
});

test("services list shows loading and retryable fetch failure instead of a misleading empty state", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  let requestCount = 0;
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/services**", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: seed.local.Slotzy_services }) });
  });

  await page.goto("/pages/manage-services.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Loading services…", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No services yet", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Could not load services", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry loading services", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Mobile Cut", exact: true })).toBeVisible();
  expect(requestCount).toBe(2);
});

test("owner account badge sits below mobile navigation as account context", async ({ page }) => {
  await seedStorage(page, buildSeed({ configuredOwner: true }), { includeSession: true });
  await page.goto("/pages/manage-services.html");
  const headerState = await page.locator(".owner-header-actions").evaluate((nav) => {
    const badge = nav.querySelector("#userBadge");
    const link = nav.querySelector(".link");
    const badgeStyles = getComputedStyle(badge);
    return {
      badgeTop: badge.getBoundingClientRect().top,
      linkTop: link.getBoundingClientRect().top,
      order: badgeStyles.order,
      background: badgeStyles.backgroundColor,
      borderTopWidth: badgeStyles.borderTopWidth,
    };
  });
  if ((await page.evaluate(() => window.innerWidth)) <= 680) {
    expect(headerState.order).toBe("10");
  }
  expect(headerState.badgeTop).toBeGreaterThanOrEqual(headerState.linkTop);
  expect(headerState.borderTopWidth).toBe("0px");
  await expectNoPageOverflow(page, "owner services header account context");
});

test("hosted availability write failure does not create local-only success", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/availability**", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });

  await page.goto("/pages/business-owner.html");
  await page.locator("input[data-day='mon'][data-field='start']").fill("10:00");
  await page.locator("#availability-save-weekly").click();

  await expect(page.locator("#availability-weekly-status")).toContainText("save your weekly hours");
  await expect.poll(() => page.evaluate((username) => {
    const availability = JSON.parse(localStorage.getItem("Slotzy_availability") || "{}");
    return availability[username]?.weekly?.mon?.start;
  }, OWNER_USERNAME)).toBe("09:00");
});

test("owner can delete a lunch, break, or time-off block and the deletion persists", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const block = {
    id: "timeoff-lunch-delete",
    startISO: "2026-10-06T17:00:00.000Z",
    endISO: "2026-10-06T18:00:00.000Z",
    note: "Lunch",
  };
  seed.local.Slotzy_availability[OWNER_USERNAME].timeOff = [block];
  await seedStorage(page, seed, { includeSession: true });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/pages/business-owner.html");
  await page.locator('[data-action="delete-timeoff"]').click();
  await expect(page.getByText("No time off blocks")).toBeVisible();
  await expect.poll(() => page.evaluate((username) => {
    const availability = JSON.parse(localStorage.getItem("Slotzy_availability") || "{}");
    return availability[username]?.timeOff?.length;
  }, OWNER_USERNAME)).toBe(0);

  await page.reload();
  await expect(page.getByText("No time off blocks")).toBeVisible();
});

test("owner recurring lunch persists, blocks public slots, and can be deleted", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const weekday = dayKeys[bookingDate.getDay()];
  seed.local.Slotzy_availability[OWNER_USERNAME].timeOff = [{
    id: "one-time-afternoon",
    startISO: new Date(`${toYmd(bookingDate)}T14:00:00`).toISOString(),
    endISO: new Date(`${toYmd(bookingDate)}T14:30:00`).toISOString(),
    note: "One-time appointment",
  }];
  await seedStorage(page, seed, { includeSession: true });
  await page.goto("/pages/business-owner.html");
  await page.locator(`input[name="availability-recurring-day"][value="${weekday}"]`).check();
  await page.locator("#availability-recurring-start").fill("12:00");
  await page.locator("#availability-recurring-end").fill("13:00");
  await page.locator("#availability-recurring-label").fill("Lunch");
  await page.locator("#availability-add-recurring").click();
  await expect(page.locator("#availability-recurring-list")).toContainText("Lunch");
  await expectControlFits(page, "button[data-action='delete-recurring']");
  const recurring = await page.evaluate((username) => JSON.parse(localStorage.getItem("Slotzy_availability") || "{}")[username]?.recurringBlocks || [], OWNER_USERNAME);
  expect(recurring).toEqual([expect.objectContaining({ weekday, start: "12:00", end: "13:00", label: "Lunch", enabled: true })]);

  await page.goto(`/pages/book.html?shop=${SHOP_SLUG}`);
  await page.locator("#serviceSelect").selectOption(SERVICE_ID);
  await page.locator("#bookingDate").fill(toYmd(bookingDate));
  const options = await page.locator("#time-slot-select option").allTextContents();
  expect(options.some((text) => text.startsWith("11:30"))).toBeTruthy();
  expect(options.some((text) => text.startsWith("12:00"))).toBeFalsy();
  expect(options.some((text) => text.startsWith("1:00"))).toBeTruthy();
  expect(options.some((text) => text.startsWith("2:00"))).toBeFalsy();

  await page.addInitScript((username) => sessionStorage.setItem("Slotzy_user", JSON.stringify({ username, role: "owner" })), OWNER_USERNAME);
  await page.goto("/pages/business-owner.html");
  await page.locator("button[data-action='delete-recurring']").click();
  await expect(page.locator("#availability-recurring-list")).toContainText("No recurring blocks");
  await expect.poll(() => page.evaluate((username) => JSON.parse(localStorage.getItem("Slotzy_availability") || "{}")[username]?.recurringBlocks?.length || 0, OWNER_USERNAME)).toBe(0);
});

test("hosted recurring block save failure does not create local-only success", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/availability**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }));
  await page.goto("/pages/business-owner.html");
  await page.locator('input[name="availability-recurring-day"][value="mon"]').check();
  await page.locator("#availability-add-recurring").click();
  await expect(page.locator("#availability-recurring-error")).toContainText("Could not save recurring block");
  await expect(page.locator("#availability-recurring-list")).toContainText("No recurring blocks");
  await expect.poll(() => page.evaluate((username) => JSON.parse(localStorage.getItem("Slotzy_availability") || "{}")[username]?.recurringBlocks?.length || 0, OWNER_USERNAME)).toBe(0);
});

test("hosted time-off delete failure keeps the block and offers a retryable error", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  const block = {
    id: "timeoff-api-failure",
    startISO: "2026-10-06T17:00:00.000Z",
    endISO: "2026-10-06T18:00:00.000Z",
    note: "Break",
  };
  seed.local.Slotzy_availability[OWNER_USERNAME].timeOff = [block];
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/availability**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "unavailable" }),
  }));
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/pages/business-owner.html");
  await page.locator('[data-action="delete-timeoff"]').click();
  await expect(page.locator("#availability-timeoff-error")).toContainText("Could not delete that block");
  await expect(page.locator('[data-action="delete-timeoff"]')).toBeVisible();
  await expect.poll(() => page.evaluate((username) => {
    const availability = JSON.parse(localStorage.getItem("Slotzy_availability") || "{}");
    return availability[username]?.timeOff?.some((entry) => entry.id === "timeoff-api-failure");
  }, OWNER_USERNAME)).toBe(true);
});

test("hosted recurring-block delete shows pending feedback and restores a retryable action after failure", async ({ page }) => {
  const seed = buildSeed({ configuredOwner: true });
  seed.local.Slotzy_availability[OWNER_USERNAME].recurringBlocks = [{
    id: "recurring-api-failure",
    weekday: "mon",
    start: "12:00",
    end: "13:00",
    label: "Lunch",
    enabled: true,
  }];
  await seedStorage(page, seed, { includeSession: true });
  await page.addInitScript(() => {
    localStorage.setItem("Slotzy_api_mode", "1");
    localStorage.setItem("Slotzy_auth_token", "synthetic-owner-token");
  });
  await page.route("**/api/availability**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await page.goto("/pages/business-owner.html");
  const deleteButton = page.locator('button[data-action="delete-recurring"]');
  await deleteButton.click();
  await expect(deleteButton).toHaveText("Deleting…");
  await expect(page.locator("#availability-recurring-error")).toContainText("Could not delete that recurring block");
  await expect(deleteButton).toBeEnabled();
  await expect(deleteButton).toHaveText("Delete");
  await expect(page.locator("#availability-recurring-list")).toContainText("Lunch");
});
