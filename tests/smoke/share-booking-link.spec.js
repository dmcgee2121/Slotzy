const { test, expect } = require("@playwright/test");

function buildSeed() {
  return {
    local: {
      Slotzy_users: [
        {
          username: "owner_share",
          password: "pass1234",
          role: "owner",
          displayName: "Owner Share",
          shopId: "shop_share_1",
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: "Share Test Shop",
        name: "Share Test Shop",
        shopId: "shop_share_1",
        bookingPolicy: {
          allowSameDay: true,
          maxDaysAdvance: 30,
          cancelHours: 24,
          bufferMinutes: 0,
          requireDeposit: false,
          depositAmount: 0,
          lateGraceMinutes: 10,
          noShowStrikeLimit: 2,
        },
      },
      Slotzy_shops: [
        {
          id: "shop_share_1",
          name: "Share Test Shop",
          slug: "share-test-shop",
          createdAtISO: new Date().toISOString(),
          bookingPolicy: {
            allowSameDay: true,
            maxDaysAdvance: 30,
            cancelHours: 24,
            bufferMinutes: 0,
            requireDeposit: false,
            depositAmount: 0,
            lateGraceMinutes: 10,
            noShowStrikeLimit: 2,
          },
        },
      ],
      Slotzy_services: [],
      Slotzy_staff: [],
      Slotzy_bookings: [],
      Slotzy_availability: {},
    },
    session: {
      Slotzy_user: {
        username: "owner_share",
        role: "owner",
      },
    },
  };
}

async function seedStorage(page, seed) {
  await page.addInitScript((seedPayload) => {
    if (localStorage.getItem("Slotzy_share_link_seeded") === "1") {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    Object.entries(seedPayload.local || {}).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    Object.entries(seedPayload.session || {}).forEach(([key, value]) => {
      sessionStorage.setItem(key, JSON.stringify(value));
    });

    localStorage.setItem("Slotzy_share_link_seeded", "1");

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {},
        },
      });
      return;
    }

    navigator.clipboard.writeText = async () => {};
  }, seed);
}

test("share booking link shows toast, helper text, and open action on desktop and mobile", async ({ page }) => {
  await seedStorage(page, buildSeed());
  await page.goto("/pages/settings.html");

  const bookingUrl = await page.locator("#publicBookingLinkInput").inputValue();
  await expect(page.locator(".public-booking-link-tip")).toContainText("Tip: add this link to your Instagram bio, Google Business Profile, and text it to clients.");
  await expect(page.locator("#openPublicBookingLinkBtn")).toBeEnabled();

  await page.evaluate(() => {
    window.__openedBookingUrl = "";
    window.open = (url) => {
      window.__openedBookingUrl = String(url || "");
      return {
        closed: false,
        focus() {},
      };
    };
  });

  await page.getByRole("button", { name: "Open Link" }).click();
  await expect.poll(async () => page.evaluate(() => window.__openedBookingUrl)).toBe(bookingUrl);

  const toast = page.locator("#toast");

  await page.getByRole("button", { name: "Copy Link" }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("Link copied");
  await page.waitForTimeout(2200);
  await expect(toast).toHaveClass(/hidden/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Copy Link" }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("Link copied");

  const toastBounds = await page.evaluate(() => {
    const node = document.getElementById("toast");
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
    };
  });

  expect(toastBounds).not.toBeNull();
  expect(toastBounds.left).toBeGreaterThanOrEqual(0);
  expect(toastBounds.right).toBeLessThanOrEqual(toastBounds.viewportWidth);

  await page.waitForTimeout(2200);
  await expect(toast).toHaveClass(/hidden/);
});
