const { test, expect } = require("@playwright/test");
const { randomUUID } = require("crypto");

const allow = process.env.SLOTZY_ALLOW_STAGING_E2E === "true";
const frontendUrl = String(process.env.SLOTZY_STAGING_FRONTEND_URL || "").replace(/\/$/, "");
const apiUrl = String(process.env.SLOTZY_STAGING_API_URL || "").replace(/\/$/, "");
const runId = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
const identity = {
  username: `${runId}-owner`, password: "Synthetic-E2E-Only-123!", email: `${runId}@example.test`,
  shopName: `E2E Synthetic Shop ${runId}`, slug: `${runId}-shop`, serviceName: `E2E Cut ${runId}`,
  clientName: `E2E Client ${runId}`, clientEmail: `${runId}-client@example.test`, clientPhone: "555-010-2026",
};

function failGuard(message) { throw new Error(`Staging E2E safety guard: ${message}`); }
function requireStagingUrl(value, name) {
  if (!value) failGuard(`${name} is required.`);
  let parsed;
  try { parsed = new URL(value); } catch { failGuard(`${name} must be an absolute HTTPS URL.`); }
  if (parsed.protocol !== "https:" || !/staging/i.test(parsed.hostname)) failGuard(`${name} must target a hostname containing "staging".`);
  return parsed;
}

async function warmHealth() {
  const api = requireStagingUrl(apiUrl, "SLOTZY_STAGING_API_URL");
  const healthUrl = new URL("/api/health", api).toString();
  const deadline = Date.now() + 150000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      const health = await response.json();
      if (response.ok && health?.ok === true && health.environment === "staging" && health.storage === "postgres") return;
      lastError = `received ${response.status}: ${JSON.stringify(health)}`;
    } catch (error) { lastError = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  failGuard(`staging/Postgres health did not become ready within 150 seconds (Render cold start or persistent failure): ${lastError}`);
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  if (!allow) failGuard('set SLOTZY_ALLOW_STAGING_E2E=true to permit staging mutation.');
  requireStagingUrl(frontendUrl, "SLOTZY_STAGING_FRONTEND_URL");
  await warmHealth();
});

test("synthetic staging owner-to-customer booking lifecycle", async ({ page, context }) => {
  // The health guard above completes before this test can write any data.
  await page.goto(`${frontendUrl}/pages/index.html`);
  await page.locator("#btn-login").click();
  await page.locator("#show-register").click();
  await page.fill("#auth-username", identity.username);
  await page.fill("#auth-password", identity.password);
  await page.selectOption("#auth-role", "owner");
  await page.getByRole("button", { name: "Continue" }).click();
  // Hosted registration can retain index.html while it applies authenticated
  // navigation state. Verify that state rather than treating any landing URL
  // as success, then use the real Dashboard entry point.
  await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#userBadge")).toContainText(identity.username);
  await expect(page.locator("#btn-dashboard")).toBeVisible();
  await page.locator("#btn-dashboard").click();
  await expect(page).toHaveURL(/\/pages\/(owner-setup|business-owner)\.html/);

  // Complete the minimum owner configuration through the hosted UI.
  if (await page.locator("#setupShopName").count()) {
    await page.fill("#setupShopName", identity.shopName);
    await page.locator("#setupStep1Next").click();
  }
  await page.goto(`${frontendUrl}/pages/manage-services.html`);
  await page.fill("#serviceName", identity.serviceName);
  await page.fill("#servicePrice", "30");
  await page.fill("#serviceDuration", "30");
  await page.getByRole("button", { name: /add|create/i }).click();
  await page.reload();
  await expect(page.getByText(identity.serviceName)).toBeVisible();

  await page.goto(`${frontendUrl}/pages/business-owner.html`);
  const tomorrow = new Date(Date.now() + 86400000);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][tomorrow.getDay()];
  await page.fill(`input[data-day="${day}"][data-field="start"]`, "09:00");
  await page.fill(`input[data-day="${day}"][data-field="end"]`, "17:00");
  await page.locator("#availability-save-weekly").click();
  await page.reload();

  const bookingLink = await page.locator("a[href*='book.html']").first().getAttribute("href");
  expect(bookingLink).toBeTruthy();
  const publicPage = await context.newPage();
  await publicPage.goto(new URL(bookingLink, frontendUrl).toString());
  await publicPage.selectOption("#barberSelect", { label: new RegExp(identity.username, "i") });
  await publicPage.selectOption("#serviceSelect", { label: identity.serviceName });
  await publicPage.locator("#bookingDate").fill(tomorrow.toISOString().slice(0, 10));
  const slot = publicPage.locator("#time-slot-select option[value]:not([value=''])").first();
  await expect(slot).toBeAttached();
  await publicPage.selectOption("#time-slot-select", await slot.getAttribute("value"));
  await publicPage.fill("#clientName", identity.clientName);
  await publicPage.fill("#clientContact", identity.clientEmail);
  await publicPage.getByRole("button", { name: /book|confirm/i }).click();
  const manageLink = await publicPage.locator("#bookingReceiptManageLink").getAttribute("href");
  expect(manageLink).toBeTruthy();

  await page.goto(`${frontendUrl}/pages/manage-appointments.html`);
  await expect(page.getByText(identity.clientName)).toBeVisible();
  const managePage = await context.newPage();
  await managePage.goto(new URL(manageLink, frontendUrl).toString());
  await expect(managePage.getByText(identity.clientName)).toBeVisible();
  await managePage.getByRole("button", { name: /^Cancel$/i }).click();
  await managePage.getByRole("button", { name: /confirm cancel/i }).click();
  await managePage.reload();
  await expect(managePage.getByText(/cancelled/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(identity.clientName)).toBeVisible();

  await publicPage.close();
  await managePage.close();
});

test("staging negative checks use synthetic context", async ({ page }) => {
  await page.goto(`${frontendUrl}/pages/index.html`);
  await page.locator("#btn-login").click();
  await page.fill("#auth-username", `${runId}-missing`);
  await page.fill("#auth-password", "wrong-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#auth-error")).toBeVisible();
  await page.goto(`${frontendUrl}/pages/manage.html?shop=${identity.slug}&contact=invalid@example.test&code=INVALID`);
  await expect(page.getByText(/not found|invalid|unable/i)).toBeVisible();
});

// No cleanup API exists. Records are intentionally prefixed with `e2e-` and
// must be removed manually through staging-only operational tooling if desired.
