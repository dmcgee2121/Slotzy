const { test, expect } = require("@playwright/test");

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgwJ/l8RGoQAAAABJRU5ErkJggg==";
const MAX_LOGO_BYTES = 1024 * 1024 + 8;

function buildSeed() {
  return {
    local: {
      Slotzy_users: [
        {
          username: "owner_logo",
          password: "pass1234",
          role: "owner",
          displayName: "Owner Logo",
          shopId: "shop_logo_1",
        },
      ],
      Slotzy_profiles: {},
      Slotzy_shop: {
        businessName: "Logo Test Shop",
        name: "Logo Test Shop",
        shopId: "shop_logo_1",
        logoDataUrl: null,
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
          id: "shop_logo_1",
          name: "Logo Test Shop",
          slug: "logo-test-shop",
          logoDataUrl: null,
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
        username: "owner_logo",
        role: "owner",
      },
    },
  };
}

async function seedStorage(page, seed) {
  await page.addInitScript((seedPayload) => {
    if (localStorage.getItem("Slotzy_logo_branding_seeded") === "1") {
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

    localStorage.setItem("Slotzy_logo_branding_seeded", "1");
  }, seed);
}

test("shop logo upload persists to settings, public booking, and QR print", async ({ page }) => {
  await seedStorage(page, buildSeed());

  await page.goto("/pages/settings.html");

  await page.setInputFiles("#shopLogoInput", {
    name: "shop-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });
  await expect(page.locator("#shopLogoInputStatus")).toContainText("Logo ready to save");

  await page.getByRole("button", { name: "Save Shop Settings" }).click();
  await expect(page.locator("#shopStatus")).toContainText("Shop settings saved successfully.");

  const savedLogoDataUrl = await page.evaluate(() => {
    const shops = JSON.parse(localStorage.getItem("Slotzy_shops") || "[]");
    return shops[0]?.logoDataUrl || "";
  });
  expect(savedLogoDataUrl.startsWith("data:image/png;base64,")).toBeTruthy();

  await page.reload();
  await expect(page.locator("#shopLogoPreview")).toHaveAttribute("src", /^data:image\/png;base64,/);

  await page.goto("/pages/book.html?shop=logo-test-shop");
  await expect(page.locator("#publicShopLogo")).toHaveAttribute("src", /^data:image\/png;base64,/);

  await page.goto("/pages/settings.html");
  await page.evaluate(() => {
    window.__lastQrPrintHtml = "";
    window.open = function () {
      return {
        document: {
          open() {
            window.__lastQrPrintHtml = "";
          },
          write(html) {
            window.__lastQrPrintHtml += String(html ?? "");
          },
          close() {},
        },
        focus() {},
        print() {},
      };
    };
  });

  await expect(page.locator("#printPublicBookingQrBtn")).toBeEnabled();
  await page.locator("#printPublicBookingQrBtn").click();
  const qrPrintHtml = await page.evaluate(() => String(window.__lastQrPrintHtml ?? ""));
  expect(qrPrintHtml).toContain("class=\"shop-logo\"");
  expect(qrPrintHtml).toContain("data:image/png;base64,");
  expect(qrPrintHtml).toContain("class=\"shop-name\">Logo Test Shop");
  expect(qrPrintHtml).toContain("/pages/book.html?shop=logo-test-shop");

  await page.locator("#removeShopLogoBtn").click();
  await expect(page.locator("#shopLogoInputStatus")).toContainText("Logo removed");
  await page.getByRole("button", { name: "Save Shop Settings" }).click();
  await expect(page.locator("#shopStatus")).toContainText("Shop settings saved successfully.");

  await page.reload();
  await expect(page.locator("#shopLogoPreview")).toHaveAttribute("src", /slotzy-logo\.png/);

  await page.goto("/pages/book.html?shop=logo-test-shop");
  await expect(page.locator("#publicShopLogo")).toHaveAttribute("src", /slotzy-logo\.png/);

  await page.goto("/pages/settings.html");
  await page.setInputFiles("#shopLogoInput", {
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(MAX_LOGO_BYTES, 0),
  });
  await expect(page.locator("#shopLogoInputStatus")).toContainText("1 MB or smaller");
});
