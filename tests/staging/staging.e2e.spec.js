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
const apiRunId = createSyntheticRunId();
const apiIdentity = {
  username: `${apiRunId}-owner`,
  password: "Synthetic-E2E-API-Only-123!",
  shopName: `E2E API Shop ${apiRunId}`,
  slug: `${apiRunId}-api-shop`,
  serviceNames: [`E2E API Cut ${apiRunId}`, `E2E API Finish ${apiRunId}`],
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

function safeRegistrationResponseMetadata(response, expectedApiOrigin) {
  const responseUrl = new URL(response.url());
  return {
    status: response.status(),
    statusText: response.statusText(),
    requestMethod: response.request().method(),
    responsePathname: responseUrl.pathname,
    responseOriginMatchesStagingApi: responseUrl.origin === expectedApiOrigin,
    contentType: String(response.headers()["content-type"] ?? "").split(";")[0],
  };
}

async function browserAuthState(page) {
  return page.evaluate(() => {
    const token = String(localStorage.getItem("Slotzy_auth_token") ?? "").trim();
    const rawUser = String(sessionStorage.getItem("Slotzy_user") ?? "").trim();
    let user = null;
    let userJsonValid = false;
    try {
      user = rawUser ? JSON.parse(rawUser) : null;
      userJsonValid = Boolean(user && typeof user === "object");
    } catch { /* report only safe absence/validity below */ }
    return {
      hasToken: Boolean(token),
      hasUser: Boolean(rawUser),
      userJsonValid,
      username: String(user?.username ?? "").trim(),
      role: String(user?.role ?? "").trim(),
    };
  });
}

async function servicesApiState(request, authToken, expectedName) {
  const endpoint = new URL("/api/services", apiUrl);
  const token = String(authToken ?? "").trim();
  const safeState = {
    status: 0,
    endpointPath: endpoint.pathname,
    serviceCount: 0,
    hasExpectedService: false,
    hasToken: Boolean(token),
  };
  if (!token) return safeState;

  try {
    const response = await request.get(endpoint.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    let payload = null;
    try { payload = await response.json(); } catch { /* safe shape below */ }
    const services = Array.isArray(payload?.services) ? payload.services : [];
    return {
      ...safeState,
      status: response.status(),
      serviceCount: services.length,
      hasExpectedService: services.some((service) => String(service?.name ?? service?.title ?? "").trim() === expectedName),
    };
  } catch (error) {
    return {
      ...safeState,
      errorName: String(error?.name ?? "Error"),
      errorMessage: safeDiagnosticText(error?.message ?? "service read failed"),
    };
  }
}

async function ownerShopApiState(request, authToken, expectedShopName) {
  const token = String(authToken ?? "").trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const [meResponse, shopsResponse] = await Promise.all([
    request.get(new URL("/api/auth/me", apiUrl).toString(), { headers }),
    request.get(new URL("/api/shops", apiUrl).toString(), { headers }),
  ]);
  let mePayload = null;
  let shopsPayload = null;
  try { mePayload = await meResponse.json(); } catch { /* safe shape below */ }
  try { shopsPayload = await shopsResponse.json(); } catch { /* safe shape below */ }
  const shops = Array.isArray(shopsPayload?.shops) ? shopsPayload.shops : [];
  return {
    hasToken: Boolean(token), authStatus: meResponse.status(), shopsStatus: shopsResponse.status(),
    authUserExists: Boolean(mePayload?.user),
    userHasShopId: Boolean(String(mePayload?.user?.shopId ?? "").trim()),
    ownerShopCount: shops.length,
    anySyntheticShopExists: shops.some((shop) => String(shop?.name ?? shop?.businessName ?? "").trim() === expectedShopName),
    anyShopHasSlug: shops.some((shop) => Boolean(String(shop?.slug ?? "").trim())),
  };
}

async function shopSaveResponseState(response, expectedShopName, inputState) {
  let payload = null;
  try { payload = await response.json(); } catch { /* safe shape below */ }
  const shop = payload?.shop && typeof payload.shop === "object" ? payload.shop : null;
  return {
    shopNameInputFilled: Boolean(inputState?.shopName),
    ownerProfileFieldPresent: Boolean(inputState?.ownerProfileFieldPresent),
    ownerProfileFilled: Boolean(inputState?.ownerProfileFilled),
    saveActionClicked: true,
    endpointPath: new URL(response.url()).pathname,
    status: response.status(),
    responseKeys: payload && typeof payload === "object" ? Object.keys(payload).sort() : [],
    shopKeys: shop ? Object.keys(shop).sort() : [],
    shopPresent: Boolean(shop), shopIdPresent: Boolean(String(shop?.id ?? "").trim()),
    syntheticShopNameMatches: String(shop?.name ?? shop?.businessName ?? "").trim() === expectedShopName,
  };
}

async function ownerSetupStep1Diagnostics(page, browserErrors) {
  const stepPanels = await page.locator("[data-step-panel]").evaluateAll((panels) => panels.map((panel) => ({
    stepId: panel.getAttribute("data-step-panel"),
    visible: Boolean(panel.getClientRects().length),
    label: String(panel.querySelector("h2")?.textContent || "").trim(),
  }))).catch(() => []);
  const buttons = await page.locator("[data-step-panel='1'] button").evaluateAll((controls) => controls.map((button) => ({
    visible: Boolean(button.getClientRects().length),
    enabled: !button.disabled,
    text: safeDiagnosticText(button.textContent || ""),
  }))).catch(() => []);
  const validationMessages = await page.locator("#setupShopStatus, #setupStatus").evaluateAll((elements) => elements
    .filter((element) => Boolean(element.getClientRects().length) && String(element.textContent || "").trim())
    .map((element) => safeDiagnosticText(element.textContent || ""))).catch(() => []);
  let path = "[unavailable]";
  try { path = new URL(page.url()).pathname; } catch { /* retain safe fallback */ }
  return {
    currentPath: path,
    activeStep: stepPanels.find((panel) => panel.visible) || null,
    shopNameInputFilled: Boolean(String(await page.locator("#setupShopName").inputValue().catch(() => "")).trim()),
    ownerDisplayNameFilled: Boolean(String(await page.locator("#setupOwnerDisplayName").inputValue().catch(() => "")).trim()),
    step1ButtonCount: buttons.length,
    step1Buttons: buttons,
    validationMessagesVisible: validationMessages.length > 0,
    validationMessages,
    browserErrors: browserErrors.map((error) => safeDiagnosticText(error)),
  };
}

async function dashboardBookingLinkDiagnostics(page, request, authToken) {
  const anchors = await page.locator("a").evaluateAll((elements) => elements.map((anchor) => {
    const href = String(anchor.getAttribute("href") || "");
    if (!/book|public|booking/i.test(href)) return null;
    try {
      const url = new URL(href, window.location.href);
      return { path: url.pathname, hasQuery: Boolean(url.search) };
    } catch {
      return { path: "[unparseable]", hasQuery: false };
    }
  }).filter(Boolean)).catch(() => []);
  const controls = await page.locator("button, input").evaluateAll((elements) => elements
    .filter((element) => /copy|share|open.*booking|booking.*link/i.test(String(element.textContent || "") + " " + String(element.getAttribute("aria-label") || "") + " " + String(element.id || "")))
    .map((element) => ({ id: String(element.id || ""), visible: Boolean(element.getClientRects().length), enabled: !element.disabled }))).catch(() => []);
  const pageState = await page.evaluate(() => {
    const input = document.getElementById("pilotBookingLink");
    const banner = document.getElementById("pilotModeBanner");
    const badge = document.getElementById("userBadge");
    const hero = document.getElementById("ownerHeroTitle");
    let localShopHasSlug = false;
    try {
      const shops = JSON.parse(localStorage.getItem("Slotzy_shops") || "[]");
      localShopHasSlug = Array.isArray(shops) && shops.some((shop) => Boolean(String(shop?.slug || "").trim()));
    } catch { /* report safe false */ }
    const badgeText = String(badge?.textContent || "").trim();
    return {
      currentPath: window.location.pathname,
      dashboardLoaded: Boolean(hero?.getClientRects().length),
      userBadgeText: /e2e-/i.test(badgeText) ? badgeText : "[not-synthetic-or-unavailable]",
      pilotBannerVisible: Boolean(banner?.getClientRects().length),
      bookingLinkInputVisible: Boolean(input?.getClientRects().length),
      bookingLinkValuePresent: Boolean(String(input?.value || "").trim()),
      bookingLinkPath: (() => {
        try { return new URL(String(input?.value || ""), window.location.href).pathname; } catch { return ""; }
      })(),
      bookingLinkHasShopQuery: (() => {
        try { return new URL(String(input?.value || ""), window.location.href).searchParams.has("shop"); } catch { return false; }
      })(),
      localShopHasSlug,
      visibleSafeHeadings: Array.from(document.querySelectorAll("h1, h2, h3"))
        .filter((heading) => Boolean(heading.getClientRects().length))
        .map((heading) => String(heading.textContent || "").trim())
        .filter((text) => ["Owner Dashboard", "Today at a Glance", "Insights", "Services", "Bookings", "Availability", "Reports", "Pilot Mode"].includes(text)),
    };
  }).catch(() => ({ currentPath: "[unavailable]", dashboardLoaded: false }));
  const apiState = await ownerShopApiState(request, authToken, "").catch(() => null);
  return {
    ...pageState,
    anchorCount: await page.locator("a").count().catch(() => 0),
    bookingRelatedAnchorHrefs: anchors,
    bookingRelatedControls: controls,
    apiShopSlugPresent: Boolean(apiState?.ownerShopCount && apiState?.anyShopHasSlug),
  };
}

async function selectSyntheticBarber(publicPage, syntheticUsername) {
  const barberSelect = publicPage.locator("#barberSelect");
  await expect(barberSelect).not.toBeDisabled();
  const options = await barberSelect.locator("option").evaluateAll((elements) => elements.map((option) => ({
    value: String(option.value || ""),
    label: String(option.textContent || "").trim(),
  })));
  const target = String(syntheticUsername ?? "").trim().toLowerCase();
  const matchingOption = options.find((option) => option.value && option.label.toLowerCase().includes(target));
  const selectionDiagnostics = async () => {
    const controlState = await barberSelect.evaluate((select) => ({
      visible: Boolean(select.getClientRects().length),
      enabled: !select.disabled,
    })).catch(() => ({ visible: false, enabled: false }));
    const visibleProviderControls = await publicPage.locator("button, [role='option'], [data-provider], [data-barber]").evaluateAll((elements) => elements
      .filter((element) => Boolean(element.getClientRects().length))
      .map((element) => String(element.textContent || "").trim())
      .filter((text) => /^e2e-/i.test(text))).catch(() => []);
    const url = new URL(publicPage.url());
    const isSyntheticBookingUrl = /^e2e-/i.test(String(url.searchParams.get("shop") || ""));
    return {
      barberSelectVisible: controlState.visible,
      barberSelectEnabled: controlState.enabled,
      optionCount: options.length,
      syntheticProviderMatchFound: Boolean(matchingOption),
      visibleSyntheticProviderControls: visibleProviderControls,
      currentPublicBookingUrl: isSyntheticBookingUrl ? publicPage.url() : "[non-synthetic-or-unavailable]",
    };
  };
  if (!matchingOption) {
    throw new Error(`Public booking synthetic barber option was not found: ${JSON.stringify({
      ...await selectionDiagnostics(),
      visibleSyntheticOptionLabels: options.map((option) => option.label).filter((label) => /^e2e-/i.test(label)),
    })}`);
  }
  const controlState = await barberSelect.evaluate((select) => ({
    visible: Boolean(select.getClientRects().length),
    value: String(select.value || ""),
  }));
  try {
    if (controlState.visible) {
      await barberSelect.selectOption(matchingOption.value);
    } else {
      // The booking engine intentionally hides the native selector when this
      // shop has one provider and auto-selects it. Confirm/set that state and
      // dispatch the normal change event so dependent services render.
      const applied = await publicPage.evaluate((value) => {
        const select = document.getElementById("barberSelect");
        if (!(select instanceof HTMLSelectElement)) return false;
        select.value = value;
        if (select.value !== value) return false;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, matchingOption.value);
      expect(applied).toBe(true);
    }
    await expect(barberSelect).toHaveValue(matchingOption.value);
    await expect(publicPage.locator("#serviceSelect")).not.toBeDisabled();
  } catch (error) {
    throw new Error(`Public booking provider selection failed: ${JSON.stringify({ ...await selectionDiagnostics(), selectionError: safeDiagnosticText(error?.message) })}`);
  }
}

async function selectSyntheticService(publicPage, expectedServiceName) {
  const serviceSelect = publicPage.locator("#serviceSelect");
  const expectedName = String(expectedServiceName ?? "").trim();
  const readOptions = () => serviceSelect.locator("option").evaluateAll((elements) => elements.map((option) => ({
    value: String(option.value || ""),
    label: String(option.textContent || "").trim(),
    serviceName: String(option.dataset.serviceName || "").trim(),
  })));
  await expect(serviceSelect).not.toBeDisabled();
  const preSelectionOptions = await readOptions();
  const preSelectionDiagnostics = {
    expectedSyntheticServiceName: expectedName,
    selectedProviderValue: String(await publicPage.locator("#barberSelect").inputValue().catch(() => "")),
    serviceSelectVisible: Boolean(await serviceSelect.evaluate((select) => select.getClientRects().length).catch(() => false)),
    serviceSelectEnabled: Boolean(await serviceSelect.isEnabled().catch(() => false)),
    optionCount: preSelectionOptions.length,
    visibleSyntheticOptionLabels: preSelectionOptions.map((option) => option.label).filter((label) => /^e2e /i.test(label)),
    expectedServiceLabelExists: preSelectionOptions.some((option) => option.serviceName === expectedName || option.label.startsWith(`${expectedName} - `)),
  };
  try {
    await publicPage.waitForFunction((name) => Array.from(document.querySelectorAll("#serviceSelect option"))
      .some((option) => option.value && (option.dataset.serviceName === name || option.textContent.trim().startsWith(`${name} - `))), expectedName);
  } catch (error) {
    const options = await readOptions().catch(() => []);
    const url = new URL(publicPage.url());
    const isSyntheticBookingUrl = /^e2e-/i.test(String(url.searchParams.get("shop") || ""));
    throw new Error(`Public booking synthetic service option was not found: ${JSON.stringify({
      currentPublicBookingUrl: isSyntheticBookingUrl ? publicPage.url() : "[non-synthetic-or-unavailable]",
      preSelectionDiagnostics,
      currentSelectedProviderValue: String(await publicPage.locator("#barberSelect").inputValue().catch(() => "")),
      currentServiceSelectVisible: Boolean(await serviceSelect.evaluate((select) => select.getClientRects().length).catch(() => false)),
      currentServiceSelectEnabled: Boolean(await serviceSelect.isEnabled().catch(() => false)),
      currentOptionCount: options.length,
      visibleSyntheticOptionLabels: options.map((option) => option.label).filter((label) => /^e2e /i.test(label)),
      expectedSyntheticServiceName: expectedName,
      currentExpectedServiceLabelExists: options.some((option) => option.serviceName === expectedName || option.label.startsWith(`${expectedName} - `)),
      publicBookingServiceApi: "not-requested; public-book.js uses hydrated browser service cache",
      waitError: safeDiagnosticText(error?.message),
    })}`);
  }
  const options = await readOptions();
  const matchingOption = options.find((option) => option.value && (option.serviceName === expectedName || option.label.startsWith(`${expectedName} - `)));
  expect(Boolean(matchingOption)).toBe(true);
  await serviceSelect.selectOption(matchingOption.value);
  await expect(serviceSelect).toHaveValue(matchingOption.value);
}

async function managePageDiagnostics(managePage, expectedClientName, expectedServiceName, bookingsResponse) {
  let responsePayload = null;
  try { responsePayload = bookingsResponse ? await bookingsResponse.json() : null; } catch { /* keys remain unavailable */ }
  return managePage.evaluate(({ clientName, serviceName, api }) => {
    const url = new URL(window.location.href);
    const visibleText = Array.from(document.querySelectorAll("body *"))
      .filter((element) => element.children.length === 0 && Boolean(element.getClientRects().length))
      .map((element) => String(element.textContent || "").trim())
      .filter((text) => /^e2e /i.test(text));
    const text = String(document.body?.textContent || "");
    return {
      managePath: url.pathname,
      manageQueryKeys: Array.from(url.searchParams.keys()).sort(),
      visibleHeadings: Array.from(document.querySelectorAll("h1, h2, h3"))
        .filter((heading) => Boolean(heading.getClientRects().length))
        .map((heading) => String(heading.textContent || "").trim())
        .filter((heading) => ["Manage Appointments", "My Appointments", "Upcoming", "Past"].includes(heading)),
      visibleSyntheticE2EText: visibleText,
      clientNameAppearsInText: text.includes(clientName),
      serviceNameAppearsInText: text.includes(serviceName),
      dateTimeAppears: Boolean(document.querySelector(".appointment-datetime span")),
      cancelButtonExists: Boolean(Array.from(document.querySelectorAll("button")).find((button) => /^Cancel$/i.test(String(button.textContent || "").trim()))),
      appointmentCardCount: document.querySelectorAll(".client-manage-card").length,
      statusBadgeTexts: Array.from(document.querySelectorAll(".client-manage-card .appointment-actions .badge"))
        .map((badge) => String(badge.textContent || "").trim()),
      cancelButtons: Array.from(document.querySelectorAll(".client-manage-card button"))
        .filter((button) => /^Cancel$/i.test(String(button.textContent || "").trim()))
        .map((button) => ({ visible: Boolean(button.getClientRects().length), enabled: !button.disabled })),
      manageBookingsApi: api,
    };
  }, {
    clientName: expectedClientName,
    serviceName: expectedServiceName,
    api: bookingsResponse ? {
      status: bookingsResponse.status(),
      responseKeys: responsePayload && typeof responsePayload === "object" ? Object.keys(responsePayload).sort() : [],
    } : { status: 0, responseKeys: [] },
  });
}

async function visibleSyntheticServiceTexts(page) {
  return page.locator("#serviceList .owner-service-card h3").allTextContents()
    .then((values) => values.map((value) => String(value).trim()).filter((value) => /^E2E /i.test(value)))
    .catch(() => []);
}

async function serviceCreateResponseState(response, expectedName, inputState) {
  let payload = null;
  let responseJsonParsed = false;
  try {
    payload = await response.json();
    responseJsonParsed = Boolean(payload && typeof payload === "object");
  } catch { /* service creation does not navigate; report shape safely below */ }
  const createdName = String(payload?.service?.name ?? payload?.service?.title ?? "").trim();
  return {
    inputsFilled: Boolean(inputState?.name && inputState?.price && inputState?.duration),
    saveActionClicked: true,
    endpointPath: new URL(response.url()).pathname,
    status: response.status(),
    responseJsonParsed,
    responseKeys: responseJsonParsed ? Object.keys(payload).sort() : [],
    serviceKeys: payload?.service && typeof payload.service === "object" ? Object.keys(payload.service).sort() : [],
    hasCreatedService: Boolean(payload?.service && typeof payload.service === "object"),
    createdServiceIdPresent: Boolean(String(payload?.service?.id ?? "").trim()),
    createdSyntheticServiceMatches: createdName === expectedName,
  };
}

async function requireSetupServices(request, authToken, expectedNames, checkpoint, page) {
  const states = [];
  for (const name of expectedNames) states.push(await servicesApiState(request, authToken, name));
  const first = states[0] ?? { status: 0, serviceCount: 0, hasToken: Boolean(authToken) };
  const allPresent = states.length === expectedNames.length && states.every((state) => state.status === 200 && state.hasExpectedService);
  if (!allPresent || first.serviceCount < expectedNames.length) {
    throw new Error(`Owner setup services failed persistence checkpoint: ${JSON.stringify({ checkpoint, endpointPath: first.endpointPath, status: first.status, serviceCount: first.serviceCount, hasToken: first.hasToken, expectedSyntheticServices: expectedNames, expectedServicesPresent: states.map((state, index) => ({ name: expectedNames[index], present: state.hasExpectedService })), currentPath: new URL(page.url()).pathname })}`);
  }
  return { status: first.status, serviceCount: first.serviceCount, hasToken: first.hasToken };
}

async function registrationOutcome(page, response, expectedUser, browserErrors, expectedApiOrigin) {
  const responseMetadata = safeRegistrationResponseMetadata(response, expectedApiOrigin);
  if (responseMetadata.requestMethod !== "POST" || responseMetadata.responsePathname !== "/api/auth/register" || !responseMetadata.responseOriginMatchesStagingApi) {
    throw new Error(`Staging E2E captured an unexpected registration response: ${JSON.stringify(responseMetadata)}`);
  }
  if (responseMetadata.status !== 201) {
    await page.locator("#auth-error").waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
    const ui = await registrationUiState(page);
    throw new Error(`Synthetic owner registration returned HTTP ${responseMetadata.status} (${responseMetadata.statusText}). response=${JSON.stringify(responseMetadata)} authError=${safeDiagnosticText(ui.authError?.text)} browserErrors=${JSON.stringify(browserErrors)}`);
  }
  try {
    await page.waitForFunction((username) => {
      const token = String(localStorage.getItem("Slotzy_auth_token") ?? "").trim();
      const rawUser = String(sessionStorage.getItem("Slotzy_user") ?? "").trim();
      try {
        const user = rawUser ? JSON.parse(rawUser) : null;
        return Boolean(token) && user?.username === username && user?.role === "owner";
      } catch {
        return false;
      }
    }, expectedUser.username, { timeout: 5000 });
  } catch {
    const authState = await browserAuthState(page);
    const ui = await registrationUiState(page);
    throw new Error(`Synthetic owner registration returned HTTP 201, but frontend auth state was not established. authState=${JSON.stringify(authState)} path=${ui.path} userBadge=${safeDiagnosticText(ui.userBadge?.text)} browserErrors=${JSON.stringify(browserErrors)}`);
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
    throw new Error(`Synthetic owner registration established session state, but the authenticated UI did not transition within 5 seconds. state=${JSON.stringify(ui)} browserErrors=${JSON.stringify(browserErrors)}`);
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

test("focused staging owner setup API chain", async ({ request }) => {
  const endpoint = (path) => new URL(path, apiUrl).toString();
  const safeResponse = (response, payload = null) => ({
    endpointPath: new URL(response.url()).pathname,
    status: response.status(),
    responseKeys: payload && typeof payload === "object" ? Object.keys(payload).sort() : [],
  });
  const readJson = async (response) => {
    try { return await response.json(); } catch { return null; }
  };
  const failStage = (stage, message, diagnostic) => {
    throw new Error(`Focused staging owner setup API chain ${stage}: ${message}. ${JSON.stringify(diagnostic)}`);
  };

  // A. Registration establishes the bearer credential used only in request
  // headers below. Its value is never included in diagnostics or assertions.
  const registerResponse = await request.post(endpoint("/api/auth/register"), {
    data: { username: apiIdentity.username, password: apiIdentity.password, role: "owner" },
  });
  const registerPayload = await readJson(registerResponse);
  const token = String(registerPayload?.token ?? "").trim();
  const registerDiagnostic = {
    ...safeResponse(registerResponse, registerPayload),
    hasToken: Boolean(token),
    hasUser: Boolean(registerPayload?.user),
    usernameMatches: registerPayload?.user?.username === apiIdentity.username,
    roleIsOwner: registerPayload?.user?.role === "owner",
  };
  if (registerResponse.status() !== 201 || !token || !registerDiagnostic.usernameMatches || !registerDiagnostic.roleIsOwner) {
    failStage("A", "registration failed", registerDiagnostic);
  }
  const headers = { Authorization: `Bearer ${token}` };

  // B. Match the authoritative payload emitted by owner setup's shop
  // collection helper (the client-only id is intentionally not sent).
  const shopResponse = await request.post(endpoint("/api/shops"), {
    headers,
    data: {
      name: apiIdentity.shopName,
      businessName: apiIdentity.shopName,
      slug: apiIdentity.slug,
      logoDataUrl: null,
      bookingPolicy: { allowSameDay: true, maxDaysAdvance: 30, cancelHours: 24, bufferMinutes: 0, requireDeposit: false, depositAmount: 0, lateGraceMinutes: 10, noShowStrikeLimit: 2, reminder24Hours: true, reminder2Hours: true, reminderCustomEnabled: false, reminderCustomMinutes: 60 },
    },
  });
  const shopPayload = await readJson(shopResponse);
  const shopId = String(shopPayload?.shop?.id ?? "").trim();
  const shopDiagnostic = {
    ...safeResponse(shopResponse, shopPayload),
    shopKeys: shopPayload?.shop && typeof shopPayload.shop === "object" ? Object.keys(shopPayload.shop).sort() : [],
    hasShop: Boolean(shopPayload?.shop), hasShopId: Boolean(shopId),
    syntheticNameMatches: shopPayload?.shop?.name === apiIdentity.shopName,
  };
  if (shopResponse.status() !== 201 || !shopId || !shopDiagnostic.syntheticNameMatches) {
    failStage("B", "shop create/link failed", shopDiagnostic);
  }

  // C. Re-read through auth middleware rather than trusting the create body.
  const meResponse = await request.get(endpoint("/api/auth/me"), { headers });
  const mePayload = await readJson(meResponse);
  const meDiagnostic = {
    ...safeResponse(meResponse, mePayload),
    hasUser: Boolean(mePayload?.user),
    userHasShopId: Boolean(String(mePayload?.user?.shopId ?? "").trim()),
  };
  if (meResponse.status() !== 200 || !meDiagnostic.hasUser || !meDiagnostic.userHasShopId) {
    failStage("C", "auth/me lacks shop linkage", meDiagnostic);
  }

  // D. Create both services independently, preserving the route contract.
  for (const [index, serviceName] of apiIdentity.serviceNames.entries()) {
    const serviceResponse = await request.post(endpoint("/api/services"), {
      headers,
      data: { name: serviceName, title: serviceName, price: index === 0 ? 30 : 20, durationMinutes: index === 0 ? 30 : 20, duration: index === 0 ? 30 : 20, active: true, shopId, barberUsername: apiIdentity.username, ownerUsername: apiIdentity.username },
    });
    const servicePayload = await readJson(serviceResponse);
    const serviceDiagnostic = {
      ...safeResponse(serviceResponse, servicePayload),
      serviceKeys: servicePayload?.service && typeof servicePayload.service === "object" ? Object.keys(servicePayload.service).sort() : [],
      hasServiceId: Boolean(String(servicePayload?.service?.id ?? "").trim()),
      syntheticNameMatches: servicePayload?.service?.name === serviceName,
    };
    if (serviceResponse.status() !== 201 || !serviceDiagnostic.hasServiceId || !serviceDiagnostic.syntheticNameMatches) {
      failStage("D", "service POST failed", { serviceNumber: index + 1, ...serviceDiagnostic });
    }
  }

  const readServices = async (stage) => {
    const response = await request.get(endpoint("/api/services"), { headers });
    const payload = await readJson(response);
    const services = Array.isArray(payload?.services) ? payload.services : [];
    const diagnostic = {
      ...safeResponse(response, payload), serviceCount: services.length,
      expectedServicesPresent: apiIdentity.serviceNames.map((name) => ({ name, present: services.some((service) => service?.name === name) })),
    };
    if (response.status() !== 200 || services.length < 2 || diagnostic.expectedServicesPresent.some((entry) => !entry.present)) {
      failStage(stage, stage === "E" ? "services created but GET /api/services did not return both" : "availability/setup snapshot detached services", diagnostic);
    }
  };
  await readServices("E");

  // F. Match the minimal availability write performed by owner setup.
  const weekly = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day, index) => [day, { enabled: index === 1, start: "09:00", end: "17:00" }]));
  const availabilityResponse = await request.put(endpoint("/api/availability"), {
    headers,
    data: { barberUsername: apiIdentity.username, availability: { timezone: "America/Chicago", bufferMinutes: 0, weekly, timeOff: [] } },
  });
  if (availabilityResponse.status() !== 200) {
    failStage("F", "availability/setup write failed", safeResponse(availabilityResponse, await readJson(availabilityResponse)));
  }
  await readServices("F");
  // Reaching here classifies the authoritative API chain as G; the browser
  // lifecycle test that follows remains responsible for the real wizard/UI.
});

test("synthetic staging owner-to-customer booking lifecycle", async ({ page, context, request }) => {
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
  const expectedApiOrigin = requireStagingUrl(apiUrl, "SLOTZY_STAGING_API_URL").origin;
  const registrationResponse = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/auth/register"
  ));
  await page.getByRole("button", { name: "Continue" }).click();
  const registration = await registrationOutcome(page, await registrationResponse, identity, browserErrors, expectedApiOrigin);
  // Hosted registration can retain index.html while it applies authenticated
  // navigation state. Verify that state rather than treating any landing URL
  // as success, then use the real Dashboard entry point.
  if (!registration.navigatedToOwnerDestination) {
    await expect(page.locator("#modal")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#userBadge")).toContainText(identity.username);
    await expect(page.locator("#btn-dashboard")).toBeVisible();
    await page.locator("#btn-dashboard").click();
  }
  // Registration first sends staff to business-owner.html. Its asynchronous
  // setup guard must then route this brand-new owner to owner-setup.html. Do
  // not inspect the transient dashboard and accidentally skip the wizard.
  await expect(page).toHaveURL(/\/pages\/owner-setup\.html/);
  await expect(page.locator("#userBadge")).toContainText(identity.username);
  const sessionUser = await page.evaluate(() => {
    const raw = sessionStorage.getItem("Slotzy_user");
    return raw ? JSON.parse(raw) : null;
  });
  expect(sessionUser).toMatchObject({ username: identity.username, role: "owner" });
  // Read the token once while the authenticated owner page is stable. All
  // service contract checks then run in Playwright's request context, so a UI
  // redirect/reload cannot destroy their JavaScript execution context.
  const authToken = await page.evaluate(() => String(localStorage.getItem("Slotzy_auth_token") ?? "").trim());
  expect(Boolean(authToken)).toBe(true);

  // A newly registered owner remains in the wizard until every required setup
  // step is complete. The ready-step Dashboard control is intentionally hidden
  // before then, so follow the real UI rather than accepting the hidden link.
  await expect(page.locator("#setupShopName")).toBeVisible();
  // The field is present in the static HTML. Wait for initSetupWizard() to
  // render Step 1 before filling it, otherwise applySetupStatus() can restore
  // the initial empty value after this test's fill and validation blocks save.
  await expect(page.locator("#setupIntroText")).toHaveText("Set the shop name and branding clients will recognize on your public booking page.");
  {
    await page.fill("#setupShopName", identity.shopName);
    const shopInputState = {
      shopName: await page.locator("#setupShopName").inputValue() === identity.shopName,
      ownerProfileFieldPresent: Boolean(await page.locator("#setupOwnerDisplayName").count()),
      ownerProfileFilled: Boolean(String(await page.locator("#setupOwnerDisplayName").inputValue().catch(() => "")).trim()),
    };
    const step1Diagnostics = await ownerSetupStep1Diagnostics(page, browserErrors);
    const shopSaveResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).origin === expectedApiOrigin
      && new URL(response.url()).pathname === "/api/shops"
    ));
    await page.locator("#setupStep1Next").click();
    let shopSave;
    try {
      shopSave = await shopSaveResponse;
    } catch (error) {
      throw new Error(`Owner setup Step 1 did not observe POST /api/shops: ${JSON.stringify({ ...step1Diagnostics, waitError: safeDiagnosticText(error?.message) })}`);
    }
    const shopCreation = await shopSaveResponseState(shopSave, identity.shopName, shopInputState);
    const ownerShopState = await ownerShopApiState(request, authToken, identity.shopName);
    if (shopCreation.status !== 201 || !shopCreation.shopPresent || !shopCreation.shopIdPresent || !shopCreation.syntheticShopNameMatches || ownerShopState.authStatus !== 200 || ownerShopState.shopsStatus !== 200 || !ownerShopState.authUserExists || !ownerShopState.userHasShopId || ownerShopState.ownerShopCount < 1 || !ownerShopState.anySyntheticShopExists) {
      throw new Error(`Owner setup Step 1 did not create and link the synthetic shop: ${JSON.stringify({ ...shopCreation, ...ownerShopState, currentPath: new URL(page.url()).pathname })}`);
    }
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
      const inputState = {
        name: await page.locator("#setupServiceName").inputValue() === service.name,
        price: await page.locator("#setupServicePrice").inputValue() === service.price,
        duration: await page.locator("#setupServiceDuration").inputValue() === service.duration,
      };
      const serviceSaveResponse = page.waitForResponse((response) => (
        response.request().method() === "POST"
        && new URL(response.url()).origin === expectedApiOrigin
        && new URL(response.url()).pathname === "/api/services"
      ));
      await page.locator("#setupAddServiceBtn").click();
      const serviceSave = await serviceSaveResponse;
      const serviceCreation = await serviceCreateResponseState(serviceSave, service.name, inputState);
      if (serviceCreation.status !== 201 || !serviceCreation.hasCreatedService || !serviceCreation.createdSyntheticServiceMatches) {
        throw new Error(`Owner setup service save failed: ${JSON.stringify(serviceCreation)}`);
      }
      await expect(page.locator("#setupServiceList")).toContainText(service.name);
      const persisted = await servicesApiState(request, authToken, service.name);
      if (persisted.status !== 200 || !persisted.hasExpectedService) {
        throw new Error(`Owner setup service was not present in the authenticated service read: ${JSON.stringify({ ...serviceCreation, ...persisted, currentPath: new URL(page.url()).pathname })}`);
      }
    }
    const setupServiceNames = setupServices.map((service) => service.name);
    await requireSetupServices(request, authToken, setupServiceNames, "after-both-service-saves", page);
    await page.locator("#setupStep3Next").click();
    await expect(page.locator("#setupStep4Next")).toBeVisible();

    const bookingDayEnabled = page.locator(`input[data-day="${bookingDay}"][data-field="enabled"]`);
    if (!await bookingDayEnabled.isChecked()) await bookingDayEnabled.check();
    await page.fill(`input[data-day="${bookingDay}"][data-field="start"]`, "09:00");
    await page.fill(`input[data-day="${bookingDay}"][data-field="end"]`, "17:00");
    const availabilitySaveResponse = page.waitForResponse((response) => (
      response.request().method() === "PUT"
      && new URL(response.url()).origin === expectedApiOrigin
      && new URL(response.url()).pathname === "/api/availability"
    ));
    await page.locator("#setupStep4Next").click();
    const availabilitySave = await availabilitySaveResponse;
    let availabilityPayload = null;
    try { availabilityPayload = await availabilitySave.json(); } catch { /* safe shape below */ }
    const availabilityDiagnostic = {
      endpointPath: new URL(availabilitySave.url()).pathname,
      method: availabilitySave.request().method(),
      status: availabilitySave.status(),
      responseKeys: availabilityPayload && typeof availabilityPayload === "object" ? Object.keys(availabilityPayload).sort() : [],
    };
    if (availabilitySave.status() !== 200) {
      throw new Error(`Owner setup availability save failed: ${JSON.stringify({ ...availabilityDiagnostic, currentPath: new URL(page.url()).pathname })}`);
    }
    await expect(page.locator("#setupGoDashboard")).toBeVisible();
    await requireSetupServices(request, authToken, setupServiceNames, "after-availability-and-setup-completion", page);
    await page.locator("#setupGoDashboard").click();
    await expect(page).toHaveURL(/\/pages\/business-owner\.html/);
    await requireSetupServices(request, authToken, setupServiceNames, "after-dashboard-navigation", page);
  }

  await page.goto(`${frontendUrl}/pages/manage-services.html`);
  const serviceReloadResponse = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/services"
  ));
  await page.reload();
  const serviceReload = await serviceReloadResponse;
  const persistedAfterReload = await servicesApiState(request, authToken, identity.serviceName);
  if (serviceReload.status() !== 200 || persistedAfterReload.status !== 200 || !persistedAfterReload.hasExpectedService) {
    throw new Error(`Persisted service was unavailable after manage-services reload: ${JSON.stringify({ loadStatus: serviceReload.status(), ...persistedAfterReload, currentPath: new URL(page.url()).pathname, visibleSyntheticServices: await visibleSyntheticServiceTexts(page) })}`);
  }
  try {
    await expect(page.getByRole("heading", { name: identity.serviceName, exact: true })).toBeVisible();
  } catch {
    throw new Error(`Persisted service was returned by the API but not rendered after reload: ${JSON.stringify({ ...persistedAfterReload, currentPath: new URL(page.url()).pathname, visibleSyntheticServices: await visibleSyntheticServiceTexts(page) })}`);
  }

  await page.goto(`${frontendUrl}/pages/business-owner.html`);
  const dashboardDiagnostics = await dashboardBookingLinkDiagnostics(page, request, authToken);
  const bookingLinkInput = page.locator("#pilotBookingLink");
  try {
    await expect(bookingLinkInput).toBeVisible();
    await expect(bookingLinkInput).toHaveValue(/\/pages\/book\.html\?shop=.+/);
    await expect(page.locator("#pilotCopyBookingBtn")).toBeVisible();
    await expect(page.locator("#pilotOpenBookingBtn")).toBeVisible();
  } catch (error) {
    throw new Error(`Owner dashboard did not expose its public booking URL: ${JSON.stringify({ ...dashboardDiagnostics, assertionError: safeDiagnosticText(error?.message) })}`);
  }
  const bookingLink = await bookingLinkInput.inputValue();
  const publicPage = await context.newPage();
  await publicPage.goto(bookingLink);
  await selectSyntheticBarber(publicPage, identity.username);
  await selectSyntheticService(publicPage, identity.serviceName);
  await publicPage.locator("#bookingDate").fill(tomorrow.toISOString().slice(0, 10));
  const slot = publicPage.locator("#time-slot-select option[value]:not([value=''])").first();
  await expect(slot).toBeAttached();
  await publicPage.selectOption("#time-slot-select", await slot.getAttribute("value"));
  await publicPage.fill("#clientName", identity.clientName);
  await publicPage.fill("#clientContact", identity.clientEmail);
  const bookingSaveResponse = publicPage.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/bookings"
  ));
  await publicPage.getByRole("button", { name: /book|confirm/i }).click();
  const bookingSave = await bookingSaveResponse;
  let bookingPayload = null;
  try { bookingPayload = await bookingSave.json(); } catch { /* safe response shape below */ }
  const bookingReceipt = publicPage.locator("#bookingReceiptTitle");
  await expect(bookingReceipt).toBeVisible();
  const manageLink = await publicPage.locator("#bookingReceiptManageLink").getAttribute("href");
  const receiptState = {
    bookingStatus: bookingSave.status(),
    bookingResponseKeys: bookingPayload && typeof bookingPayload === "object" ? Object.keys(bookingPayload).sort() : [],
    receiptDisplayed: await bookingReceipt.isVisible(),
    manageLinkExists: Boolean(manageLink),
    manageLinkPath: (() => { try { return new URL(String(manageLink || ""), publicPage.url()).pathname; } catch { return ""; } })(),
    manageLinkQueryKeys: (() => { try { return Array.from(new URL(String(manageLink || ""), publicPage.url()).searchParams.keys()).sort(); } catch { return []; } })(),
    syntheticClientVisibleOnReceipt: await publicPage.getByText(identity.clientName, { exact: true }).isVisible().catch(() => false),
    syntheticServiceVisibleOnReceipt: await publicPage.getByText(identity.serviceName, { exact: true }).isVisible().catch(() => false),
  };
  if (bookingSave.status() !== 201 || !receiptState.manageLinkExists || !receiptState.syntheticClientVisibleOnReceipt || !receiptState.syntheticServiceVisibleOnReceipt) {
    throw new Error(`Public booking did not create a verifiable receipt/manage link: ${JSON.stringify(receiptState)}`);
  }

  await page.goto(`${frontendUrl}/pages/manage-appointments.html`);
  await expect(page.getByText(identity.clientName)).toBeVisible();
  const managePage = await context.newPage();
  const manageBookingsResponse = managePage.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/bookings"
  ));
  await managePage.goto(new URL(manageLink, frontendUrl).toString());
  const manageBookings = await manageBookingsResponse;
  try {
    await expect(managePage.getByText(identity.serviceName, { exact: true })).toBeVisible();
    await expect(managePage.locator(".appointment-datetime span").first()).toBeVisible();
    await expect(managePage.getByRole("button", { name: /^Cancel$/i })).toBeVisible();
  } catch (error) {
    throw new Error(`Manage link did not render the booked appointment: ${JSON.stringify({ receiptState, manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, manageBookings), assertionError: safeDiagnosticText(error?.message) })}`);
  }
  await managePage.getByRole("button", { name: /^Cancel$/i }).click();
  await managePage.getByRole("button", { name: /confirm cancel/i }).click();
  const cancelledCard = managePage.locator(".client-manage-card").filter({
    has: managePage.getByText(identity.serviceName, { exact: true }),
  });
  try {
    await expect(cancelledCard).toHaveCount(1);
    await expect(cancelledCard.locator(".appointment-actions .badge")).toHaveText("Cancelled");
    await expect(cancelledCard.getByRole("button", { name: /^Cancel$/i })).toHaveCount(0);
  } catch (error) {
    throw new Error(`Manage page did not reflect cancellation for the synthetic appointment: ${JSON.stringify({ manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null), assertionError: safeDiagnosticText(error?.message) })}`);
  }
  await managePage.reload();
  const reloadedCancelledCard = managePage.locator(".client-manage-card").filter({
    has: managePage.getByText(identity.serviceName, { exact: true }),
  });
  try {
    await expect(reloadedCancelledCard).toHaveCount(1);
    await expect(reloadedCancelledCard.locator(".appointment-actions .badge")).toHaveText("Cancelled");
    await expect(reloadedCancelledCard.getByRole("button", { name: /^Cancel$/i })).toHaveCount(0);
  } catch (error) {
    throw new Error(`Manage-page reload did not preserve cancellation for the synthetic appointment: ${JSON.stringify({ manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null), assertionError: safeDiagnosticText(error?.message) })}`);
  }
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
