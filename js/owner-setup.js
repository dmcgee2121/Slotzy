import * as dataStore from "./dataStore.js";
import {
  clearSetupProgress,
  getOwnerSetupStatus,
  markSetupComplete,
  readSetupProgress,
  writeSetupProgress,
} from "./owner-setup-state.js";
import {
  DAY_KEYS,
  DAY_LABELS,
  DEFAULT_SHOP_LOGO_URL,
  MAX_SHOP_LOGO_BYTES,
  VALID_SHOP_LOGO_TYPES,
  buildBookingLink,
  copyText,
  createId,
  escapeHtml,
  getDefaultBookingPolicy,
  getStoredShopLogoDataUrl,
  looksLikeEmail,
  normalizeAvailability,
  normalizeTimeValue,
  readFileAsDataUrl,
  sanitizeBufferMinutes,
  toSlug,
} from "./owner-setup-shared.js";

(function () {
  const state = {
    username: "",
    currentStep: 1,
    shopId: "",
    shopName: "",
    shopSlug: "",
    shopLogoDataUrl: "",
    selectedAvailabilityBarberUsername: "",
    setupStatus: null,
  };

  const ui = {
    main: document.getElementById("ownerSetupMain"),
    stepSummary: document.getElementById("setupStepSummary"),
    introText: document.getElementById("setupIntroText"),
    shopNameInput: document.getElementById("setupShopName"),
    shopLogoInput: document.getElementById("setupShopLogoInput"),
    shopLogoStatus: document.getElementById("setupShopLogoStatus"),
    shopLogoPreview: document.getElementById("setupShopLogoPreview"),
    shopLogoPreviewStatus: document.getElementById("setupShopLogoPreviewStatus"),
    removeShopLogoBtn: document.getElementById("setupRemoveShopLogoBtn"),
    shopStatus: document.getElementById("setupShopStatus"),
    onlyBarberCheckbox: document.getElementById("setupOnlyBarberCheckbox"),
    ownerDisplayNameInput: document.getElementById("setupOwnerDisplayName"),
    barberAddCard: document.getElementById("setupBarberAddCard"),
    barberDisplayNameInput: document.getElementById("setupBarberDisplayName"),
    barberUsernameInput: document.getElementById("setupBarberUsername"),
    barberPasswordInput: document.getElementById("setupBarberPassword"),
    barberEmailInput: document.getElementById("setupBarberEmail"),
    barberStatus: document.getElementById("setupBarberStatus"),
    barberTeamSection: document.getElementById("setupBarberTeamSection"),
    barberList: document.getElementById("setupBarberList"),
    serviceBarberSelect: document.getElementById("setupServiceBarber"),
    serviceNameInput: document.getElementById("setupServiceName"),
    servicePriceInput: document.getElementById("setupServicePrice"),
    serviceDurationInput: document.getElementById("setupServiceDuration"),
    serviceStatus: document.getElementById("setupServiceStatus"),
    serviceList: document.getElementById("setupServiceList"),
    availabilityBarberSelect: document.getElementById("setupAvailabilityBarber"),
    timezoneSelect: document.getElementById("setupTimezone"),
    bufferMinutesSelect: document.getElementById("setupBufferMinutes"),
    availabilityWeeklyBody: document.getElementById("setupAvailabilityWeeklyBody"),
    availabilityStatus: document.getElementById("setupAvailabilityStatus"),
    readyShopName: document.getElementById("setupReadyShopName"),
    readyBarberName: document.getElementById("setupReadyBarberName"),
    bookingLinkInput: document.getElementById("setupBookingLink"),
    bookingQrImage: document.getElementById("setupBookingQrImage"),
    bookingQrEmpty: document.getElementById("setupBookingQrEmpty"),
    printBookingQrBtn: document.getElementById("setupPrintBookingQr"),
    readyStatus: document.getElementById("setupReadyStatus"),
    generalStatus: document.getElementById("setupStatus"),
  };

  document.addEventListener("DOMContentLoaded", initSetupWizard);

  async function initSetupWizard() {
    const sessionUser = dataStore.getSessionUser();
    const username = String(sessionUser?.username ?? "").trim();
    const role = String(sessionUser?.role ?? "").trim().toLowerCase();
    if (!username || role !== "owner") {
      renderOwnerOnlyState();
      return;
    }

    state.username = username;
    bindEvents();

    try {
      await refreshSetupStatus();
      if (!state.setupStatus?.needsWizard) {
        clearSetupProgress();
        window.location.replace("business-owner.html");
        return;
      }
      applySetupStatus();
      showStep(resolveInitialStep());
    } catch (error) {
      console.error("[Slotzy:owner-setup] Failed to initialize onboarding.", error);
      setStatus(ui.generalStatus, "Setup is unavailable right now. Please refresh and try again.", false);
    }
  }

  function bindEvents() {
    document.getElementById("setupStep1Next")?.addEventListener("click", handleSaveShopStep);
    document.getElementById("setupStep2Back")?.addEventListener("click", () => showStep(1));
    document.getElementById("setupStep2Next")?.addEventListener("click", handleBarberStepNext);
    document.getElementById("setupStep3Back")?.addEventListener("click", () => showStep(2));
    document.getElementById("setupStep3Next")?.addEventListener("click", handleServiceStepNext);
    document.getElementById("setupStep4Back")?.addEventListener("click", () => showStep(3));
    document.getElementById("setupSaveAvailabilityBtn")?.addEventListener("click", () => saveAvailabilityForSelectedBarber({ showSuccess: true }));
    document.getElementById("setupStep4Next")?.addEventListener("click", handleAvailabilityStepNext);
    document.getElementById("setupAddBarberBtn")?.addEventListener("click", handleAddBarber);
    document.getElementById("setupAddServiceBtn")?.addEventListener("click", handleAddService);
    document.getElementById("setupCopyBookingLink")?.addEventListener("click", handleCopyBookingLink);
    document.getElementById("setupPrintBookingQr")?.addEventListener("click", handlePrintBookingQr);
    document.getElementById("setupOpenBookingPage")?.addEventListener("click", handleOpenBookingPage);
    document.getElementById("setupGoDashboard")?.addEventListener("click", () => {
      window.location.href = "business-owner.html";
    });
    ui.shopLogoInput?.addEventListener("change", handleShopLogoChange);
    ui.removeShopLogoBtn?.addEventListener("click", handleRemoveShopLogo);
    ui.onlyBarberCheckbox?.addEventListener("change", renderBarberMode);
    ui.serviceList?.addEventListener("click", handleServiceListClick);
    ui.availabilityBarberSelect?.addEventListener("change", handleAvailabilityBarberChange);
    ui.availabilityWeeklyBody?.addEventListener("change", handleWeeklyToggleChange);
  }

  function setStatus(element, message, isSuccess) {
    if (!element) return;
    element.textContent = String(message ?? "");
    element.setAttribute("role", isSuccess ? "status" : "alert");
    element.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    element.setAttribute("aria-atomic", "true");
    element.classList.remove("status-success", "status-error");
    element.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearStatus(element) {
    if (!element) return;
    element.textContent = "";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.setAttribute("aria-atomic", "true");
    element.classList.remove("status-success", "status-error");
  }

  function renderOwnerOnlyState() {
    if (!ui.main) return;
    ui.main.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Owner sign-in required.</h1>
        <p class="small">Please sign in as an owner to run setup.</p>
        <a href="../index.html" class="btn btn-primary">Go to Home</a>
      </section>
    `;
  }

  async function refreshSetupStatus() {
    state.setupStatus = await getOwnerSetupStatus(state.username);
    state.shopId = String(state.setupStatus?.shopId ?? "").trim();
    state.shopName = String(state.setupStatus?.shopName ?? "").trim();
    state.shopSlug = String(state.setupStatus?.shop?.slug ?? "").trim() || toSlug(state.shopName || state.username);
    state.shopLogoDataUrl = getStoredShopLogoDataUrl(state.setupStatus?.shop, dataStore.getShop() || {});
  }

  function applySetupStatus() {
    if (ui.shopNameInput) ui.shopNameInput.value = state.shopName;
    if (ui.ownerDisplayNameInput) {
      ui.ownerDisplayNameInput.value = String(state.setupStatus?.owner?.displayName ?? state.username).trim() || state.username;
    }
    if (ui.onlyBarberCheckbox) {
      ui.onlyBarberCheckbox.checked = getAdditionalBarbers().length === 0;
    }
    renderShopLogoPreview();
    renderBarberMode();
    renderBarberList();
    renderServiceBarberOptions();
    renderServiceList();
    renderAvailabilityBarberOptions();
    renderReadyStep();
  }

  function resolveInitialStep() {
    const progress = readSetupProgress();
    if (!state.setupStatus?.hasNamedShop) return 1;
    if (!Array.isArray(state.setupStatus?.staff) || state.setupStatus.staff.length === 0) return 2;
    if (!state.setupStatus?.hasServices) return 3;
    if (!state.setupStatus?.hasAvailability) return 4;
    if (!state.shopId && progress.step > 1) return 1;
    if (progress.shopId && state.shopId && progress.shopId !== state.shopId) return 1;
    return Math.max(1, Math.min(5, Number(progress.step || 1)));
  }

  function showStep(stepNumber) {
    const nextStep = Math.max(1, Math.min(5, Number(stepNumber || 1)));
    state.currentStep = nextStep;

    document.querySelectorAll("[data-step-panel]").forEach((panel) => {
      const panelStep = Number(panel.getAttribute("data-step-panel") ?? "0");
      panel.classList.toggle("hidden", panelStep !== nextStep);
    });
    document.querySelectorAll(".setup-step").forEach((item) => {
      const itemStep = Number(item.getAttribute("data-step") ?? "0");
      item.classList.toggle("is-active", itemStep === nextStep);
      item.classList.toggle("is-complete", itemStep < nextStep);
    });

    if (ui.stepSummary) ui.stepSummary.textContent = `Step ${nextStep} of 5`;
    if (ui.introText) ui.introText.textContent = getIntroText(nextStep);
    writeSetupProgress({ step: nextStep, shopId: state.shopId });
    if (nextStep === 5) {
      renderReadyQr();
    }
  }

  function getIntroText(step) {
    if (step === 1) return "Set the shop name and branding clients will recognize on your public booking page.";
    if (step === 2) return "Solo-first by default. Keep going fast as a solo barber, or add team members only if you need multiple schedules.";
    if (step === 3) return "Add at least two services before you share the booking link.";
    if (step === 4) return "Set weekly hours and buffer time so Slotzy can generate valid booking slots.";
    if (step === 5) return "Your booking page is live. Copy the link, share the QR, and open the public page.";
    return "Set up your shop, team, services, and hours once, then start sharing your booking link.";
  }

  async function handleSaveShopStep() {
    clearStatus(ui.shopStatus);
    const shopName = String(ui.shopNameInput?.value ?? "").trim();
    if (shopName.length < 2) {
      setStatus(ui.shopStatus, "Shop name must be at least 2 characters.", false);
      return;
    }

    try {
      await saveOwnerShop(shopName);
      await saveOwnerRecord(String(ui.ownerDisplayNameInput?.value ?? state.username).trim() || state.username);
      await refreshSetupStatus();
      applySetupStatus();
      setStatus(ui.shopStatus, "Shop details saved.", true);
      window.showToast?.("Saved.", { type: "success" });
      showStep(2);
    } catch (error) {
      console.error("[Slotzy:owner-setup] Could not save shop step.", error);
      setStatus(ui.shopStatus, "Could not save shop details right now. Please try again.", false);
    }
  }

  async function handleBarberStepNext() {
    clearStatus(ui.barberStatus);
    const ownerDisplayName = String(ui.ownerDisplayNameInput?.value ?? "").trim();
    if (ownerDisplayName.length < 2) {
      setStatus(ui.barberStatus, "Your display name must be at least 2 characters.", false);
      return;
    }
    if (!ui.onlyBarberCheckbox?.checked && getAdditionalBarbers().length === 0) {
      setStatus(ui.barberStatus, "Add at least one barber or choose \"I'm the only barber\".", false);
      return;
    }

    try {
      await saveOwnerRecord(ownerDisplayName);
      await refreshSetupStatus();
      applySetupStatus();
      showStep(3);
    } catch (error) {
      console.error("[Slotzy:owner-setup] Could not save barber step.", error);
      setStatus(ui.barberStatus, "Could not save booking team right now. Please try again.", false);
    }
  }

  async function handleAddBarber() {
    clearStatus(ui.barberStatus);
    const displayName = String(ui.barberDisplayNameInput?.value ?? "").trim();
    const username = String(ui.barberUsernameInput?.value ?? "").trim();
    const password = String(ui.barberPasswordInput?.value ?? "").trim();
    const email = String(ui.barberEmailInput?.value ?? "").trim();

    if (displayName.length < 2) return setStatus(ui.barberStatus, "Display name must be at least 2 characters.", false);
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return setStatus(ui.barberStatus, "Username must be 3-32 chars using letters, numbers, dot, dash, or underscore.", false);
    if (password.length < 4) return setStatus(ui.barberStatus, "Password must be at least 4 characters.", false);
    if (email && !looksLikeEmail(email)) return setStatus(ui.barberStatus, "Please enter a valid barber email address.", false);

    const users = await dataStore.getUsersAsync();
    const nextUsers = Array.isArray(users) ? [...users] : [];
    const duplicate = nextUsers.some((user) => String(user?.username ?? "").trim().toLowerCase() === username.toLowerCase());
    if (duplicate) return setStatus(ui.barberStatus, "That barber username is already in use.", false);

    nextUsers.push({ username, password, role: "barber", shopId: state.shopId, displayName, email });
    await dataStore.saveUsersAsync(nextUsers);

    if (ui.barberDisplayNameInput) ui.barberDisplayNameInput.value = "";
    if (ui.barberUsernameInput) ui.barberUsernameInput.value = "";
    if (ui.barberPasswordInput) ui.barberPasswordInput.value = "";
    if (ui.barberEmailInput) ui.barberEmailInput.value = "";
    if (ui.onlyBarberCheckbox) ui.onlyBarberCheckbox.checked = false;

    await refreshSetupStatus();
    applySetupStatus();
    setStatus(ui.barberStatus, "Barber added to your booking team.", true);
    window.showToast?.("Barber account created.", "success");
  }

  async function handleServiceStepNext() {
    const services = getScopedServices();
    if (services.length < 2) {
      setStatus(ui.serviceStatus, "Add at least 2 services before continuing.", false);
      return;
    }
    showStep(4);
  }

  async function handleAddService() {
    clearStatus(ui.serviceStatus);
    const barberUsername = String(ui.serviceBarberSelect?.value ?? "").trim();
    const name = String(ui.serviceNameInput?.value ?? "").trim();
    const price = Number(ui.servicePriceInput?.value ?? "");
    const durationMinutes = Math.round(Number(ui.serviceDurationInput?.value ?? ""));

    if (!barberUsername) return setStatus(ui.serviceStatus, "Choose a barber for this service.", false);
    if (name.length < 2) return setStatus(ui.serviceStatus, "Service name must be at least 2 characters.", false);
    if (!Number.isFinite(price) || price <= 0) return setStatus(ui.serviceStatus, "Price must be greater than 0.", false);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 240) return setStatus(ui.serviceStatus, "Duration must be between 10 and 240 minutes.", false);

    const services = await dataStore.getServicesAsync();
    const nextServices = Array.isArray(services) ? [...services] : [];
    const duplicate = nextServices.some((service) => (
      String(service?.shopId ?? "").trim() === state.shopId
      && String(service?.barberUsername ?? service?.ownerUsername ?? "").trim() === barberUsername
      && String(service?.name ?? service?.title ?? "").trim().toLowerCase() === name.toLowerCase()
    ));
    if (duplicate) return setStatus(ui.serviceStatus, "That barber already has a service with this name.", false);

    nextServices.push({
      id: createId("svc"),
      name,
      title: name,
      price: Number(price.toFixed(2)),
      durationMinutes,
      duration: durationMinutes,
      active: true,
      createdAtISO: new Date().toISOString(),
      shopId: state.shopId,
      barberUsername,
      ownerUsername: barberUsername,
    });
    await dataStore.saveServicesAsync(nextServices);

    if (ui.serviceNameInput) ui.serviceNameInput.value = "";
    if (ui.servicePriceInput) ui.servicePriceInput.value = "";
    if (ui.serviceDurationInput) ui.serviceDurationInput.value = "";

    await refreshSetupStatus();
    applySetupStatus();
    setStatus(ui.serviceStatus, "Service added.", true);
    window.showToast?.("Service added.", "success");
  }

  async function handleServiceListClick(event) {
    const button = event.target.closest("button[data-action='remove-service'][data-id]");
    if (!button) return;
    const serviceId = String(button.getAttribute("data-id") ?? "").trim();
    if (!serviceId) return;

    const services = await dataStore.getServicesAsync();
    const nextServices = (Array.isArray(services) ? services : []).filter((service) => String(service?.id ?? "").trim() !== serviceId);
    await dataStore.saveServicesAsync(nextServices);
    await refreshSetupStatus();
    applySetupStatus();
    setStatus(ui.serviceStatus, "Service removed.", true);
  }

  async function handleAvailabilityBarberChange() {
    state.selectedAvailabilityBarberUsername = String(ui.availabilityBarberSelect?.value ?? "").trim();
    await loadAvailabilityEditor();
  }

  function handleWeeklyToggleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.field !== "enabled") return;
    const row = target.closest("tr");
    row?.querySelectorAll('input[type="time"]').forEach((input) => {
      input.disabled = !target.checked;
    });
  }

  async function handleAvailabilityStepNext() {
    const saved = await saveAvailabilityForSelectedBarber({ showSuccess: false });
    if (!saved) return;
    await refreshSetupStatus();
    applySetupStatus();
    await renderReadyQr();
    markSetupComplete({ shopId: state.shopId });
    setStatus(ui.readyStatus, "Setup complete. Your booking page is ready to share.", true);
    window.showToast?.("Setup complete.", { type: "success" });
    showStep(5);
  }

  async function saveAvailabilityForSelectedBarber({ showSuccess }) {
    clearStatus(ui.availabilityStatus);
    const barberUsername = String(ui.availabilityBarberSelect?.value ?? state.selectedAvailabilityBarberUsername ?? "").trim();
    if (!barberUsername) return setStatus(ui.availabilityStatus, "Choose a barber before saving availability.", false), false;

    const weekly = {};
    const errors = [];
    DAY_KEYS.forEach((dayKey) => {
      const enabled = Boolean(document.querySelector(`input[data-day="${dayKey}"][data-field="enabled"]`)?.checked);
      const start = String(document.querySelector(`input[data-day="${dayKey}"][data-field="start"]`)?.value ?? "").trim();
      const end = String(document.querySelector(`input[data-day="${dayKey}"][data-field="end"]`)?.value ?? "").trim();
      if (enabled) {
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) errors.push(`${DAY_LABELS[dayKey]} requires both start and end times.`);
        else if (start >= end) errors.push(`${DAY_LABELS[dayKey]} start must be before end.`);
      }
      weekly[dayKey] = { enabled, start: normalizeTimeValue(start, "09:00"), end: normalizeTimeValue(end, "17:00") };
    });

    if (DAY_KEYS.every((dayKey) => !weekly[dayKey].enabled)) errors.push("Enable at least one day before continuing.");
    if (errors.length > 0) return setStatus(ui.availabilityStatus, errors.join(" "), false), false;

    const existing = await dataStore.getAvailabilityForBarberAsync(barberUsername);
    await dataStore.saveAvailabilityForBarberAsync(barberUsername, {
      ...existing,
      timezone: String(ui.timezoneSelect?.value ?? "").trim() || "America/Chicago",
      bufferMinutes: sanitizeBufferMinutes(ui.bufferMinutesSelect?.value),
      weekly,
      timeOff: Array.isArray(existing?.timeOff) ? existing.timeOff : [],
    });

    if (showSuccess) {
      setStatus(ui.availabilityStatus, "Availability saved.", true);
      window.showToast?.("Availability saved.", "success");
    }
    return true;
  }

  async function handleCopyBookingLink() {
    const bookingLink = String(ui.bookingLinkInput?.value ?? "").trim();
    if (!bookingLink) return setStatus(ui.readyStatus, "Booking link is not ready yet.", false);
    const copied = await copyText(bookingLink);
    if (!copied) return setStatus(ui.readyStatus, "Could not copy link. Please copy it manually.", false);
    clearStatus(ui.readyStatus);
    window.showToast?.("Link copied", "success", 2000);
  }

  function handlePrintBookingQr() {
    clearStatus(ui.readyStatus);
    const bookingUrl = String(ui.bookingLinkInput?.value ?? "").trim();
    const qrDataUrl = String(ui.bookingQrImage?.src ?? "").trim();
    if (!bookingUrl || !qrDataUrl) {
      setStatus(ui.readyStatus, "QR code is not ready to print yet.", false);
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=540,height=720");
    if (!printWindow) {
      setStatus(ui.readyStatus, "Popup blocked. Allow popups to print the booking QR.", false);
      return;
    }

    const shopName = state.shopName || "Slotzy Shop";
    const safeTitle = escapeHtml(`${shopName} Booking QR`);
    const safeShopName = escapeHtml(shopName);
    const safeUrl = escapeHtml(bookingUrl);
    const logoSrc = escapeHtml(state.shopLogoDataUrl || DEFAULT_SHOP_LOGO_URL);
    const logoAlt = escapeHtml(state.shopLogoDataUrl ? `${shopName} logo` : "Slotzy logo");

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; text-align: center; color: #0f172a; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0 0 10px; font-size: 14px; color: #334155; }
    .logo-wrap { margin-bottom: 14px; }
    .shop-logo { max-width: 180px; max-height: 72px; width: auto; height: auto; object-fit: contain; border-radius: 18px; border: 1px solid #cbd5e1; padding: 8px 12px; background: #ffffff; }
    .qr-wrap { display: inline-block; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #ffffff; }
    .qr-image { width: 260px; height: 260px; display: block; }
    .shop-name { margin-top: 16px; font-size: 16px; font-weight: 700; color: #0f172a; }
    .link { margin-top: 12px; word-break: break-all; font-size: 12px; color: #334155; }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img class="shop-logo" src="${logoSrc}" alt="${logoAlt}" />
  </div>
  <h1>${safeTitle}</h1>
  <p>Scan to book</p>
  <div class="qr-wrap">
    <img class="qr-image" src="${qrDataUrl}" alt="Booking QR code" />
  </div>
  <p class="shop-name">${safeShopName}</p>
  <p class="link">${safeUrl}</p>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function handleOpenBookingPage() {
    const bookingLink = String(ui.bookingLinkInput?.value ?? "").trim();
    if (!bookingLink) return setStatus(ui.readyStatus, "Booking link is not ready yet.", false);
    window.open(bookingLink, "_blank", "noopener,noreferrer");
  }

  async function handleShopLogoChange(event) {
    clearStatus(ui.shopLogoStatus);
    const file = event?.target?.files?.[0];
    if (!file) return renderShopLogoPreview();
    const fileType = String(file.type ?? "").toLowerCase();
    if (!VALID_SHOP_LOGO_TYPES.has(fileType)) return resetLogoInput("Please choose a JPG, PNG, or WEBP logo.");
    if (Number(file.size ?? 0) > MAX_SHOP_LOGO_BYTES) return resetLogoInput("Logo must be 1 MB or smaller.");

    try {
      state.shopLogoDataUrl = await readFileAsDataUrl(file);
      renderShopLogoPreview();
      setStatus(ui.shopLogoStatus, "Logo ready to save with your shop.", true);
    } catch {
      resetLogoInput("Could not read that logo file. Please try another image.");
    }
  }

  function handleRemoveShopLogo() {
    state.shopLogoDataUrl = "";
    if (ui.shopLogoInput) ui.shopLogoInput.value = "";
    renderShopLogoPreview();
    setStatus(ui.shopLogoStatus, "Logo removed. Save the shop step to keep the default Slotzy logo.", true);
  }

  function resetLogoInput(message) {
    if (ui.shopLogoInput) ui.shopLogoInput.value = "";
    renderShopLogoPreview();
    setStatus(ui.shopLogoStatus, message, false);
  }

  async function saveOwnerShop(shopName) {
    const [users, shops] = await Promise.all([dataStore.getUsersAsync(), dataStore.getShopsAsync()]);
    const nextUsers = Array.isArray(users) ? [...users] : [];
    const nextShops = Array.isArray(shops) ? [...shops] : [];
    const ownerIndex = nextUsers.findIndex((user) => String(user?.username ?? "").trim() === state.username);
    const owner = ownerIndex >= 0 ? nextUsers[ownerIndex] : {};
    const shopId = String(owner?.shopId ?? state.shopId ?? "").trim() || createId("shop");
    const existingShopIndex = nextShops.findIndex((shop) => String(shop?.id ?? "").trim() === shopId);
    const existingShop = existingShopIndex >= 0 ? nextShops[existingShopIndex] : {};
    const legacyShop = dataStore.getShop() || {};
    const bookingPolicy = { ...getDefaultBookingPolicy(), ...(legacyShop.bookingPolicy || {}), ...(existingShop.bookingPolicy || {}) };
    const nextShop = {
      ...existingShop,
      id: shopId,
      name: shopName,
      slug: toSlug(shopName),
      logoDataUrl: String(state.shopLogoDataUrl ?? "").trim() || null,
      createdAtISO: String(existingShop?.createdAtISO ?? "").trim() || new Date().toISOString(),
      bookingPolicy,
    };

    if (existingShopIndex >= 0) nextShops[existingShopIndex] = nextShop;
    else nextShops.push(nextShop);

    nextUsers[ownerIndex >= 0 ? ownerIndex : nextUsers.length] = {
      ...owner,
      username: state.username,
      role: "owner",
      displayName: String(owner?.displayName ?? ui.ownerDisplayNameInput?.value ?? state.username).trim() || state.username,
      shopId,
    };

    await Promise.all([
      dataStore.saveUsersAsync(nextUsers),
      dataStore.saveShopsAsync(nextShops),
      dataStore.saveShopAsync({
        ...legacyShop,
        businessName: shopName,
        name: shopName,
        logoDataUrl: String(state.shopLogoDataUrl ?? "").trim() || null,
        shopId,
        bookingPolicy,
        updatedAt: new Date().toISOString(),
      }),
    ]);
  }

  async function saveOwnerRecord(displayName) {
    const users = await dataStore.getUsersAsync();
    const nextUsers = Array.isArray(users) ? [...users] : [];
    const ownerIndex = nextUsers.findIndex((user) => String(user?.username ?? "").trim() === state.username);
    const owner = ownerIndex >= 0 ? nextUsers[ownerIndex] : {};
    nextUsers[ownerIndex >= 0 ? ownerIndex : nextUsers.length] = {
      ...owner,
      username: state.username,
      role: "owner",
      displayName,
      shopId: state.shopId || String(owner?.shopId ?? "").trim() || null,
    };
    await dataStore.saveUsersAsync(nextUsers);
  }

  function renderShopLogoPreview() {
    if (ui.shopLogoPreview) ui.shopLogoPreview.src = state.shopLogoDataUrl || DEFAULT_SHOP_LOGO_URL;
    if (ui.shopLogoPreviewStatus) ui.shopLogoPreviewStatus.textContent = state.shopLogoDataUrl ? "Custom shop logo ready for your booking page and QR." : "Using the default Slotzy logo.";
    if (ui.removeShopLogoBtn) ui.removeShopLogoBtn.disabled = !state.shopLogoDataUrl;
  }

  function renderBarberMode() {
    const isSolo = Boolean(ui.onlyBarberCheckbox?.checked);
    ui.barberAddCard?.classList.toggle("hidden", isSolo);
    ui.barberTeamSection?.classList.toggle("hidden", isSolo);
    ui.barberList?.classList.toggle("hidden", isSolo);
  }

  function renderBarberList() {
    const staff = Array.isArray(state.setupStatus?.staff) ? state.setupStatus.staff : [];
    if (!ui.barberList) return;
    if (staff.length === 0) {
      ui.barberList.innerHTML = `<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">S</span><h3>No booking team yet</h3><p>Your owner profile will appear here once the shop is saved.</p></section>`;
      return;
    }
    ui.barberList.innerHTML = `<ul class="availability-timeoff-items">${staff.map((staffUser) => `
      <li class="availability-timeoff-item"><div><strong>${escapeHtml(staffUser.displayName)}</strong><p class="small">@${escapeHtml(staffUser.username)}</p>${String(staffUser?.email ?? "").trim() ? `<p class="small">${escapeHtml(String(staffUser.email))}</p>` : ""}</div><span class="badge badge-muted">${escapeHtml(staffUser.role === "owner" ? "Owner" : "Barber")}</span></li>`).join("")}</ul>`;
  }

  function renderServiceBarberOptions() {
    renderStaffSelect(ui.serviceBarberSelect);
  }

  function renderServiceList() {
    const services = getScopedServices();
    if (!ui.serviceList) return;
    if (services.length === 0) {
      ui.serviceList.innerHTML = `<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">S</span><h3>No services yet</h3><p>Add at least two services so clients have real options to book.</p></section>`;
      return;
    }
    const namesByUsername = new Map((state.setupStatus?.staff || []).map((staffUser) => [staffUser.username, staffUser.displayName]));
    ui.serviceList.innerHTML = `<ul class="availability-timeoff-items">${services.map((service) => {
      const barberUsername = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim();
      const barberName = namesByUsername.get(barberUsername) || barberUsername || "Barber";
      const duration = Number(service?.durationMinutes ?? service?.duration ?? 0);
      return `<li class="availability-timeoff-item"><div><strong>${escapeHtml(String(service?.name ?? service?.title ?? "Service"))}</strong><p class="small">${escapeHtml(barberName)} | $${Number(service?.price ?? 0).toFixed(2)} | ${escapeHtml(String(duration))} min</p></div><button class="btn btn-ghost" type="button" data-action="remove-service" data-id="${escapeHtml(String(service?.id ?? ""))}">Remove</button></li>`;
    }).join("")}</ul>`;
  }

  function renderAvailabilityBarberOptions() {
    renderStaffSelect(ui.availabilityBarberSelect, state.selectedAvailabilityBarberUsername);
    state.selectedAvailabilityBarberUsername = String(ui.availabilityBarberSelect?.value ?? "").trim();
    loadAvailabilityEditor();
  }

  function renderStaffSelect(selectEl, preferredUsername = "") {
    if (!selectEl) return;
    const staff = Array.isArray(state.setupStatus?.staff) ? state.setupStatus.staff : [];
    if (staff.length === 0) {
      selectEl.innerHTML = '<option value="">Add your booking team first</option>';
      selectEl.disabled = true;
      return;
    }
    const currentValue = String(preferredUsername || selectEl.value || "").trim();
    selectEl.innerHTML = staff.map((staffUser) => `<option value="${escapeHtml(staffUser.username)}">${escapeHtml(staffUser.displayName)}</option>`).join("");
    selectEl.disabled = false;
    selectEl.value = staff.some((staffUser) => staffUser.username === currentValue) ? currentValue : staff[0].username;
  }

  async function loadAvailabilityEditor() {
    const username = String(ui.availabilityBarberSelect?.value ?? "").trim();
    state.selectedAvailabilityBarberUsername = username;
    const availability = normalizeAvailability(username ? await dataStore.getAvailabilityForBarberAsync(username) : {});
    if (ui.timezoneSelect) ui.timezoneSelect.value = availability.timezone;
    if (ui.bufferMinutesSelect) ui.bufferMinutesSelect.value = String(availability.bufferMinutes);
    if (ui.availabilityWeeklyBody) {
      ui.availabilityWeeklyBody.innerHTML = DAY_KEYS.map((dayKey) => {
        const row = availability.weekly[dayKey];
        return `<tr><td>${escapeHtml(DAY_LABELS[dayKey])}</td><td><input type="checkbox" data-day="${dayKey}" data-field="enabled" ${row.enabled ? "checked" : ""} /></td><td><input type="time" data-day="${dayKey}" data-field="start" value="${escapeHtml(row.start)}" ${row.enabled ? "" : "disabled"} /></td><td><input type="time" data-day="${dayKey}" data-field="end" value="${escapeHtml(row.end)}" ${row.enabled ? "" : "disabled"} /></td></tr>`;
      }).join("");
    }
  }

  function renderReadyStep() {
    const staffNames = (state.setupStatus?.staff || []).map((staffUser) => staffUser.displayName).filter(Boolean);
    if (ui.readyShopName) ui.readyShopName.textContent = state.shopName || "My Shop";
    if (ui.readyBarberName) ui.readyBarberName.textContent = staffNames.length > 0 ? staffNames.join(", ") : "Booking team pending";
    if (ui.bookingLinkInput) ui.bookingLinkInput.value = buildBookingLink(state.shopSlug || toSlug(state.shopName || state.username));
    if (ui.printBookingQrBtn) ui.printBookingQrBtn.disabled = true;
  }

  async function renderReadyQr() {
    const bookingLink = String(ui.bookingLinkInput?.value ?? "").trim();
    if (!bookingLink) return;
    if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
      setStatus(ui.readyStatus, "QR generator is unavailable right now.", false);
      if (ui.printBookingQrBtn) ui.printBookingQrBtn.disabled = true;
      return;
    }
    try {
      const dataUrl = await window.QRCode.toDataURL(bookingLink, { margin: 1, width: 320, color: { dark: "#0f172a", light: "#ffffff" } });
      if (ui.bookingQrImage) {
        ui.bookingQrImage.src = String(dataUrl ?? "");
        ui.bookingQrImage.classList.remove("hidden");
      }
      ui.bookingQrEmpty?.classList.add("hidden");
      if (ui.printBookingQrBtn) ui.printBookingQrBtn.disabled = false;
    } catch (error) {
      console.error("[Slotzy:owner-setup] Could not render booking QR.", error);
      setStatus(ui.readyStatus, "Could not generate QR code.", false);
      if (ui.printBookingQrBtn) ui.printBookingQrBtn.disabled = true;
    }
  }

  function getAdditionalBarbers() {
    return (state.setupStatus?.additionalBarbers || []).filter((staffUser) => String(staffUser?.role ?? "").trim().toLowerCase() === "barber");
  }

  function getScopedServices() {
    return Array.isArray(state.setupStatus?.services) ? state.setupStatus.services : [];
  }
})();
