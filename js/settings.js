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
  const cancelHoursInput = document.getElementById("cancelHoursInput");
  const bufferMinutesInput = document.getElementById("bufferMinutesInput");
  const requireDepositInput = document.getElementById("requireDepositInput");
  const depositAmountInput = document.getElementById("depositAmountInput");
  const lateGraceMinutesInput = document.getElementById("lateGraceMinutesInput");
  const noShowStrikeLimitInput = document.getElementById("noShowStrikeLimitInput");
  const allowSameDayInput = document.getElementById("allowSameDayInput");
  const maxDaysAdvanceInput = document.getElementById("maxDaysAdvanceInput");
  const saveShopBtn = document.getElementById("saveShopBtn");
  const shopStatus = document.getElementById("shopStatus");
  const showToast = window.showToast;
  let saveFeedbackTimer = null;

  const currentUser = getCurrentUser();
  const currentUsername = getUsername(currentUser);
  const currentRole = getRole(currentUser);

  init();

  function init() {
    if (!currentUsername || !currentRole) {
      renderLoggedOutState();
      return;
    }

    wireLogoutButton({ redirectPath: "../index.html" });

    backBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      if (currentRole === "owner") {
        window.location.href = "business-owner.html";
      } else {
        window.location.href = "customer-dashboard.html";
      }
    });

    loadProfile();
    bindCompletenessEvents();
    updateProfileCompleteness();
    saveProfileBtn?.addEventListener("click", handleSaveProfile);
    configureShopSettings();
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
    return role === "owner" ? "owner" : role === "customer" ? "customer" : "";
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
    loadShopSettings();
    saveShopBtn?.addEventListener("click", handleSaveShopSettings);
  }

  function loadShopSettings() {
    const shop = getShopSettings();
    const policyDefaults = getDefaultBookingPolicy();

    if (!shop) {
      applyShopDefaults(policyDefaults);
      applyDepositToggleState();
      return;
    }

    const address = shop.address && typeof shop.address === "object" ? shop.address : {};
    const policy = shop.bookingPolicy && typeof shop.bookingPolicy === "object"
      ? shop.bookingPolicy
      : {};

    if (businessNameInput) businessNameInput.value = String(shop.businessName ?? "");
    if (shopPhoneInput) shopPhoneInput.value = String(shop.shopPhone ?? "");
    if (shopEmailInput) shopEmailInput.value = String(shop.shopEmail ?? "");
    if (address1Input) address1Input.value = String(address.line1 ?? "");
    if (cityInput) cityInput.value = String(address.city ?? "");
    if (stateInput) stateInput.value = String(address.state ?? "");
    if (zipInput) zipInput.value = String(address.zip ?? "");

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
    applyDepositToggleState();
  }

  function handleSaveShopSettings() {
    if (currentRole !== "owner") return;
    clearShopStatus();

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

    const shop = {
      businessName,
      shopPhone,
      shopEmail,
      address: {
        line1: address1,
        city,
        state,
        zip,
      },
      bookingPolicy: {
        allowSameDay,
        maxDaysAdvance,
        cancelHours,
        bufferMinutes,
        requireDeposit,
        depositAmount: requireDeposit ? depositAmount : 0,
        lateGraceMinutes,
        noShowStrikeLimit,
      },
      updatedAt: new Date().toISOString(),
    };
    saveShopSettings(shop);

    if (cancelHoursInput) cancelHoursInput.value = String(cancelHours);
    if (bufferMinutesInput) bufferMinutesInput.value = String(bufferMinutes);
    if (maxDaysAdvanceInput) maxDaysAdvanceInput.value = String(maxDaysAdvance);
    if (lateGraceMinutesInput) lateGraceMinutesInput.value = String(lateGraceMinutes);
    if (noShowStrikeLimitInput) noShowStrikeLimitInput.value = String(noShowStrikeLimit);
    if (depositAmountInput) {
      depositAmountInput.value = requireDeposit ? String(depositAmount) : "";
    }
    applyDepositToggleState();

    setShopStatus("Shop settings saved successfully.", true);
  }

  function getShopSettings() {
    return dataStore.getShop();
  }

  function saveShopSettings(shop) {
    dataStore.saveShop(shop);
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
    };
  }

  function applyShopDefaults(policyDefaults) {
    if (businessNameInput) businessNameInput.value = "";
    if (shopPhoneInput) shopPhoneInput.value = "";
    if (shopEmailInput) shopEmailInput.value = "";
    if (address1Input) address1Input.value = "";
    if (cityInput) cityInput.value = "";
    if (stateInput) stateInput.value = "";
    if (zipInput) zipInput.value = "";

    if (allowSameDayInput) allowSameDayInput.checked = policyDefaults.allowSameDay;
    if (maxDaysAdvanceInput) maxDaysAdvanceInput.value = String(policyDefaults.maxDaysAdvance);
    if (cancelHoursInput) cancelHoursInput.value = String(policyDefaults.cancelHours);
    if (bufferMinutesInput) bufferMinutesInput.value = String(policyDefaults.bufferMinutes);
    if (requireDepositInput) requireDepositInput.checked = policyDefaults.requireDeposit;
    if (depositAmountInput) depositAmountInput.value = "";
    if (lateGraceMinutesInput) lateGraceMinutesInput.value = String(policyDefaults.lateGraceMinutes);
    if (noShowStrikeLimitInput) noShowStrikeLimitInput.value = String(policyDefaults.noShowStrikeLimit);
  }

  function applyDepositToggleState() {
    if (!depositAmountInput) return;
    const enabled = Boolean(requireDepositInput?.checked);
    depositAmountInput.disabled = !enabled;
    if (!enabled) {
      depositAmountInput.value = "";
    }
  }

  function setProfileStatus(message, isSuccess) {
    if (!profileStatus) return;
    profileStatus.textContent = message;
    profileStatus.classList.remove("status-success", "status-error");
    profileStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearProfileStatus() {
    if (!profileStatus) return;
    profileStatus.textContent = "";
    profileStatus.classList.remove("status-success", "status-error");
  }

  function setShopStatus(message, isSuccess) {
    if (!shopStatus) return;
    shopStatus.textContent = message;
    shopStatus.classList.remove("status-success", "status-error");
    shopStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearShopStatus() {
    if (!shopStatus) return;
    shopStatus.textContent = "";
    shopStatus.classList.remove("status-success", "status-error");
  }

  function notifyProfileSaved() {
    if (typeof showToast === "function") {
      showToast("Your profile has been updated.", "success");
      return;
    }
    showFallbackToast("Your profile has been updated.");
  }

  function showFallbackToast(message) {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast hidden";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("toast-success");
    window.setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("toast-success");
    }, 2500);
  }

  function applySavedButtonFeedback() {
    if (!saveProfileBtn) return;
    if (saveFeedbackTimer) {
      clearTimeout(saveFeedbackTimer);
      saveFeedbackTimer = null;
    }

    const originalText = "Save Profile";
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saved ✓";
    saveFeedbackTimer = window.setTimeout(() => {
      saveProfileBtn.textContent = originalText;
      saveProfileBtn.disabled = false;
      saveFeedbackTimer = null;
    }, 1500);
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
})();
