const { test, expect } = require("@playwright/test");

const FIXED_NOW_ISO = "2026-03-13T10:00:00";
const SHOP_ID = "shop_today_glance";
const OWNER_USERNAME = "owner_today_glance";
const BARBER_USERNAME = "barber_today_glance";

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

function makeBooking({ id, startIso, durationMinutes, ownerUsername, barberUsername, clientName, clientContact, serviceName, status = "booked" }) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    id,
    shopId: SHOP_ID,
    ownerUsername,
    barberUsername,
    barberDisplayName: barberUsername === BARBER_USERNAME ? "Barber Today" : "Owner Today",
    shopName: "Today Glance Shop",
    serviceId: `svc-${id}`,
    serviceName,
    price: 35,
    durationMinutes,
    clientName,
    clientContact,
    status,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startAtISO: start.toISOString(),
    date: toYmd(start),
    time: toHhmm(start),
    createdAt: new Date("2026-03-12T18:00:00").toISOString(),
  };
}

function buildSeed(bookings) {
  return {
    local: {
      Slotzy_users: [
        {
          username: OWNER_USERNAME,
          password: "pass1234",
          role: "owner",
          displayName: "Owner Today",
          shopId: SHOP_ID,
        },
        {
          username: BARBER_USERNAME,
          password: "pass1234",
          role: "barber",
          displayName: "Barber Today",
          shopId: SHOP_ID,
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: "Today Glance Shop",
        name: "Today Glance Shop",
        shopId: SHOP_ID,
      },
      Slotzy_shops: [
        {
          id: SHOP_ID,
          name: "Today Glance Shop",
          slug: "today-glance-shop",
          createdAtISO: FIXED_NOW_ISO,
        },
      ],
      Slotzy_services: [
        {
          id: "svc-owner",
          name: "Owner Cut",
          title: "Owner Cut",
          price: 35,
          duration: 30,
          durationMinutes: 30,
          active: true,
          createdAtISO: FIXED_NOW_ISO,
          shopId: SHOP_ID,
          barberUsername: OWNER_USERNAME,
          ownerUsername: OWNER_USERNAME,
        },
        {
          id: "svc-barber",
          name: "Barber Fade",
          title: "Barber Fade",
          price: 40,
          duration: 30,
          durationMinutes: 30,
          active: true,
          createdAtISO: FIXED_NOW_ISO,
          shopId: SHOP_ID,
          barberUsername: BARBER_USERNAME,
          ownerUsername: BARBER_USERNAME,
        },
      ],
      Slotzy_staff: [],
      Slotzy_bookings: bookings,
      Slotzy_availability: {},
    },
    session: {},
  };
}

async function seedStorage(page, { seed, sessionUser }) {
  await page.addInitScript(({ seedPayload, userPayload, fixedIso, sessionKey }) => {
    localStorage.clear();
    sessionStorage.clear();

    Object.entries(seedPayload.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    if (userPayload) {
      sessionStorage.setItem(sessionKey, JSON.stringify(userPayload));
    }

    const fixedNow = new Date(fixedIso).getTime();
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedNow);
          return;
        }
        super(...args);
      }
      static now() {
        return fixedNow;
      }
    }
    MockDate.parse = RealDate.parse;
    MockDate.UTC = RealDate.UTC;
    window.Date = MockDate;
  }, {
    seedPayload: seed,
    userPayload: sessionUser,
    fixedIso: FIXED_NOW_ISO,
    sessionKey: "Slotzy_user",
  });
}

test("owner dashboard Today card shows next appointment, quick actions, and refreshes after booking creation", async ({ page }) => {
  const initialBookings = [
    makeBooking({
      id: "bk-owner-next",
      startIso: "2026-03-13T11:30:00",
      durationMinutes: 30,
      ownerUsername: OWNER_USERNAME,
      barberUsername: OWNER_USERNAME,
      clientName: "Alex Client",
      clientContact: "alex@example.com",
      serviceName: "Owner Cut",
      status: "booked",
    }),
    makeBooking({
      id: "bk-barber-later",
      startIso: "2026-03-13T13:00:00",
      durationMinutes: 30,
      ownerUsername: BARBER_USERNAME,
      barberUsername: BARBER_USERNAME,
      clientName: "Taylor Client",
      clientContact: "taylor@example.com",
      serviceName: "Barber Fade",
      status: "confirmed",
    }),
    makeBooking({
      id: "bk-cancelled-ignore",
      startIso: "2026-03-13T15:00:00",
      durationMinutes: 30,
      ownerUsername: OWNER_USERNAME,
      barberUsername: OWNER_USERNAME,
      clientName: "Ignore Client",
      clientContact: "ignore@example.com",
      serviceName: "Owner Cut",
      status: "cancelled",
    }),
  ];
  await seedStorage(page, {
    seed: buildSeed(initialBookings),
    sessionUser: { username: OWNER_USERNAME, role: "owner" },
  });

  await page.goto("/pages/business-owner.html");

  await expect(page.locator("#ownerTodayGlanceCount")).toHaveText("2 booked or confirmed today");
  await expect(page.locator("#ownerTodayNextTitle")).toHaveText("11:30 AM");
  await expect(page.locator("#ownerTodayNextMeta")).toHaveText("Alex Client | Owner Cut");

  await page.evaluate(() => {
    const bookings = JSON.parse(localStorage.getItem("Slotzy_bookings") || "[]");
    bookings.push({
      id: "bk-owner-new",
      shopId: "shop_today_glance",
      ownerUsername: "owner_today_glance",
      barberUsername: "owner_today_glance",
      barberDisplayName: "Owner Today",
      shopName: "Today Glance Shop",
      serviceId: "svc-new",
      serviceName: "Hot Towel Shave",
      price: 45,
      durationMinutes: 30,
      clientName: "Jordan Rush",
      clientContact: "jordan@example.com",
      status: "booked",
      startISO: new Date("2026-03-13T10:15:00").toISOString(),
      endISO: new Date("2026-03-13T10:45:00").toISOString(),
      startAtISO: new Date("2026-03-13T10:15:00").toISOString(),
      date: "2026-03-13",
      time: "10:15",
      createdAt: new Date("2026-03-12T19:00:00").toISOString(),
    });
    localStorage.setItem("Slotzy_bookings", JSON.stringify(bookings));
    window.dispatchEvent(new CustomEvent("slotzy:bookings-updated", {
      detail: { count: bookings.length },
    }));
  });

  await expect(page.locator("#ownerTodayGlanceCount")).toHaveText("3 booked or confirmed today");
  await expect(page.locator("#ownerTodayNextTitle")).toHaveText("10:15 AM");
  await expect(page.locator("#ownerTodayNextMeta")).toHaveText("Jordan Rush | Hot Towel Shave");

  await page.getByRole("button", { name: "Share Booking Link" }).click();
  await expect(page).toHaveURL(/\/pages\/settings\.html#public-booking-link-section$/);
  await expect(page.locator("#public-booking-link-section")).toBeVisible();

  await page.goto("/pages/business-owner.html");
  await page.getByRole("button", { name: "View Today" }).click();
  await expect(page).toHaveURL(/\/pages\/owner-today\.html$/);
});

test("barber dashboard Today card shows only that barber's appointments", async ({ page }) => {
  const bookings = [
    makeBooking({
      id: "bk-owner-only",
      startIso: "2026-03-13T11:30:00",
      durationMinutes: 30,
      ownerUsername: OWNER_USERNAME,
      barberUsername: OWNER_USERNAME,
      clientName: "Alex Client",
      clientContact: "alex@example.com",
      serviceName: "Owner Cut",
      status: "booked",
    }),
    makeBooking({
      id: "bk-barber-only",
      startIso: "2026-03-13T12:15:00",
      durationMinutes: 30,
      ownerUsername: BARBER_USERNAME,
      barberUsername: BARBER_USERNAME,
      clientName: "Casey Client",
      clientContact: "casey@example.com",
      serviceName: "Barber Fade",
      status: "confirmed",
    }),
  ];
  await seedStorage(page, {
    seed: buildSeed(bookings),
    sessionUser: { username: BARBER_USERNAME, role: "barber" },
  });

  await page.goto("/pages/business-owner.html");

  await expect(page.locator("#ownerTodayGlanceCount")).toHaveText("1 booked or confirmed today");
  await expect(page.locator("#ownerTodayNextTitle")).toHaveText("12:15 PM");
  await expect(page.locator("#ownerTodayNextMeta")).toHaveText("Casey Client | Barber Fade");
});
