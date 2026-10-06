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
const OWNER_SETUP_STATIC_INTRO = "Add the essentials clients need to choose a service and time.";
const OWNER_SETUP_STEP_ONE_INTRO = "Name your shop and choose an optional logo for the page clients will see.";
const OWNER_SETUP_STEP_THREE_INTRO = "Add at least two services with the price and time each one needs.";

function failGuard(message) { throw new Error(`Staging E2E safety guard: ${message}`); }
async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

function safeDiagnosticText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted-url]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\b(token|authorization|password)\b\s*[:=]\s*[^,\s}\]]+/gi, "$1=[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .slice(0, 500);
}

function describeIdShape(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "missing";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) return "uuid";
  if (/^[a-z]+_[a-z0-9_-]+$/i.test(normalized)) return "prefixed";
  return "opaque";
}

function toLocalYmd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function safeBookingRequestPath(value) {
  try {
    return new URL(value).pathname.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:bookingId"
    );
  } catch {
    return "";
  }
}

function collectApiLifecycleDiagnostics(page, expectedOrigin, expectedPath) {
  const events = [];
  const matches = (request) => {
    try {
      const url = new URL(request.url());
      return url.origin === expectedOrigin && url.pathname === expectedPath;
    } catch {
      return false;
    }
  };
  const add = (event) => {
    if (events.length < 12) events.push(event);
  };
  const onRequest = (request) => {
    if (matches(request)) add({ type: "request", method: request.method(), path: expectedPath });
  };
  const onResponse = (response) => {
    if (matches(response.request())) add({ type: "response", method: response.request().method(), path: expectedPath, status: response.status() });
  };
  const onRequestFailed = (request) => {
    if (matches(request)) add({ type: "requestfailed", method: request.method(), path: expectedPath, failure: safeDiagnosticText(request.failure()?.errorText) });
  };
  const onClose = () => add({ type: "pageclosed" });
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  page.on("close", onClose);
  return {
    snapshot: () => events.map((event) => ({ ...event })),
    stop: () => {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
      page.off("close", onClose);
    },
  };
}

function collectOwnerSetupLifecycleDiagnostics(page, expectedOrigin) {
  const events = [];
  const paths = new Set(["/api/auth/me", "/api/shops", "/api/services", "/api/availability"]);
  const describe = (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin !== expectedOrigin || !paths.has(url.pathname)) return null;
      return { method: request.method(), path: url.pathname };
    } catch {
      return null;
    }
  };
  const add = (event) => {
    if (event && events.length < 20) events.push(event);
  };
  const onRequest = (request) => {
    const entry = describe(request);
    add(entry && { type: "request", ...entry });
  };
  const onResponse = (response) => {
    const entry = describe(response.request());
    add(entry && { type: "response", ...entry, status: response.status() });
  };
  const onRequestFailed = (request) => {
    const entry = describe(request);
    add(entry && { type: "requestfailed", ...entry, failure: safeDiagnosticText(request.failure()?.errorText) });
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  return {
    snapshot: () => events.map((event) => ({ ...event })),
    stop: () => {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

async function publicBookingSubmitDiagnostics(page) {
  if (page.isClosed()) return { pageClosed: true };
  return page.evaluate(() => {
    const read = (id) => document.getElementById(id);
    const select = (id) => String(read(id)?.value ?? "").trim();
    const button = read("bookBtn");
    return {
      pagePath: window.location.pathname,
      publicBookingBuild: String(document.documentElement?.dataset?.publicBookingBuild ?? ""),
      buttonPresent: Boolean(button),
      buttonVisible: Boolean(button?.getClientRects().length),
      buttonEnabled: Boolean(button && !button.disabled),
      buttonBusy: button?.getAttribute("aria-busy") === "true",
      selectedShopPresent: Boolean(select("shopSelect")),
      selectedProviderPresent: Boolean(select("barberSelect")),
      selectedServicePresent: Boolean(select("serviceSelect")),
      selectedDatePresent: Boolean(select("bookingDate")),
      selectedSlotPresent: Boolean(select("time-slot-select")),
      clientNamePresent: Boolean(select("clientName")),
      clientContactPresent: Boolean(select("clientContact")),
      receiptDisplayed: Boolean(read("bookingReceiptTitle")?.getClientRects().length),
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    };
  }).catch((error) => ({ pageClosed: page.isClosed(), diagnosticError: safeDiagnosticText(error?.message) }));
}

async function ownerSetupStepTransitionDiagnostics(page, browserErrors) {
  if (page.isClosed()) return { pageClosed: true, browserErrors: browserErrors.map(safeDiagnosticText) };
  const state = await page.evaluate(() => {
    const visible = (element) => Boolean(element?.getClientRects().length);
    const panelState = Array.from(document.querySelectorAll("[data-step-panel]")).map((panel) => ({
      step: String(panel.getAttribute("data-step-panel") || ""),
      visible: visible(panel),
      heading: String(panel.querySelector("h2")?.textContent || "").trim(),
    }));
    const stepTwo = document.getElementById("setupStep2Next");
    const stepOneButton = document.getElementById("setupStep1Next");
    const shopStatus = document.getElementById("setupShopStatus");
    const setupStatus = document.getElementById("setupStatus");
    return {
      currentPath: window.location.pathname,
      documentReadyState: document.readyState,
      stepSummary: String(document.getElementById("setupStepSummary")?.textContent || "").trim(),
      setupIntroText: String(document.getElementById("setupIntroText")?.textContent || "").trim(),
      activeStepCount: document.querySelectorAll(".setup-step[aria-current='step']").length,
      activeStepLabel: String(document.querySelector(".setup-step[aria-current='step']")?.textContent || "").trim(),
      visiblePanels: panelState.filter((panel) => panel.visible),
      serviceProviderSelected: Boolean(String(document.getElementById("setupServiceBarber")?.value || "").trim()),
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      stepTwo: {
        exists: Boolean(stepTwo),
        visible: visible(stepTwo),
        enabled: Boolean(stepTwo && !stepTwo.disabled),
      },
      stepOneSave: {
        visible: visible(stepOneButton),
        enabled: Boolean(stepOneButton && !stepOneButton.disabled),
        pending: stepOneButton?.getAttribute("aria-busy") === "true",
      },
      shopStatus: {
        visible: visible(shopStatus),
        success: shopStatus?.classList.contains("status-success") === true,
        error: shopStatus?.classList.contains("status-error") === true,
        text: String(shopStatus?.textContent || "").trim().slice(0, 240),
      },
      generalStatus: {
        visible: visible(setupStatus),
        error: setupStatus?.classList.contains("status-error") === true,
        text: String(setupStatus?.textContent || "").trim().slice(0, 240),
      },
    };
  }).catch((error) => ({ pageClosed: page.isClosed(), diagnosticError: safeDiagnosticText(error?.message) }));
  return { ...state, browserErrors: browserErrors.map((error) => safeDiagnosticText(error)) };
}

async function waitForOwnerSetupInitialization(page, timeout = 60000) {
  await page.waitForFunction((staticIntro) => {
    const visible = (element) => Boolean(element?.getClientRects().length);
    const intro = String(document.getElementById("setupIntroText")?.textContent || "").trim();
    const activeSteps = document.querySelectorAll(".setup-step[aria-current='step']");
    const visiblePanels = Array.from(document.querySelectorAll("[data-step-panel]")).filter(visible);
    const generalStatus = document.getElementById("setupStatus");
    const initializationFailed = Boolean(
      generalStatus?.classList.contains("status-error")
      && String(generalStatus.textContent || "").trim()
    );
    const initialized = Boolean(
      intro
      && intro !== staticIntro
      && activeSteps.length === 1
      && visiblePanels.length === 1
    );
    return initialized || initializationFailed;
  }, OWNER_SETUP_STATIC_INTRO, { timeout });
}

async function ownerSetupServiceSaveDiagnostics(page, expectedService) {
  if (page.isClosed()) return { pageClosed: true };
  return page.evaluate((service) => {
    const read = (id) => document.getElementById(id);
    const visible = (element) => Boolean(element?.getClientRects().length);
    const valuePresent = (id) => Boolean(String(read(id)?.value ?? "").trim());
    const button = read("setupAddServiceBtn");
    const status = read("setupServiceStatus");
    const serviceRows = Array.from(document.querySelectorAll("#setupServiceList .availability-timeoff-item"));
    return {
      currentPath: window.location.pathname,
      servicesPanelVisible: visible(document.querySelector("[data-step-panel='3']")),
      activeStepLabel: String(document.querySelector(".setup-step[aria-current='step']")?.textContent || "").trim(),
      fields: {
        barberSelected: valuePresent("setupServiceBarber"),
        namePresent: valuePresent("setupServiceName"),
        pricePresent: valuePresent("setupServicePrice"),
        durationPresent: valuePresent("setupServiceDuration"),
        nameMatchesExpected: String(read("setupServiceName")?.value ?? "").trim() === String(service?.name ?? ""),
        priceMatchesExpected: String(read("setupServicePrice")?.value ?? "").trim() === String(service?.price ?? ""),
        durationMatchesExpected: String(read("setupServiceDuration")?.value ?? "").trim() === String(service?.duration ?? ""),
      },
      addButton: {
        present: Boolean(button),
        visible: visible(button),
        enabled: Boolean(button && !button.disabled),
        text: String(button?.textContent || "").trim().slice(0, 80),
      },
      serviceListCount: serviceRows.length,
      expectedServiceRendered: serviceRows.some((row) => String(row.textContent || "").includes(String(service?.name ?? ""))),
      serviceSaveStatus: {
        visible: visible(status),
        success: status?.classList.contains("status-success") === true,
        error: status?.classList.contains("status-error") === true,
        text: String(status?.textContent || "").trim().slice(0, 240),
      },
    };
  }, expectedService).catch((error) => ({ pageClosed: page.isClosed(), diagnosticError: safeDiagnosticText(error?.message) }));
}

async function manageCancelRuntimeDiagnostics(page) {
  if (page.isClosed()) return { pageClosed: true };
  return page.evaluate(() => {
    const data = document.documentElement?.dataset || {};
    return {
      stage: String(data.manageCancelStage || ""),
      apiMode: String(data.manageCancelApiMode || ""),
      apiEnabled: data.manageCancelApiEnabled === "true",
      apiBaseUrlPresent: data.manageCancelApiBasePresent === "true",
      authTokenPresent: data.manageCancelAuthTokenPresent === "true",
      requireApi: data.manageCancelRequireApi === "true",
      authoritativeIdPresent: data.manageCancelIdPresent === "true",
      authoritativeIdUuidLike: data.manageCancelIdUuidLike === "true",
      intendedMethod: String(data.manageCancelIntendedMethod || ""),
      intendedPath: String(data.manageCancelIntendedPath || ""),
    };
  }).catch((error) => ({
    pageClosed: page.isClosed(),
    diagnosticError: safeDiagnosticText(error?.message),
  }));
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
  // Keep these reads ordered. Both are protected and each creates its own
  // storage snapshot on the hosted backend; a concurrent post-write read can
  // otherwise observe different snapshots and make a valid browser session
  // look inconsistent.
  const meResponse = await request.get(new URL("/api/auth/me", apiUrl).toString(), { headers });
  const shopsResponse = await request.get(new URL("/api/shops", apiUrl).toString(), { headers });
  let mePayload = null;
  let shopsPayload = null;
  try { mePayload = await meResponse.json(); } catch { /* safe shape below */ }
  try { shopsPayload = await shopsResponse.json(); } catch { /* safe shape below */ }
  const shops = Array.isArray(shopsPayload?.shops) ? shopsPayload.shops : [];
  const authError = String(mePayload?.error ?? "").trim().toLowerCase();
  const authFailureKind = authError === "missing bearer token"
    ? "missing_bearer"
    : authError === "invalid token payload"
      ? "invalid_payload"
      : authError === "user not found for token"
        ? "user_not_found"
        : authError === "invalid or expired token"
          ? "invalid_or_expired"
          : (meResponse.status() === 401 ? "unknown_unauthorized" : "none");
  return {
    hasToken: Boolean(token), authorizationHeaderIncluded: Boolean(token), authStatus: meResponse.status(), shopsStatus: shopsResponse.status(),
    authFailureKind,
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
  const api = bookingsResponse ? {
    status: bookingsResponse.status(),
    responseKeys: responsePayload && typeof responsePayload === "object" ? Object.keys(responsePayload).sort() : [],
  } : { status: 0, responseKeys: [] };
  if (managePage.isClosed()) return { pageClosed: true, manageBookingsApi: api };
  const inspect = managePage.evaluate(({ clientName, serviceName, apiState }) => {
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
      manageBookingsApi: apiState,
    };
  }, {
    clientName: expectedClientName,
    serviceName: expectedServiceName,
    apiState: api,
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ diagnosticTimedOut: true, manageBookingsApi: api }), 1000));
  try {
    return await Promise.race([inspect, timeout]);
  } catch (error) {
    return {
      pageClosed: managePage.isClosed(),
      diagnosticError: safeDiagnosticText(error?.message),
      manageBookingsApi: api,
    };
  }
}

async function visibleSyntheticServiceTexts(page) {
  return page.locator("#serviceList .owner-service-card h3").allTextContents()
    .then((values) => values.map((value) => String(value).trim()).filter((value) => /^E2E /i.test(value)))
    .catch(() => []);
}

async function servicesPageDiagnostics(page, expectedServiceName) {
  if (page.isClosed()) return { pageClosed: true };
  return page.evaluate((serviceName) => {
    const list = document.getElementById("serviceList");
    const visible = (element) => Boolean(element?.getClientRects().length);
    const visibleText = (selector) => Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((element) => String(element.textContent || "").trim());
    const serviceCards = Array.from(document.querySelectorAll("#serviceList .owner-service-card"));
    return {
      currentPath: window.location.pathname,
      serviceEditorVisible: visible(Array.from(document.querySelectorAll("h1")).find((heading) => String(heading.textContent || "").trim() === "Service Editor")),
      serviceListPresent: Boolean(list),
      serviceCardCount: serviceCards.length,
      expectedServiceCardPresent: serviceCards.some((card) => String(card.textContent || "").includes(serviceName)),
      loadingStateVisible: visibleText("#serviceList .empty-state-title").includes("Loading services…"),
      loadErrorVisible: visibleText("#serviceList .empty-state-title").includes("Could not load services"),
      retryLoadVisible: Array.from(document.querySelectorAll("button[data-action='retry-load']")).some(visible),
      formSaveErrorVisible: visible(document.getElementById("serviceFormStatus"))
        && /couldn.t save/i.test(String(document.getElementById("serviceFormStatus")?.textContent || "")),
      visibleStateLabels: visibleText("#serviceList .empty-state-title, #serviceFormStatus")
        .filter((text) => /loading services|could not load services|couldn.t save/i.test(text)),
    };
  }, expectedServiceName).catch((error) => ({ pageClosed: page.isClosed(), diagnosticError: safeDiagnosticText(error?.message) }));
}

async function serviceCreateResponseState(response, expectedName, inputState) {
  let payload = null;
  let responseJsonParsed = false;
  try {
    payload = await response.json();
    responseJsonParsed = Boolean(payload && typeof payload === "object");
  } catch { /* service creation does not navigate; report shape safely below */ }
  const createdName = String(payload?.service?.name ?? payload?.service?.title ?? "").trim();
  const responseCode = String(payload?.code ?? "").trim();
  return {
    inputsFilled: Boolean(inputState?.name && inputState?.price && inputState?.duration),
    saveActionClicked: true,
    endpointPath: new URL(response.url()).pathname,
    status: response.status(),
    responseJsonParsed,
    responseKeys: responseJsonParsed ? Object.keys(payload).sort() : [],
    errorClassification: responseCode === "service_persistence_failed"
      ? "authoritative_persistence_failure"
      : (response.status() >= 500 ? "unclassified_server_failure" : "none"),
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

  // Exercise the hosted branding persistence path with representative image
  // data while keeping diagnostics limited to byte counts and field presence.
  const logoDataUrl = `data:image/png;base64,${Buffer.alloc(64 * 1024, 1).toString("base64")}`;
  const coverDataUrl = `data:image/webp;base64,${Buffer.alloc(128 * 1024, 2).toString("base64")}`;
  const brandingBody = {
    name: apiIdentity.shopName,
    businessName: apiIdentity.shopName,
    slug: apiIdentity.slug,
    logo: logoDataUrl,
    cover: coverDataUrl,
  };
  const brandingResponse = await request.patch(endpoint(`/api/shops/${encodeURIComponent(shopId)}`), {
    headers,
    data: brandingBody,
  });
  const brandingPayload = await readJson(brandingResponse);
  const brandingDiagnostic = {
    ...safeResponse(brandingResponse, brandingPayload),
    approximatePayloadBytes: Buffer.byteLength(JSON.stringify(brandingBody)),
    shopResponseKeys: brandingPayload?.shop && typeof brandingPayload.shop === "object"
      ? Object.keys(brandingPayload.shop).sort()
      : [],
    returnedLogoApproximateBytes: String(brandingPayload?.shop?.logo ?? "").length,
    returnedCoverApproximateBytes: String(brandingPayload?.shop?.cover ?? "").length,
    returnedLogoIsDataUrl: String(brandingPayload?.shop?.logo ?? "").startsWith("data:image/png;base64,"),
    returnedCoverIsDataUrl: String(brandingPayload?.shop?.cover ?? "").startsWith("data:image/webp;base64,"),
  };
  if (brandingResponse.status() !== 200 || !brandingDiagnostic.returnedLogoIsDataUrl || !brandingDiagnostic.returnedCoverIsDataUrl) {
    failStage("B-branding", "hosted logo/cover save failed", brandingDiagnostic);
  }

  const publicBrandingResponse = await request.get(endpoint(`/api/public/booking-context?shop=${encodeURIComponent(apiIdentity.slug)}`));
  const publicBrandingPayload = await readJson(publicBrandingResponse);
  const publicShop = Array.isArray(publicBrandingPayload?.shops) ? publicBrandingPayload.shops[0] : null;
  const publicBrandingDiagnostic = {
    ...safeResponse(publicBrandingResponse, publicBrandingPayload),
    shopCount: Array.isArray(publicBrandingPayload?.shops) ? publicBrandingPayload.shops.length : 0,
    publicShopKeys: publicShop && typeof publicShop === "object" ? Object.keys(publicShop).sort() : [],
    publicLogoApproximateBytes: String(publicShop?.logo ?? "").length,
    publicCoverApproximateBytes: String(publicShop?.cover ?? "").length,
    chooserHasCustomLogo: String(publicShop?.logo ?? "").startsWith("data:image/png;base64,"),
    directContextHasCustomCover: String(publicShop?.cover ?? "").startsWith("data:image/webp;base64,"),
  };
  if (publicBrandingResponse.status() !== 200 || !publicBrandingDiagnostic.chooserHasCustomLogo || !publicBrandingDiagnostic.directContextHasCustomCover) {
    failStage("B-public-branding", "public branding did not match the saved shop", publicBrandingDiagnostic);
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
    const availabilityPayload = await readJson(availabilityResponse);
    failStage("F", "availability/setup write failed", {
      ...safeResponse(availabilityResponse, availabilityPayload),
      errorClassification: availabilityPayload?.code === "availability_persistence_failed"
        ? "authoritative_persistence_failure"
        : "unclassified_server_failure",
      authenticatedProviderRequested: Boolean(apiIdentity.username),
      availabilityObjectPresent: true,
      timezonePresent: true,
      weeklyObjectPresent: true,
      weeklyDayCount: Object.keys(weekly).length,
      timeOffArrayPresent: true,
      recurringBlocksArrayPresent: false,
    });
  }
  await readServices("F");
  // Reaching here classifies the authoritative API chain as G; the browser
  // lifecycle test that follows remains responsible for the real wizard/UI.
});

test("synthetic staging owner-to-customer booking lifecycle", async ({ page, context, browser, request }) => {
  const browserErrors = collectBrowserDiagnostics(page);
  // Keep the synthetic appointment safely beyond the default 24-hour
  // cancellation cutoff regardless of what time the hosted suite starts.
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);
  const bookingDateYmd = toLocalYmd(bookingDate);
  const bookingDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][bookingDate.getDay()];
  const expectedApiOrigin = requireStagingUrl(apiUrl, "SLOTZY_STAGING_API_URL").origin;
  // Start before registration can navigate. The prior listener began only
  // after Step 1 was already rendered, so an initialization stall exposed no
  // protected-read lifecycle evidence.
  const setupInitializationNetwork = collectOwnerSetupLifecycleDiagnostics(page, expectedApiOrigin);
  // The health guard above completes before this test can write any data.
  await page.goto(`${frontendUrl}/pages/index.html`);
  // The login control is in the static header and can be clicked while the
  // asynchronous boot/session restore is still running. Wait for the actual
  // signed-out home view so registration cannot race an older restore task.
  await expect(page.locator("#app .home-hero")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-auth-mode", "server");
  await page.locator("#btn-login").click();
  await page.locator("#show-register").click();
  await page.fill("#auth-username", identity.username);
  await page.fill("#auth-password", identity.password);
  await page.selectOption("#auth-role", "owner");
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
  let authToken = await page.evaluate(() => String(localStorage.getItem("Slotzy_auth_token") ?? "").trim());
  expect(Boolean(authToken)).toBe(true);

  // Registration returned 201 for a per-run random identity. Prove its server
  // state is also fresh before accepting any wizard step; local/session resume
  // state is never sufficient for this lifecycle.
  const initialOwnerShopState = await ownerShopApiState(request, authToken, identity.shopName);
  const initialServicesState = await servicesApiState(request, authToken, identity.serviceName);
  const initialAuthoritativeState = {
    tokenPresent: Boolean(authToken),
    authStatus: initialOwnerShopState.authStatus,
    authFailureKind: initialOwnerShopState.authFailureKind,
    shopsStatus: initialOwnerShopState.shopsStatus,
    ownerPresent: initialOwnerShopState.authUserExists,
    ownerHasShop: initialOwnerShopState.userHasShopId,
    ownerShopCount: initialOwnerShopState.ownerShopCount,
    expectedShopPresent: initialOwnerShopState.anySyntheticShopExists,
    servicesStatus: initialServicesState.status,
    serviceCount: initialServicesState.serviceCount,
    expectedServicePresent: initialServicesState.hasExpectedService,
  };
  const freshOwnerState = initialAuthoritativeState.authStatus === 200
    && initialAuthoritativeState.shopsStatus === 200
    && initialAuthoritativeState.ownerPresent
    && !initialAuthoritativeState.ownerHasShop
    && initialAuthoritativeState.ownerShopCount === 0
    && !initialAuthoritativeState.expectedShopPresent
    && initialAuthoritativeState.servicesStatus === 200
    && initialAuthoritativeState.serviceCount === 0
    && !initialAuthoritativeState.expectedServicePresent;
  if (!freshOwnerState) {
    const lifecycleEvents = setupInitializationNetwork.snapshot();
    setupInitializationNetwork.stop();
    throw new Error(`New synthetic owner did not have empty authoritative setup state: ${JSON.stringify({
      initialAuthoritativeState,
      setupUi: await ownerSetupStepTransitionDiagnostics(page, browserErrors),
      lifecycleEvents,
    })}`);
  }

  // owner-setup.html initially contains a generic static shell. Wait for the
  // module to finish its protected reads and select exactly one real step;
  // otherwise that shell can be mistaken for resumable Services state.
  try {
    await waitForOwnerSetupInitialization(page);
    const setupUi = await ownerSetupStepTransitionDiagnostics(page, browserErrors);
    const initializedAtStepOne = setupUi.setupIntroText === OWNER_SETUP_STEP_ONE_INTRO
      && setupUi.stepSummary === "Step 1 of 5"
      && setupUi.activeStepCount === 1
      && /Shop/.test(setupUi.activeStepLabel)
      && setupUi.visiblePanels?.length === 1
      && setupUi.visiblePanels[0]?.step === "1"
      && setupUi.stepOneSave?.visible
      && setupUi.stepOneSave?.enabled
      && !setupUi.stepOneSave?.pending
      && !setupUi.generalStatus?.error;
    if (!initializedAtStepOne) throw new Error("wizard initialized at an unexpected step or error state");
  } catch (error) {
    const setupUi = await ownerSetupStepTransitionDiagnostics(page, browserErrors);
    const lifecycleEvents = setupInitializationNetwork.snapshot();
    setupInitializationNetwork.stop();
    throw new Error(`Fresh synthetic owner setup did not initialize at Step 1: ${JSON.stringify({
      currentPath: setupUi.currentPath,
      activeStepLabel: setupUi.activeStepLabel,
      setupIntroText: setupUi.setupIntroText,
      staticIntroVisible: setupUi.setupIntroText === OWNER_SETUP_STATIC_INTRO,
      activeStepCount: setupUi.activeStepCount,
      visiblePanels: setupUi.visiblePanels,
      tokenPresent: initialAuthoritativeState.tokenPresent,
      ownerPresent: initialAuthoritativeState.ownerPresent,
      ownerHasShop: initialAuthoritativeState.ownerHasShop,
      ownerShopCount: initialAuthoritativeState.ownerShopCount,
      serviceCount: initialAuthoritativeState.serviceCount,
      documentReadyState: setupUi.documentReadyState,
      serviceWorkerControlled: setupUi.serviceWorkerControlled,
      generalStatus: setupUi.generalStatus,
      lifecycleEvents,
      browserErrors: setupUi.browserErrors,
      assertionError: safeDiagnosticText(error?.message),
    })}`);
  }
  setupInitializationNetwork.stop();

  // A newly registered owner remains in the wizard until every required setup
  // step is complete. The ready-step Dashboard control is intentionally hidden
  // before then, so follow the real UI rather than accepting the hidden link.
  await expect(page.locator("#setupShopName")).toBeVisible();
  {
    await page.fill("#setupShopName", identity.shopName);
    const shopInputState = {
      shopName: await page.locator("#setupShopName").inputValue() === identity.shopName,
      ownerProfileFieldPresent: Boolean(await page.locator("#setupOwnerDisplayName").count()),
      ownerProfileFilled: Boolean(String(await page.locator("#setupOwnerDisplayName").inputValue().catch(() => "")).trim()),
    };
    const step1Diagnostics = await ownerSetupStep1Diagnostics(page, browserErrors);
    const setupLifecycle = collectOwnerSetupLifecycleDiagnostics(page, expectedApiOrigin);
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
    if (shopCreation.status !== 201 || !shopCreation.shopPresent || !shopCreation.shopIdPresent || !shopCreation.syntheticShopNameMatches) {
      setupLifecycle.stop();
      throw new Error(`Owner setup Step 1 did not create the synthetic shop: ${JSON.stringify({ ...shopCreation, currentPath: new URL(page.url()).pathname })}`);
    }
    try {
      await expect(page.getByRole("heading", { name: "Choose your booking team", exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.locator("[data-step-panel='2']")).toBeVisible();
      await expect(page.locator("#setupStep2Next")).toBeVisible();
      await expect(page.locator("#setupStep2Next")).toBeEnabled();
    } catch (error) {
      const lifecycleEvents = setupLifecycle.snapshot();
      setupLifecycle.stop();
      throw new Error(`Owner setup Step 1 did not transition to Team: ${JSON.stringify({
        stepTransition: await ownerSetupStepTransitionDiagnostics(page, browserErrors),
        browserAuth: await browserAuthState(page),
        shopCreation,
        lifecycleEvents,
        assertionError: safeDiagnosticText(error?.message),
      })}`);
    }
    setupLifecycle.stop();

    // Step 2 is displayed only after owner setup's authenticated refresh has
    // completed. Re-read token presence here rather than reusing a value from
    // registration, then make ordered protected reads for the linkage proof.
    const currentAuthToken = await page.evaluate(() => String(localStorage.getItem("Slotzy_auth_token") ?? "").trim());
    const currentBrowserAuth = await browserAuthState(page);
    const ownerShopState = await ownerShopApiState(request, currentAuthToken, identity.shopName);
    if (
      !currentBrowserAuth.hasToken
      || !currentBrowserAuth.hasUser
      || currentBrowserAuth.username !== identity.username
      || currentBrowserAuth.role !== "owner"
      || ownerShopState.authStatus !== 200
      || ownerShopState.shopsStatus !== 200
      || !ownerShopState.authUserExists
      || !ownerShopState.userHasShopId
      || ownerShopState.ownerShopCount < 1
      || !ownerShopState.anySyntheticShopExists
    ) {
      throw new Error(`Owner setup Step 1 did not retain authenticated shop linkage: ${JSON.stringify({
        shopCreation,
        browserAuth: currentBrowserAuth,
        ownerShopState,
        stepTransition: await ownerSetupStepTransitionDiagnostics(page, browserErrors),
      })}`);
    }
    authToken = currentAuthToken;

    await page.fill("#setupOwnerDisplayName", identity.username);
    await page.locator("#setupStep2Next").click();
    try {
      await expect(page.getByRole("heading", { name: "Add your services", exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.locator("#setupIntroText")).toHaveText(OWNER_SETUP_STEP_THREE_INTRO);
      await expect(page.locator("[data-step-panel='3']")).toBeVisible();
      await expect(page.locator("[data-step-panel='1']")).toBeHidden();
      await expect(page.locator("[data-step-panel='2']")).toBeHidden();
      await expect(page.locator("#setupServiceBarber")).not.toHaveValue("");
      await expect(page.locator("#setupAddServiceBtn")).toBeVisible();
      await expect(page.locator("#setupAddServiceBtn")).toBeEnabled();
    } catch (error) {
      throw new Error(`Owner setup Team step did not initialize Services: ${JSON.stringify({
        setupUi: await ownerSetupStepTransitionDiagnostics(page, browserErrors),
        browserAuth: {
          tokenPresent: Boolean(currentAuthToken),
          ownerPresent: currentBrowserAuth.hasUser,
          roleIsOwner: currentBrowserAuth.role === "owner",
        },
        ownerShopState: {
          authStatus: ownerShopState.authStatus,
          shopsStatus: ownerShopState.shopsStatus,
          ownerPresent: ownerShopState.authUserExists,
          ownerHasShop: ownerShopState.userHasShopId,
          ownerShopCount: ownerShopState.ownerShopCount,
          expectedShopPresent: ownerShopState.anySyntheticShopExists,
        },
        assertionError: safeDiagnosticText(error?.message),
      })}`);
    }

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
      const serviceEndpointPath = "/api/services";
      const serviceNetwork = collectApiLifecycleDiagnostics(page, expectedApiOrigin, serviceEndpointPath);
      const serviceSaveRequest = page.waitForRequest((request) => (
        request.method() === "POST"
        && new URL(request.url()).origin === expectedApiOrigin
        && new URL(request.url()).pathname === serviceEndpointPath
      ), { timeout: 10000 }).then((request) => ({ request }), (error) => ({ error }));
      const serviceSaveResponse = page.waitForResponse((response) => (
        response.request().method() === "POST"
        && new URL(response.url()).origin === expectedApiOrigin
        && new URL(response.url()).pathname === serviceEndpointPath
      ), { timeout: 20000 }).then((response) => ({ response }), (error) => ({ error }));
      const serviceSaveBeforeClick = await ownerSetupServiceSaveDiagnostics(page, service);
      const addServiceButton = page.locator("#setupAddServiceBtn");
      await expect(addServiceButton).toBeVisible();
      await expect(addServiceButton).toBeEnabled();
      await addServiceButton.click();
      const [serviceSaveRequestResult, serviceSaveResult] = await Promise.all([
        serviceSaveRequest,
        serviceSaveResponse,
      ]);
      const serviceCreation = serviceSaveResult.response
        ? await serviceCreateResponseState(serviceSaveResult.response, service.name, inputState)
        : {
            status: null,
            responseKeys: [],
            hasCreatedService: false,
            createdServiceIdPresent: false,
            createdSyntheticServiceMatches: false,
          };
      try {
        await expect(page.locator("#setupServiceList")).toContainText(service.name, { timeout: 30000 });
        await expect(page.locator("#setupServiceStatus.status-error")).toHaveCount(0);
      } catch (error) {
        const lifecycleEvents = serviceNetwork.snapshot();
        serviceNetwork.stop();
        throw new Error(`Owner setup service save did not update the UI: ${JSON.stringify({
          expectedServiceRendered: false,
          submitBeforeClick: serviceSaveBeforeClick,
          submitAfterWait: await ownerSetupServiceSaveDiagnostics(page, service),
          requestStarted: !serviceSaveRequestResult.error,
          responseObserved: !serviceSaveResult.error,
          serviceCreation,
          lifecycleEvents,
          assertionError: safeDiagnosticText(error?.message),
        })}`);
      }
      const persisted = await servicesApiState(request, authToken, service.name);
      if (persisted.status !== 200 || !persisted.hasExpectedService) {
        const lifecycleEvents = serviceNetwork.snapshot();
        serviceNetwork.stop();
        throw new Error(`Owner setup service was not present in the authenticated service read: ${JSON.stringify({
          ...persisted,
          submitBeforeClick: serviceSaveBeforeClick,
          submitAfterPersistenceCheck: await ownerSetupServiceSaveDiagnostics(page, service),
          lifecycleEvents,
          currentPath: new URL(page.url()).pathname,
        })}`);
      }
      const lifecycleEvents = serviceNetwork.snapshot();
      serviceNetwork.stop();
      if (serviceSaveRequestResult.error || serviceSaveResult.error) {
        throw new Error(`Owner setup service POST lifecycle was not observed after persisted UI success: ${JSON.stringify({
          requestStarted: !serviceSaveRequestResult.error,
          responseObserved: !serviceSaveResult.error,
          endpointPath: serviceEndpointPath,
          method: "POST",
          submitBeforeClick: serviceSaveBeforeClick,
          submitAfterPersistenceCheck: await ownerSetupServiceSaveDiagnostics(page, service),
          lifecycleEvents,
          requestWaitError: safeDiagnosticText(serviceSaveRequestResult.error?.message),
          responseWaitError: safeDiagnosticText(serviceSaveResult.error?.message),
        })}`);
      }
      if (serviceCreation.status !== 201 || !serviceCreation.hasCreatedService || !serviceCreation.createdSyntheticServiceMatches) {
        throw new Error(`Owner setup service POST non-success: ${JSON.stringify({ ...serviceCreation, lifecycleEvents })}`);
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

  const servicesEndpointPath = "/api/services";
  // Listen before navigation. manage-services starts its authoritative read
  // during module initialization, so registering after goto can miss it.
  // The rendered page state is the success criterion; the lifecycle trace is
  // retained only to diagnose a failed render without turning a cached/already
  // completed read into a 180-second test timeout.
  const servicesNetwork = collectApiLifecycleDiagnostics(page, expectedApiOrigin, servicesEndpointPath);
  await page.goto(`${frontendUrl}/pages/manage-services.html`);
  const persistedAfterReload = await servicesApiState(request, authToken, identity.serviceName);
  try {
    await expect(page).toHaveURL(/\/pages\/manage-services\.html$/);
    await expect(page.getByRole("heading", { name: "Service Editor", exact: true })).toBeVisible();
    await expect(page.locator("#serviceList .owner-service-card").filter({
      has: page.getByRole("heading", { name: identity.serviceName, exact: true }),
    })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Loading services…", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Could not load services", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry loading services", exact: true })).toHaveCount(0);
    await expect(page.locator("#serviceFormStatus.service-form-status-error")).toHaveCount(0);
  } catch (error) {
    const lifecycleEvents = servicesNetwork.snapshot();
    servicesNetwork.stop();
    throw new Error(`Manage services page did not resolve to the persisted service: ${JSON.stringify({
      ...await servicesPageDiagnostics(page, identity.serviceName),
      persistedAfterReload,
      lifecycleEvents,
      visibleSyntheticServices: await visibleSyntheticServiceTexts(page),
      assertionError: safeDiagnosticText(error?.message),
    })}`);
  }
  const servicesLifecycleEvents = servicesNetwork.snapshot();
  servicesNetwork.stop();
  if (persistedAfterReload.status !== 200 || !persistedAfterReload.hasExpectedService) {
    throw new Error(`Persisted service was unavailable after manage-services page load: ${JSON.stringify({
      ...persistedAfterReload,
      servicesPage: await servicesPageDiagnostics(page, identity.serviceName),
      lifecycleEvents: servicesLifecycleEvents,
      visibleSyntheticServices: await visibleSyntheticServiceTexts(page),
    })}`);
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
  const publicContext = await browser.newContext();
  const directoryPage = await publicContext.newPage();
  const directoryContextResponse = directoryPage.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/public/booking-context"
    && !new URL(response.url()).search
  ));
  await directoryPage.goto(`${frontendUrl}/pages/book.html`);
  const directoryContextLoad = await directoryContextResponse;
  expect(directoryContextLoad.status()).toBe(200);
  await expect(directoryPage.locator("#publicShopPickerSection")).toBeVisible();
  await expect(directoryPage.locator("#publicShopPickerList")).not.toContainText(identity.shopName);
  const visibleSyntheticDirectoryCards = await directoryPage.locator(".public-shop-directory-card strong").allTextContents();
  expect(visibleSyntheticDirectoryCards.filter((name) => /^E2E\s/i.test(String(name)) || /e2e-/i.test(String(name)))).toEqual([]);
  await directoryPage.close();

  const publicPage = await publicContext.newPage();
  const publicContextResponse = publicPage.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/public/booking-context"
  ));
  await publicPage.goto(bookingLink);
  const publicContextLoad = await publicContextResponse;
  expect(publicContextLoad.status()).toBe(200);
  expect(await publicPage.evaluate(() => Boolean(localStorage.getItem("Slotzy_auth_token")))).toBe(false);
  await selectSyntheticBarber(publicPage, identity.username);
  await selectSyntheticService(publicPage, identity.serviceName);
  await publicPage.locator("#bookingDate").fill(bookingDateYmd);
  const slot = publicPage.locator("#time-slot-select option[value]:not([value=''])").first();
  try {
    await expect(slot).toBeAttached();
  } catch (error) {
    let contextPayload = null;
    try { contextPayload = await publicContextLoad.json(); } catch { /* response shape below */ }
    const selected = await publicPage.evaluate(() => ({
      shopId: String(document.querySelector("#shopSelect")?.value || ""),
      providerId: String(document.querySelector("#barberSelect")?.value || ""),
      serviceId: String(document.querySelector("#serviceSelect")?.value || ""),
      date: String(document.querySelector("#bookingDate")?.value || ""),
      slotCount: document.querySelectorAll("#time-slot-select option[value]:not([value=''])").length,
      slotPanelText: String(document.querySelector("#slotList")?.textContent || "").trim().slice(0, 180),
      browserLocalDate: new Date().toString().slice(0, 80),
    }));
    const provider = (Array.isArray(contextPayload?.providers) ? contextPayload.providers : [])
      .find((item) => String(item?.username || "") === selected.providerId);
    const service = (Array.isArray(contextPayload?.services) ? contextPayload.services : [])
      .find((item) => String(item?.id || "") === selected.serviceId);
    const dayAvailability = contextPayload?.availabilityByBarber?.[selected.providerId]?.weekly?.[bookingDay] || null;
    throw new Error(`Public booking produced no slots: ${JSON.stringify({
      responseStatus: publicContextLoad.status(),
      responseKeys: contextPayload && typeof contextPayload === "object" ? Object.keys(contextPayload).sort() : [],
      selectedShopIdShape: describeIdShape(selected.shopId),
      selectedProviderIdShape: describeIdShape(selected.providerId),
      selectedServiceIdShape: describeIdShape(selected.serviceId),
      selectedDate: selected.date,
      providerCount: Array.isArray(contextPayload?.providers) ? contextPayload.providers.length : 0,
      serviceCount: Array.isArray(contextPayload?.services) ? contextPayload.services.length : 0,
      providerFound: Boolean(provider),
      serviceFound: Boolean(service),
      serviceDurationValid: Number.isFinite(Number(service?.durationMinutes)) && Number(service.durationMinutes) > 0,
      selectedDateAvailabilityEnabled: dayAvailability?.enabled === true,
      selectedDateAvailabilityHasTimes: Boolean(dayAvailability?.start && dayAvailability?.end),
      generatedSlotCount: selected.slotCount,
      slotPanelText: safeDiagnosticText(selected.slotPanelText),
      browserLocalDate: safeDiagnosticText(selected.browserLocalDate),
      assertion: safeDiagnosticText(error?.message),
    })}`);
  }
  await publicPage.selectOption("#time-slot-select", await slot.getAttribute("value"));
  await publicPage.fill("#clientName", identity.clientName);
  await publicPage.fill("#clientContact", identity.clientEmail);
  const bookingEndpointPath = "/api/bookings";
  const bookingNetwork = collectApiLifecycleDiagnostics(publicPage, expectedApiOrigin, bookingEndpointPath);
  const bookingPostRequest = publicPage.waitForRequest((request) => (
    request.method() === "POST"
    && new URL(request.url()).origin === expectedApiOrigin
    && new URL(request.url()).pathname === bookingEndpointPath
  ), { timeout: 5000 }).then((request) => ({ request }), (error) => ({ error }));
  const bookingSaveResponse = publicPage.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === bookingEndpointPath
  ), { timeout: 15000 }).then((response) => ({ response }), (error) => ({ error }));
  const bookingSubmitBeforeClick = await publicBookingSubmitDiagnostics(publicPage);
  const bookingButton = publicPage.locator("#bookBtn");
  await expect(bookingButton).toBeVisible();
  await expect(bookingButton).toBeEnabled();
  await bookingButton.click();
  const bookingPostRequestResult = await bookingPostRequest;
  if (bookingPostRequestResult.error) {
    const bookingEvents = bookingNetwork.snapshot();
    bookingNetwork.stop();
    throw new Error(`Public booking POST was not initiated: ${JSON.stringify({
      bookingPostInitiated: false,
      endpointPath: bookingEndpointPath,
      method: "POST",
      submitBeforeClick: bookingSubmitBeforeClick,
      submitAfterWait: await publicBookingSubmitDiagnostics(publicPage),
      lifecycleEvents: bookingEvents,
      waitError: safeDiagnosticText(bookingPostRequestResult.error?.message),
    })}`);
  }
  const bookingSaveResult = await bookingSaveResponse;
  if (bookingSaveResult.error) {
    const bookingEvents = bookingNetwork.snapshot();
    bookingNetwork.stop();
    throw new Error(`Public booking POST was not observed: ${JSON.stringify({
      bookingPostInitiated: true,
      bookingPostResponseObserved: false,
      endpointPath: bookingEndpointPath,
      method: "POST",
      status: 0,
      responseKeys: [],
      submitBeforeClick: bookingSubmitBeforeClick,
      submitAfterWait: await publicBookingSubmitDiagnostics(publicPage),
      lifecycleEvents: bookingEvents,
      waitError: safeDiagnosticText(bookingSaveResult.error?.message),
    })}`);
  }
  bookingNetwork.stop();
  const bookingSave = bookingSaveResult.response;
  expect(bookingSave.request().headers().authorization).toBeUndefined();
  let bookingPayload = null;
  try { bookingPayload = await bookingSave.json(); } catch { /* safe response shape below */ }
  const createdBooking = bookingPayload?.booking && typeof bookingPayload.booking === "object"
    ? bookingPayload.booking
    : null;
  const createdBookingId = String(createdBooking?.id ?? "").trim();
  const bookingReceipt = publicPage.locator("#bookingReceiptTitle");
  await expect(bookingReceipt).toBeVisible();
  const manageLink = await publicPage.locator("#bookingReceiptManageLink").getAttribute("href");
  const receiptState = {
    bookingPostObserved: true,
    bookingStatus: bookingSave.status(),
    bookingResponseKeys: bookingPayload && typeof bookingPayload === "object" ? Object.keys(bookingPayload).sort() : [],
    manageTokenReturned: Boolean(String(bookingPayload?.manageToken ?? "").trim()),
    returnedBookingIdShape: describeIdShape(createdBooking?.id),
    returnedBookingStatus: String(createdBooking?.status ?? ""),
    returnedShopIdShape: describeIdShape(createdBooking?.shopId),
    returnedProviderIdShape: describeIdShape(createdBooking?.barberUsername ?? createdBooking?.ownerUsername),
    returnedServiceIdShape: describeIdShape(createdBooking?.serviceId),
    returnedClientNamePresent: Boolean(String(createdBooking?.clientName ?? "").trim()),
    returnedClientContactPresent: Boolean(String(createdBooking?.clientContact ?? "").trim()),
    returnedCustomerUsernamePresent: Boolean(String(createdBooking?.customerUsername ?? "").trim()),
    receiptDisplayed: await bookingReceipt.isVisible(),
    manageLinkExists: Boolean(manageLink),
    manageLinkPath: (() => { try { return new URL(String(manageLink || ""), publicPage.url()).pathname; } catch { return ""; } })(),
    manageLinkQueryKeys: (() => { try { return Array.from(new URL(String(manageLink || ""), publicPage.url()).searchParams.keys()).sort(); } catch { return []; } })(),
    manageLinkHasTokenFragment: (() => { try { return Boolean(new URLSearchParams(new URL(String(manageLink || ""), publicPage.url()).hash.slice(1)).get("token")); } catch { return false; } })(),
    syntheticClientVisibleOnReceipt: await publicPage.getByText(identity.clientName, { exact: true }).isVisible().catch(() => false),
    syntheticServiceVisibleOnReceipt: await publicPage.getByText(identity.serviceName, { exact: true }).isVisible().catch(() => false),
  };
  if (
    bookingSave.status() !== 201
    || !createdBookingId
    || !receiptState.manageTokenReturned
    || !receiptState.manageLinkExists
    || !receiptState.manageLinkHasTokenFragment
    || receiptState.manageLinkQueryKeys.includes("contact")
    || receiptState.manageLinkQueryKeys.includes("shop")
    || !receiptState.syntheticClientVisibleOnReceipt
    || !receiptState.syntheticServiceVisibleOnReceipt
  ) {
    throw new Error(`Public booking did not create a verifiable receipt/manage link: ${JSON.stringify(receiptState)}`);
  }
  await publicContext.close();

  const ownerAppointmentsResponse = page.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/bookings"
  ), { timeout: 15000 }).then((response) => ({ response }), (error) => ({ error }));
  await page.goto(`${frontendUrl}/pages/manage-appointments.html`);
  const ownerAppointmentsResult = await ownerAppointmentsResponse;
  if (ownerAppointmentsResult.error) {
    throw new Error(`Owner appointments API read was not observed: ${JSON.stringify({
      apiRequestObserved: false,
      endpointPath: "/api/bookings",
      method: "GET",
      status: 0,
      responseKeys: [],
      waitError: safeDiagnosticText(ownerAppointmentsResult.error?.message),
    })}`);
  }
  const ownerAppointmentsLoad = ownerAppointmentsResult.response;
  let ownerAppointmentsPayload = null;
  try { ownerAppointmentsPayload = await ownerAppointmentsLoad.json(); } catch { /* safe shape below */ }
  const ownerAppointments = Array.isArray(ownerAppointmentsPayload?.bookings)
    ? ownerAppointmentsPayload.bookings
    : [];
  const matchingOwnerAppointment = ownerAppointments.find((booking) => String(booking?.id ?? "").trim() === createdBookingId) || null;
  const ownerAppointmentsState = {
    apiRequestObserved: true,
    endpointPath: new URL(ownerAppointmentsLoad.url()).pathname,
    method: ownerAppointmentsLoad.request().method(),
    status: ownerAppointmentsLoad.status(),
    responseKeys: ownerAppointmentsPayload && typeof ownerAppointmentsPayload === "object" ? Object.keys(ownerAppointmentsPayload).sort() : [],
    appointmentCount: ownerAppointments.length,
    matchingSyntheticBookingId: Boolean(matchingOwnerAppointment),
    matchingSyntheticServiceMarker: ownerAppointments.some((booking) => String(booking?.serviceName ?? booking?.serviceTitle ?? "").trim() === identity.serviceName),
    matchingSyntheticClientMarker: ownerAppointments.some((booking) => String(booking?.clientName ?? "").trim() === identity.clientName),
    appointmentStatuses: [...new Set(ownerAppointments.map((booking) => String(booking?.status ?? "").trim()).filter(Boolean))].sort(),
    createdShopIdShape: describeIdShape(createdBooking?.shopId),
    ownerShopIdShape: describeIdShape(matchingOwnerAppointment?.shopId),
    shopIdMatchesCreated: Boolean(matchingOwnerAppointment) && String(matchingOwnerAppointment?.shopId ?? "") === String(createdBooking?.shopId ?? ""),
    createdProviderIdShape: describeIdShape(createdBooking?.barberUsername ?? createdBooking?.ownerUsername),
    ownerProviderIdShape: describeIdShape(matchingOwnerAppointment?.barberUsername ?? matchingOwnerAppointment?.ownerUsername),
    providerIdMatchesCreated: Boolean(matchingOwnerAppointment) && String(matchingOwnerAppointment?.barberUsername ?? matchingOwnerAppointment?.ownerUsername ?? "") === String(createdBooking?.barberUsername ?? createdBooking?.ownerUsername ?? ""),
  };
  if (
    ownerAppointmentsLoad.status() !== 200
    || !ownerAppointmentsState.matchingSyntheticBookingId
    || !ownerAppointmentsState.matchingSyntheticServiceMarker
    || !ownerAppointmentsState.matchingSyntheticClientMarker
  ) {
    throw new Error(`Owner appointments API did not return the anonymous booking: ${JSON.stringify({ receiptState, ownerAppointmentsState })}`);
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  const ownerAppointmentCard = page.locator(".appointment-row").filter({
    has: page.getByText(identity.serviceName, { exact: true }),
  });
  try {
    await expect(ownerAppointmentCard).toContainText(identity.clientName);
    await expect(ownerAppointmentCard.locator(".appointment-actions .badge")).toContainText(/Booked|Confirmed/);
  } catch (error) {
    throw new Error(`Owner appointments UI did not render the authoritative anonymous booking: ${JSON.stringify({ ownerAppointmentsState, assertionError: safeDiagnosticText(error?.message) })}`);
  }
  const managePage = await context.newPage();
  const manageBrowserErrors = collectBrowserDiagnostics(managePage);
  const manageBookingResponse = managePage.waitForResponse((response) => (
    response.request().method() === "GET"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === "/api/public/manage"
  ));
  await managePage.goto(new URL(manageLink, frontendUrl).toString());
  const manageBooking = await manageBookingResponse;
  const managedCard = managePage.locator(".client-manage-card").filter({
    has: managePage.getByText(identity.serviceName, { exact: true }),
  });
  try {
    await expect(managePage.getByText(identity.serviceName, { exact: true })).toBeVisible();
    await expect(managedCard).toContainText(identity.clientName);
    await expect(managePage.locator(".appointment-datetime span").first()).toBeVisible();
    await expect(managedCard.locator(".appointment-actions .badge")).toHaveText("Booked");
    await expect(managePage.getByRole("button", { name: /^Cancel$/i })).toBeVisible();
  } catch (error) {
    throw new Error(`Manage link did not render the booked appointment: ${JSON.stringify({ receiptState, manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, manageBooking), assertionError: safeDiagnosticText(error?.message) })}`);
  }
  const managedCancelButton = managePage.getByRole("button", { name: /^Cancel$/i });
  const managedBookingId = String((await managedCancelButton.getAttribute("data-id")) ?? "").trim();
  const managedBookingIdShape = {
    authoritativeIdPresent: Boolean(managedBookingId),
    authoritativeIdUuidLike: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(managedBookingId),
  };
  const cardBadgeBeforeConfirm = await managedCard.locator(".appointment-actions .badge").allTextContents()
    .then((values) => values.map((value) => String(value).trim())).catch(() => []);
  await managedCancelButton.click();
  const cancelEndpointPath = "/api/public/manage/cancel";
  const cancelNetwork = collectApiLifecycleDiagnostics(managePage, expectedApiOrigin, cancelEndpointPath);
  const cancelUpdateRequest = managePage.waitForRequest((request) => (
    request.method() === "PATCH"
    && new URL(request.url()).origin === expectedApiOrigin
    && new URL(request.url()).pathname === cancelEndpointPath
  ), { timeout: 5000 }).then((request) => ({ request }), (error) => ({ error }));
  const cancelUpdateResponse = managePage.waitForResponse((response) => (
    response.request().method() === "PATCH"
    && new URL(response.url()).origin === expectedApiOrigin
    && new URL(response.url()).pathname === cancelEndpointPath
  ), { timeout: 15000 }).then((response) => ({ response }), (error) => ({ error }));
  const confirmCancelButton = managedCard.getByRole("button", { name: /^Confirm Cancel$/i });
  await expect(confirmCancelButton).toBeVisible();
  await confirmCancelButton.click();
  const cancelUpdateRequestResult = await cancelUpdateRequest;
  if (cancelUpdateRequestResult.error) {
    const networkEvents = cancelNetwork.snapshot();
    cancelNetwork.stop();
    throw new Error(`Cancel PATCH was not initiated: ${JSON.stringify({
      cancelButtonClicked: true,
      confirmCancelButtonClicked: true,
      cardBadgeBeforeConfirm,
      ...managedBookingIdShape,
      endpointPath: cancelEndpointPath,
      method: "PATCH",
      runtime: await manageCancelRuntimeDiagnostics(managePage),
      lifecycleEvents: networkEvents,
      manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null),
      browserErrors: manageBrowserErrors.map((message) => safeDiagnosticText(message)),
      waitError: safeDiagnosticText(cancelUpdateRequestResult.error?.message),
    })}`);
  }
  const cancelUpdateResult = await cancelUpdateResponse;
  if (cancelUpdateResult.error) {
    const networkEvents = cancelNetwork.snapshot();
    cancelNetwork.stop();
    throw new Error(`Cancel PATCH not observed: ${JSON.stringify({
      cancelButtonClicked: true,
      confirmCancelButtonClicked: true,
      cardBadgeBeforeConfirm,
      ...managedBookingIdShape,
      endpointPath: "",
      method: "",
      status: 0,
      responseKeys: [],
      bookingStatusAfterResponse: "",
      runtime: await manageCancelRuntimeDiagnostics(managePage),
      lifecycleEvents: networkEvents,
      manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null),
      browserErrors: manageBrowserErrors.map((message) => safeDiagnosticText(message)),
      waitError: safeDiagnosticText(cancelUpdateResult.error?.message),
    })}`);
  }
  const cancelUpdate = cancelUpdateResult.response;
  const cancelNetworkEvents = cancelNetwork.snapshot();
  cancelNetwork.stop();
  let cancelUpdatePayload = null;
  try { cancelUpdatePayload = await cancelUpdate.json(); } catch { /* safe response shape below */ }
  const cancelDiagnostic = {
    cancelButtonClicked: true,
    confirmCancelButtonClicked: true,
    endpointPath: safeBookingRequestPath(cancelUpdate.url()),
    method: cancelUpdate.request().method(),
    status: cancelUpdate.status(),
    responseKeys: cancelUpdatePayload && typeof cancelUpdatePayload === "object" ? Object.keys(cancelUpdatePayload).sort() : [],
    bookingStatusAfterResponse: String(cancelUpdatePayload?.booking?.status ?? "").trim(),
    ...managedBookingIdShape,
    cardBadgeBeforeConfirm,
    runtime: await manageCancelRuntimeDiagnostics(managePage),
    bookingNetworkEvents: cancelNetworkEvents,
    cardBadgeAfterPatch: await managedCard.locator(".appointment-actions .badge").allTextContents()
      .then((values) => values.map((value) => String(value).trim())).catch(() => []),
  };
  if (cancelUpdate.status() !== 200 || cancelDiagnostic.bookingStatusAfterResponse !== "cancelled") {
    throw new Error(`Cancel PATCH non-success: ${JSON.stringify(cancelDiagnostic)}`);
  }
  const cancelledCard = managedCard;
  try {
    await expect(cancelledCard).toHaveCount(1, { timeout: 15000 });
    await expect(cancelledCard.locator(".appointment-actions .badge")).toHaveText("Cancelled", { timeout: 15000 });
    await expect(cancelledCard.getByRole("button", { name: /^Cancel$/i })).toHaveCount(0, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Cancel persisted but UI did not refresh: ${JSON.stringify({
      ...cancelDiagnostic,
      cardBadgeAfterUiWait: await cancelledCard.locator(".appointment-actions .badge").allTextContents().then((values) => values.map((value) => String(value).trim())).catch(() => []),
      cancelButtonRemains: await cancelledCard.getByRole("button", { name: /^Cancel$/i }).count().then((count) => count > 0).catch(() => false),
      manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null),
      assertionError: safeDiagnosticText(error?.message),
    })}`);
  }
  await managePage.reload();
  const reloadedCancelledCard = managePage.locator(".client-manage-card").filter({
    has: managePage.getByText(identity.serviceName, { exact: true }),
  });
  try {
    await expect(reloadedCancelledCard).toHaveCount(1, { timeout: 15000 });
    await expect(reloadedCancelledCard.locator(".appointment-actions .badge")).toHaveText("Cancelled", { timeout: 15000 });
    await expect(reloadedCancelledCard.getByRole("button", { name: /^Cancel$/i })).toHaveCount(0, { timeout: 15000 });
  } catch (error) {
    throw new Error(`Cancelled status did not persist after reload: ${JSON.stringify({
      ...cancelDiagnostic,
      cardBadgeAfterReload: await reloadedCancelledCard.locator(".appointment-actions .badge").allTextContents().then((values) => values.map((value) => String(value).trim())).catch(() => []),
      cancelButtonRemainsAfterReload: await reloadedCancelledCard.getByRole("button", { name: /^Cancel$/i }).count().then((count) => count > 0).catch(() => false),
      manage: await managePageDiagnostics(managePage, identity.clientName, identity.serviceName, null),
      assertionError: safeDiagnosticText(error?.message),
    })}`);
  }
  await page.reload();
  await expect(page.getByText(identity.clientName)).toBeVisible();

  await publicPage.close();
  await managePage.close();
});

test("staging negative checks use synthetic context", async ({ page, request }) => {
  const endpoint = (path) => new URL(
    path,
    requireStagingUrl(apiUrl, "SLOTZY_STAGING_API_URL")
  ).toString();
  const blockedResponses = await Promise.all([
    request.get(endpoint("/api/dev/emails")),
    request.delete(endpoint("/api/dev/emails")),
    request.post(endpoint("/api/notify/booking"), { data: {} }),
    request.post(endpoint("/api/notify/cancel"), { data: {} }),
    request.post(endpoint("/api/notify/reschedule"), { data: {} }),
  ]);
  for (const response of blockedResponses) {
    expect(response.status()).toBe(404);
    const payload = await readJson(response);
    expect(Object.keys(payload || {}).sort()).toEqual(["error"]);
  }
  await page.goto(`${frontendUrl}/pages/index.html`);
  await page.locator("#btn-login").click();
  await page.fill("#auth-username", `${runId}-missing`);
  await page.fill("#auth-password", "wrong-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#auth-error")).toBeVisible();
  await page.goto(`${frontendUrl}/pages/manage.html?shop=${identity.slug}&contact=invalid@example.test&code=INVALID`);
  await expect(page.getByText(/not found|invalid|unable/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cancel$/i })).toHaveCount(0);
});

// No cleanup API exists. Records are intentionally prefixed with `e2e-` and
// must be removed manually through staging-only operational tooling if desired.
