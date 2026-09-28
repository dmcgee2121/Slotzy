const { test, expect } = require("@playwright/test");
const { randomUUID } = require("crypto");

const allow = process.env.SLOTZY_ALLOW_STAGING_E2E === "true";
const frontendUrl = String(process.env.SLOTZY_STAGING_FRONTEND_URL || "").replace(/\/$/, "");
const apiUrl = String(process.env.SLOTZY_STAGING_API_URL || "").replace(/\/$/, "");

function createSyntheticRunId() {
  // This remains short enough for ordinary username limits while combining
  // independent clock, worker, and cryptographic-random entropy. Do not use a
  // timestamp alone: repeated/parallel hosted runs can share a millisecond.
  const timestamp = Date.now().toString(36);
  const worker = Math.max(0, Number(process.pid) || 0).toString(36);
  const random = randomUUID().replace(/-/g, "").slice(0, 16);
  return `e2e-${timestamp}-${worker}-${random}`;
}

const runId = createSyntheticRunId();
const identity = {
  username: `${runId}-owner`, password: "Synthetic-E2E-Only-123!", email: `${runId}@example.test`,
  shopName: `E2E Synthetic Shop ${runId}`, slug: `${runId}-shop`, serviceName: `E2E Cut ${runId}`,
  clientName: `E2E Client ${runId}`, clientEmail: `${runId}-client@example.test`, clientPhone: "555-010-2026",
};

function failGuard(message) { throw new Error(`Staging E2E safety guard: ${message}`); }
function safeDiagnosticText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted-url]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\b(token|authorization|password)\b\s*[:=]\s*[^,\s}\]]+/gi, "$1=[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .slice(0, 500);
}

function collectBrowserDiagnostics(page) {
  const errors = [];
  const add = (source, message) => {
    if (errors.length < 10) errors.push(`${source}: ${safeDiagnosticText(message)}`);
  };
  page.on("pageerror", (error) => add("pageerror", error?.message));
  page.on("console", (message) => {
    if (message.type() === "error") add("console", message.text());
  });
  return errors;
}

async function registrationUiState(page) {
  const inspect = async (selector) => {
    const locator = page.locator(selector);
    if (!await locator.count()) return null;
    return locator.evaluate((element) => ({
      text: String(element.textContent || "").trim(),
      className: String(element.className || ""),
      ariaHidden: element.getAttribute("aria-hidden"),
      visible: Boolean(element.getClientRects().length),
    })).catch(() => null);
  };
  let path = "";
  try { path = new URL(page.url()).pathname; } catch { path = "[unavailable]"; }
  return {
    path,
    modal: await inspect("#modal"),
    authError: await inspect("#auth-error"),
    userBadge: await inspect("#userBadge"),
    dashboard: await inspect("#btn-dashboard"),
  };
}

async function registrationOutcome(page, response, expectedUser, browserErrors) {
  const status = response.status();
  let payload = {};
  try { payload = await response.json(); } catch { /* response diagnostics below remain safe */ }
  if (!response.ok()) {
    const safeError = String(payload?.error || payload?.message || "no safe error message");
    if (/\b23505\b|duplicate key|username already exists/i.test(safeError)) {
      throw new Error(`Synthetic fixture collision for ${expectedUser.username}: registration returned HTTP ${status} (${safeError}). Use a new e2e run identity; do not remove the database uniqueness constraint.`);
    }
    throw new Error(`Synthetic owner registration failed with HTTP ${status}: ${safeError}`);
  }
  const responseShape = {
    status,
    hasUser: Boolean(payload?.user && typeof payload.user === "object"),
    hasToken: Boolean(String(payload?.token ?? "").trim()),
    username: String(payload?.user?.username ?? "").trim(),
    role: String(payload?.user?.role ?? "").trim(),
  };
  if (!responseShape.hasUser || !responseShape.hasToken || responseShape.username !== expectedUser.username || responseShape.role !== "owner") {
    throw new Error(`Synthetic owner registration returned an invalid success shape: ${JSON.stringify(responseShape)}`);
  }

  // `hideModal` completes after its transition, while `goToDashboard` changes
  // documents immediately. A correct owner navigation can therefore replace
  // index.html before that transition finalizes. Treat only that intended
  // owner destination as an alternative to an in-place modal close.
  try {
    await page.waitForFunction(() => {
      const modal = document.querySelector("#modal");
      const error = document.querySelector("#auth-error");
      const ownerDestination = /\/pages\/(owner-setup|business-owner)\.html$/.test(window.location.pathname);
      return ownerDestination || modal?.getAttribute("aria-hidden") === "true" || Boolean(error && !error.classList.contains("hidden") && error.textContent.trim());
    }, undefined, { timeout: 5000 });
  } catch {
    const ui = await registrationUiState(page);
    throw new Error(`Synthetic owner registration returned ${JSON.stringify(responseShape)}, but the authenticated UI did not transition within 5 seconds. state=${JSON.stringify(ui)} browserErrors=${JSON.stringify(browserErrors)}`);
  }
  const ui = await registrationUiState(page);
  const authError = String(ui.authError?.text ?? "").trim();
  const modalHidden = ui.modal?.ariaHidden;
  const ownerDestination = /\/pages\/(owner-setup|business-owner)\.html$/.test(ui.path);
  if (String(authError || "").trim()) {
    throw new Error(`Synthetic owner registration returned HTTP ${status} but the UI kept the modal open: ${authError}`);
  }
  if (!ownerDestination && modalHidden !== "true") {
    throw new Error(`Synthetic owner registration returned HTTP ${status}, but neither closed the modal nor reached the intended owner destination.`);
  }
  return { navigatedToOwnerDestination: ownerDestination };
}
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
  const browserErrors = collectBrowserDiagnostics(page);
  const tomorrow = new Date(Date.now() + 86400000);
  const bookingDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][tomorrow.getDay()];
  // The health guard above completes before this test can write any data.
  await page.goto(`${frontendUrl}/pages/index.html`);
  await page.locator("#btn-login").click();
  await page.locator("#show-register").click();
  await page.fill("#auth-username", identity.username);
  await page.fill("#auth-password", identity.password);
  await page.selectOption("#auth-role", "owner");
  const registrationResponse = page.waitForResponse((response) => (
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/api/auth/register")
  ));
  await page.getByRole("button", { name: "Continue" }).click();
  const registration = await registrationOutcome(page, await registrationResponse, identity, browserErrors);
  // Hosted registration can retain index.html while it applies authenticated
  // navigation state. Verify that state rather than treating any landing URL
  // as success, then use the real Dashboard entry point.
  if (!registration.navigatedToOwnerDestination) {
    await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#userBadge")).toContainText(identity.username);
    await expect(page.locator("#btn-dashboard")).toBeVisible();
    await page.locator("#btn-dashboard").click();
  }
  await expect(page).toHaveURL(/\/pages\/(owner-setup|business-owner)\.html/);
  await expect(page.locator("#userBadge")).toContainText(identity.username);
  const sessionUser = await page.evaluate(() => {
    const raw = sessionStorage.getItem("Slotzy_user");
    return raw ? JSON.parse(raw) : null;
  });
  expect(sessionUser).toMatchObject({ username: identity.username, role: "owner" });

  // A newly registered owner remains in the wizard until every required setup
  // step is complete. The ready-step Dashboard control is intentionally hidden
  // before then, so follow the real UI rather than accepting the hidden link.
  if (await page.locator("#setupShopName").count()) {
    await page.fill("#setupShopName", identity.shopName);
    await page.locator("#setupStep1Next").click();
    await expect(page.locator("#setupStep2Next")).toBeVisible();

    await page.fill("#setupOwnerDisplayName", identity.username);
    await page.locator("#setupStep2Next").click();
    await expect(page.locator("#setupServiceName")).toBeVisible();

    const setupServices = [
      { name: identity.serviceName, price: "30", duration: "30" },
      { name: `E2E Finish ${runId}`, price: "20", duration: "20" },
    ];
    for (const service of setupServices) {
      await expect(page.locator("#setupServiceBarber")).not.toHaveValue("");
      await page.fill("#setupServiceName", service.name);
      await page.fill("#setupServicePrice", service.price);
      await page.fill("#setupServiceDuration", service.duration);
      await page.locator("#setupAddServiceBtn").click();
      await expect(page.locator("#setupServiceList")).toContainText(service.name);
    }
    await page.locator("#setupStep3Next").click();
    await expect(page.locator("#setupStep4Next")).toBeVisible();

    const bookingDayEnabled = page.locator(`input[data-day="${bookingDay}"][data-field="enabled"]`);
    if (!await bookingDayEnabled.isChecked()) await bookingDayEnabled.check();
    await page.fill(`input[data-day="${bookingDay}"][data-field="start"]`, "09:00");
    await page.fill(`input[data-day="${bookingDay}"][data-field="end"]`, "17:00");
    await page.locator("#setupStep4Next").click();
    await expect(page.locator("#setupGoDashboard")).toBeVisible();
    await page.locator("#setupGoDashboard").click();
    await expect(page).toHaveURL(/\/pages\/business-owner\.html/);
  } else {
    await expect(page).toHaveURL(/\/pages\/business-owner\.html/);
    await expect(page.getByRole("heading", { name: /owner dashboard/i })).toBeVisible();
  }

  await page.goto(`${frontendUrl}/pages/manage-services.html`);
  await page.reload();
  await expect(page.getByText(identity.serviceName)).toBeVisible();

  await page.goto(`${frontendUrl}/pages/business-owner.html`);

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
