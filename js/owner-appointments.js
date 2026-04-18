import * as dataStore from "./dataStore.js";
import { buildCsvFilename, downloadCsvFile, formatCsvDate, formatCsvTime } from "./csv-utils.js";
import { buildBookingNotificationPayload, postBookingNotification } from "./booking-notifications.js";

(function () {
  const SLOT_INCREMENT_MINUTES = 15;
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  const WALKIN_LAST_SERVICE_KEY_PREFIX = "Slotzy_lastService_";
  const WALKIN_LAST_CLIENT_KEY_PREFIX = "Slotzy_lastClient_";

  let isInitialized = false;
  let bookingSyncBound = false;
  let ownerUsername = "";
  let currentRole = "";
  let currentShopId = "";
  let scopeMode = "my";
  let scopeOwnerUsername = "";
  let barbersInShop = [];
  let calendarInstance = null;
  let selectedDateYmd = null;
  let bookedCountByDay = new Map();
  let clientNoShowCountByKey = new Map();
  let rescheduleBookingId = "";
  let walkinModalBarberUsername = "";
  let walkinSlotOptions = [];
  let walkinSlotsGenerated = false;

  const listContainer = document.getElementById("appointment-list");
  const filterEl = document.getElementById("appointment-filter");
  const controlsEl = document.getElementById("appointment-controls");
  const searchEl = document.getElementById("appointment-search");
  const monthLabel = document.getElementById("calendar-month");
  const summaryLabel = document.getElementById("calendar-summary");
  const statusMessageEl = document.getElementById("appointment-status");
  const ownerScopeEl = document.getElementById("appointment-owner-filter");
  const ownerSelectLabelEl = document.getElementById("appointment-owner-select-label");
  const ownerSelectEl = document.getElementById("appointment-owner-select");
  const activeDayFilterEl = document.getElementById("active-day-filter");
  const exportAppointmentsCsvBtn = document.getElementById("exportAppointmentsCsvBtn");
  const addWalkinBtn = document.getElementById("addWalkinBtn");
  const rescheduleModalEl = document.getElementById("reschedule-modal");
  const rescheduleSummaryEl = document.getElementById("reschedule-summary");
  const rescheduleDateEl = document.getElementById("reschedule-date");
  const rescheduleSlotEl = document.getElementById("reschedule-slot");
  const rescheduleEmptyEl = document.getElementById("reschedule-empty");
  const rescheduleStatusEl = document.getElementById("reschedule-status");
  const rescheduleConfirmBtn = document.getElementById("reschedule-confirm");
  const rescheduleCancelBtn = document.getElementById("reschedule-cancel");
  const rescheduleCloseBtn = document.getElementById("reschedule-close");
  const walkinModalEl = document.getElementById("walkin-modal");
  const walkinBarberSelectEl = document.getElementById("walkinBarberSelect");
  const walkinServiceSelectEl = document.getElementById("walkinServiceSelect");
  const walkinCustomServiceFieldsEl = document.getElementById("walkinCustomServiceFields");
  const walkinCustomServiceNameEl = document.getElementById("walkinCustomServiceName");
  const walkinCustomDurationEl = document.getElementById("walkinCustomDuration");
  const walkinCustomPriceEl = document.getElementById("walkinCustomPrice");
  const walkinDateEl = document.getElementById("walkinDate");
  const walkinNowBtn = document.getElementById("walkinNowBtn");
  const walkinSlotSelectEl = document.getElementById("walkinSlotSelect");
  const walkinNextAvailableBtn = document.getElementById("walkinNextAvailableBtn");
  const walkinRepeatLastServiceBtn = document.getElementById("walkinRepeatLastServiceBtn");
  const walkinSameClientBtn = document.getElementById("walkinSameClientBtn");
  const walkinSlotEmptyEl = document.getElementById("walkinSlotEmpty");
  const walkinClientNameEl = document.getElementById("walkinClientName");
  const walkinClientContactEl = document.getElementById("walkinClientContact");
  const walkinNotesEl = document.getElementById("walkinNotes");
  const walkinStatusEl = document.getElementById("walkinStatus");
  const walkinQuickAddBtn = document.getElementById("walkinQuickAddBtn");
  const walkinCreateBtn = document.getElementById("walkinCreateBtn");
  const walkinCancelBtn = document.getElementById("walkinCancelBtn");
  const walkinCloseBtn = document.getElementById("walkinCloseBtn");

  document.addEventListener("DOMContentLoaded", initManageAppointments);

  function initManageAppointments() {
    if (isInitialized) return;
    isInitialized = true;

    const sessionUser = dataStore.getSessionUser();
    if (!isStaff(sessionUser)) {
      renderStaffOnlyState();
      return;
    }

    ownerUsername = String(sessionUser.username ?? "").trim();
    currentRole = String(sessionUser.role ?? "").toLowerCase();
    if (!ownerUsername) {
      renderStaffOnlyState();
      return;
    }

    currentShopId = resolveCurrentShopId(ownerUsername);
    barbersInShop = getBarbersForCurrentScope();
    configureScopeControls();
    bindEventsOnce();
    bindBookingSync();
    renderAll();
  }

  function isStaff(user) {
    if (!user || typeof user !== "object") return false;
    const role = String(user.role ?? "").toLowerCase();
    return role === "owner" || role === "barber";
  }

  function renderStaffOnlyState() {
    const main = document.querySelector("main.owner-layout") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="card owner-panel center-card section-stack">
        <div class="card-head">
          <h1>Staff sign-in required.</h1>
          <p class="small">Please log in as an owner or barber.</p>
        </div>
        <div class="cta-row">
          <a href="../index.html" class="btn btn-primary">Go to Home</a>
        </div>
      </section>
    `;
  }

  function resolveCurrentShopId(username) {
    const users = dataStore.getUsers();
    const user = users.find((item) => String(item?.username ?? "") === String(username ?? ""));
    const direct = String(user?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShopForUser(username);
    return String(fallback?.id ?? "").trim();
  }

  function getBarbersForCurrentScope() {
    if (!currentShopId) return [];
    return dataStore.getBarbersForShop(currentShopId, { includeOwners: true })
      .map((barber) => ({
        username: String(barber?.username ?? "").trim(),
        displayName: String(barber?.displayName ?? barber?.username ?? "").trim() || String(barber?.username ?? ""),
      }))
      .filter((barber) => Boolean(barber.username));
  }

  function configureScopeControls() {
    if (!ownerScopeEl || !ownerSelectEl || !ownerSelectLabelEl) return;
    const hasTeamScope = barbersInShop.length > 1;

    if (currentRole !== "owner") {
      scopeMode = "my";
      scopeOwnerUsername = ownerUsername;
      ownerScopeEl.innerHTML = '<option value="my">My appointments</option>';
      ownerScopeEl.value = "my";
      ownerScopeEl.disabled = true;
      ownerSelectLabelEl.classList.add("hidden");
      ownerSelectEl.classList.add("hidden");
      ownerSelectEl.disabled = true;
      return;
    }

    if (!hasTeamScope) {
      scopeMode = "my";
      scopeOwnerUsername = ownerUsername;
      ownerScopeEl.innerHTML = '<option value="my">My schedule</option>';
      ownerScopeEl.value = "my";
      ownerScopeEl.disabled = true;
      ownerSelectLabelEl.classList.add("hidden");
      ownerSelectEl.classList.add("hidden");
      ownerSelectEl.disabled = true;
      return;
    }

    scopeMode = normalizeScopeMode(String(ownerScopeEl.value ?? "my"));
    ownerScopeEl.value = scopeMode;
    ownerScopeEl.disabled = false;
    renderScopeOwnerOptions();
    syncScopeOwnerControls();
  }

  function renderScopeOwnerOptions() {
    if (!ownerSelectEl) return;

    if (!barbersInShop.length) {
      scopeOwnerUsername = "";
      ownerSelectEl.innerHTML = '<option value="">No barbers found</option>';
      ownerSelectEl.disabled = true;
      return;
    }

    ownerSelectEl.innerHTML = barbersInShop
      .map((barber) => `<option value="${escapeHtml(barber.username)}">${escapeHtml(barber.displayName)}</option>`)
      .join("");

    const exists = barbersInShop.some((barber) => barber.username === scopeOwnerUsername);
    if (!exists) {
      const ownerRow = barbersInShop.find((barber) => barber.username === ownerUsername);
      scopeOwnerUsername = ownerRow?.username || barbersInShop[0].username;
    }
    ownerSelectEl.value = scopeOwnerUsername;
    ownerSelectEl.disabled = false;
  }

  function syncScopeOwnerControls() {
    if (!ownerScopeEl || !ownerSelectEl || !ownerSelectLabelEl) return;

    const showSpecific = currentRole === "owner" && scopeMode === "specific";
    ownerSelectLabelEl.classList.toggle("hidden", !showSpecific);
    ownerSelectEl.classList.toggle("hidden", !showSpecific);
  }

  function normalizeScopeMode(value) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized === "all") return "all";
    if (normalized === "specific") return "specific";
    return "my";
  }

  function bindEventsOnce() {
    if (filterEl && filterEl.dataset.bound !== "true") {
      filterEl.addEventListener("change", () => {
        syncFilterButtons();
        renderAll();
      });
      filterEl.dataset.bound = "true";
    }
    if (controlsEl && controlsEl.dataset.bound !== "true") {
      controlsEl.addEventListener("click", handleFilterControlClick);
      controlsEl.dataset.bound = "true";
    }
    if (searchEl && searchEl.dataset.bound !== "true") {
      searchEl.addEventListener("input", renderAll);
      searchEl.dataset.bound = "true";
    }
    if (ownerScopeEl && ownerScopeEl.dataset.bound !== "true") {
      ownerScopeEl.addEventListener("change", handleOwnerScopeChange);
      ownerScopeEl.dataset.bound = "true";
    }
    if (ownerSelectEl && ownerSelectEl.dataset.bound !== "true") {
      ownerSelectEl.addEventListener("change", handleOwnerSelectChange);
      ownerSelectEl.dataset.bound = "true";
    }
    if (listContainer && listContainer.dataset.bound !== "true") {
      listContainer.addEventListener("click", handleListActionClick);
      listContainer.dataset.bound = "true";
    }
    if (activeDayFilterEl && activeDayFilterEl.dataset.bound !== "true") {
      activeDayFilterEl.addEventListener("click", handleActiveDayFilterClick);
      activeDayFilterEl.dataset.bound = "true";
    }
    if (exportAppointmentsCsvBtn && exportAppointmentsCsvBtn.dataset.bound !== "true") {
      exportAppointmentsCsvBtn.addEventListener("click", handleExportAppointmentsCsv);
      exportAppointmentsCsvBtn.dataset.bound = "true";
    }
    if (addWalkinBtn && addWalkinBtn.dataset.bound !== "true") {
      addWalkinBtn.addEventListener("click", openWalkinModal);
      addWalkinBtn.dataset.bound = "true";
    }
    if (rescheduleDateEl && rescheduleDateEl.dataset.bound !== "true") {
      rescheduleDateEl.addEventListener("change", handleRescheduleDateChange);
      rescheduleDateEl.dataset.bound = "true";
    }
    if (rescheduleSlotEl && rescheduleSlotEl.dataset.bound !== "true") {
      rescheduleSlotEl.addEventListener("change", updateRescheduleConfirmState);
      rescheduleSlotEl.dataset.bound = "true";
    }
    if (rescheduleConfirmBtn && rescheduleConfirmBtn.dataset.bound !== "true") {
      rescheduleConfirmBtn.addEventListener("click", handleRescheduleConfirm);
      rescheduleConfirmBtn.dataset.bound = "true";
    }
    if (rescheduleCancelBtn && rescheduleCancelBtn.dataset.bound !== "true") {
      rescheduleCancelBtn.addEventListener("click", closeRescheduleModal);
      rescheduleCancelBtn.dataset.bound = "true";
    }
    if (rescheduleCloseBtn && rescheduleCloseBtn.dataset.bound !== "true") {
      rescheduleCloseBtn.addEventListener("click", closeRescheduleModal);
      rescheduleCloseBtn.dataset.bound = "true";
    }
    if (rescheduleModalEl && rescheduleModalEl.dataset.bound !== "true") {
      rescheduleModalEl.addEventListener("click", (event) => {
        if (event.target === rescheduleModalEl) closeRescheduleModal();
      });
      rescheduleModalEl.dataset.bound = "true";
    }
    if (walkinBarberSelectEl && walkinBarberSelectEl.dataset.bound !== "true") {
      walkinBarberSelectEl.addEventListener("change", handleWalkinBarberChange);
      walkinBarberSelectEl.dataset.bound = "true";
    }
    if (walkinServiceSelectEl && walkinServiceSelectEl.dataset.bound !== "true") {
      walkinServiceSelectEl.addEventListener("change", handleWalkinServiceChange);
      walkinServiceSelectEl.dataset.bound = "true";
    }
    if (walkinDateEl && walkinDateEl.dataset.bound !== "true") {
      walkinDateEl.addEventListener("change", handleWalkinDateChange);
      walkinDateEl.dataset.bound = "true";
    }
    if (walkinNowBtn && walkinNowBtn.dataset.bound !== "true") {
      walkinNowBtn.addEventListener("click", handleWalkinNowShortcut);
      walkinNowBtn.dataset.bound = "true";
    }
    if (walkinSlotSelectEl && walkinSlotSelectEl.dataset.bound !== "true") {
      walkinSlotSelectEl.addEventListener("change", handleWalkinSlotChange);
      walkinSlotSelectEl.dataset.bound = "true";
    }
    if (walkinCustomDurationEl && walkinCustomDurationEl.dataset.bound !== "true") {
      walkinCustomDurationEl.addEventListener("input", handleWalkinCustomDurationInput);
      walkinCustomDurationEl.dataset.bound = "true";
    }
    if (walkinNextAvailableBtn && walkinNextAvailableBtn.dataset.bound !== "true") {
      walkinNextAvailableBtn.addEventListener("click", handleWalkinUseNextAvailable);
      walkinNextAvailableBtn.dataset.bound = "true";
    }
    if (walkinRepeatLastServiceBtn && walkinRepeatLastServiceBtn.dataset.bound !== "true") {
      walkinRepeatLastServiceBtn.addEventListener("click", handleWalkinRepeatLastService);
      walkinRepeatLastServiceBtn.dataset.bound = "true";
    }
    if (walkinSameClientBtn && walkinSameClientBtn.dataset.bound !== "true") {
      walkinSameClientBtn.addEventListener("click", handleWalkinUseSameClient);
      walkinSameClientBtn.dataset.bound = "true";
    }
    if (walkinQuickAddBtn && walkinQuickAddBtn.dataset.bound !== "true") {
      walkinQuickAddBtn.addEventListener("click", handleQuickAddWalkin);
      walkinQuickAddBtn.dataset.bound = "true";
    }
    if (walkinCreateBtn && walkinCreateBtn.dataset.bound !== "true") {
      walkinCreateBtn.addEventListener("click", handleWalkinCreate);
      walkinCreateBtn.dataset.bound = "true";
    }
    if (walkinCancelBtn && walkinCancelBtn.dataset.bound !== "true") {
      walkinCancelBtn.addEventListener("click", closeWalkinModal);
      walkinCancelBtn.dataset.bound = "true";
    }
    if (walkinCloseBtn && walkinCloseBtn.dataset.bound !== "true") {
      walkinCloseBtn.addEventListener("click", closeWalkinModal);
      walkinCloseBtn.dataset.bound = "true";
    }
    if (walkinModalEl && walkinModalEl.dataset.bound !== "true") {
      walkinModalEl.addEventListener("click", (event) => {
        if (event.target === walkinModalEl) closeWalkinModal();
      });
      walkinModalEl.dataset.bound = "true";
    }
    if (document.body.dataset.ownerRescheduleEscBound !== "true") {
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!walkinModalEl?.classList.contains("hidden")) {
          closeWalkinModal();
          return;
        }
        if (rescheduleModalEl?.classList.contains("hidden")) return;
        closeRescheduleModal();
      });
      document.body.dataset.ownerRescheduleEscBound = "true";
    }
  }

  function bindBookingSync() {
    if (bookingSyncBound) return;
    window.addEventListener("storage", handleBookingStorageSync);
    window.addEventListener(BOOKING_SYNC_EVENT, handleBookingEventSync);
    bookingSyncBound = true;
  }

  function handleBookingStorageSync(event) {
    if (!isInitialized) return;
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderAll();
  }

  function handleBookingEventSync() {
    if (!isInitialized) return;
    renderAll();
  }

  function handleOwnerScopeChange() {
    if (currentRole !== "owner") return;

    scopeMode = normalizeScopeMode(String(ownerScopeEl?.value ?? "my"));
    if (scopeMode === "my") {
      scopeOwnerUsername = ownerUsername;
    } else if (scopeMode === "specific") {
      if (!scopeOwnerUsername && barbersInShop.length > 0) {
        scopeOwnerUsername = barbersInShop[0].username;
      }
      if (ownerSelectEl && scopeOwnerUsername) ownerSelectEl.value = scopeOwnerUsername;
    }

    syncScopeOwnerControls();
    renderAll();
  }

  function handleOwnerSelectChange() {
    if (currentRole !== "owner") return;
    scopeOwnerUsername = String(ownerSelectEl?.value ?? "").trim();
    renderAll();
  }

  function loadOwnerBookings() {
    const scopedOwnerUsername = getScopedOwnerUsername();
    return dataStore.getBookings()
      .filter((booking) => {
        const bookingOwner = String(booking?.ownerUsername ?? "").trim();
        if (!bookingOwner) return false;

        if (currentRole !== "owner") {
          return bookingOwner === ownerUsername;
        }

        if (scopeMode === "all") {
          if (!currentShopId) return bookingOwner === ownerUsername;
          return String(booking?.shopId ?? "").trim() === currentShopId;
        }

        return bookingOwner === scopedOwnerUsername;
      })
      .map(normalizeBooking)
      .filter(Boolean);
  }

  function getScopedOwnerUsername() {
    if (currentRole !== "owner") return ownerUsername;
    if (scopeMode === "specific") return scopeOwnerUsername || ownerUsername;
    if (scopeMode === "all") return "";
    return ownerUsername;
  }

  function resolveBarberDisplayName(username) {
    const key = String(username ?? "").trim();
    if (!key) return "";

    const fromScope = barbersInShop.find((barber) => barber.username === key);
    if (fromScope) return fromScope.displayName;

    const user = dataStore.getUsers().find((item) => String(item?.username ?? "") === key);
    return String(user?.displayName ?? user?.username ?? key).trim() || key;
  }

  function normalizeBooking(booking) {
    const id = String(booking?.id ?? "").trim();
    if (!id) return null;

    const start = getStartDate(booking);
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return null;

    const durationMinutes = resolveDurationMinutes(booking);
    const end = getEndDate(booking, start, durationMinutes);
    const status = normalizeStatus(booking?.status);
    const serviceName = String(booking?.serviceName ?? booking?.serviceTitle ?? "Service").trim() || "Service";
    const clientName = String(booking?.clientName ?? booking?.customerUsername ?? booking?.name ?? "Unknown").trim() || "Unknown";
    const clientContact = String(booking?.clientContact ?? booking?.contact ?? "").trim();
    const price = Number(booking?.price ?? 0);
    const depositRequired = Boolean(booking?.depositRequired);
    const depositAmountRaw = Number(booking?.depositAmount ?? 0);
    const depositAmount = Number.isFinite(depositAmountRaw) && depositAmountRaw > 0
      ? Number(depositAmountRaw.toFixed(2))
      : 0;
    const depositStatus = depositRequired
      ? String(booking?.depositStatus ?? "unpaid").trim().toLowerCase() || "unpaid"
      : "not_required";

    return {
      id,
      ownerUsername: String(booking?.ownerUsername ?? ""),
      barberUsername: String(booking?.barberUsername ?? booking?.ownerUsername ?? "").trim(),
      barberDisplayName: resolveBarberDisplayName(booking?.barberUsername ?? booking?.ownerUsername),
      shopId: String(booking?.shopId ?? ""),
      source: normalizeBookingSource(booking?.source),
      serviceName,
      durationMinutes,
      price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
      clientName,
      clientContact,
      notes: String(booking?.notes ?? "").trim(),
      depositRequired,
      depositAmount,
      depositStatus,
      status,
      start,
      end,
      createdAt: resolveCreatedAtValue(booking),
    };
  }

  function resolveCreatedAtValue(booking) {
    return String(booking?.createdAtISO ?? booking?.createdAt ?? "").trim();
  }

  function getStartDate(booking) {
    const iso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (iso) {
      const fromIso = new Date(iso);
      if (Number.isFinite(fromIso.getTime())) return fromIso;
    }

    const legacyDate = String(booking?.date ?? "").trim();
    const legacyTime = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (legacyDate && legacyTime) {
      const parsed = new Date(`${legacyDate}T${legacyTime}:00`);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }

    const legacyDatetime = String(booking?.datetime ?? "").trim();
    if (legacyDatetime) {
      const parsedLegacy = new Date(legacyDatetime);
      if (Number.isFinite(parsedLegacy.getTime())) return parsedLegacy;
    }
    return null;
  }

  function resolveDurationMinutes(booking) {
    const duration = Number(booking?.durationMinutes ?? 0);
    if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
    return 30;
  }

  function getEndDate(booking, start, durationMinutes) {
    const endIso = String(booking?.endISO ?? "").trim();
    if (endIso) {
      const fromIso = new Date(endIso);
      if (Number.isFinite(fromIso.getTime()) && fromIso > start) return fromIso;
    }
    return new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  function normalizeStatus(statusValue) {
    const status = String(statusValue ?? "booked").trim().toLowerCase();
    if (status === "confirmed") return "confirmed";
    if (status === "cancelled") return "cancelled";
    if (status === "completed") return "completed";
    if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
    return "booked";
  }

  function normalizeBookingSource(sourceValue) {
    const source = String(sourceValue ?? "").trim().toLowerCase();
    if (!source) return "online";
    if (source === "walk-in" || source === "walkin") return "walkin";
    return source;
  }

  function isScheduledStatus(statusValue) {
    const status = normalizeStatus(statusValue);
    return status === "booked" || status === "confirmed";
  }

  function isWalkinAutofillStatus(statusValue) {
    const status = normalizeStatus(statusValue);
    return status === "booked" || status === "confirmed" || status === "completed";
  }

  function getWalkinLastServiceStorageKey(barberUsername) {
    const barber = String(barberUsername ?? "").trim();
    return barber ? `${WALKIN_LAST_SERVICE_KEY_PREFIX}${barber}` : "";
  }

  function getWalkinLastClientStorageKey(barberUsername) {
    const barber = String(barberUsername ?? "").trim();
    return barber ? `${WALKIN_LAST_CLIENT_KEY_PREFIX}${barber}` : "";
  }

  function readWalkinSessionValue(key, fallback = null) {
    if (!key) return fallback;
    try {
      if (typeof dataStore.readSession === "function") {
        return dataStore.readSession(key, fallback);
      }
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeWalkinSessionValue(key, value) {
    if (!key) return;
    try {
      if (typeof dataStore.writeSession === "function") {
        dataStore.writeSession(key, value);
        return;
      }
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore sessionStorage write failures so the modal still works normally.
    }
  }

  function readWalkinLastServiceCache(barberUsername) {
    const cached = readWalkinSessionValue(getWalkinLastServiceStorageKey(barberUsername), null);
    if (!cached || typeof cached !== "object") return null;

    const serviceId = String(cached.serviceId ?? "").trim();
    const serviceName = String(cached.serviceName ?? "").trim();
    const durationMinutes = Number(cached.durationMinutes ?? 0);
    const price = Number(cached.price ?? 0);
    const createdAtISO = String(cached.createdAtISO ?? "").trim();

    if (!serviceId && !serviceName) return null;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

    return {
      serviceId,
      serviceName,
      durationMinutes: Math.round(durationMinutes),
      price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
      createdAtISO,
    };
  }

  function writeWalkinLastServiceCache(barberUsername, payload) {
    const key = getWalkinLastServiceStorageKey(barberUsername);
    if (!key || !payload || typeof payload !== "object") return;
    writeWalkinSessionValue(key, {
      serviceId: String(payload.serviceId ?? "").trim(),
      serviceName: String(payload.serviceName ?? "").trim(),
      durationMinutes: Number(payload.durationMinutes ?? 0),
      price: Number(payload.price ?? 0),
      createdAtISO: String(payload.createdAtISO ?? "").trim(),
    });
  }

  function readWalkinLastClientCache(barberUsername) {
    const cached = readWalkinSessionValue(getWalkinLastClientStorageKey(barberUsername), null);
    if (!cached || typeof cached !== "object") return null;

    const clientName = String(cached.clientName ?? "").trim();
    const clientContact = String(cached.clientContact ?? "").trim();
    const createdAtISO = String(cached.createdAtISO ?? "").trim();
    if (!clientName) return null;

    return {
      clientName,
      clientContact,
      createdAtISO,
    };
  }

  function writeWalkinLastClientCache(barberUsername, payload) {
    const key = getWalkinLastClientStorageKey(barberUsername);
    if (!key || !payload || typeof payload !== "object") return;
    writeWalkinSessionValue(key, {
      clientName: String(payload.clientName ?? "").trim(),
      clientContact: String(payload.clientContact ?? "").trim(),
      createdAtISO: String(payload.createdAtISO ?? "").trim(),
    });
  }

  function resolveWalkinAutofillSortTimestamp(booking, fallbackStart) {
    const createdAtTs = Date.parse(String(booking?.createdAtISO ?? booking?.createdAt ?? "").trim());
    if (Number.isFinite(createdAtTs)) return createdAtTs;

    const startIsoTs = Date.parse(String(booking?.startISO ?? booking?.startAtISO ?? "").trim());
    if (Number.isFinite(startIsoTs)) return startIsoTs;

    if (fallbackStart instanceof Date && Number.isFinite(fallbackStart.getTime())) {
      return fallbackStart.getTime();
    }
    return 0;
  }

  function getMostRecentWalkinAutofillBooking(barberUsername) {
    const targetBarber = String(barberUsername ?? "").trim();
    if (!targetBarber) return null;

    return dataStore.getBookings()
      .map((booking) => {
        const normalized = normalizeBooking(booking);
        if (!normalized) return null;
        if (normalized.barberUsername !== targetBarber) return null;
        if (!isWalkinAutofillStatus(normalized.status)) return null;

        const bookingShopId = String(normalized.shopId ?? "").trim();
        if (currentShopId && bookingShopId && bookingShopId !== currentShopId) return null;

        const rawServiceName = String(booking?.serviceName ?? booking?.serviceTitle ?? "").trim();
        const rawClientName = String(booking?.clientName ?? booking?.name ?? booking?.customerUsername ?? "").trim();
        const sortTimestamp = resolveWalkinAutofillSortTimestamp(booking, normalized.start);

        return {
          ...normalized,
          serviceId: String(booking?.serviceId ?? "").trim(),
          rawServiceName,
          rawClientName,
          sortTimestamp,
          createdAtISO: resolveCreatedAtValue(booking),
          startISO: String(booking?.startISO ?? booking?.startAtISO ?? "").trim(),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.sortTimestamp !== left.sortTimestamp) {
          return right.sortTimestamp - left.sortTimestamp;
        }
        return right.start.getTime() - left.start.getTime();
      })[0] || null;
  }

  function getWalkinLastServiceData(barberUsername) {
    const mostRecentBooking = getMostRecentWalkinAutofillBooking(barberUsername);
    if (mostRecentBooking) {
      const payload = {
        serviceId: mostRecentBooking.serviceId,
        serviceName: mostRecentBooking.rawServiceName || (mostRecentBooking.serviceName !== "Service" ? mostRecentBooking.serviceName : ""),
        durationMinutes: mostRecentBooking.durationMinutes,
        price: mostRecentBooking.price,
        createdAtISO: mostRecentBooking.createdAtISO || mostRecentBooking.startISO || mostRecentBooking.start.toISOString(),
      };
      if (payload.serviceId || payload.serviceName) {
        writeWalkinLastServiceCache(barberUsername, payload);
        return payload;
      }
    }

    return readWalkinLastServiceCache(barberUsername);
  }

  function getWalkinLastClientData(barberUsername) {
    const mostRecentBooking = getMostRecentWalkinAutofillBooking(barberUsername);
    if (mostRecentBooking) {
      const payload = {
        clientName: mostRecentBooking.rawClientName || (mostRecentBooking.clientName !== "Unknown" ? mostRecentBooking.clientName : ""),
        clientContact: String(mostRecentBooking.clientContact ?? "").trim(),
        createdAtISO: mostRecentBooking.createdAtISO || mostRecentBooking.startISO || mostRecentBooking.start.toISOString(),
      };
      if (payload.clientName) {
        writeWalkinLastClientCache(barberUsername, payload);
        return payload;
      }
    }

    return readWalkinLastClientCache(barberUsername);
  }

  function renderAll() {
    if (currentRole === "owner") {
      barbersInShop = getBarbersForCurrentScope();
      renderScopeOwnerOptions();
      if (scopeMode === "specific" && !scopeOwnerUsername) {
        scopeMode = "my";
        if (ownerScopeEl) ownerScopeEl.value = "my";
      }
      syncScopeOwnerControls();
    }

    const bookings = loadOwnerBookings();
    clientNoShowCountByKey = buildClientNoShowCountMap(bookings);
    syncFilterButtons();
    if (window.FullCalendar) {
      renderCalendar(bookings);
    } else {
      renderSummary(bookings, new Date());
    }
    renderOwnerAppointments(bookings);
    if (walkinModalEl && !walkinModalEl.classList.contains("hidden")) {
      refreshWalkinBarberOptions({ preserveSelection: true });
      refreshWalkinServiceOptions({ preserveSelection: true });
      populateWalkinSlots();
    }
  }

  function renderSummary(bookings, referenceDate) {
    if (!monthLabel || !summaryLabel) return;

    const anchor = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime())
      ? referenceDate
      : new Date();
    const monthName = anchor.toLocaleString(undefined, { month: "long" });
    const year = anchor.getFullYear();
    const monthStart = new Date(year, anchor.getMonth(), 1);
    const monthEnd = new Date(year, anchor.getMonth() + 1, 1);
    const monthCount = bookings.filter((booking) => booking.start >= monthStart && booking.start < monthEnd).length;
    const scopeLabel = getScopeSummaryLabel();

    monthLabel.textContent = `${monthName} ${year}`;
    summaryLabel.textContent = `${monthCount} appointments this month (${scopeLabel})`;
  }

  function getScopeSummaryLabel() {
    if (currentRole !== "owner") return "My appointments";
    if (scopeMode === "all") return "All barbers";
    if (scopeMode === "specific") {
      return resolveBarberDisplayName(scopeOwnerUsername) || "Specific barber";
    }
    return "My appointments";
  }

  function getWalkinBarberChoices() {
    const unique = new Map();
    const addChoice = (username, displayName = "") => {
      const key = String(username ?? "").trim();
      if (!key || unique.has(key)) return;
      unique.set(key, {
        username: key,
        displayName: String(displayName ?? "").trim() || resolveBarberDisplayName(key) || key,
      });
    };

    if (currentRole === "owner") {
      barbersInShop.forEach((barber) => addChoice(barber.username, barber.displayName));
      addChoice(ownerUsername);
    } else {
      addChoice(ownerUsername);
    }

    return Array.from(unique.values());
  }

  function getDefaultWalkinBarberUsername() {
    if (currentRole !== "owner") return ownerUsername;
    if (scopeMode === "specific" && scopeOwnerUsername) return scopeOwnerUsername;
    if (scopeMode === "my" && ownerUsername) return ownerUsername;
    return getWalkinBarberChoices()[0]?.username || ownerUsername;
  }

  function getQuickAddWalkinBarberUsername() {
    if (currentRole !== "owner") return ownerUsername;
    if (scopeMode === "specific") return String(scopeOwnerUsername ?? "").trim();
    if (scopeMode === "my") return ownerUsername;
    return "";
  }

  function getQuickAddWalkinPreset(barberUsername) {
    const lastService = getWalkinLastServiceData(barberUsername);
    if (lastService && String(lastService.serviceName ?? "").trim()) {
      return {
        serviceId: String(lastService.serviceId ?? "").trim(),
        name: String(lastService.serviceName ?? "").trim(),
        durationMinutes: Number(lastService.durationMinutes ?? 30) || 30,
        price: Number(lastService.price ?? 0) || 0,
      };
    }

    const haircutService = getServicesForBarber(barberUsername)
      .find((service) => service.name.localeCompare("Haircut", undefined, { sensitivity: "base" }) === 0);

    if (haircutService) {
      return {
        serviceId: haircutService.id,
        name: haircutService.name,
        durationMinutes: haircutService.durationMinutes,
        price: haircutService.price,
      };
    }

    return {
      serviceId: "",
      name: "Haircut",
      durationMinutes: 30,
      price: 0,
    };
  }

  function getServicesForBarber(barberUsername) {
    const targetBarber = String(barberUsername ?? "").trim();
    if (!targetBarber) return [];

    return dataStore.getServices()
      .filter((service) => {
        const serviceBarber = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim();
        if (serviceBarber !== targetBarber) return false;
        if (service?.active === false) return false;
        if (!currentShopId) return true;
        const serviceShopId = String(service?.shopId ?? "").trim();
        return !serviceShopId || serviceShopId === currentShopId;
      })
      .map((service) => ({
        id: String(service?.id ?? "").trim(),
        name: String(service?.name ?? service?.title ?? "Service").trim() || "Service",
        durationMinutes: resolveDurationMinutes(service),
        price: Number.isFinite(Number(service?.price)) ? Number(Number(service.price).toFixed(2)) : 0,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  }

  function refreshWalkinBarberOptions({ preserveSelection = true } = {}) {
    if (!walkinBarberSelectEl) return;

    const choices = getWalkinBarberChoices();
    const previous = preserveSelection ? String(walkinBarberSelectEl.value ?? "").trim() : "";
    const preferred = previous || walkinModalBarberUsername || getDefaultWalkinBarberUsername();
    const resolved = choices.some((barber) => barber.username === preferred)
      ? preferred
      : (choices[0]?.username || "");

    walkinBarberSelectEl.innerHTML = choices
      .map((barber) => `<option value="${escapeHtml(barber.username)}">${escapeHtml(barber.displayName)}</option>`)
      .join("");
    walkinBarberSelectEl.value = resolved;
    walkinBarberSelectEl.disabled = currentRole !== "owner" || choices.length <= 1;
    walkinModalBarberUsername = resolved;
    updateWalkinAutofillButtonState();
  }

  function refreshWalkinServiceOptions({ preserveSelection = true } = {}) {
    if (!walkinServiceSelectEl) return;
    const previous = preserveSelection ? String(walkinServiceSelectEl.value ?? "").trim() : "";
    const services = getServicesForBarber(walkinBarberSelectEl?.value);
    const options = [
      ...services.map((service) => ({
        value: service.id,
        label: `${service.name} | ${service.durationMinutes} min | $${formatMoneyValue(service.price)}`,
      })),
      { value: "custom", label: "Custom service" },
    ];
    const resolved = options.some((option) => option.value === previous)
      ? previous
      : (services[0]?.id || "custom");

    walkinServiceSelectEl.innerHTML = options
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    walkinServiceSelectEl.value = resolved;
    toggleWalkinCustomFields();
  }

  function toggleWalkinCustomFields() {
    if (!walkinCustomServiceFieldsEl || !walkinServiceSelectEl) return;
    const isCustom = String(walkinServiceSelectEl.value ?? "").trim() === "custom";
    walkinCustomServiceFieldsEl.classList.toggle("hidden", !isCustom);
  }

  function clearWalkinCustomServiceInputs() {
    if (walkinCustomServiceNameEl) walkinCustomServiceNameEl.value = "";
    if (walkinCustomDurationEl) walkinCustomDurationEl.value = "";
    if (walkinCustomPriceEl) walkinCustomPriceEl.value = "";
  }

  function hasWalkinSlotPrereqs() {
    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    const dateYmd = String(walkinDateEl?.value ?? "").trim();
    const service = getWalkinSelectedService();
    return Boolean(barberUsername && dateYmd && Number.isFinite(service.durationMinutes) && service.durationMinutes > 0);
  }

  function setWalkinSlotMessage(message = "") {
    if (!walkinSlotEmptyEl) return;
    const text = String(message ?? "").trim();
    walkinSlotEmptyEl.textContent = text;
    walkinSlotEmptyEl.classList.toggle("hidden", !text);
  }

  function isWalkinToday(dateYmd = walkinDateEl?.value) {
    return String(dateYmd ?? "").trim() === toYmdLocal(new Date());
  }

  function updateWalkinCreateButtonState() {
    if (!walkinCreateBtn) return;
    const hasSlot = Boolean(String(walkinSlotSelectEl?.value ?? "").trim());
    walkinCreateBtn.disabled = !hasSlot;
    if (walkinQuickAddBtn) {
      walkinQuickAddBtn.disabled = !hasWalkinSlotPrereqs();
    }
  }

  function updateWalkinNextAvailableState() {
    if (!walkinNextAvailableBtn) return;
    walkinNextAvailableBtn.disabled = !hasWalkinSlotPrereqs() || !walkinSlotsGenerated;
  }

  function updateWalkinAutofillButtonState() {
    const hasBarber = Boolean(String(walkinBarberSelectEl?.value ?? "").trim());
    if (walkinRepeatLastServiceBtn) {
      walkinRepeatLastServiceBtn.disabled = !hasBarber;
    }
    if (walkinSameClientBtn) {
      walkinSameClientBtn.disabled = !hasBarber;
    }
  }

  function resetWalkinSlotState() {
    if (!walkinSlotSelectEl) return;
    walkinSlotOptions = [];
    walkinSlotsGenerated = false;
    walkinSlotSelectEl.innerHTML = '<option value="">Select a time...</option>';
    walkinSlotSelectEl.value = "";
    walkinSlotSelectEl.disabled = true;
    setWalkinSlotMessage("");
    updateWalkinCreateButtonState();
    updateWalkinNextAvailableState();
  }

  function getWalkinSelectedService() {
    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    const selectedServiceId = String(walkinServiceSelectEl?.value ?? "").trim();
    const isCustom = selectedServiceId === "custom";

    if (isCustom) {
      const rawName = String(walkinCustomServiceNameEl?.value ?? "").trim();
      const rawDuration = Number(walkinCustomDurationEl?.value ?? "");
      const rawPriceText = String(walkinCustomPriceEl?.value ?? "").trim();
      const parsedPrice = rawPriceText ? Number(rawPriceText) : 0;
      return {
        isCustom: true,
        serviceId: "",
        barberUsername,
        name: rawName,
        durationMinutes: Number.isFinite(rawDuration) ? Math.round(rawDuration) : 0,
        price: Number.isFinite(parsedPrice) ? Number(parsedPrice.toFixed(2)) : 0,
        rawPriceText,
      };
    }

    const service = getServicesForBarber(barberUsername).find((item) => item.id === selectedServiceId) || null;
    return {
      isCustom: false,
      serviceId: String(service?.id ?? ""),
      barberUsername,
      name: String(service?.name ?? ""),
      durationMinutes: Number(service?.durationMinutes ?? 0),
      price: Number(service?.price ?? 0),
      rawPriceText: formatMoneyValue(service?.price ?? 0),
    };
  }

  function getWalkinSlotOptions({ includePastSlots = false } = {}) {
    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    const service = getWalkinSelectedService();
    const dateYmd = String(walkinDateEl?.value ?? "").trim();
    if (!barberUsername || !dateYmd) return [];
    if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) return [];
    return buildRescheduleSlotOptions({
      ownerName: barberUsername,
      dateYmd,
      durationMinutes: service.durationMinutes,
      ignoreBookingId: "",
      includePastSlots,
    });
  }

  function findNextAvailableWalkinSlot({ startDateYmd, includePastSlotsToday = false } = {}) {
    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    const service = getWalkinSelectedService();
    const anchorYmd = String(startDateYmd ?? walkinDateEl?.value ?? "").trim() || toYmdLocal(new Date());
    if (!barberUsername || !anchorYmd) return null;
    if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) return null;

    const anchorDate = parseYmdLocal(anchorYmd);
    if (!(anchorDate instanceof Date) || !Number.isFinite(anchorDate.getTime())) return null;

    for (let offset = 0; offset < 30; offset += 1) {
      const candidateDate = new Date(anchorDate);
      candidateDate.setDate(anchorDate.getDate() + offset);
      const dateYmd = toYmdLocal(candidateDate);
      const slotOptions = buildRescheduleSlotOptions({
        ownerName: barberUsername,
        dateYmd,
        durationMinutes: service.durationMinutes,
        ignoreBookingId: "",
        includePastSlots: includePastSlotsToday && offset === 0,
      });
      if (slotOptions.length) {
        return {
          dateYmd,
          slot: slotOptions[0],
          slotOptions,
        };
      }
    }

    return null;
  }

  function createWalkinBooking({
    barberUsername,
    dateYmd,
    selectedStartISO,
    service,
    clientName,
    clientContact = "",
    notes = "",
  }) {
    const resolvedBarberUsername = String(barberUsername ?? "").trim();
    const resolvedDateYmd = String(dateYmd ?? "").trim();
    const resolvedStartISO = String(selectedStartISO ?? "").trim();
    const resolvedClientName = String(clientName ?? "").trim();
    const resolvedClientContact = String(clientContact ?? "").trim();
    const resolvedNotes = String(notes ?? "").trim();
    const resolvedService = service && typeof service === "object" ? service : {};

    if (!resolvedBarberUsername) {
      return { ok: false, error: "Choose a barber before creating the appointment." };
    }
    if (!String(resolvedService.name ?? "").trim()) {
      return { ok: false, error: "Choose a service before creating the appointment." };
    }

    const durationMinutes = Number(resolvedService.durationMinutes ?? 0);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return { ok: false, error: "Enter a valid service duration in minutes." };
    }
    if (!resolvedDateYmd) {
      return { ok: false, error: "Choose a date for the appointment." };
    }
    if (!resolvedStartISO) {
      return { ok: false, error: "Choose an available time slot." };
    }
    if (!resolvedClientName) {
      return { ok: false, error: "Client name is required for walk-ins." };
    }

    const slotOptions = buildRescheduleSlotOptions({
      ownerName: resolvedBarberUsername,
      dateYmd: resolvedDateYmd,
      durationMinutes,
      ignoreBookingId: "",
    });
    const selectedSlot = slotOptions.find((slot) => isSameInstant(slot.startISO, resolvedStartISO));
    if (!selectedSlot) {
      return {
        ok: false,
        code: "slot_unavailable",
        error: "That time is no longer available. Please choose another slot.",
      };
    }

    const start = new Date(selectedSlot.startISO);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return { ok: false, error: "Could not create a valid appointment time range." };
    }

    const nowIso = new Date().toISOString();
    const normalizedPrice = Number.isFinite(Number(resolvedService.price))
      ? Number(Number(resolvedService.price).toFixed(2))
      : 0;
    const booking = {
      id: createBookingId(),
      source: "walkin",
      status: "confirmed",
      createdAtISO: nowIso,
      createdAt: nowIso,
      shopId: currentShopId || resolveCurrentShopId(resolvedBarberUsername),
      ownerUsername: resolvedBarberUsername,
      barberUsername: resolvedBarberUsername,
      barberDisplayName: resolveBarberDisplayName(resolvedBarberUsername),
      serviceId: String(resolvedService.serviceId ?? "").trim(),
      serviceName: String(resolvedService.name ?? "").trim(),
      durationMinutes,
      price: normalizedPrice,
      clientName: resolvedClientName,
      clientContact: resolvedClientContact,
      notes: resolvedNotes,
      depositRequired: false,
      depositAmount: 0,
      depositStatus: "not_required",
      customerUsername: resolvedClientContact || resolvedClientName,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      startAtISO: start.toISOString(),
      date: toYmdLocal(start),
      time: minutesToHhmm(start.getHours() * 60 + start.getMinutes()),
    };

    const bookings = dataStore.getBookings();
    bookings.push(booking);
    dataStore.saveBookings(bookings);
    writeWalkinLastServiceCache(resolvedBarberUsername, {
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
      durationMinutes: booking.durationMinutes,
      price: booking.price,
      createdAtISO: nowIso,
    });
    writeWalkinLastClientCache(resolvedBarberUsername, {
      clientName: booking.clientName,
      clientContact: booking.clientContact,
      createdAtISO: nowIso,
    });

    return {
      ok: true,
      booking,
      start,
    };
  }

  function openWalkinModal() {
    if (!walkinModalEl || !walkinDateEl) return;

    refreshWalkinBarberOptions({ preserveSelection: false });
    refreshWalkinServiceOptions({ preserveSelection: false });
    resetWalkinSlotState();
    clearWalkinStatus();

    const todayYmd = toYmdLocal(new Date());
    walkinDateEl.min = todayYmd;
    walkinDateEl.value = todayYmd;
    if (walkinClientNameEl) walkinClientNameEl.value = "";
    if (walkinClientContactEl) walkinClientContactEl.value = "";
    if (walkinNotesEl) walkinNotesEl.value = "";
    clearWalkinCustomServiceInputs();
    updateWalkinAutofillButtonState();

    populateWalkinSlots();
    walkinModalEl.classList.remove("hidden");
    walkinModalEl.classList.add("show");
    walkinModalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    window.setTimeout(() => {
      walkinClientNameEl?.focus();
    }, 0);
  }

  function closeWalkinModal() {
    if (!walkinModalEl) return;
    walkinModalEl.classList.remove("show");
    walkinModalEl.classList.add("hidden");
    walkinModalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    clearWalkinStatus();
    resetWalkinSlotState();
    updateWalkinAutofillButtonState();
  }

  function handleWalkinBarberChange() {
    walkinModalBarberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    clearWalkinStatus();
    updateWalkinAutofillButtonState();
    refreshWalkinServiceOptions({ preserveSelection: false });
    populateWalkinSlots({ preserveSelection: true });
  }

  function handleWalkinServiceChange() {
    clearWalkinStatus();
    toggleWalkinCustomFields();
    populateWalkinSlots({ preserveSelection: true });
  }

  function handleWalkinDateChange() {
    clearWalkinStatus();
    populateWalkinSlots({ preserveSelection: true });
  }

  function handleWalkinCustomDurationInput() {
    if (String(walkinServiceSelectEl?.value ?? "").trim() !== "custom") return;
    clearWalkinStatus();
    populateWalkinSlots({ preserveSelection: true });
  }

  function populateWalkinSlots({ preserveSelection = false } = {}) {
    if (!walkinSlotSelectEl || !walkinDateEl) return;

    const previousSelectedStartISO = preserveSelection
      ? String(walkinSlotSelectEl.value ?? "").trim()
      : "";

    resetWalkinSlotState();

    if (!hasWalkinSlotPrereqs()) return;

    walkinSlotOptions = getWalkinSlotOptions();
    walkinSlotsGenerated = true;

    if (!walkinSlotOptions.length) {
      setWalkinSlotMessage("No available time slots for this selection.");
      updateWalkinNextAvailableState();
      return;
    }

    walkinSlotOptions.forEach((slot) => {
      const option = document.createElement("option");
      option.value = slot.startISO;
      option.textContent = slot.label;
      walkinSlotSelectEl.appendChild(option);
    });
    walkinSlotSelectEl.disabled = false;
    if (previousSelectedStartISO) {
      const selectedSlot = walkinSlotOptions.find((slot) => isSameInstant(slot.startISO, previousSelectedStartISO));
      if (selectedSlot) {
        walkinSlotSelectEl.value = selectedSlot.startISO;
      }
    }
    updateWalkinCreateButtonState();
    updateWalkinNextAvailableState();
  }

  function handleWalkinSlotChange() {
    clearWalkinStatus();
    setWalkinSlotMessage("");
    updateWalkinCreateButtonState();
  }

  function handleWalkinUseNextAvailable() {
    clearWalkinStatus();

    if (!hasWalkinSlotPrereqs()) {
      setWalkinSlotMessage("Choose a barber, service, duration, and date first.");
      updateWalkinCreateButtonState();
      return;
    }
    const nextAvailable = findNextAvailableWalkinSlot({
      startDateYmd: String(walkinDateEl?.value ?? "").trim(),
      includePastSlotsToday: isWalkinToday(),
    });
    if (!nextAvailable) {
      walkinSlotSelectEl.value = "";
      setWalkinSlotMessage("No available times in the next 30 days for this selection.");
      updateWalkinCreateButtonState();
      updateWalkinNextAvailableState();
      return;
    }

    if (walkinDateEl) {
      walkinDateEl.value = nextAvailable.dateYmd;
    }
    populateWalkinSlots();
    if (walkinSlotSelectEl) {
      walkinSlotSelectEl.disabled = false;
      walkinSlotSelectEl.value = nextAvailable.slot.startISO;
    }
    setWalkinSlotMessage("");
    updateWalkinCreateButtonState();
    updateWalkinNextAvailableState();
  }

  function handleWalkinNowShortcut() {
    clearWalkinStatus();
    if (walkinDateEl) {
      walkinDateEl.value = toYmdLocal(new Date());
    }
    handleWalkinUseNextAvailable();
  }

  function handleWalkinRepeatLastService() {
    clearWalkinStatus();

    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    if (!barberUsername) {
      setWalkinStatus("Choose a barber first.", false);
      updateWalkinAutofillButtonState();
      return;
    }

    const lastService = getWalkinLastServiceData(barberUsername);
    if (!lastService) {
      setWalkinStatus("No previous service found for this barber yet.", false);
      return;
    }

    const services = getServicesForBarber(barberUsername);
    const matchingService = lastService.serviceId
      ? services.find((service) => service.id === lastService.serviceId)
      : null;

    if (matchingService && walkinServiceSelectEl) {
      walkinServiceSelectEl.value = matchingService.id;
      clearWalkinCustomServiceInputs();
    } else {
      const serviceName = String(lastService.serviceName ?? "").trim();
      const durationMinutes = Number(lastService.durationMinutes ?? 0);
      if (!serviceName || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        setWalkinStatus("No previous service found for this barber yet.", false);
        return;
      }

      if (walkinServiceSelectEl) {
        walkinServiceSelectEl.value = "custom";
      }
      if (walkinCustomServiceNameEl) {
        walkinCustomServiceNameEl.value = serviceName;
      }
      if (walkinCustomDurationEl) {
        walkinCustomDurationEl.value = String(Math.round(durationMinutes));
      }
      if (walkinCustomPriceEl) {
        const price = Number(lastService.price ?? 0);
        walkinCustomPriceEl.value = Number.isFinite(price) && price > 0 ? formatMoneyValue(price) : "";
      }
    }

    toggleWalkinCustomFields();
    populateWalkinSlots({ preserveSelection: true });
    setWalkinStatus("Filled from last appointment.", true);
  }

  function handleWalkinUseSameClient() {
    clearWalkinStatus();

    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    if (!barberUsername) {
      setWalkinStatus("Choose a barber first.", false);
      updateWalkinAutofillButtonState();
      return;
    }

    const lastClient = getWalkinLastClientData(barberUsername);
    if (!lastClient) {
      setWalkinStatus("No previous client found for this barber yet.", false);
      return;
    }

    if (walkinClientNameEl) {
      walkinClientNameEl.value = lastClient.clientName;
    }
    if (walkinClientContactEl) {
      walkinClientContactEl.value = lastClient.clientContact;
    }
    setWalkinStatus("Filled from last appointment.", true);
  }

  function handleQuickAddWalkin() {
    const inModal = Boolean(walkinModalEl && !walkinModalEl.classList.contains("hidden"));
    if (!inModal) {
      openWalkinModal();
    }

    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim() || getQuickAddWalkinBarberUsername();
    if (!barberUsername) {
      setWalkinStatus("Choose a barber before using quick add.", false);
      return;
    }

    if (walkinBarberSelectEl && walkinBarberSelectEl.value !== barberUsername) {
      walkinBarberSelectEl.value = barberUsername;
      handleWalkinBarberChange();
    }

    const preferredService = getQuickAddWalkinPreset(barberUsername);
    if (preferredService.name) {
      const match = getServicesForBarber(barberUsername).find((service) => service.id === preferredService.serviceId);
      if (match && walkinServiceSelectEl) {
        walkinServiceSelectEl.value = match.id;
        handleWalkinServiceChange();
      } else if (walkinServiceSelectEl) {
        walkinServiceSelectEl.value = "custom";
        if (walkinCustomServiceNameEl) walkinCustomServiceNameEl.value = preferredService.name;
        if (walkinCustomDurationEl) walkinCustomDurationEl.value = String(Math.max(5, Math.round(preferredService.durationMinutes || 30)));
        if (walkinCustomPriceEl) walkinCustomPriceEl.value = preferredService.price > 0 ? formatMoneyValue(preferredService.price) : "";
        handleWalkinServiceChange();
      }
    }

    const nextAvailable = findNextAvailableWalkinSlot({
      startDateYmd: toYmdLocal(new Date()),
      includePastSlotsToday: true,
    });
    if (!nextAvailable) {
      setWalkinStatus("No available times in the next 30 days for this selection.", false);
      return;
    }

    if (walkinDateEl) {
      walkinDateEl.value = nextAvailable.dateYmd;
    }
    populateWalkinSlots();
    if (walkinSlotSelectEl) {
      walkinSlotSelectEl.value = nextAvailable.slot.startISO;
    }

    const clientName = String(walkinClientNameEl?.value ?? "").trim() || "Walk-In";
    const clientContact = String(walkinClientContactEl?.value ?? "").trim();
    const notes = String(walkinNotesEl?.value ?? "").trim();
    const service = getWalkinSelectedService();

    const result = createWalkinBooking({
      barberUsername,
      dateYmd: nextAvailable.dateYmd,
      selectedStartISO: nextAvailable.slot.startISO,
      service,
      clientName,
      clientContact,
      notes,
    });

    if (!result.ok) {
      setWalkinStatus(result.error || "Could not add the walk-in right now.", false);
      return;
    }

    closeWalkinModal();
    renderAll();
    const successMessage = `${clientName} added at ${formatTimeLabel(result.start)}.`;
    if (typeof window.showToast === "function") {
      window.showToast(successMessage, "success");
    } else {
      setInlineStatus(successMessage, true);
    }
  }

  function handleWalkinCreate() {
    clearWalkinStatus();

    const barberUsername = String(walkinBarberSelectEl?.value ?? "").trim();
    const dateYmd = String(walkinDateEl?.value ?? "").trim();
    const selectedStartISO = String(walkinSlotSelectEl?.value ?? "").trim();
    const clientName = String(walkinClientNameEl?.value ?? "").trim();
    const clientContact = String(walkinClientContactEl?.value ?? "").trim();
    const notes = String(walkinNotesEl?.value ?? "").trim();
    const service = getWalkinSelectedService();

    if (!barberUsername) {
      setWalkinStatus("Choose a barber before creating the appointment.", false);
      return;
    }
    if (!service.name) {
      setWalkinStatus(service.isCustom ? "Enter a custom service name." : "Choose a service.", false);
      return;
    }
    if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) {
      setWalkinStatus("Enter a valid service duration in minutes.", false);
      return;
    }
    if (service.isCustom && service.rawPriceText && service.price < 0) {
      setWalkinStatus("Custom service price cannot be negative.", false);
      return;
    }
    if (!dateYmd) {
      setWalkinStatus("Choose a date for the appointment.", false);
      return;
    }
    if (!selectedStartISO) {
      setWalkinStatus("Choose an available time slot.", false);
      return;
    }
    if (!clientName) {
      setWalkinStatus("Client name is required for walk-ins.", false);
      return;
    }

    const result = createWalkinBooking({
      barberUsername,
      dateYmd,
      selectedStartISO,
      service,
      clientName,
      clientContact,
      notes,
    });
    if (!result.ok) {
      setWalkinStatus(result.error || "Could not add the walk-in right now.", false);
      if (result.code === "slot_unavailable") {
        populateWalkinSlots();
      }
      return;
    }

    closeWalkinModal();
    setInlineStatus(`Walk-in added for ${clientName}.`, true);
    renderAll();
  }

  function setWalkinStatus(message, success) {
    if (!walkinStatusEl) return;
    const text = String(message ?? "").trim();
    walkinStatusEl.textContent = text;
    walkinStatusEl.setAttribute("role", success ? "status" : "alert");
    walkinStatusEl.setAttribute("aria-live", success ? "polite" : "assertive");
    walkinStatusEl.setAttribute("aria-atomic", "true");
    walkinStatusEl.classList.remove("status-success", "status-error");
    walkinStatusEl.classList.add(success ? "status-success" : "status-error");
  }

  function clearWalkinStatus() {
    if (!walkinStatusEl) return;
    walkinStatusEl.textContent = "";
    walkinStatusEl.setAttribute("role", "status");
    walkinStatusEl.setAttribute("aria-live", "polite");
    walkinStatusEl.setAttribute("aria-atomic", "true");
    walkinStatusEl.classList.remove("status-success", "status-error");
  }

  function renderCalendar(bookings) {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl || !window.FullCalendar) return;

    bookedCountByDay = buildBookedCountByDay(bookings);
    bindCalendarHostEventsOnce(calendarEl);

    let initialDate = new Date();
    if (calendarInstance) {
      const currentDate = calendarInstance.getDate();
      if (currentDate instanceof Date && Number.isFinite(currentDate.getTime())) {
        initialDate = currentDate;
      }
      calendarInstance.destroy();
    }

    const events = bookings.map((booking) => ({
      id: booking.id,
      title: `${statusMarker(booking.status)} ${booking.clientName} - ${booking.serviceName}`,
      start: booking.start.toISOString(),
      end: booking.end.toISOString(),
      allDay: false,
      startEditable: booking.status === "booked",
      durationEditable: false,
      extendedProps: {
        bookingId: booking.id,
        status: booking.status,
        ownerUsername: booking.ownerUsername,
        durationMinutes: booking.durationMinutes,
      },
    }));

    calendarInstance = new window.FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      initialDate,
      height: "auto",
      editable: true,
      eventDurationEditable: false,
      snapDuration: "00:15:00",
      events,
      eventAllow: (_dropInfo, draggedEvent) => {
        const status = normalizeStatus(draggedEvent?.extendedProps?.status);
        return status === "booked";
      },
      eventDrop: (info) => {
        handleCalendarEventDrop(info);
      },
      dateClick: (info) => {
        const clickedYmd = toYmdLocal(info?.date);
        if (!clickedYmd) return;
        selectedDateYmd = selectedDateYmd === clickedYmd ? null : clickedYmd;
        refreshVisibleCalendarDays();
        renderOwnerAppointments(loadOwnerBookings());
      },
      dayCellDidMount: (info) => {
        decorateCalendarDay(info.el, info.date);
      },
      datesSet: (info) => {
        const visibleMonthStart = info?.view?.currentStart;
        const bookingsNow = loadOwnerBookings();
        renderSummary(bookingsNow, visibleMonthStart);

        if (selectedDateYmd && !isYmdInMonth(selectedDateYmd, visibleMonthStart)) {
          selectedDateYmd = null;
          renderOwnerAppointments(bookingsNow);
        }

        window.requestAnimationFrame(() => {
          refreshVisibleCalendarDays();
        });
      },
    });
    calendarInstance.render();
    enhanceCalendarAccessibility(calendarEl);
    refreshVisibleCalendarDays();
  }

  function handleCalendarEventDrop(info) {
    const bookingId = String(
      info?.event?.extendedProps?.bookingId ?? info?.event?.id ?? ""
    ).trim();
    const droppedStart = info?.event?.start;
    if (!bookingId || !(droppedStart instanceof Date) || !Number.isFinite(droppedStart.getTime())) {
      info?.revert?.();
      setInlineStatus("Could not reschedule this appointment from calendar.", false);
      return;
    }

    const result = applyRescheduleByStartISO({
      bookingId,
      startISO: droppedStart.toISOString(),
      allowStatuses: ["booked"],
      invalidStatusMessage: "Only booked appointments can be dragged to reschedule.",
    });

    if (!result.ok) {
      info?.revert?.();
      setInlineStatus(result.error || "That drop is not available. Appointment was reverted.", false);
      return;
    }

    setInlineStatus("Appointment rescheduled from calendar.", true);
    renderAll();
  }

  function statusMarker(status) {
    if (status === "confirmed") return "F";
    if (status === "completed") return "C";
    if (status === "cancelled") return "X";
    if (status === "no-show") return "N";
    return "B";
  }

  function buildBookedCountByDay(bookings) {
    const counts = new Map();
    bookings.forEach((booking) => {
      if (!isScheduledStatus(booking?.status)) return;
      const ymd = toYmdLocal(booking.start);
      if (!ymd) return;
      counts.set(ymd, (counts.get(ymd) ?? 0) + 1);
    });
    return counts;
  }

  function bindCalendarHostEventsOnce(calendarEl) {
    if (!calendarEl || calendarEl.dataset.hostBound === "true") return;
    calendarEl.addEventListener("click", (event) => {
      const todayBtn = event.target.closest(".fc-today-button");
      if (!todayBtn) return;
      window.setTimeout(() => {
        selectedDateYmd = toYmdLocal(new Date());
        refreshVisibleCalendarDays();
        renderOwnerAppointments(loadOwnerBookings());
      }, 0);
    });
    calendarEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const dayCell = event.target.closest(".fc-daygrid-day");
      if (!dayCell) return;
      event.preventDefault();
      const clickedYmd = String(dayCell.getAttribute("data-ymd") ?? "").trim();
      if (!clickedYmd) return;
      selectedDateYmd = selectedDateYmd === clickedYmd ? null : clickedYmd;
      refreshVisibleCalendarDays();
      renderOwnerAppointments(loadOwnerBookings());
    });
    calendarEl.dataset.hostBound = "true";
  }

  function enhanceCalendarAccessibility(calendarEl) {
    if (!calendarEl) return;
    calendarEl.setAttribute("role", "region");
    calendarEl.setAttribute("aria-label", "Owner appointments calendar");

    const toolbarButtons = calendarEl.querySelectorAll(".fc-button");
    toolbarButtons.forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const label = String(button.textContent ?? "").trim() || "Calendar control";
      button.setAttribute("aria-label", label);
    });
  }

  function decorateCalendarDay(dayCell, dayDate) {
    if (!dayCell) return;
    const ymd = toYmdLocal(dayDate);
    if (!ymd) return;
    dayCell.setAttribute("data-ymd", ymd);
    dayCell.setAttribute("role", "button");
    dayCell.setAttribute("tabindex", "0");
    dayCell.classList.toggle("owner-calendar-day-selected", selectedDateYmd === ymd);
    dayCell.setAttribute("aria-pressed", selectedDateYmd === ymd ? "true" : "false");
    dayCell.setAttribute("aria-label", buildCalendarDayAriaLabel(dayDate, bookedCountByDay.get(ymd) ?? 0));

    const top = dayCell.querySelector(".fc-daygrid-day-top");
    if (!top) return;
    const existingBadge = top.querySelector(".owner-calendar-day-count");
    if (existingBadge) existingBadge.remove();

    const count = bookedCountByDay.get(ymd) ?? 0;
    if (count <= 0) return;

    const badge = document.createElement("span");
    badge.className = "owner-calendar-day-count";
    badge.textContent = count > 9 ? "9+" : String(count);
    top.appendChild(badge);
    dayCell.setAttribute("aria-label", buildCalendarDayAriaLabel(dayDate, count));
  }

  function refreshVisibleCalendarDays() {
    const dayCells = document.querySelectorAll("#calendar .fc-daygrid-day");
    dayCells.forEach((dayCell) => {
      const ymd = String(dayCell.getAttribute("data-ymd") ?? "");
      if (!ymd) return;
      const dayDate = parseYmdLocal(ymd);
      const count = bookedCountByDay.get(ymd) ?? 0;
      dayCell.classList.toggle("owner-calendar-day-selected", selectedDateYmd === ymd);
      dayCell.setAttribute("aria-pressed", selectedDateYmd === ymd ? "true" : "false");
      if (dayDate) {
        dayCell.setAttribute("aria-label", buildCalendarDayAriaLabel(dayDate, count));
      }

      const top = dayCell.querySelector(".fc-daygrid-day-top");
      if (!top) return;
      let badge = top.querySelector(".owner-calendar-day-count");
      if (count <= 0) {
        badge?.remove();
        return;
      }

      if (!badge) {
        badge = document.createElement("span");
        badge.className = "owner-calendar-day-count";
        top.appendChild(badge);
      }
      badge.textContent = count > 9 ? "9+" : String(count);
    });
  }

  function buildCalendarDayAriaLabel(dayDate, count) {
    const dateLabel = formatDateFriendly(dayDate);
    if (!count) return `${dateLabel}. No scheduled appointments.`;
    return `${dateLabel}. ${count} scheduled appointment${count === 1 ? "" : "s"}.`;
  }

  function renderOwnerAppointments(bookings) {
    if (!listContainer) return;

    renderActiveDayFilterChip();

    const now = new Date();
    const sorted = getVisibleAppointments(bookings, now);
    const query = String(searchEl?.value ?? "").trim();
    const hasScopeFilter = currentRole === "owner" && scopeMode !== "my";
    const hasActiveFilters = query.length > 0 || getActiveFilterScope() !== "today" || hasScopeFilter;

    syncAppointmentsExportButton(sorted.length);

    if (sorted.length === 0) {
      const isTodayScope = getActiveFilterScope() === "today" && !selectedDateYmd;
      const description = hasActiveFilters
        ? "No matches for your current search or view."
        : (isTodayScope ? "No appointments today - add a walk-in." : "No appointments yet. Add a walk-in or share your booking link.");
      const actionMarkup = hasActiveFilters
        ? `
          <div class="empty-state-actions">
            <button type="button" class="btn btn-ghost empty-state-cta" data-action="clear-filters">Clear filters</button>
          </div>
        `
        : `
          <div class="empty-state-actions">
            <button type="button" class="btn btn-primary empty-state-cta" data-action="open-walkin">Add Walk-in</button>
            <a href="book.html" class="btn btn-ghost empty-state-cta">Open Public Booking</a>
          </div>
        `;
      listContainer.innerHTML = `
        <section class="empty-state empty-state-compact">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No appointments found</h3>
          <p>${escapeHtml(description)}</p>
          ${actionMarkup}
        </section>
      `;
      return;
    }

    listContainer.innerHTML = sorted.map((booking) => renderAppointmentCard(booking, now)).join("");
  }

  function getVisibleAppointments(bookings, now = new Date()) {
    const scoped = applyFilterAndSearch(bookings, now);
    return sortAppointments(scoped, now);
  }

  function syncAppointmentsExportButton(totalVisible) {
    if (!exportAppointmentsCsvBtn) return;
    exportAppointmentsCsvBtn.disabled = Number(totalVisible ?? 0) <= 0;
  }

  function renderActiveDayFilterChip() {
    if (!activeDayFilterEl) return;
    if (!selectedDateYmd) {
      activeDayFilterEl.classList.add("hidden");
      activeDayFilterEl.innerHTML = "";
      return;
    }

    const selectedDate = parseYmdLocal(selectedDateYmd);
    if (!(selectedDate instanceof Date) || !Number.isFinite(selectedDate.getTime())) {
      selectedDateYmd = null;
      activeDayFilterEl.classList.add("hidden");
      activeDayFilterEl.innerHTML = "";
      return;
    }

    activeDayFilterEl.classList.remove("hidden");
    activeDayFilterEl.innerHTML = `
      <span>Showing appointments for ${escapeHtml(formatDateFriendly(selectedDate))}</span>
      <button type="button" class="btn btn-ghost btn-compact" data-action="clear-day-filter">Clear</button>
    `;
  }

  function applyFilterAndSearch(bookings, now) {
    const scope = getActiveFilterScope();
    const query = String(searchEl?.value ?? "").trim().toLowerCase();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);

    return bookings
      .filter((booking) => {
        const bookingDay = toYmdLocal(booking.start);
        if (selectedDateYmd && bookingDay !== selectedDateYmd) return false;

        if (scope === "all") return true;
        if (scope === "cancelled") return booking.status === "cancelled";
        if (scope === "no_show") return booking.status === "no-show";
        if (scope === "today") {
          if (selectedDateYmd) return true;
          return booking.start >= todayStart && booking.start < tomorrowStart;
        }
        if (scope === "this_week") {
          if (!isScheduledStatus(booking.status)) return false;
          if (selectedDateYmd) return true;
          return booking.start >= todayStart && booking.start < weekEnd;
        }
        return true;
      })
      .filter((booking) => {
        if (!query) return true;
        const haystack = `${booking.clientName} ${booking.clientContact} ${booking.barberDisplayName} ${booking.ownerUsername}`.toLowerCase();
        return haystack.includes(query);
      });
  }

  function handleFilterControlClick(event) {
    const button = event.target.closest("button.segment-btn[data-filter-value]");
    if (!button) return;
    const nextScope = String(button.getAttribute("data-filter-value") ?? "").toLowerCase();
    if (!nextScope) return;
    setFilterScope(nextScope);
    renderAll();
  }

  function setFilterScope(scope) {
    const normalized = normalizeFilterScope(scope);
    if (filterEl) filterEl.value = normalized;
    syncFilterButtons();
  }

  function getActiveFilterScope() {
    return normalizeFilterScope(String(filterEl?.value ?? "today").toLowerCase());
  }

  function normalizeFilterScope(scope) {
    const allowed = new Set(["today", "this_week", "all", "cancelled", "no_show"]);
    return allowed.has(scope) ? scope : "today";
  }

  function syncFilterButtons() {
    const activeScope = getActiveFilterScope();
    const buttons = document.querySelectorAll("button.segment-btn[data-filter-value]");
    buttons.forEach((button) => {
      const buttonScope = normalizeFilterScope(String(button.getAttribute("data-filter-value") ?? ""));
      const isActive = buttonScope === activeScope;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function sortAppointments(bookings, now) {
    const nowTs = now.getTime();
    return [...bookings].sort((a, b) => {
      const aUpcoming = isScheduledStatus(a.status) && a.start.getTime() >= nowTs;
      const bUpcoming = isScheduledStatus(b.status) && b.start.getTime() >= nowTs;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;

      if (aUpcoming && bUpcoming) {
        return a.start.getTime() - b.start.getTime();
      }
      return b.start.getTime() - a.start.getTime();
    });
  }

  function renderAppointmentCard(booking, now) {
    const dateText = formatDateFriendly(booking.start);
    const startText = formatTimeLabel(booking.start);
    const endText = formatTimeLabel(booking.end);
    const statusBadge = getStatusBadgeClass(booking.status);
    const statusLabel = formatStatusLabel(booking.status);
    const walkinBadgeMarkup = booking.source === "walkin"
      ? '<span class="badge badge-source-walkin">Walk-in</span>'
      : "";
    const actionsMarkup = renderActions(booking, now);
    const barberMeta = currentRole === "owner"
      ? `<span class="small">${escapeHtml(`Barber: ${booking.barberDisplayName || booking.ownerUsername}`)}</span>`
      : "";
    const depositMeta = booking.depositRequired
      ? `Deposit: $${booking.depositAmount.toFixed(2)} (${formatDepositStatusLabel(booking.depositStatus)})`
      : "Deposit: Not required";
    const noShowCount = getClientNoShowCount(booking);
    const noShowMeta = `No-shows: ${noShowCount}`;

    return `
      <article class="appointment-row">
        <div class="appointment-main">${escapeHtml(booking.serviceName)}</div>
        <div class="appointment-datetime">
          <span>${escapeHtml(dateText)}</span>
          <span>${escapeHtml(`${startText} - ${endText}`)}</span>
          ${barberMeta}
          <span class="small">${escapeHtml(`Client: ${booking.clientName}`)}</span>
          <span class="small">${escapeHtml(`Contact: ${booking.clientContact || "N/A"}`)}</span>
          <span class="small">${escapeHtml(depositMeta)}</span>
          <span class="small">${escapeHtml(noShowMeta)}</span>
        </div>
        <div class="appointment-actions">
          <span class="badge ${escapeHtml(statusBadge)}">${escapeHtml(statusLabel)}</span>
          ${walkinBadgeMarkup}
          ${actionsMarkup}
        </div>
      </article>
    `;
  }

  function renderActions(booking, now) {
    if (!isScheduledStatus(booking.status)) return "";
    const isFuture = booking.start.getTime() >= now.getTime();
    const rescheduleBtn = `<button type="button" class="btn btn-ghost btn-compact" data-action="reschedule" data-booking-id="${escapeHtml(booking.id)}">Reschedule</button>`;
    const calendarBtn = `<button type="button" class="btn btn-ghost btn-compact" data-action="download-ics" data-booking-id="${escapeHtml(booking.id)}">Add to Calendar</button>`;
    const cancelBtn = `<button type="button" class="btn btn-danger btn-compact" data-action="cancel" data-booking-id="${escapeHtml(booking.id)}">Cancel</button>`;
    const completeBtn = `<button type="button" class="btn btn-primary btn-compact" data-action="complete" data-booking-id="${escapeHtml(booking.id)}">Mark Completed</button>`;
    const noShowBtn = `<button type="button" class="btn btn-ghost btn-compact" data-action="no-show" data-booking-id="${escapeHtml(booking.id)}">Mark No-show</button>`;
    if (isFuture) {
      const confirmBtn = booking.status === "booked"
        ? `<button type="button" class="btn btn-primary btn-compact" data-action="confirm" data-booking-id="${escapeHtml(booking.id)}">Confirm</button>`
        : "";
      return `${confirmBtn}${rescheduleBtn}${calendarBtn}${cancelBtn}`;
    }
    return `${calendarBtn}${completeBtn}${noShowBtn}`;
  }

  function getStatusBadgeClass(status) {
    if (status === "confirmed") return "badge-success";
    if (status === "completed") return "badge-success";
    if (status === "cancelled") return "badge-danger";
    if (status === "no-show") return "badge-danger";
    return "badge-warning";
  }

  function formatStatusLabel(status) {
    if (status === "confirmed") return "Confirmed";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "no-show") return "No-show";
    return "Booked";
  }

  function formatDepositStatusLabel(status) {
    if (status === "paid") return "Paid";
    if (status === "waived") return "Waived";
    if (status === "not_required") return "Not required";
    return "Unpaid";
  }

  function buildClientNoShowCountMap(bookings) {
    const map = new Map();
    if (!Array.isArray(bookings)) return map;

    bookings.forEach((booking) => {
      if (normalizeStatus(booking?.status) !== "no-show") return;
      const key = getClientNoShowKey(booking);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }

  function getClientNoShowCount(booking) {
    const key = getClientNoShowKey(booking);
    if (!key) return 0;
    return Number(clientNoShowCountByKey.get(key) ?? 0);
  }

  function getClientNoShowKey(booking) {
    const contact = String(booking?.clientContact ?? "").trim().toLowerCase();
    if (contact) return `contact:${contact}`;
    const name = String(booking?.clientName ?? "").trim().toLowerCase();
    if (name) return `name:${name}`;
    return "";
  }

  function handleExportAppointmentsCsv() {
    const visibleBookings = getVisibleAppointments(loadOwnerBookings(), new Date());
    if (!visibleBookings.length) {
      setInlineStatus("No appointments to export.", false);
      return;
    }

    const columns = [
      "id",
      "source",
      "status",
      "date",
      "startTime",
      "endTime",
      "serviceName",
      "price",
      "durationMinutes",
      "barberUsername",
      "clientName",
      "clientContact",
      "createdAt",
    ];
    const rows = visibleBookings.map((booking) => ({
      id: booking.id,
      source: booking.source,
      status: booking.status,
      date: formatCsvDate(booking.start),
      startTime: formatCsvTime(booking.start),
      endTime: formatCsvTime(booking.end),
      serviceName: booking.serviceName,
      price: formatMoneyValue(booking.price),
      durationMinutes: String(booking.durationMinutes ?? ""),
      barberUsername: booking.barberUsername || booking.ownerUsername,
      clientName: booking.clientName,
      clientContact: booking.clientContact || "",
      createdAt: booking.createdAt,
    }));

    downloadCsvFile({
      filename: buildCsvFilename("appointments"),
      columns,
      rows,
    });
    setInlineStatus(`Exported ${rows.length} appointment${rows.length === 1 ? "" : "s"} to CSV.`, true);
  }

  function handleActiveDayFilterClick(event) {
    const clearBtn = event.target.closest("button[data-action='clear-day-filter']");
    if (!clearBtn) return;
    selectedDateYmd = null;
    refreshVisibleCalendarDays();
    renderOwnerAppointments(loadOwnerBookings());
  }

  function handleListActionClick(event) {
    const clearFiltersBtn = event.target.closest("button[data-action='clear-filters']");
    if (clearFiltersBtn) {
      clearFilters();
      return;
    }

    const openWalkinBtn = event.target.closest("button[data-action='open-walkin']");
    if (openWalkinBtn) {
      openWalkinModal();
      return;
    }

    const button = event.target.closest("button[data-action][data-booking-id]");
    if (!button) return;

    const bookingId = String(button.getAttribute("data-booking-id") ?? "");
    const action = String(button.getAttribute("data-action") ?? "");
    if (!bookingId || !action) return;

    const booking = loadOwnerBookings().find((item) => item.id === bookingId);
    if (!booking) {
      setInlineStatus("Appointment not found.", false);
      return;
    }

    if (action === "cancel") {
      handleCancel(booking);
      return;
    }
    if (action === "confirm") {
      handleConfirm(booking);
      return;
    }
    if (action === "reschedule") {
      openRescheduleModal(booking);
      return;
    }
    if (action === "download-ics") {
      handleDownloadCalendar(booking);
      return;
    }
    if (action === "complete") {
      handleComplete(booking);
      return;
    }
    if (action === "no-show") {
      handleNoShow(booking);
    }
  }

  function clearFilters() {
    if (searchEl) searchEl.value = "";
    setFilterScope("today");
    if (currentRole === "owner" && ownerScopeEl) {
      scopeMode = "my";
      scopeOwnerUsername = ownerUsername;
      ownerScopeEl.value = "my";
      syncScopeOwnerControls();
    }
    setInlineStatus("Filters cleared.", true);
    renderAll();
  }

  function handleCancel(booking) {
    if (!isScheduledStatus(booking.status)) {
      setInlineStatus("Only booked or confirmed appointments can be cancelled.", false);
      return;
    }
    if (booking.start.getTime() < Date.now()) {
      setInlineStatus("Past appointments cannot be cancelled.", false);
      return;
    }
    if (!window.confirm("Cancel this appointment?")) return;
    const result = applyBookingStatusUpdate(booking.id, "cancelled");
    if (!result.ok) {
      setInlineStatus("Could not cancel this appointment.", false);
      return;
    }
    queueOwnerBookingNotification("cancel", result);
    setInlineStatus("Appointment cancelled.", true);
    renderAll();
  }

  function handleConfirm(booking) {
    if (booking.status !== "booked") {
      setInlineStatus("Only booked appointments can be confirmed.", false);
      return;
    }
    if (booking.start.getTime() < Date.now()) {
      setInlineStatus("Past appointments cannot be confirmed. Mark completed or no-show instead.", false);
      return;
    }
    const result = applyBookingStatusUpdate(booking.id, "confirmed");
    if (!result.ok) {
      setInlineStatus("Could not confirm this appointment.", false);
      return;
    }
    queueOwnerBookingNotification("booking", result);
    setInlineStatus("Appointment confirmed.", true);
    renderAll();
  }

  function handleComplete(booking) {
    if (!isScheduledStatus(booking.status)) {
      setInlineStatus("Only booked or confirmed appointments can be marked completed.", false);
      return;
    }
    if (booking.start.getTime() >= Date.now()) {
      setInlineStatus("You can mark completed only after the appointment start time.", false);
      return;
    }
    const result = applyBookingStatusUpdate(booking.id, "completed");
    if (!result.ok) {
      setInlineStatus("Could not mark this appointment completed.", false);
      return;
    }
    setInlineStatus("Marked completed.", true);
    renderAll();
  }

  function handleNoShow(booking) {
    if (!isScheduledStatus(booking.status)) {
      setInlineStatus("Only booked or confirmed appointments can be marked no-show.", false);
      return;
    }
    if (booking.start.getTime() >= Date.now()) {
      setInlineStatus("You can mark no-show only after the appointment start time.", false);
      return;
    }
    const result = applyBookingStatusUpdate(booking.id, "no-show");
    if (!result.ok) {
      setInlineStatus("Could not mark this appointment no-show.", false);
      return;
    }
    setInlineStatus("Marked no-show.", true);
    renderAll();
  }

  function openRescheduleModal(booking) {
    if (!rescheduleModalEl || !rescheduleDateEl || !rescheduleSlotEl) return;
    if (!isScheduledStatus(booking.status)) {
      setInlineStatus("Only booked or confirmed appointments can be rescheduled.", false);
      return;
    }

    rescheduleBookingId = String(booking.id ?? "");
    const start = booking.start instanceof Date ? booking.start : new Date(String(booking.startISO ?? ""));
    const end = booking.end instanceof Date ? booking.end : new Date(String(booking.endISO ?? ""));
    const summaryBits = [
      currentRole === "owner" ? `Barber: ${booking.barberDisplayName || booking.ownerUsername}` : "",
      String(booking.serviceName ?? "Service"),
      `${formatDateFriendly(start)} ${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      `Client: ${String(booking.clientName ?? "Unknown")}`,
    ].filter(Boolean);
    if (rescheduleSummaryEl) rescheduleSummaryEl.textContent = summaryBits.join(" | ");

    rescheduleDateEl.min = toYmdLocal(new Date());
    rescheduleDateEl.value = toYmdLocal(start);
    clearRescheduleStatus();
    populateRescheduleSlots();
    showRescheduleModal();

    window.setTimeout(() => {
      rescheduleDateEl.focus();
    }, 0);
  }

  function showRescheduleModal() {
    if (!rescheduleModalEl) return;
    rescheduleModalEl.classList.remove("hidden");
    rescheduleModalEl.classList.add("show");
    rescheduleModalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeRescheduleModal() {
    if (!rescheduleModalEl) return;
    rescheduleModalEl.classList.remove("show");
    rescheduleModalEl.classList.add("hidden");
    rescheduleModalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    rescheduleBookingId = "";
    clearRescheduleStatus();
  }

  function handleRescheduleDateChange() {
    clearRescheduleStatus();
    populateRescheduleSlots();
  }

  function populateRescheduleSlots() {
    if (!rescheduleSlotEl || !rescheduleDateEl) return;

    rescheduleSlotEl.innerHTML = '<option value="">Select a time...</option>';
    rescheduleSlotEl.value = "";
    rescheduleSlotEl.disabled = true;
    rescheduleEmptyEl?.classList.add("hidden");

    const booking = loadOwnerBookings().find((item) => item.id === rescheduleBookingId);
    if (!booking) {
      setRescheduleStatus("Could not load this appointment for rescheduling.", false);
      updateRescheduleConfirmState();
      return;
    }

    const dateYmd = String(rescheduleDateEl.value ?? "").trim();
    if (!dateYmd) {
      updateRescheduleConfirmState();
      return;
    }

    const slotOptions = buildRescheduleSlotOptions({
      ownerName: booking.ownerUsername,
      dateYmd,
      durationMinutes: booking.durationMinutes,
      ignoreBookingId: booking.id,
    });

    if (slotOptions.length === 0) {
      rescheduleEmptyEl?.classList.remove("hidden");
      updateRescheduleConfirmState();
      return;
    }

    slotOptions.forEach((slot) => {
      const option = document.createElement("option");
      option.value = slot.startISO;
      option.textContent = slot.label;
      rescheduleSlotEl.appendChild(option);
    });
    rescheduleSlotEl.disabled = false;
    updateRescheduleConfirmState();
  }

  function updateRescheduleConfirmState() {
    if (!rescheduleConfirmBtn || !rescheduleSlotEl) return;
    const hasSlot = Boolean(String(rescheduleSlotEl.value ?? "").trim());
    rescheduleConfirmBtn.disabled = !rescheduleBookingId || !hasSlot || rescheduleSlotEl.disabled;
  }

  function applyRescheduleByStartISO({
    bookingId,
    startISO,
    allowStatuses = ["booked", "confirmed"],
    invalidStatusMessage = "Only booked or confirmed appointments can be rescheduled.",
  }) {
    const targetBookingId = String(bookingId ?? "").trim();
    const requestedStartISO = String(startISO ?? "").trim();
    if (!targetBookingId) {
      return { ok: false, error: "No appointment selected." };
    }
    if (!requestedStartISO) {
      return { ok: false, error: "Please choose a time slot." };
    }

    const bookings = dataStore.getBookings();
    const index = bookings.findIndex((booking) => {
      const id = String(booking?.id ?? "");
      if (id !== targetBookingId) return false;
      return canManageRawBooking(booking);
    });
    if (index < 0) {
      return { ok: false, error: "Appointment not found. Please refresh." };
    }

    const current = bookings[index];
    const currentStatus = normalizeStatus(current?.status);
    if (!Array.isArray(allowStatuses) || !allowStatuses.includes(currentStatus)) {
      return { ok: false, error: invalidStatusMessage };
    }

    const requestedStart = new Date(requestedStartISO);
    if (!Number.isFinite(requestedStart.getTime())) {
      return { ok: false, error: "Invalid time slot selected." };
    }

    const durationMinutes = resolveDurationMinutes(current);
    const slotOptions = buildRescheduleSlotOptions({
      ownerName: current.ownerUsername,
      dateYmd: toYmdLocal(requestedStart),
      durationMinutes,
      ignoreBookingId: targetBookingId,
    });
    const selectedSlot = slotOptions.find((slot) => isSameInstant(slot.startISO, requestedStartISO));
    if (!selectedSlot) {
      return { ok: false, error: "That time is no longer available. Please choose another slot." };
    }

    const start = new Date(selectedSlot.startISO);
    if (!Number.isFinite(start.getTime())) {
      return { ok: false, error: "Invalid time slot selected." };
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    if (!Number.isFinite(end.getTime()) || start >= end) {
      return { ok: false, error: "Invalid appointment time range." };
    }

    const previousBooking = { ...current };
    bookings[index] = {
      ...current,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      startAtISO: start.toISOString(),
      date: toYmdLocal(start),
      time: minutesToHhmm(start.getHours() * 60 + start.getMinutes()),
      durationMinutes,
    };
    dataStore.saveBookings(bookings);

    return {
      ok: true,
      previousBooking,
      booking: bookings[index],
      bookingId: targetBookingId,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }

  function isSameInstant(leftIso, rightIso) {
    const left = new Date(String(leftIso ?? ""));
    const right = new Date(String(rightIso ?? ""));
    if (!Number.isFinite(left.getTime()) || !Number.isFinite(right.getTime())) return false;
    return left.getTime() === right.getTime();
  }

  function handleRescheduleConfirm() {
    clearRescheduleStatus();
    if (!rescheduleBookingId) {
      setRescheduleStatus("No appointment selected.", false);
      return;
    }

    const dateYmd = String(rescheduleDateEl?.value ?? "").trim();
    const startISO = String(rescheduleSlotEl?.value ?? "").trim();
    if (!dateYmd) {
      setRescheduleStatus("Please choose a date.", false);
      return;
    }
    if (!startISO) {
      setRescheduleStatus("Please choose a time slot.", false);
      return;
    }

    const result = applyRescheduleByStartISO({
      bookingId: rescheduleBookingId,
      startISO,
      allowStatuses: ["booked", "confirmed"],
      invalidStatusMessage: "Only booked or confirmed appointments can be rescheduled.",
    });
    if (!result.ok) {
      setRescheduleStatus(result.error, false);
      if (String(result.error ?? "").includes("no longer available")) {
        populateRescheduleSlots();
      }
      return;
    }

    queueOwnerBookingNotification("reschedule", result);
    closeRescheduleModal();
    setInlineStatus("Appointment rescheduled.", true);
    renderAll();
  }

  function setRescheduleStatus(message, success) {
    if (!rescheduleStatusEl) return;
    const text = String(message ?? "");
    rescheduleStatusEl.textContent = text;
    rescheduleStatusEl.setAttribute("role", success ? "status" : "alert");
    rescheduleStatusEl.setAttribute("aria-live", success ? "polite" : "assertive");
    rescheduleStatusEl.setAttribute("aria-atomic", "true");
    rescheduleStatusEl.classList.remove("status-success", "status-error");
    rescheduleStatusEl.classList.add(success ? "status-success" : "status-error");
  }

  function clearRescheduleStatus() {
    if (!rescheduleStatusEl) return;
    rescheduleStatusEl.textContent = "";
    rescheduleStatusEl.setAttribute("role", "status");
    rescheduleStatusEl.setAttribute("aria-live", "polite");
    rescheduleStatusEl.setAttribute("aria-atomic", "true");
    rescheduleStatusEl.classList.remove("status-success", "status-error");
  }

  function buildRescheduleSlotOptions({ ownerName, dateYmd, durationMinutes, ignoreBookingId, includePastSlots = false }) {
    const date = parseYmdLocal(dateYmd);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return [];
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];

    const availability = getAvailability(ownerName);
    if (!availability) return [];
    const dayKey = DAY_KEYS[date.getDay()];
    const day = availability.weekly[dayKey];
    if (!day || day.enabled !== true) return [];

    const dayStartMin = hhmmToMinutes(day.start);
    const dayEndMin = hhmmToMinutes(day.end);
    if (!Number.isFinite(dayStartMin) || !Number.isFinite(dayEndMin) || dayStartMin >= dayEndMin) return [];

    const bookedWindows = getOwnerBookedWindows(ownerName, availability.bufferMinutes, ignoreBookingId);
    const timeOffWindows = getTimeOffWindows(availability.timeOff);
    const nowTs = Date.now();
    const options = [];

    for (let startMin = dayStartMin; startMin + durationMinutes <= dayEndMin; startMin += SLOT_INCREMENT_MINUTES) {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, startMin, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      if (!includePastSlots && start.getTime() < nowTs) continue;
      if (overlapsAnyWindow(start, end, bookedWindows)) continue;
      if (overlapsAnyWindow(start, end, timeOffWindows)) continue;

      options.push({
        startISO: start.toISOString(),
        label: `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      });
    }

    return options;
  }

  function getAvailability(ownerName) {
    const owner = String(ownerName ?? "").trim();
    if (!owner) return null;

    const defaults = {
      timezone: "America/Chicago",
      bufferMinutes: 0,
      weekly: {
        mon: { enabled: true, start: "09:00", end: "17:00" },
        tue: { enabled: true, start: "09:00", end: "17:00" },
        wed: { enabled: true, start: "09:00", end: "17:00" },
        thu: { enabled: true, start: "09:00", end: "17:00" },
        fri: { enabled: true, start: "09:00", end: "17:00" },
        sat: { enabled: true, start: "09:00", end: "17:00" },
        sun: { enabled: false, start: "09:00", end: "17:00" },
      },
      timeOff: [],
    };

    const parsed = dataStore.getAvailabilityForBarber(owner) || {};

    const weekly = {};
    Object.keys(defaults.weekly).forEach((key) => {
      const source = parsed?.weekly?.[key] || {};
      weekly[key] = {
        enabled: Boolean(source.enabled ?? defaults.weekly[key].enabled),
        start: normalizeTime(String(source.start ?? defaults.weekly[key].start)),
        end: normalizeTime(String(source.end ?? defaults.weekly[key].end)),
      };
    });

    const bufferRaw = Number(parsed?.bufferMinutes ?? defaults.bufferMinutes);
    const bufferMinutes = [0, 5, 10, 15].includes(bufferRaw) ? bufferRaw : 0;
    const timeOff = Array.isArray(parsed?.timeOff)
      ? parsed.timeOff.map((block) => ({
        id: String(block?.id ?? ""),
        startISO: String(block?.startISO ?? ""),
        endISO: String(block?.endISO ?? ""),
        note: String(block?.note ?? ""),
      }))
      : [];

    return {
      timezone: String(parsed?.timezone ?? defaults.timezone),
      bufferMinutes,
      weekly,
      timeOff,
    };
  }

  function getOwnerBookedWindows(ownerName, bufferMinutes, ignoreBookingId) {
    return dataStore.getBookings()
      .filter((booking) => String(booking?.ownerUsername ?? "") === ownerName)
      .filter((booking) => isScheduledStatus(booking?.status))
      .filter((booking) => String(booking?.id ?? "") !== String(ignoreBookingId ?? ""))
      .map((booking) => getBookingWindow(booking))
      .filter(Boolean)
      .map((window) => ({
        start: window.start,
        end: new Date(window.end.getTime() + bufferMinutes * 60 * 1000),
      }));
  }

  function getTimeOffWindows(timeOff) {
    if (!Array.isArray(timeOff)) return [];
    return timeOff
      .map((block) => {
        const start = new Date(String(block?.startISO ?? ""));
        const end = new Date(String(block?.endISO ?? ""));
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return null;
        return { start, end };
      })
      .filter(Boolean);
  }

  function getBookingWindow(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    const endIso = String(booking?.endISO ?? "").trim();
    let start = null;
    let end = null;

    if (startIso && endIso) {
      start = new Date(startIso);
      end = new Date(endIso);
    } else {
      const date = String(booking?.date ?? "").trim();
      const time = normalizeTime(String(booking?.time ?? "").trim());
      const duration = resolveDurationMinutes(booking);
      const parsedStart = parseLocalDateTime(date, time);
      if (parsedStart && Number.isFinite(duration) && duration > 0) {
        start = parsedStart;
        end = new Date(parsedStart.getTime() + duration * 60 * 1000);
      }
    }

    if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return null;
    }
    return { start, end };
  }

  function overlapsAnyWindow(start, end, windows) {
    return windows.some((window) => start < window.end && end > window.start);
  }

  function handleDownloadCalendar(booking) {
    const errorMessage = downloadIcs(booking);
    if (errorMessage) {
      setInlineStatus(errorMessage, false);
      return;
    }
    setInlineStatus("Calendar file downloaded.", true);
  }

  function formatIcsUtc(dt) {
    const date = dt instanceof Date ? dt : new Date(dt);
    if (!Number.isFinite(date.getTime())) return "";
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
  }

  function escapeIcsText(s) {
    return String(s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function generateIcsForBooking(booking) {
    const startIso = String(booking?.startISO ?? "").trim();
    const endIso = String(booking?.endISO ?? "").trim();
    const nowStamp = formatIcsUtc(new Date());
    const startStamp = formatIcsUtc(startIso);
    const endStamp = formatIcsUtc(endIso);
    const status = String(booking?.status ?? "booked").toLowerCase();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Slotzy//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${String(booking?.id ?? "")}@slotzy.local`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${startStamp}`,
      `DTEND:${endStamp}`,
      `SUMMARY:${escapeIcsText(`Slotzy - ${String(booking?.serviceName ?? "Service")}`)}`,
      `DESCRIPTION:${escapeIcsText(
        `Client: ${String(booking?.clientName ?? "Unknown")} (${String(booking?.clientContact ?? "N/A")})\n` +
        `Barber: ${String(booking?.ownerUsername ?? "")}\n` +
        `Status: ${status}`
      )}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return `${lines.join("\r\n")}\r\n`;
  }

  function downloadIcs(booking) {
    if (!booking || typeof booking !== "object") return "Appointment details are missing.";
    if (!isScheduledStatus(booking.status)) {
      return "Only booked or confirmed appointments can be added to calendar.";
    }

    const start = booking.start instanceof Date ? booking.start : new Date(String(booking.startISO ?? ""));
    const end = booking.end instanceof Date ? booking.end : new Date(String(booking.endISO ?? ""));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return "Appointment date/time is missing or invalid.";
    }
    if (start >= end) return "Appointment time range is invalid.";

    const bookingForIcs = {
      ...booking,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };

    const icsText = generateIcsForBooking(bookingForIcs);
    if (!icsText.includes("DTSTART:") || !icsText.includes("DTEND:")) {
      return "Could not generate calendar content for this appointment.";
    }

    const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const yyyy = String(start.getFullYear());
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");
    const datePart = `${yyyy}-${mm}-${dd}`;
    const serviceSlug = String(booking.serviceName ?? "appointment")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "appointment";
    const filename = `slotzy-${datePart}-${serviceSlug}.ics`;

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.className = "ui-offscreen-control";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return null;
  }

  function canManageRawBooking(booking) {
    const owner = String(booking?.ownerUsername ?? "").trim();
    if (!owner) return false;

    if (currentRole !== "owner") {
      return owner === ownerUsername;
    }

    if (!currentShopId) return true;
    const bookingShopId = String(booking?.shopId ?? "").trim();
    if (!bookingShopId) {
      return owner === ownerUsername;
    }
    return bookingShopId === currentShopId;
  }

  function updateBookingStatus(bookingId, nextStatus) {
    let didUpdate = false;
    const updated = dataStore.getBookings().map((booking) => {
      const id = String(booking?.id ?? "");
      if (id !== bookingId) return booking;
      if (!canManageRawBooking(booking)) return booking;
      didUpdate = true;
      return { ...booking, status: nextStatus };
    });
    if (didUpdate) dataStore.saveBookings(updated);
  }

  function applyBookingStatusUpdate(bookingId, nextStatus) {
    const targetId = String(bookingId ?? "").trim();
    if (!targetId) return { ok: false, previousBooking: null, booking: null };

    let previousBooking = null;
    let nextBooking = null;
    let didUpdate = false;
    const updated = dataStore.getBookings().map((booking) => {
      const id = String(booking?.id ?? "");
      if (id !== targetId) return booking;
      if (!canManageRawBooking(booking)) return booking;
      previousBooking = { ...booking };
      nextBooking = { ...booking, status: nextStatus };
      didUpdate = true;
      return nextBooking;
    });

    if (didUpdate) {
      dataStore.saveBookings(updated);
    }

    return {
      ok: didUpdate,
      previousBooking,
      booking: nextBooking,
    };
  }

  function buildOwnerNotificationPayload({ booking, previousBooking = null } = {}) {
    if (!booking || typeof booking !== "object") return null;
    const shop = dataStore.getShopById(String(booking?.shopId ?? "").trim()) || dataStore.getShopForUser(ownerUsername) || null;
    return buildBookingNotificationPayload({
      booking,
      previousBooking,
      shop,
      users: dataStore.getUsers(),
      profiles: dataStore.getProfiles(),
      manageLink: window.location.href,
      source: "owner-manage-appointments",
    });
  }

  function queueOwnerBookingNotification(kind, { booking, previousBooking = null } = {}) {
    const payload = buildOwnerNotificationPayload({ booking, previousBooking });
    if (!payload) return;

    void postBookingNotification(kind, payload).then((notifyResult) => {
      if (notifyResult?.ok) return;
      const suffix = notifyResult?.offline
        ? " Email not sent (server offline)."
        : ` ${String(notifyResult?.error ?? "").trim() || "Email not sent right now."}`;
      setInlineStatus(`${statusMessageEl?.textContent || "Appointment updated."}${suffix}`.trim(), false);
    });
  }

  function setInlineStatus(message, success) {
    if (!statusMessageEl) return;
    statusMessageEl.textContent = String(message ?? "");
    statusMessageEl.setAttribute("role", success ? "status" : "alert");
    statusMessageEl.setAttribute("aria-live", success ? "polite" : "assertive");
    statusMessageEl.setAttribute("aria-atomic", "true");
    statusMessageEl.classList.remove("status-success", "status-error");
    statusMessageEl.classList.add(success ? "status-success" : "status-error");
  }

  function formatMoneyValue(value) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return "";
    return amount.toFixed(2);
  }

  function formatDateFriendly(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatTimeLabel(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function toYmdLocal(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseYmdLocal(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [yyyy, mm, dd] = raw.split("-").map(Number);
    const parsed = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
    if (
      parsed.getFullYear() !== yyyy ||
      parsed.getMonth() !== mm - 1 ||
      parsed.getDate() !== dd
    ) {
      return null;
    }
    return parsed;
  }

  function isYmdInMonth(ymd, monthStart) {
    const date = parseYmdLocal(ymd);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return false;
    if (!(monthStart instanceof Date) || !Number.isFinite(monthStart.getTime())) return true;
    return date.getFullYear() === monthStart.getFullYear() && date.getMonth() === monthStart.getMonth();
  }

  function parseLocalDateTime(dateYmd, timeHhmm) {
    const date = parseYmdLocal(dateYmd);
    const minuteOfDay = hhmmToMinutes(timeHhmm);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !Number.isFinite(minuteOfDay)) {
      return null;
    }
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  }

  function hhmmToMinutes(value) {
    const normalized = normalizeTime(String(value ?? ""));
    if (!/^\d{2}:\d{2}$/.test(normalized)) return NaN;
    const [hh, mm] = normalized.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
    return hh * 60 + mm;
  }

  function minutesToHhmm(totalMinutes) {
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function normalizeTime(value) {
    const raw = String(value ?? "").trim();
    return /^\d{2}:\d{2}$/.test(raw) ? raw : normalizeTimeTo24(raw);
  }

  function normalizeTimeTo24(timeValue) {
    const raw = String(timeValue || "").trim();
    if (!raw) return "";
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;

    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "";
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function createBookingId() {
    return `bk_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
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
