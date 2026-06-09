import * as dataStore from "./dataStore.js";
import { wireLogoutButton } from "./logout.js";

(function () {
  const settingsMain = document.getElementById("settingsMain");
  const backBtn = document.getElementById("backBtn");
  const fullNameInput = document.getElementById("fullNameInput");
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const profileCompletenessText = document.getElementById("profileCompletenessText");
  const profileProgressBar = document.getElementById("profileProgressBar");
  const missingFields = document.getElementById("missingFields");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profileStatus = document.getElementById("profileStatus");

  const shopSettingsCard = document.getElementById("shopSettingsCard");
  const businessNameInput = document.getElementById("businessNameInput");
  const shopPhoneInput = document.getElementById("shopPhoneInput");
  const shopEmailInput = document.getElementById("shopEmailInput");
  const address1Input = document.getElementById("address1Input");
  const cityInput = document.getElementById("cityInput");
  const stateInput = document.getElementById("stateInput");
  const zipInput = document.getElementById("zipInput");
  const shopLogoInput = document.getElementById("shopLogoInput");
  const shopLogoInputStatus = document.getElementById("shopLogoInputStatus");
  const shopLogoPreview = document.getElementById("shopLogoPreview");
  const shopLogoPreviewStatus = document.getElementById("shopLogoPreviewStatus");
  const removeShopLogoBtn = document.getElementById("removeShopLogoBtn");
  const shopCoverInput = document.getElementById("shopCoverInput");
  const shopCoverInputStatus = document.getElementById("shopCoverInputStatus");
  const shopCoverPreview = document.getElementById("shopCoverPreview");
  const shopCoverPreviewStatus = document.getElementById("shopCoverPreviewStatus");
  const removeShopCoverBtn = document.getElementById("removeShopCoverBtn");
  const cancelHoursInput = document.getElementById("cancelHoursInput");
  const bufferMinutesInput = document.getElementById("bufferMinutesInput");
  const requireDepositInput = document.getElementById("requireDepositInput");
  const depositAmountInput = document.getElementById("depositAmountInput");
  const lateGraceMinutesInput = document.getElementById("lateGraceMinutesInput");
  const noShowStrikeLimitInput = document.getElementById("noShowStrikeLimitInput");
  const allowSameDayInput = document.getElementById("allowSameDayInput");
  const maxDaysAdvanceInput = document.getElementById("maxDaysAdvanceInput");
  const reminder24HoursInput = document.getElementById("reminder24HoursInput");
  const reminder2HoursInput = document.getElementById("reminder2HoursInput");
  const reminderCustomEnabledInput = document.getElementById("reminderCustomEnabledInput");
  const reminderCustomMinutesInput = document.getElementById("reminderCustomMinutesInput");
  const saveShopBtn = document.getElementById("saveShopBtn");
  const shopStatus = document.getElementById("shopStatus");
  const publicBookingLinkInput = document.getElementById("publicBookingLinkInput");
  const copyPublicBookingLinkBtn = document.getElementById("copyPublicBookingLinkBtn");
  const openPublicBookingLinkBtn = document.getElementById("openPublicBookingLinkBtn");
  const publicBookingLinkStatus = document.getElementById("publicBookingLinkStatus");
  const publicBookingQrImage = document.getElementById("publicBookingQrImage");
  const publicBookingQrEmpty = document.getElementById("publicBookingQrEmpty");
  const downloadPublicBookingQrBtn = document.getElementById("downloadPublicBookingQrBtn");
  const printPublicBookingQrBtn = document.getElementById("printPublicBookingQrBtn");
  const publicBookingQrStatus = document.getElementById("publicBookingQrStatus");
  const demoModeCard = document.getElementById("demoModeCard");
  const resetDemoBtn = document.getElementById("resetDemoBtn");
  const copyDemoOwnerBtn = document.getElementById("copyDemoOwnerBtn");
  const demoStatus = document.getElementById("demoStatus");
  const backupRestoreCard = document.getElementById("backupRestoreCard");
  const exportBackupBtn = document.getElementById("exportBackupBtn");
  const importBackupBtn = document.getElementById("importBackupBtn");
  const backupImportInput = document.getElementById("backupImportInput");
  const backupRestoreWarning = document.getElementById("backupRestoreWarning");
  const backupRestoreSummary = document.getElementById("backupRestoreSummary");
  const confirmBackupRestoreBtn = document.getElementById("confirmBackupRestoreBtn");
  const cancelBackupRestoreBtn = document.getElementById("cancelBackupRestoreBtn");
  const backupStatus = document.getElementById("backupStatus");
  const supportToolsCard = document.getElementById("supportToolsCard");
  const reportProblemBtn = document.getElementById("reportProblemBtn");
  const supportStatus = document.getElementById("supportStatus");

  const barberDisplayNameInput = document.getElementById("barberDisplayNameInput");
  const barberUsernameInput = document.getElementById("barberUsernameInput");
  const barberEmailInput = document.getElementById("barberEmailInput");
  const barberPasswordInput = document.getElementById("barberPasswordInput");
  const addBarberUserBtn = document.getElementById("addBarberUserBtn");
  const barberUserStatus = document.getElementById("barberUserStatus");
  const barberUsersList = document.getElementById("barberUsersList");

  const showToast = window.showToast;
  const APP_VERSION = "0.1.0-beta";
  const DEFAULT_SHOP_LOGO_URL = new URL("../assets/images/slotzy-logo.png", import.meta.url).href;
  const MAX_SHOP_IMAGE_BYTES = 1024 * 1024;
  const VALID_SHOP_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
  const OWNER_STYLES_WARNING_BANNER_ID = "ownerStylesWarningBanner";
  let saveFeedbackTimer = null;
  let publicBookingQrDataUrl = "";
  let shopLogoDataUrl = "";
  let shopCoverDataUrl = "";
  let pendingBackupRestore = null;
  const DEMO_LOGIN_CREDENTIALS = {
    owner: { username: "owner_demo", password: "demo" },
    jordan: { username: "jordan_demo", password: "demo" },
    alex: { username: "alex_demo", password: "demo" },
  };

  const currentUser = getCurrentUser();
  const currentUsername = getUsername(currentUser);
  const currentRole = getRole(currentUser);

  init();

  function init() {
    if (!currentUsername || !currentRole || (currentRole !== "owner" && currentRole !== "barber")) {
      renderLoggedOutState();
      return;
    }

    wireLogoutButton({ redirectPath: "../index.html" });

    backBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "business-owner.html";
    });

    loadProfile();
    bindCompletenessEvents();
    updateProfileCompleteness();
    saveProfileBtn?.addEventListener("click", handleSaveProfile);
    configureShopSettings();
    configureDemoModeControls();
    configureBackupRestoreControls();
    configureSupportTools();
  }

  function getCurrentUser() {
    return dataStore.getSessionUser();
  }

  function getUsername(user) {
    if (!user || typeof user !== "object") return "";
    return String(user.username ?? "").trim();
  }

  function getRole(user) {
    if (!user || typeof user !== "object") return "";
    const role = String(user.role ?? "").trim().toLowerCase();
    if (role === "owner") return "owner";
    if (role === "barber") return "barber";
    return "";
  }

  function getProfilesMap() {
    return dataStore.getProfiles();
  }

  function saveProfilesMap(profilesMap) {
    dataStore.saveProfiles(profilesMap);
  }

  function loadProfile() {
    const profiles = getProfilesMap();
    const profile = profiles[currentUsername];
    if (!profile || typeof profile !== "object") return;

    if (fullNameInput) fullNameInput.value = String(profile.fullName ?? "");
    if (emailInput) emailInput.value = String(profile.email ?? "");
    if (phoneInput) phoneInput.value = String(profile.phone ?? "");
  }

  function handleSaveProfile() {
    if (!saveProfileBtn || saveProfileBtn.disabled) return;
    clearProfileStatus();

    const fullName = String(fullNameInput?.value ?? "").trim();
    const email = String(emailInput?.value ?? "").trim();
    const phone = String(phoneInput?.value ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (fullName && fullName.length < 2) {
      setProfileStatus("Full name must be at least 2 characters.", false);
      return;
    }
    if (email && (!email.includes("@") || !email.includes("."))) {
      setProfileStatus("Please enter a valid email address.", false);
      return;
    }
    if (phone && phoneDigits.length < 10) {
      setProfileStatus("Please enter a valid phone number with at least 10 digits.", false);
      return;
    }

    const profiles = getProfilesMap();
    profiles[currentUsername] = {
      fullName,
      email,
      phone,
      phoneDigits,
      updatedAt: new Date().toISOString(),
    };
    saveProfilesMap(profiles);
    syncCurrentUserEmail(email);
    setProfileStatus("Profile saved successfully.", true);
    notifyProfileSaved();
    applySavedButtonFeedback();
    updateProfileCompleteness();
  }

  function configureShopSettings() {
    if (!shopSettingsCard) return;
    if (currentRole !== "owner") {
      shopSettingsCard.classList.add("hidden");
      return;
    }

    shopSettingsCard.classList.remove("hidden");
    requireDepositInput?.addEventListener("change", applyDepositToggleState);
    reminderCustomEnabledInput?.addEventListener("change", applyReminderToggleState);
    shopLogoInput?.addEventListener("change", handleShopLogoChange);
    removeShopLogoBtn?.addEventListener("click", handleRemoveShopLogo);
    shopCoverInput?.addEventListener("change", handleShopCoverChange);
    removeShopCoverBtn?.addEventListener("click", handleRemoveShopCover);
    loadShopSettings();
    scheduleOwnerStylesWarningCheck();
    saveShopBtn?.addEventListener("click", handleSaveShopSettings);
    copyPublicBookingLinkBtn?.addEventListener("click", handleCopyPublicBookingLink);
    openPublicBookingLinkBtn?.addEventListener("click", handleOpenPublicBookingLink);
    downloadPublicBookingQrBtn?.addEventListener("click", handleDownloadPublicBookingQr);
    printPublicBookingQrBtn?.addEventListener("click", handlePrintPublicBookingQr);
    addBarberUserBtn?.addEventListener("click", handleAddBarberUser);
    renderShopTeam();
  }

  function scheduleOwnerStylesWarningCheck() {
    if (!isDevMode()) return;
    const runCheck = () => {
      if (shouldShowOwnerStylesWarning()) {
        insertOwnerStylesWarningBanner();
        return;
      }

      removeOwnerStylesWarningBanner();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => window.requestAnimationFrame(runCheck));
    } else {
      window.setTimeout(runCheck, 0);
    }

    window.addEventListener("load", runCheck, { once: true });
  }

  function shouldShowOwnerStylesWarning() {
    if (!shopSettingsCard || !shopLogoPreview) return false;

    const computedStyle = window.getComputedStyle(shopLogoPreview);
    const maxHeight = String(computedStyle.maxHeight ?? "").trim().toLowerCase();
    const maxHeightValue = Number.parseFloat(maxHeight);
    const logoLooksUncapped = maxHeight === "none"
      || (Number.isFinite(maxHeightValue) && maxHeightValue > 300);

    return logoLooksUncapped || !areOwnerStylesAvailable();
  }

  function areOwnerStylesAvailable() {
    const ownerStylesheetLink = document.querySelector('link[rel="stylesheet"][href$="owner-dashboard.css"]');
    if (!ownerStylesheetLink || ownerStylesheetLink.disabled) return false;

    const ownerSheet = ownerStylesheetLink.sheet;
    if (!ownerSheet) return false;

    try {
      return ownerSheet.cssRules.length > 0;
    } catch {
      return true;
    }
  }

  function insertOwnerStylesWarningBanner() {
    if (!shopSettingsCard || document.getElementById(OWNER_STYLES_WARNING_BANNER_ID)) return;

    const banner = document.createElement("aside");
    banner.id = OWNER_STYLES_WARNING_BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.className = "empty-state empty-state-warning empty-state-inline";

    const icon = document.createElement("span");
    icon.className = "empty-state-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "!";

    const content = document.createElement("div");
    content.className = "empty-state-content";

    const title = document.createElement("h3");
    title.className = "empty-state-title";
    title.textContent = "Owner styles not loaded.";

    const message = document.createElement("p");
    message.className = "empty-state-subtitle";
    message.textContent = "Make sure you are running from the project root and serving over HTTP.";
    content.append(title, message);

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "btn btn-sm btn-ghost";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.setAttribute("aria-label", "Dismiss owner styles warning");
    dismissBtn.addEventListener("click", () => banner.remove());

    banner.append(icon, content, dismissBtn);
    const cardHeading = shopSettingsCard.querySelector("h2");
    if (cardHeading) {
      shopSettingsCard.insertBefore(banner, cardHeading);
      return;
    }

    shopSettingsCard.prepend(banner);
  }

  function removeOwnerStylesWarningBanner() {
    document.getElementById(OWNER_STYLES_WARNING_BANNER_ID)?.remove();
  }

  function isDevMode() {
    const protocol = String(window.location.protocol ?? "").toLowerCase();
    const hostname = String(window.location.hostname ?? "").trim().toLowerCase();

    if (protocol === "file:") return true;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
    if (hostname.endsWith(".local")) return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) return true;

    return false;
  }

  function configureDemoModeControls() {
    if (!demoModeCard || !resetDemoBtn) return;
    if (!dataStore.isDemoMode()) {
      demoModeCard.classList.add("hidden");
      clearDemoStatus();
      return;
    }

    demoModeCard.classList.remove("hidden");
    if (resetDemoBtn.dataset.bound !== "true") {
      resetDemoBtn.addEventListener("click", handleResetDemoClick);
      resetDemoBtn.dataset.bound = "true";
    }
    if (copyDemoOwnerBtn && copyDemoOwnerBtn.dataset.bound !== "true") {
      copyDemoOwnerBtn.addEventListener("click", () => handleCopyDemoLogin("owner"));
      copyDemoOwnerBtn.dataset.bound = "true";
    }
  }

  function configureBackupRestoreControls() {
    if (!backupRestoreCard) return;
    if (currentRole !== "owner") {
      backupRestoreCard.classList.add("hidden");
      clearBackupStatus();
      hideBackupRestoreWarning();
      return;
    }

    backupRestoreCard.classList.remove("hidden");
    if (exportBackupBtn && exportBackupBtn.dataset.bound !== "true") {
      exportBackupBtn.addEventListener("click", handleExportBackupClick);
      exportBackupBtn.dataset.bound = "true";
    }
    if (importBackupBtn && importBackupBtn.dataset.bound !== "true") {
      importBackupBtn.addEventListener("click", handleImportBackupClick);
      importBackupBtn.dataset.bound = "true";
    }
    if (backupImportInput && backupImportInput.dataset.bound !== "true") {
      backupImportInput.addEventListener("change", handleBackupFileSelected);
      backupImportInput.dataset.bound = "true";
    }
    if (confirmBackupRestoreBtn && confirmBackupRestoreBtn.dataset.bound !== "true") {
      confirmBackupRestoreBtn.addEventListener("click", handleConfirmBackupRestore);
      confirmBackupRestoreBtn.dataset.bound = "true";
    }
    if (cancelBackupRestoreBtn && cancelBackupRestoreBtn.dataset.bound !== "true") {
      cancelBackupRestoreBtn.addEventListener("click", cancelPendingBackupRestore);
      cancelBackupRestoreBtn.dataset.bound = "true";
    }
  }

  function configureSupportTools() {
    if (!supportToolsCard) return;
    if (currentRole !== "owner") {
      supportToolsCard.classList.add("hidden");
      clearSupportStatus();
      return;
    }

    supportToolsCard.classList.remove("hidden");
    if (reportProblemBtn && reportProblemBtn.dataset.bound !== "true") {
      reportProblemBtn.addEventListener("click", handleReportProblemClick);
      reportProblemBtn.dataset.bound = "true";
    }
  }

  function handleResetDemoClick() {
    clearDemoStatus();
    const confirmed = window.confirm("Reset demo data to the original sample set?");
    if (!confirmed) return;
    setDemoStatus("Resetting demo data...", true);
    window.location.href = "../index.html?reset=1&demo=1";
  }

  async function handleCopyDemoLogin(accountType) {
    clearDemoStatus();
    const credentials = DEMO_LOGIN_CREDENTIALS[accountType];
    if (!credentials) {
      setDemoStatus("Demo login is unavailable.", false);
      return;
    }

    const payload = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
    try {
      const copied = await copyText(payload);
      if (!copied) throw new Error("copy_failed");
      const label = accountType === "owner"
        ? "Owner"
        : (accountType === "jordan" ? "Jordan" : "Alex");
      setDemoStatus(`${label} demo login copied.`, true);
      showToast?.(`${label} demo login copied.`, "success");
    } catch {
      setDemoStatus("Could not copy demo login. Please copy it manually.", false);
    }
  }

  function handleExportBackupClick() {
    clearBackupStatus();
    hideBackupRestoreWarning();

    try {
      const payload = dataStore.createSlotzyBackup();
      const filename = buildBackupFilename(payload?.exportedAtISO);
      downloadJsonFile(filename, payload);
      setBackupStatus(`Backup exported: ${filename}`, true);
      showToast?.("Backup exported.", { type: "success" });
    } catch (error) {
      console.error("[Slotzy:settings] Could not export backup.", error);
      setBackupStatus("Could not export backup right now. Please try again.", false);
    }
  }

  function handleImportBackupClick() {
    clearBackupStatus();
    hideBackupRestoreWarning();
    pendingBackupRestore = null;
    if (backupImportInput) {
      backupImportInput.value = "";
      backupImportInput.click();
    }
  }

  async function handleBackupFileSelected(event) {
    clearBackupStatus();
    pendingBackupRestore = null;
    const file = event?.target?.files?.[0];
    if (!file) {
      hideBackupRestoreWarning();
      return;
    }

    const lowerName = String(file.name ?? "").toLowerCase();
    if (!lowerName.endsWith(".json")) {
      hideBackupRestoreWarning();
      setBackupStatus("Choose a Slotzy backup JSON file.", false);
      return;
    }

    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText);
      const summary = dataStore.getSlotzyBackupSummary(payload);
      if (summary.format !== "slotzy-backup") {
        throw new Error("not_slotzy_backup");
      }

      pendingBackupRestore = {
        payload,
        filename: String(file.name ?? "").trim() || "slotzy-backup.json",
        summary,
      };
      renderPendingBackupRestore();
      setBackupStatus("Backup loaded. Review the warning below before restoring.", true);
    } catch (error) {
      console.error("[Slotzy:settings] Could not read backup file.", error);
      pendingBackupRestore = null;
      hideBackupRestoreWarning();
      setBackupStatus("Could not read that backup file. Choose a valid Slotzy backup JSON.", false);
    }
  }

  function renderPendingBackupRestore() {
    if (!backupRestoreWarning || !backupRestoreSummary || !pendingBackupRestore) return;
    const summary = pendingBackupRestore.summary || {};
    const exportedAt = formatBackupTimestamp(summary.exportedAtISO);
    backupRestoreSummary.textContent = [
      `File: ${pendingBackupRestore.filename}`,
      exportedAt ? `Exported: ${exportedAt}` : "",
      `Local keys: ${Number(summary.localKeyCount ?? 0)}`,
      `Session keys: ${Number(summary.sessionKeyCount ?? 0)}`,
    ].filter(Boolean).join(" | ");
    backupRestoreWarning.classList.remove("hidden");
  }

  function hideBackupRestoreWarning() {
    if (backupRestoreWarning) {
      backupRestoreWarning.classList.add("hidden");
    }
    if (backupRestoreSummary) {
      backupRestoreSummary.textContent = "Choose a backup file to review it before restoring.";
    }
  }

  function cancelPendingBackupRestore() {
    pendingBackupRestore = null;
    if (backupImportInput) backupImportInput.value = "";
    hideBackupRestoreWarning();
    clearBackupStatus();
  }

  function handleConfirmBackupRestore() {
    if (!pendingBackupRestore?.payload) {
      setBackupStatus("Choose a backup file before restoring.", false);
      return;
    }

    try {
      const summary = dataStore.restoreSlotzyBackup(pendingBackupRestore.payload);
      const restoredLocal = Number(summary?.localKeyCount ?? 0);
      const restoredSession = Number(summary?.sessionKeyCount ?? 0);
      setBackupStatus(`Backup restored. Reloading with ${restoredLocal} local keys and ${restoredSession} session keys.`, true);
      showToast?.("Backup restored.", { type: "success" });
      pendingBackupRestore = null;
      hideBackupRestoreWarning();
      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      console.error("[Slotzy:settings] Could not restore backup.", error);
      setBackupStatus("Could not restore that backup. Your current data was not changed.", false);
    }
  }

  async function handleReportProblemClick() {
    clearSupportStatus();
    const systemInfo = [
      "Slotzy support report",
      `App version: ${APP_VERSION}`,
      `Demo mode: ${dataStore.isDemoMode() ? "ON" : "OFF"}`,
      `Current shopId: ${getCurrentShopId() || "none"}`,
      `Current user: ${currentUsername || "unknown"}`,
      `Browser: ${navigator.userAgent}`,
    ].join("\n");

    try {
      const copied = await copyText(systemInfo);
      if (!copied) throw new Error("copy_failed");
      setSupportStatus("System info copied. Paste it into your bug report.", true);
      showToast?.("System info copied.", { type: "success" });
    } catch {
      setSupportStatus("Could not copy system info. Please try again.", false);
    }
  }

  function getCurrentOwnerRecord() {
    const users = dataStore.getUsers();
    return users.find((user) => String(user?.username ?? "") === currentUsername) || null;
  }

  function ensureCurrentShop() {
    const users = dataStore.getUsers();
    const shops = dataStore.getShops();
    const owner = users.find((user) => String(user?.username ?? "") === currentUsername);
    if (!owner) return shops[0] || null;

    let targetShopId = String(owner?.shopId ?? "").trim();
    if (!targetShopId) {
      targetShopId = shops[0]?.id || "";
    }

    let targetShop = dataStore.getShopById(targetShopId);
    if (!targetShop) {
      const nextShopName = getLegacyShopName();
      targetShop = {
        id: createId("shop"),
        name: nextShopName,
        slug: toSlug(nextShopName),
        createdAtISO: new Date().toISOString(),
      };
      dataStore.saveShops([...shops, targetShop]);
      targetShopId = targetShop.id;
    }

    if (owner.shopId !== targetShopId) {
      const nextUsers = users.map((user) => (
        String(user?.username ?? "") === currentUsername
          ? { ...user, shopId: targetShopId }
          : user
      ));
      dataStore.saveUsers(nextUsers);
    }

    return targetShop;
  }

  function getLegacyShopName() {
    const legacyShop = dataStore.getShop();
    return String(legacyShop?.businessName ?? legacyShop?.name ?? "My Shop").trim() || "My Shop";
  }

  function getStoredShopLogoDataUrl(shop, legacyShop) {
    return String(
      shop?.logoDataUrl ??
      legacyShop?.logoDataUrl ??
      legacyShop?.logoUrl ??
      ""
    ).trim();
  }

  function getStoredShopCoverDataUrl(shop, legacyShop) {
    return String(
      shop?.coverDataUrl ??
      legacyShop?.coverDataUrl ??
      ""
    ).trim();
  }

  function getShopLogoPreviewSource() {
    return shopLogoDataUrl || DEFAULT_SHOP_LOGO_URL;
  }

  function renderShopLogoPreview() {
    if (shopLogoPreview) {
      shopLogoPreview.src = getShopLogoPreviewSource();
      shopLogoPreview.alt = shopLogoDataUrl ? "Shop logo preview" : "Default Slotzy logo preview";
    }
    if (shopLogoPreviewStatus) {
      shopLogoPreviewStatus.textContent = shopLogoDataUrl
        ? "Custom shop logo ready. It will appear on your public booking page and QR printout."
        : "No custom logo yet. Clients will see the default Slotzy logo until you upload one.";
    }
    if (removeShopLogoBtn) {
      removeShopLogoBtn.disabled = !shopLogoDataUrl;
    }
    if (shopLogoInput && !shopLogoDataUrl) {
      shopLogoInput.value = "";
    }
  }

  function renderShopCoverPreview() {
    if (shopCoverPreview) {
      if (shopCoverDataUrl) {
        shopCoverPreview.src = shopCoverDataUrl;
      } else {
        shopCoverPreview.removeAttribute("src");
      }
      shopCoverPreview.alt = shopCoverDataUrl ? "Shop cover preview" : "No shop cover selected";
      shopCoverPreview.classList.toggle("hidden", !shopCoverDataUrl);
    }
    if (shopCoverPreviewStatus) {
      shopCoverPreviewStatus.textContent = shopCoverDataUrl
        ? "Custom cover image ready. It will appear on your public booking page."
        : "No cover image yet. Clients will see the default Slotzy page styling until you add one.";
    }
    if (removeShopCoverBtn) {
      removeShopCoverBtn.disabled = !shopCoverDataUrl;
    }
    if (shopCoverInput && !shopCoverDataUrl) {
      shopCoverInput.value = "";
    }
  }

  async function handleShopLogoChange(event) {
    clearShopStatus();
    clearShopLogoInputStatus();
    const file = event?.target?.files?.[0];
    if (!file) {
      renderShopLogoPreview();
      return;
    }

    const fileType = String(file.type ?? "").toLowerCase();
    if (!VALID_SHOP_IMAGE_TYPES.has(fileType)) {
      if (shopLogoInput) shopLogoInput.value = "";
      setShopLogoInputStatus("Please choose a JPG, PNG, or WEBP logo.", false);
      renderShopLogoPreview();
      return;
    }

    if (Number(file.size ?? 0) > MAX_SHOP_IMAGE_BYTES) {
      if (shopLogoInput) shopLogoInput.value = "";
      setShopLogoInputStatus("Logo must be 1 MB or smaller.", false);
      renderShopLogoPreview();
      return;
    }

    try {
      shopLogoDataUrl = await readFileAsDataUrl(file);
      renderShopLogoPreview();
      setShopLogoInputStatus("Logo ready to save with your shop settings.", true);
    } catch {
      if (shopLogoInput) shopLogoInput.value = "";
      setShopLogoInputStatus("Could not read that logo file. Please try another image.", false);
      renderShopLogoPreview();
    }
  }

  function handleRemoveShopLogo() {
    clearShopStatus();
    clearShopLogoInputStatus();
    shopLogoDataUrl = "";
    if (shopLogoInput) shopLogoInput.value = "";
    renderShopLogoPreview();
    setShopLogoInputStatus("Logo removed. Save shop settings to keep the default Slotzy logo.", true);
  }

  async function handleShopCoverChange(event) {
    clearShopStatus();
    clearShopCoverInputStatus();
    const file = event?.target?.files?.[0];
    if (!file) {
      renderShopCoverPreview();
      return;
    }

    const fileType = String(file.type ?? "").toLowerCase();
    if (!VALID_SHOP_IMAGE_TYPES.has(fileType)) {
      if (shopCoverInput) shopCoverInput.value = "";
      setShopCoverInputStatus("Please choose a JPG, PNG, or WEBP cover image.", false);
      renderShopCoverPreview();
      return;
    }

    if (Number(file.size ?? 0) > MAX_SHOP_IMAGE_BYTES) {
      if (shopCoverInput) shopCoverInput.value = "";
      setShopCoverInputStatus("Cover image must be 1 MB or smaller.", false);
      renderShopCoverPreview();
      return;
    }

    try {
      shopCoverDataUrl = await readFileAsDataUrl(file);
      renderShopCoverPreview();
      setShopCoverInputStatus("Cover image ready to save with your shop settings.", true);
    } catch {
      if (shopCoverInput) shopCoverInput.value = "";
      setShopCoverInputStatus("Could not read that cover image. Please try another image.", false);
      renderShopCoverPreview();
    }
  }

  function handleRemoveShopCover() {
    clearShopStatus();
    clearShopCoverInputStatus();
    shopCoverDataUrl = "";
    if (shopCoverInput) shopCoverInput.value = "";
    renderShopCoverPreview();
    setShopCoverInputStatus("Cover image removed. Save shop settings to keep the default public page styling.", true);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const result = String(reader.result ?? "").trim();
        if (!/^data:image\/(?:png|jpeg|jpg|webp);/i.test(result)) {
          reject(new Error("invalid_logo_data"));
          return;
        }
        resolve(result);
      });
      reader.addEventListener("error", () => reject(reader.error || new Error("file_read_failed")));
      reader.readAsDataURL(file);
    });
  }

  function loadShopSettings() {
    const shop = ensureCurrentShop();
    const legacyShop = dataStore.getShop() || {};
    const policyDefaults = getDefaultBookingPolicy();
    const policySource = shop?.bookingPolicy && typeof shop.bookingPolicy === "object"
      ? shop.bookingPolicy
      : legacyShop.bookingPolicy;
    const policy = policySource && typeof policySource === "object"
      ? policySource
      : {};
    const addressSource = shop?.address && typeof shop.address === "object"
      ? shop.address
      : legacyShop.address;
    const address = addressSource && typeof addressSource === "object" ? addressSource : {};

    if (businessNameInput) {
      businessNameInput.value = String(shop?.name ?? legacyShop.businessName ?? "");
    }
    if (shopPhoneInput) shopPhoneInput.value = String(shop?.shopPhone ?? legacyShop.shopPhone ?? "");
    if (shopEmailInput) shopEmailInput.value = String(shop?.shopEmail ?? legacyShop.shopEmail ?? "");
    if (address1Input) address1Input.value = String(address.line1 ?? "");
    if (cityInput) cityInput.value = String(address.city ?? "");
    if (stateInput) stateInput.value = String(address.state ?? "");
    if (zipInput) zipInput.value = String(address.zip ?? "");
    shopLogoDataUrl = getStoredShopLogoDataUrl(shop, legacyShop);
    shopCoverDataUrl = getStoredShopCoverDataUrl(shop, legacyShop);
    clearShopLogoInputStatus();
    clearShopCoverInputStatus();
    renderShopLogoPreview();
    renderShopCoverPreview();

    if (allowSameDayInput) allowSameDayInput.checked = Boolean(
      policy.allowSameDay ?? policyDefaults.allowSameDay
    );
    if (maxDaysAdvanceInput) {
      maxDaysAdvanceInput.value = String(
        clampNumber(policy.maxDaysAdvance, 1, 365, policyDefaults.maxDaysAdvance)
      );
    }
    if (cancelHoursInput) {
      cancelHoursInput.value = String(
        clampNumber(policy.cancelHours, 0, 168, policyDefaults.cancelHours)
      );
    }
    if (bufferMinutesInput) {
      bufferMinutesInput.value = String(
        clampNumber(policy.bufferMinutes, 0, 180, policyDefaults.bufferMinutes)
      );
    }
    if (requireDepositInput) {
      requireDepositInput.checked = Boolean(policy.requireDeposit ?? policyDefaults.requireDeposit);
    }
    if (depositAmountInput) {
      const amount = toNonNegativeMoney(policy.depositAmount);
      depositAmountInput.value = amount === null ? "" : String(amount);
    }
    if (lateGraceMinutesInput) {
      lateGraceMinutesInput.value = String(
        clampNumber(policy.lateGraceMinutes, 0, 120, policyDefaults.lateGraceMinutes)
      );
    }
    if (noShowStrikeLimitInput) {
      noShowStrikeLimitInput.value = String(
        clampNumber(policy.noShowStrikeLimit, 0, 10, policyDefaults.noShowStrikeLimit)
      );
    }
    if (reminder24HoursInput) {
      reminder24HoursInput.checked = Boolean(policy.reminder24Hours ?? policyDefaults.reminder24Hours);
    }
    if (reminder2HoursInput) {
      reminder2HoursInput.checked = Boolean(policy.reminder2Hours ?? policyDefaults.reminder2Hours);
    }
    if (reminderCustomEnabledInput) {
      reminderCustomEnabledInput.checked = Boolean(policy.reminderCustomEnabled ?? policyDefaults.reminderCustomEnabled);
    }
    if (reminderCustomMinutesInput) {
      reminderCustomMinutesInput.value = String(
        clampNumber(policy.reminderCustomMinutes, 5, 10080, policyDefaults.reminderCustomMinutes)
      );
    }
    updatePublicBookingLink(shop);
    applyDepositToggleState();
    applyReminderToggleState();
  }

  async function handleSaveShopSettings() {
    if (currentRole !== "owner") return;
    clearShopStatus();
    clearShopLogoInputStatus();
    const originalSaveText = saveShopBtn?.textContent ?? "Save Shop Settings";
    if (saveShopBtn) {
      saveShopBtn.disabled = true;
      saveShopBtn.textContent = "Saving...";
    }

    try {
      const businessName = String(businessNameInput?.value ?? "").trim();
      const shopPhone = String(shopPhoneInput?.value ?? "").trim();
      const shopEmail = String(shopEmailInput?.value ?? "").trim();
      const address1 = String(address1Input?.value ?? "").trim();
      const city = String(cityInput?.value ?? "").trim();
      const state = String(stateInput?.value ?? "").trim();
      const zip = String(zipInput?.value ?? "").trim();
      const cancelHours = clampNumber(cancelHoursInput?.value, 0, 168, 24);
      const bufferMinutes = clampNumber(bufferMinutesInput?.value, 0, 180, 0);
      const allowSameDay = Boolean(allowSameDayInput?.checked);
      const maxDaysAdvance = clampNumber(maxDaysAdvanceInput?.value, 1, 365, 30);
      const requireDeposit = Boolean(requireDepositInput?.checked);
      const depositAmount = toNonNegativeMoney(depositAmountInput?.value);
      const lateGraceMinutes = clampNumber(lateGraceMinutesInput?.value, 0, 120, 10);
      const noShowStrikeLimit = clampNumber(noShowStrikeLimitInput?.value, 0, 10, 2);
      const reminder24Hours = Boolean(reminder24HoursInput?.checked);
      const reminder2Hours = Boolean(reminder2HoursInput?.checked);
      const reminderCustomEnabled = Boolean(reminderCustomEnabledInput?.checked);
      const reminderCustomMinutes = clampNumber(reminderCustomMinutesInput?.value, 5, 10080, 60);
      const persistedLogoDataUrl = shopLogoDataUrl || null;
      const persistedCoverDataUrl = shopCoverDataUrl || null;

      if (businessName.length < 2) {
        setShopStatus("Business name must be at least 2 characters.", false);
        return;
      }
      if (shopEmail && (!shopEmail.includes("@") || !shopEmail.includes("."))) {
        setShopStatus("Please enter a valid shop email address.", false);
        return;
      }
      if (requireDeposit && (depositAmount === null || depositAmount <= 0)) {
        setShopStatus("Please enter a deposit amount when deposits are required.", false);
        return;
      }

      const ownerRecord = getCurrentOwnerRecord();
      const ownerShopId = String(ownerRecord?.shopId ?? "").trim();
      const shops = dataStore.getShops();
      let nextShopId = ownerShopId;
      if (!nextShopId) {
        nextShopId = createId("shop");
      }

      const bookingPolicy = {
        allowSameDay,
        maxDaysAdvance,
        cancelHours,
        bufferMinutes,
        requireDeposit,
        depositAmount: requireDeposit ? depositAmount : 0,
        lateGraceMinutes,
        noShowStrikeLimit,
        reminder24Hours,
        reminder2Hours,
        reminderCustomEnabled,
        reminderCustomMinutes,
      };
      const existingShopRecord = dataStore.getShopById(nextShopId) || {};
      const updatedShop = {
        ...existingShopRecord,
        id: nextShopId,
        name: businessName,
        slug: toSlug(businessName),
        logoDataUrl: persistedLogoDataUrl,
        coverDataUrl: persistedCoverDataUrl,
        shopPhone,
        shopEmail,
        address: {
          line1: address1,
          city,
          state,
          zip,
        },
        bookingPolicy,
        createdAtISO: (
          existingShopRecord?.createdAtISO ||
          new Date().toISOString()
        ),
      };

      const existingIndex = shops.findIndex((shop) => String(shop?.id ?? "") === nextShopId);
      const nextShops = [...shops];
      if (existingIndex >= 0) nextShops[existingIndex] = updatedShop;
      else nextShops.push(updatedShop);

      const savedShops = await dataStore.saveShopsAsync(nextShops);
      const resolvedShops = Array.isArray(savedShops) && savedShops.length > 0
        ? savedShops
        : nextShops;
      const persistedShop = resolvedShops.find((shop) => String(shop?.id ?? "") === nextShopId) || updatedShop;

      if (!ownerShopId) {
        const users = dataStore.getUsers().map((user) => (
          String(user?.username ?? "") === currentUsername
            ? { ...user, shopId: nextShopId }
            : user
        ));
        dataStore.saveUsers(users);
      }

      const legacyShopPayload = {
        businessName,
        logoDataUrl: persistedLogoDataUrl,
        coverDataUrl: persistedCoverDataUrl,
        shopPhone,
        shopEmail,
        address: {
          line1: address1,
          city,
          state,
          zip,
        },
        bookingPolicy,
        shopId: nextShopId,
        updatedAt: new Date().toISOString(),
      };
      dataStore.saveShop(legacyShopPayload);

      if (cancelHoursInput) cancelHoursInput.value = String(cancelHours);
      if (bufferMinutesInput) bufferMinutesInput.value = String(bufferMinutes);
      if (maxDaysAdvanceInput) maxDaysAdvanceInput.value = String(maxDaysAdvance);
      if (lateGraceMinutesInput) lateGraceMinutesInput.value = String(lateGraceMinutes);
      if (noShowStrikeLimitInput) noShowStrikeLimitInput.value = String(noShowStrikeLimit);
      if (depositAmountInput) {
        depositAmountInput.value = requireDeposit ? String(depositAmount) : "";
      }
      shopLogoDataUrl = getStoredShopLogoDataUrl(persistedShop, legacyShopPayload);
      shopCoverDataUrl = getStoredShopCoverDataUrl(persistedShop, legacyShopPayload);
      renderShopLogoPreview();
      renderShopCoverPreview();
      updatePublicBookingLink(persistedShop);
      applyDepositToggleState();
      renderShopTeam();

      if (persistedLogoDataUrl) {
        setShopLogoInputStatus("Logo saved. It will appear on your booking page and QR printout.", true);
      } else {
        setShopLogoInputStatus("Default Slotzy branding restored.", true);
      }
      if (persistedCoverDataUrl) {
        setShopCoverInputStatus("Cover image saved. It will appear on your public booking page.", true);
      } else {
        setShopCoverInputStatus("No cover image set. Shared Slotzy styling will be used.", true);
      }
      setShopStatus("Shop settings saved successfully.", true);
      showToast?.("Settings saved.", { type: "success" });
    } catch (error) {
      console.error("[Slotzy:settings] Failed to save shop settings.", error);
      setShopStatus("Could not save shop settings right now. Please try again.", false);
    } finally {
      if (saveShopBtn) {
        saveShopBtn.disabled = false;
        saveShopBtn.textContent = originalSaveText;
      }
    }
  }

  function getCurrentShopId() {
    const owner = getCurrentOwnerRecord();
    const direct = String(owner?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShops()[0];
    return String(fallback?.id ?? "");
  }

  function handleAddBarberUser() {
    clearBarberUserStatus();
    const shopId = getCurrentShopId();
    if (!shopId) {
      setBarberUserStatus("Save shop settings first so we can assign the barber to a shop.", false);
      return;
    }

    const displayName = String(barberDisplayNameInput?.value ?? "").trim();
    const username = String(barberUsernameInput?.value ?? "").trim();
    const email = String(barberEmailInput?.value ?? "").trim();
    const password = String(barberPasswordInput?.value ?? "").trim();

    if (displayName.length < 2) {
      setBarberUserStatus("Display name must be at least 2 characters.", false);
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      setBarberUserStatus("Username must be 3-32 chars using letters, numbers, dot, dash, or underscore.", false);
      return;
    }
    if (password.length < 4) {
      setBarberUserStatus("Password must be at least 4 characters.", false);
      return;
    }
    if (email && !looksLikeEmail(email)) {
      setBarberUserStatus("Please enter a valid barber email address.", false);
      return;
    }

    const users = dataStore.getUsers();
    const duplicate = users.some((user) => String(user?.username ?? "").toLowerCase() === username.toLowerCase());
    if (duplicate) {
      setBarberUserStatus("That username is already in use.", false);
      return;
    }

    users.push({
      username,
      password,
      role: "barber",
      shopId,
      displayName,
      email,
    });
    dataStore.saveUsers(users);

    if (barberDisplayNameInput) barberDisplayNameInput.value = "";
    if (barberUsernameInput) barberUsernameInput.value = "";
    if (barberEmailInput) barberEmailInput.value = "";
    if (barberPasswordInput) barberPasswordInput.value = "";
    setBarberUserStatus("Barber added to your shop.", true);
    showToast?.("Barber account created.", "success");
    renderShopTeam();
  }

  function renderShopTeam() {
    if (!barberUsersList) return;
    const shopId = getCurrentShopId();
    const users = dataStore.getUsers()
      .filter((user) => String(user?.shopId ?? "") === shopId)
      .filter((user) => String(user?.role ?? "").toLowerCase() === "barber")
      .sort((a, b) => {
        const left = String(a?.displayName ?? a?.username ?? "");
        const right = String(b?.displayName ?? b?.username ?? "");
        return left.localeCompare(right, undefined, { sensitivity: "base" });
      });

    if (users.length === 0) {
      barberUsersList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No barbers yet</h3>
          <p>Add barber accounts so clients can book specific team members.</p>
        </section>
      `;
      return;
    }

    barberUsersList.innerHTML = `
      <ul class="availability-timeoff-items">
        ${users.map((user) => `
          <li class="availability-timeoff-item">
            <div>
              <strong>${escapeHtml(String(user?.displayName ?? user?.username ?? ""))}</strong>
              <p class="small">@${escapeHtml(String(user?.username ?? ""))}</p>
              ${String(user?.email ?? "").trim()
                ? `<p class="small">${escapeHtml(String(user?.email ?? ""))}</p>`
                : ""}
            </div>
            <span class="badge badge-muted">Barber</span>
          </li>
        `).join("")}
      </ul>
    `;
  }

  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  function toNonNegativeMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const normalized = Math.round(num * 100) / 100;
    return normalized >= 0 ? normalized : null;
  }

  function getDefaultBookingPolicy() {
    return {
      allowSameDay: true,
      maxDaysAdvance: 30,
      cancelHours: 24,
      bufferMinutes: 0,
      requireDeposit: false,
      depositAmount: 0,
      lateGraceMinutes: 10,
      noShowStrikeLimit: 2,
      reminder24Hours: true,
      reminder2Hours: true,
      reminderCustomEnabled: false,
      reminderCustomMinutes: 60,
    };
  }

  function applyDepositToggleState() {
    if (!depositAmountInput) return;
    const enabled = Boolean(requireDepositInput?.checked);
    depositAmountInput.disabled = !enabled;
    if (!enabled) {
      depositAmountInput.value = "";
    }
  }

  function applyReminderToggleState() {
    if (!reminderCustomMinutesInput) return;
    const enabled = Boolean(reminderCustomEnabledInput?.checked);
    reminderCustomMinutesInput.disabled = !enabled;
  }

  function setProfileStatus(message, isSuccess) {
    if (!profileStatus) return;
    profileStatus.textContent = String(message ?? "");
    profileStatus.setAttribute("role", isSuccess ? "status" : "alert");
    profileStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    profileStatus.setAttribute("aria-atomic", "true");
    profileStatus.classList.remove("status-success", "status-error");
    profileStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearProfileStatus() {
    if (!profileStatus) return;
    profileStatus.textContent = "";
    profileStatus.setAttribute("role", "status");
    profileStatus.setAttribute("aria-live", "polite");
    profileStatus.setAttribute("aria-atomic", "true");
    profileStatus.classList.remove("status-success", "status-error");
  }

  function setShopStatus(message, isSuccess) {
    if (!shopStatus) return;
    shopStatus.textContent = String(message ?? "");
    shopStatus.setAttribute("role", isSuccess ? "status" : "alert");
    shopStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    shopStatus.setAttribute("aria-atomic", "true");
    shopStatus.classList.remove("status-success", "status-error");
    shopStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearShopStatus() {
    if (!shopStatus) return;
    shopStatus.textContent = "";
    shopStatus.setAttribute("role", "status");
    shopStatus.setAttribute("aria-live", "polite");
    shopStatus.setAttribute("aria-atomic", "true");
    shopStatus.classList.remove("status-success", "status-error");
  }

  function setShopLogoInputStatus(message, isSuccess) {
    if (!shopLogoInputStatus) return;
    shopLogoInputStatus.textContent = String(message ?? "");
    shopLogoInputStatus.setAttribute("role", isSuccess ? "status" : "alert");
    shopLogoInputStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    shopLogoInputStatus.setAttribute("aria-atomic", "true");
    shopLogoInputStatus.classList.remove("status-success", "status-error");
    shopLogoInputStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearShopLogoInputStatus() {
    if (!shopLogoInputStatus) return;
    shopLogoInputStatus.textContent = "";
    shopLogoInputStatus.setAttribute("role", "status");
    shopLogoInputStatus.setAttribute("aria-live", "polite");
    shopLogoInputStatus.setAttribute("aria-atomic", "true");
    shopLogoInputStatus.classList.remove("status-success", "status-error");
  }

  function setShopCoverInputStatus(message, isSuccess) {
    if (!shopCoverInputStatus) return;
    shopCoverInputStatus.textContent = String(message ?? "");
    shopCoverInputStatus.setAttribute("role", isSuccess ? "status" : "alert");
    shopCoverInputStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    shopCoverInputStatus.setAttribute("aria-atomic", "true");
    shopCoverInputStatus.classList.remove("status-success", "status-error");
    shopCoverInputStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearShopCoverInputStatus() {
    if (!shopCoverInputStatus) return;
    shopCoverInputStatus.textContent = "";
    shopCoverInputStatus.setAttribute("role", "status");
    shopCoverInputStatus.setAttribute("aria-live", "polite");
    shopCoverInputStatus.setAttribute("aria-atomic", "true");
    shopCoverInputStatus.classList.remove("status-success", "status-error");
  }

  function setBarberUserStatus(message, isSuccess) {
    if (!barberUserStatus) return;
    barberUserStatus.textContent = String(message ?? "");
    barberUserStatus.setAttribute("role", isSuccess ? "status" : "alert");
    barberUserStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    barberUserStatus.setAttribute("aria-atomic", "true");
    barberUserStatus.classList.remove("status-success", "status-error");
    barberUserStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function setBackupStatus(message, isSuccess) {
    if (!backupStatus) return;
    backupStatus.textContent = String(message ?? "");
    backupStatus.setAttribute("role", isSuccess ? "status" : "alert");
    backupStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    backupStatus.setAttribute("aria-atomic", "true");
    backupStatus.classList.remove("status-success", "status-error");
    backupStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function setSupportStatus(message, isSuccess) {
    if (!supportStatus) return;
    supportStatus.textContent = String(message ?? "");
    supportStatus.setAttribute("role", isSuccess ? "status" : "alert");
    supportStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    supportStatus.setAttribute("aria-atomic", "true");
    supportStatus.classList.remove("status-success", "status-error");
    supportStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearSupportStatus() {
    if (!supportStatus) return;
    supportStatus.textContent = "";
    supportStatus.setAttribute("role", "status");
    supportStatus.setAttribute("aria-live", "polite");
    supportStatus.setAttribute("aria-atomic", "true");
    supportStatus.classList.remove("status-success", "status-error");
  }

  function clearBackupStatus() {
    if (!backupStatus) return;
    backupStatus.textContent = "";
    backupStatus.setAttribute("role", "status");
    backupStatus.setAttribute("aria-live", "polite");
    backupStatus.setAttribute("aria-atomic", "true");
    backupStatus.classList.remove("status-success", "status-error");
  }

  function updatePublicBookingLink(shop) {
    if (!publicBookingLinkInput) return;
    clearPublicBookingLinkStatus();
    clearPublicBookingQrStatus();

    const slug = toSlug(shop?.slug ?? shop?.name ?? businessNameInput?.value ?? "");
    if (!slug) {
      publicBookingLinkInput.value = "";
      if (copyPublicBookingLinkBtn) copyPublicBookingLinkBtn.disabled = true;
      if (openPublicBookingLinkBtn) openPublicBookingLinkBtn.disabled = true;
      setPublicBookingQrUnavailable("QR code will appear once your booking page URL is ready.");
      return;
    }

    publicBookingLinkInput.value = getPublicBookingUrl(slug);
    if (copyPublicBookingLinkBtn) copyPublicBookingLinkBtn.disabled = false;
    if (openPublicBookingLinkBtn) openPublicBookingLinkBtn.disabled = false;
    renderPublicBookingQr(publicBookingLinkInput.value);
  }

  function getPublicBookingUrl(slug) {
    const origin = String(window.location.origin ?? "").trim();
    const encodedSlug = encodeURIComponent(String(slug ?? "").trim());
    if (origin) {
      return `${origin}/pages/book.html?shop=${encodedSlug}`;
    }
    return `/pages/book.html?shop=${encodedSlug}`;
  }

  function getQrPrintLogoSource() {
    return shopLogoDataUrl || DEFAULT_SHOP_LOGO_URL;
  }

  async function copyText(value) {
    const text = String(value ?? "");
    if (!text) return false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  function buildBackupFilename(isoString) {
    const stamp = formatBackupFilenameStamp(isoString || new Date().toISOString());
    return `slotzy-backup-${stamp}.json`;
  }

  function formatBackupFilenameStamp(isoString) {
    const date = new Date(String(isoString ?? ""));
    if (!Number.isFinite(date.getTime())) return "export";
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}-${hh}${min}`;
  }

  function formatBackupTimestamp(isoString) {
    const date = new Date(String(isoString ?? ""));
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleString();
  }

  function downloadJsonFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = String(filename ?? "slotzy-backup.json").trim() || "slotzy-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  async function handleCopyPublicBookingLink() {
    const value = String(publicBookingLinkInput?.value ?? "").trim();
    if (!value) {
      setPublicBookingLinkStatus("Public booking link is not ready yet.", false);
      return;
    }

    try {
      const copied = await copyText(value);
      if (!copied) throw new Error("copy_failed");
      clearPublicBookingLinkStatus();
      showToast?.("Link copied", "success", 2000);
    } catch {
      setPublicBookingLinkStatus("Could not copy link. Please copy it manually.", false);
    }
  }

  function handleOpenPublicBookingLink() {
    const value = String(publicBookingLinkInput?.value ?? "").trim();
    if (!value) {
      setPublicBookingLinkStatus("Public booking link is not ready yet.", false);
      return;
    }
    window.open(value, "_blank", "noopener,noreferrer");
  }

  async function renderPublicBookingQr(bookingUrl) {
    const value = String(bookingUrl ?? "").trim();
    if (!value) {
      setPublicBookingQrUnavailable("QR code will appear once your booking page URL is ready.");
      return;
    }

    if (!publicBookingQrImage) return;
    clearPublicBookingQrStatus();

    try {
      const qrLib = window.QRCode;
      if (!qrLib || typeof qrLib.toDataURL !== "function") {
        throw new Error("qr_library_unavailable");
      }

      const dataUrl = await qrLib.toDataURL(value, {
        margin: 1,
        width: 320,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });

      publicBookingQrDataUrl = String(dataUrl ?? "").trim();
      if (!publicBookingQrDataUrl) throw new Error("qr_generation_failed");

      publicBookingQrImage.src = publicBookingQrDataUrl;
      publicBookingQrImage.classList.remove("hidden");
      if (publicBookingQrEmpty) publicBookingQrEmpty.classList.add("hidden");
      if (downloadPublicBookingQrBtn) downloadPublicBookingQrBtn.disabled = false;
      if (printPublicBookingQrBtn) printPublicBookingQrBtn.disabled = false;
    } catch {
      setPublicBookingQrUnavailable("QR preview unavailable right now. You can still share the booking URL.");
      setPublicBookingQrStatus("Could not generate QR code.", false);
    }
  }

  function handleDownloadPublicBookingQr() {
    clearPublicBookingQrStatus();
    if (!publicBookingQrDataUrl) {
      setPublicBookingQrStatus("QR code is not ready to download.", false);
      return;
    }

    const slug = getBookingSlugFromUrl(String(publicBookingLinkInput?.value ?? ""));
    const filename = `slotzy-${slug || "shop"}-qr.png`;
    const anchor = document.createElement("a");
    anchor.href = publicBookingQrDataUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setPublicBookingQrStatus("QR code downloaded.", true);
  }

  function handlePrintPublicBookingQr() {
    clearPublicBookingQrStatus();
    if (!publicBookingQrDataUrl) {
      setPublicBookingQrStatus("QR code is not ready to print.", false);
      return;
    }

    const bookingUrl = String(publicBookingLinkInput?.value ?? "").trim();
    const businessName = String(businessNameInput?.value ?? "").trim() || "Slotzy Shop";
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=540,height=720");
    if (!printWindow) {
      setPublicBookingQrStatus("Popup blocked. Allow popups to print QR.", false);
      return;
    }

    const title = `${businessName} Booking QR`;
    const safeTitle = escapeHtml(title);
    const safeBusinessName = escapeHtml(businessName);
    const safeUrl = escapeHtml(bookingUrl);
    const logoSrc = escapeHtml(getQrPrintLogoSource());
    const logoAlt = escapeHtml(shopLogoDataUrl ? `${businessName} logo` : "Slotzy logo");
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
    <img class="qr-image" src="${publicBookingQrDataUrl}" alt="Booking QR code" />
  </div>
  <p class="shop-name">${safeBusinessName}</p>
  <p class="link">${safeUrl}</p>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function setPublicBookingQrUnavailable(message) {
    publicBookingQrDataUrl = "";
    if (publicBookingQrImage) {
      publicBookingQrImage.removeAttribute("src");
      publicBookingQrImage.classList.add("hidden");
    }
    if (publicBookingQrEmpty) {
      publicBookingQrEmpty.textContent = String(message ?? "QR code is unavailable.");
      publicBookingQrEmpty.classList.remove("hidden");
    }
    if (downloadPublicBookingQrBtn) downloadPublicBookingQrBtn.disabled = true;
    if (printPublicBookingQrBtn) printPublicBookingQrBtn.disabled = true;
  }

  function getBookingSlugFromUrl(urlText) {
    const raw = String(urlText ?? "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.origin);
      return String(parsed.searchParams.get("shop") ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    } catch {
      return "";
    }
  }

  function setPublicBookingQrStatus(message, isSuccess) {
    if (!publicBookingQrStatus) return;
    publicBookingQrStatus.textContent = String(message ?? "");
    publicBookingQrStatus.setAttribute("role", isSuccess ? "status" : "alert");
    publicBookingQrStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    publicBookingQrStatus.setAttribute("aria-atomic", "true");
    publicBookingQrStatus.classList.remove("status-success", "status-error");
    publicBookingQrStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearPublicBookingQrStatus() {
    if (!publicBookingQrStatus) return;
    publicBookingQrStatus.textContent = "";
    publicBookingQrStatus.setAttribute("role", "status");
    publicBookingQrStatus.setAttribute("aria-live", "polite");
    publicBookingQrStatus.setAttribute("aria-atomic", "true");
    publicBookingQrStatus.classList.remove("status-success", "status-error");
  }

  function setPublicBookingLinkStatus(message, isSuccess) {
    if (!publicBookingLinkStatus) return;
    publicBookingLinkStatus.textContent = String(message ?? "");
    publicBookingLinkStatus.setAttribute("role", isSuccess ? "status" : "alert");
    publicBookingLinkStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    publicBookingLinkStatus.setAttribute("aria-atomic", "true");
    publicBookingLinkStatus.classList.remove("status-success", "status-error");
    publicBookingLinkStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearPublicBookingLinkStatus() {
    if (!publicBookingLinkStatus) return;
    publicBookingLinkStatus.textContent = "";
    publicBookingLinkStatus.setAttribute("role", "status");
    publicBookingLinkStatus.setAttribute("aria-live", "polite");
    publicBookingLinkStatus.setAttribute("aria-atomic", "true");
    publicBookingLinkStatus.classList.remove("status-success", "status-error");
  }

  function clearBarberUserStatus() {
    if (!barberUserStatus) return;
    barberUserStatus.textContent = "";
    barberUserStatus.setAttribute("role", "status");
    barberUserStatus.setAttribute("aria-live", "polite");
    barberUserStatus.setAttribute("aria-atomic", "true");
    barberUserStatus.classList.remove("status-success", "status-error");
  }

  function setDemoStatus(message, isSuccess) {
    if (!demoStatus) return;
    demoStatus.textContent = String(message ?? "");
    demoStatus.setAttribute("role", isSuccess ? "status" : "alert");
    demoStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    demoStatus.setAttribute("aria-atomic", "true");
    demoStatus.classList.remove("status-success", "status-error");
    demoStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearDemoStatus() {
    if (!demoStatus) return;
    demoStatus.textContent = "";
    demoStatus.setAttribute("role", "status");
    demoStatus.setAttribute("aria-live", "polite");
    demoStatus.setAttribute("aria-atomic", "true");
    demoStatus.classList.remove("status-success", "status-error");
  }

  function notifyProfileSaved() {
    if (typeof showToast === "function") {
      showToast("Your profile has been updated.", { type: "success" });
    }
  }

  function applySavedButtonFeedback() {
    if (!saveProfileBtn) return;
    if (saveFeedbackTimer) {
      clearTimeout(saveFeedbackTimer);
      saveFeedbackTimer = null;
    }

    const originalText = "Save Profile";
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saved";
    saveFeedbackTimer = window.setTimeout(() => {
      saveProfileBtn.textContent = originalText;
      saveProfileBtn.disabled = false;
      saveFeedbackTimer = null;
    }, 1400);
  }

  function bindCompletenessEvents() {
    [fullNameInput, emailInput, phoneInput].forEach((input) => {
      input?.addEventListener("keyup", updateProfileCompleteness);
      input?.addEventListener("change", updateProfileCompleteness);
    });
  }

  function updateProfileCompleteness() {
    const fullName = String(fullNameInput?.value ?? "").trim();
    const email = String(emailInput?.value ?? "").trim();
    const phone = String(phoneInput?.value ?? "").trim();

    const fields = [
      { label: "full name", filled: Boolean(fullName) },
      { label: "email", filled: Boolean(email) },
      { label: "phone", filled: Boolean(phone) },
    ];
    const filledCount = fields.filter((field) => field.filled).length;
    const percent = Math.round((filledCount / 3) * 100);
    const missing = fields.filter((field) => !field.filled).map((field) => field.label);

    if (profileCompletenessText) {
      profileCompletenessText.textContent = `Profile completeness: ${percent}%`;
    }
    if (profileProgressBar) {
      profileProgressBar.style.width = `${percent}%`;
    }
    if (missingFields) {
      missingFields.textContent = missing.length > 0
        ? `Missing: ${missing.join(", ")}`
        : "Missing: none";
    }
  }

  function renderLoggedOutState() {
    if (!settingsMain) return;
    settingsMain.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Please sign in to access settings.</h1>
        <p class="small">Sign in with your account to update your profile.</p>
        <a href="../index.html" class="btn btn-primary owner-action-btn">Go to Home</a>
      </section>
    `;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function syncCurrentUserEmail(email) {
    if (currentRole !== "owner" && currentRole !== "barber") return;
    const nextEmail = String(email ?? "").trim();
    const users = dataStore.getUsers().map((user) => {
      if (String(user?.username ?? "") !== currentUsername) return user;
      return {
        ...user,
        email: nextEmail,
      };
    });
    dataStore.saveUsers(users);
  }

  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
  }

  function toSlug(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `shop-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
