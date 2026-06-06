const { test, expect } = require("@playwright/test");

const SHOP_ID = "shop_public_manage";
const OWNER_USERNAME = "owner_public_manage";
const SERVICE_ID = "svc_public_manage";
const PUBLIC_CONTACT = "555-1234";
const DEFAULT_POLICY = {
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

function makeBooking({ id, start, durationMinutes, serviceName, contact, status = "booked" }) {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    id,
    shopId: SHOP_ID,
    ownerUsername: OWNER_USERNAME,
    barberUsername: OWNER_USERNAME,
    barberDisplayName: "Jordan Manage",
    shopName: "Manage Test Shop",
    serviceId: `${SERVICE_ID}-${id}`,
    serviceName,
    price: 30,
    durationMinutes,
    clientName: "Public Booker",
    clientContact: contact,
    status,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startAtISO: start.toISOString(),
    date: toYmd(start),
    time: toHhmm(start),
    createdAt: new Date().toISOString(),
  };
}

function buildAvailability({ start = "09:00", end = "17:00", timeOff = [] } = {}) {
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
        sun: { enabled: true, start, end },
      },
      timeOff,
    },
  };
}

function buildSeed(existingBookings, { bookingPolicy = DEFAULT_POLICY, availability = buildAvailability() } = {}) {
  return {
    local: {
      Slotzy_users: [
        {
          username: OWNER_USERNAME,
          password: "pass1234",
          role: "owner",
          displayName: "Jordan Manage",
          shopId: SHOP_ID,
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: "Manage Test Shop",
        name: "Manage Test Shop",
        shopId: SHOP_ID,
        bookingPolicy,
      },
      Slotzy_shops: [
        {
          id: SHOP_ID,
          name: "Manage Test Shop",
          slug: "manage-test-shop",
          createdAtISO: new Date().toISOString(),
          bookingPolicy,
        },
      ],
      Slotzy_services: [
        {
          id: SERVICE_ID,
          name: "Public Access Cut",
          title: "Public Access Cut",
          price: 35,
          duration: 30,
          durationMinutes: 30,
          active: true,
          createdAtISO: new Date().toISOString(),
          shopId: SHOP_ID,
          barberUsername: OWNER_USERNAME,
          ownerUsername: OWNER_USERNAME,
        },
      ],
      Slotzy_staff: [],
      Slotzy_bookings: existingBookings,
      Slotzy_availability: availability,
    },
  };
}

async function seedStorage(page, seed) {
  await page.addInitScript((seedPayload) => {
    if (localStorage.getItem("Slotzy_public_manage_seeded") === "1") {
      return;
    }
    localStorage.clear();
    sessionStorage.clear();

    // Disable API mode to use localStorage
    localStorage.setItem("Slotzy_api_mode", "0");

    Object.entries(seedPayload.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    localStorage.setItem("Slotzy_public_manage_seeded", "1");

    window.__copiedManageLink = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedManageLink = String(value ?? "");
        },
      },
    });
  }, seed);
}

test("public booking receipt exposes a manage link and contact-based manage page can cancel within policy", async ({ page, context }) => {
  const blockedStart = new Date(Date.now() + 6 * 60 * 60 * 1000);
  blockedStart.setMinutes(0, 0, 0);
  const otherContactStart = new Date(Date.now() + 8 * 60 * 60 * 1000);
  otherContactStart.setMinutes(30, 0, 0);
  const seed = buildSeed([
    makeBooking({
      id: "bk_blocked_window",
      start: blockedStart,
      durationMinutes: 30,
      serviceName: "Blocked Trim",
      contact: PUBLIC_CONTACT,
    }),
    makeBooking({
      id: "bk_other_contact",
      start: otherContactStart,
      durationMinutes: 30,
      serviceName: "Other Contact Service",
      contact: "555-9999",
    }),
  ]);
  await seedStorage(page, seed);

  await page.goto("/pages/book.html?shop=manage-test-shop");
  await expect(page.locator("#serviceSelect")).toBeEnabled();
  await page.selectOption("#serviceSelect", SERVICE_ID);
  await page.fill("#clientName", "Public Booker");
  await page.fill("#clientContact", PUBLIC_CONTACT);

  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  await page.fill("#bookingDate", toYmd(bookingDate));
  await expect(page.locator("#time-slot-select")).toBeVisible();
  const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
  const firstSlotValue = await firstSlot.getAttribute("value");
  expect(firstSlotValue).toBeTruthy();
  await page.selectOption("#time-slot-select", String(firstSlotValue));

  await page.getByRole("button", { name: "Book Appointment" }).click();
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  await expect(page.locator("#bookingReceiptManageLink")).toBeVisible();
  const manageLink = String(await page.locator("#bookingReceiptManageLink").getAttribute("href") || "");
  expect(manageLink).toContain("/pages/manage.html?");
  expect(manageLink).toContain("shop=manage-test-shop");
  expect(manageLink).toContain("contact=555-1234");
  expect(manageLink).not.toContain("code=");

  await page.click("#btn-receipt-copy-manage-link");
  await expect(page.locator("#toast")).toContainText("Manage link copied.");
  const copiedManageLink = await page.evaluate(() => String(window.__copiedManageLink ?? ""));
  expect(copiedManageLink).toBe(manageLink);
  const storedManageLink = await page.evaluate(() => String(sessionStorage.getItem("Slotzy_lastManageLink") ?? ""));
  expect(storedManageLink).toBe(manageLink);

  const ownerPage = await context.newPage();
  await ownerPage.addInitScript((username) => {
    sessionStorage.setItem("Slotzy_user", JSON.stringify({ username, role: "owner" }));
  }, OWNER_USERNAME);
  await ownerPage.goto("/pages/business-owner.html");
  await expect(ownerPage.locator("#owner-upcoming-list")).toContainText("Public Access Cut");

  await page.goto(manageLink);
  await expect(page.locator("#manageHeaderShopName")).toContainText("Manage Test Shop");
  await expect(page.locator("#manageIdentitySummary")).toContainText(PUBLIC_CONTACT);
  await expect(page.locator("#manageUpcomingList")).toContainText("Public Access Cut");
  await expect(page.locator("#manageUpcomingList")).toContainText("Blocked Trim");
  await expect(page.locator("#manageUpcomingList")).not.toContainText("Other Contact Service");
  await expect(page.locator("button[data-action='cancel-appointment']")).toHaveCount(1);
  await expect(page.locator("#manageUpcomingList")).toContainText("Cancellations must be made at least 24 hours before.");
  await expect(
    page.locator("#manageUpcomingList .client-manage-card").filter({ hasText: "Public Access Cut" }).getByRole("button", { name: "Reschedule" })
  ).toBeEnabled();
  await expect(
    page.locator("#manageUpcomingList .client-manage-card").filter({ hasText: "Blocked Trim" }).getByRole("button", { name: "Reschedule" })
  ).toBeDisabled();
  await expect(
    page.locator("#manageUpcomingList .client-manage-card").filter({ hasText: "Blocked Trim" })
  ).toContainText("Rescheduling must be at least 24 hours before.");

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.locator("button[data-action='cancel-appointment']").click();
  await expect(page.locator("#manageStatus")).toContainText("Appointment cancelled.");
  await expect(page.locator("#toast")).toContainText("Appointment cancelled.");
  await expect(page.locator("#managePastList")).toContainText("Public Access Cut");
  await expect(page.locator("#managePastList")).toContainText("Cancelled");
  await expect(page.locator("#manageUpcomingList")).not.toContainText("Public Access Cut");
  await expect(page.locator("#manageUpcomingList")).toContainText("Blocked Trim");

  await expect(ownerPage.locator("#owner-upcoming-list")).not.toContainText("Public Access Cut");

  await page.reload();
  await expect(page.locator("#managePastList")).toContainText("Public Access Cut");
  await expect(page.locator("#managePastList")).toContainText("Cancelled");
  await expect(page.locator("#manageUpcomingList")).toContainText("Blocked Trim");
  await ownerPage.close();
});

test("public manage page can reschedule with booking rules, overlap protection, and policy limits", async ({ page, context }) => {
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  bookingDate.setHours(9, 0, 0, 0);

  const overlappingStart = new Date(bookingDate);
  overlappingStart.setHours(9, 30, 0, 0);

  const timeOffStart = new Date(bookingDate);
  timeOffStart.setHours(10, 0, 0, 0);
  const timeOffEnd = new Date(bookingDate);
  timeOffEnd.setHours(10, 30, 0, 0);

  const bookingPolicy = {
    ...DEFAULT_POLICY,
    allowSameDay: false,
    maxDaysAdvance: 7,
    cancelHours: 24,
  };
  const availability = buildAvailability({
    start: "09:00",
    end: "11:00",
    timeOff: [
      {
        id: "timeoff_training",
        startISO: timeOffStart.toISOString(),
        endISO: timeOffEnd.toISOString(),
        note: "Training",
      },
    ],
  });
  const seed = buildSeed(
    [
      makeBooking({
        id: "bk_overlap_other_client",
        start: overlappingStart,
        durationMinutes: 30,
        serviceName: "Overlap Guard",
        contact: "555-8888",
      }),
    ],
    {
      bookingPolicy,
      availability,
    }
  );
  await seedStorage(page, seed);

  await page.goto("/pages/book.html?shop=manage-test-shop");
  await expect(page.locator("#serviceSelect")).toBeEnabled();
  await page.selectOption("#serviceSelect", SERVICE_ID);
  await page.fill("#clientName", "Public Booker");
  await page.fill("#clientContact", PUBLIC_CONTACT);
  const bookMinDate = new Date();
  bookMinDate.setDate(bookMinDate.getDate() + 1);
  bookMinDate.setHours(0, 0, 0, 0);
  const bookMaxDate = new Date();
  bookMaxDate.setDate(bookMaxDate.getDate() + 7);
  bookMaxDate.setHours(0, 0, 0, 0);
  await expect(page.locator("#bookingDate")).toHaveAttribute("min", toYmd(bookMinDate));
  await expect(page.locator("#bookingDate")).toHaveAttribute("max", toYmd(bookMaxDate));

  await page.fill("#bookingDate", toYmd(bookingDate));
  await expect(page.locator("#time-slot-select")).toBeVisible();
  const firstSlot = page.locator("#time-slot-select option[value]:not([value=''])").first();
  const firstSlotValue = await firstSlot.getAttribute("value");
  expect(firstSlotValue).toBeTruthy();
  await page.selectOption("#time-slot-select", String(firstSlotValue));

  await page.getByRole("button", { name: "Book Appointment" }).click();
  await expect(page.getByRole("heading", { name: "Booked!" })).toBeVisible();
  const manageLink = String(await page.locator("#bookingReceiptManageLink").getAttribute("href") || "");
  expect(manageLink).toContain("/pages/manage.html?");

  const ownerPage = await context.newPage();
  await ownerPage.addInitScript((username) => {
    sessionStorage.setItem("Slotzy_user", JSON.stringify({ username, role: "owner" }));
  }, OWNER_USERNAME);
  await ownerPage.goto("/pages/business-owner.html");
  await expect(ownerPage.locator("#owner-upcoming-list")).toContainText("Public Access Cut");
  await expect(ownerPage.locator("#owner-upcoming-list")).toContainText("9:00");

  await page.goto(manageLink);
  const bookedCard = page.locator("#manageUpcomingList .client-manage-card").filter({ hasText: "Public Access Cut" });
  await expect(bookedCard).toContainText("9:00");
  await bookedCard.getByRole("button", { name: "Reschedule" }).click();

  await expect(page.locator("#clientRescheduleModal")).toBeVisible();
  await expect(page.locator("#clientReschedulePolicyHint")).toContainText("Same-day bookings are not available");

  await expect(page.locator("#clientRescheduleDate")).toHaveAttribute("min", toYmd(bookMinDate));
  await expect(page.locator("#clientRescheduleDate")).toHaveAttribute("max", toYmd(bookMaxDate));

  const slotOptions = await page.locator("#clientRescheduleSlot option").evaluateAll((options) =>
    options
      .map((option) => ({
        value: option.value || "",
        text: (option.textContent || "").trim(),
      }))
      .filter((option) => option.value)
  );
  expect(slotOptions.some((option) => option.text.startsWith("9:00"))).toBeTruthy();
  expect(slotOptions.some((option) => option.text.startsWith("9:30"))).toBeFalsy();
  expect(slotOptions.some((option) => option.text.startsWith("10:00"))).toBeFalsy();
  expect(slotOptions.some((option) => option.text.startsWith("10:30"))).toBeTruthy();

  const rescheduledSlot = slotOptions.find((option) => option.text.startsWith("10:30"));
  expect(rescheduledSlot).toBeTruthy();
  await page.selectOption("#clientRescheduleSlot", String(rescheduledSlot.value));
  await page.getByRole("button", { name: "Confirm Reschedule" }).click();

  await expect(page.locator("#manageStatus")).toContainText("Appointment rescheduled.");
  await expect(page.locator("#toast")).toContainText("Appointment rescheduled");
  await expect(page.locator("#manageUpcomingList")).toContainText("10:30");
  await expect(page.locator("#manageUpcomingList")).not.toContainText("9:00 AM - 9:30 AM");

  await expect(ownerPage.locator("#owner-upcoming-list")).toContainText("10:30");
  await expect(ownerPage.locator("#owner-upcoming-list")).not.toContainText("9:00 AM");

  await page.reload();
  await expect(page.locator("#manageUpcomingList")).toContainText("10:30");
  await ownerPage.close();
});
