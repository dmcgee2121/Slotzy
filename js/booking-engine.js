import { wireLogoutButton } from "./logout.js";
import * as dataStore from "./dataStore.js";
import { buildBookingNotificationPayload, postBookingNotification } from "./booking-notifications.js";

export function initBookingEngine(options = {}) {
  const requestedMode = String(
    options?.mode ?? (options?.isPublic ? "public" : "customer")
  ).trim().toLowerCase();
  const mode = requestedMode === "public" ? "public" : "customer";
  const CLIENT_SESSION_KEY = "Slotzy_clientSession";
  const LAST_BOOKING_KEY = "Slotzy_lastBookingId";
  const LAST_MANAGE_LINK_KEY = "Slotzy_lastManageLink";
  const SLOT_INCREMENT_MINUTES = 15;
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const BOOKING_SYNC_EVENT = "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  const AVAILABILITY_STORAGE_KEY = dataStore.KEYS?.AVAILABILITY || "Slotzy_availability";
  const DEFAULT_PUBLIC_SHOP_LOGO_URL = new URL("../assets/images/slotzy-logo.png", import.meta.url).href;
  const rootEl = options?.rootEl instanceof HTMLElement
    ? options.rootEl
    : document.querySelector("main.owner-layout") || document.body;
  const dashboardMain = rootEl?.matches?.("main.owner-layout")
    ? rootEl
    : rootEl?.querySelector?.("main.owner-layout") || document.querySelector("main.owner-layout");
  const bookingPanel = findElementById("bookingPanel");
  const shopSelect = findElementById("shopSelect");
  const barberSelect = findElementById("barberSelect");
  const barberField = findElementById("barberField");
  const serviceSelect = findElementById("serviceSelect");
  const bookingPolicyCard = findElementById("bookingPolicyCard");
  const bookingPolicySameDay = findElementById("bookingPolicySameDay");
  const bookingPolicyAdvance = findElementById("bookingPolicyAdvance");
  const bookingPolicyCancel = findElementById("bookingPolicyCancel");
  const bookingDate = findElementById("bookingDate");
  const slotList = findElementById("slotList");
  const clientNameInput = findElementById("clientName");
  const clientContactInput = findElementById("clientContact");
  const depositNotice = findElementById("depositNotice");
  const depositNoticeText = findElementById("depositNoticeText");
  const depositAckWrap = findElementById("depositAckWrap");
  const depositAcknowledge = findElementById("depositAcknowledge");
  const bookBtn = findElementById("bookBtn");
  const policyHint = findElementById("policyHint");
  const bookingStatus = findElementById("bookingStatus");
  const nextAppointmentDetails = findElementById("nextAppointmentDetails");
  const nextAppointmentService = findElementById("nextAppointmentService");
  const nextAppointmentDate = findElementById("nextAppointmentDate");
  const nextAppointmentTime = findElementById("nextAppointmentTime");
  const nextAppointmentStatus = findElementById("nextAppointmentStatus");
  const nextAppointmentEmptyState = findElementById("nextAppointmentEmptyState");
  const upcomingList = findElementById("upcomingList");
  const upcomingEmptyState = findElementById("upcomingEmptyState");
  const pastList = findElementById("pastList");
  const pastEmptyState = findElementById("pastEmptyState");
  const publicShopPickerSection = findElementById("publicShopPickerSection");
  const publicShopSearchInput = findElementById("publicShopSearch");
  const publicShopPickerList = findElementById("publicShopPickerList");
  const publicShopPickerStatus = findElementById("publicShopPickerStatus");
  const publicShopHero = findElementById("publicShopHero");
  const publicShopName = findElementById("publicShopName");
  const publicShopBranding = findElementById("publicShopBranding");
  const publicShopPhone = findElementById("publicShopPhone");
  const publicShopAddress = findElementById("publicShopAddress");
  const publicShopError = findElementById("publicShopError");
  const publicShopLogo = findElementById("publicShopLogo");
  const shopSelectLabel = findElement('label[for="shopSelect"]');
  const changeBarberHelp = findElementById("changeBarberHelp");
  const changeBarberLink = findElementById("changeBarberLink");
  const showToast = window.showToast;
  const isPublicBookingPage = mode === "public" || /\/(?:book|book-shop)\.html$/i.test(window.location.pathname);
  const defaultRequestedShopSlug = normalizeSlug(new URLSearchParams(window.location.search).get("shop"));
  const defaultRequestedShopId = String(options?.shopId ?? "").trim();
  const hasBookingUi = Boolean(
    bookingPanel
    || shopSelect
    || barberSelect
    || serviceSelect
    || bookingDate
    || bookBtn
  );
  const engineRoot = rootEl || bookingPanel || document.body;

  let bookingContext = {};
  let requestedShopSlug = defaultRequestedShopSlug;
  let currentUser = null;
  let currentUsername = "";
  let isLoggedInCustomer = false;
  let initialClientSession = null;
  let activeClientIdentity = null;
  let receiptSection = null;

  let selectedSlotValue = "";
  let selectedShopId = "";
  let selectedBarberUsername = "";
  let publicShopSlugError = "";
  let bookingSyncBound = false;

  if (!hasBookingUi) return Promise.resolve(null);
  if (engineRoot?.dataset.bookingEngineInitialized === "1") return Promise.resolve(null);
  if (engineRoot) {
    engineRoot.dataset.bookingEngineInitialized = "1";
    engineRoot.dataset.bookingEngineMode = mode;
  }

  return Promise.resolve()
    .then(() => (
      typeof options?.getContext === "function"
        ? options.getContext()
        : {}
    ))
    .then((context) => {
      bookingContext = normalizeBookingContext(context);
      requestedShopSlug = resolveRequestedShopSlug();
      currentUser = resolveCurrentUser();
      currentUsername = String(currentUser?.username ?? "").trim();
      isLoggedInCustomer = String(currentUser?.role ?? "").toLowerCase() === "customer" && Boolean(currentUsername);
      initialClientSession = getClientSession();
      activeClientIdentity = getActiveClientIdentity();
      wireLogoutButton({ redirectPath: "../index.html" });
      init();
      return {
        mode,
        rootEl: engineRoot,
      };
    })
    .catch((error) => {
      console.error("[Slotzy:booking-engine] Failed to initialize.", error);
      bookingContext = normalizeBookingContext({});
      requestedShopSlug = defaultRequestedShopSlug;
      currentUser = resolveCurrentUser();
      currentUsername = String(currentUser?.username ?? "").trim();
      isLoggedInCustomer = String(currentUser?.role ?? "").toLowerCase() === "customer" && Boolean(currentUsername);
      initialClientSession = getClientSession();
      activeClientIdentity = getActiveClientIdentity();
      wireLogoutButton({ redirectPath: "../index.html" });
      disableBookingFlow("Booking is temporarily unavailable. Please refresh and try again.");
      return null;
    });

  function init() {
    if (clientNameInput && !clientNameInput.value) {
      clientNameInput.value = String(initialClientSession?.clientName ?? currentUsername ?? "").trim();
    }
    if (clientContactInput && !clientContactInput.value) {
      clientContactInput.value = String(initialClientSession?.clientContact ?? "").trim();
    }
    populateShops();
    if (publicShopSlugError) {
      disableBookingFlow(publicShopSlugError);
      return;
    }
    populateBarbers();
    populateServices();
    initializeDate();
    renderBookingPolicyCard();
    updatePolicyHint();
    renderDepositPolicyNotice();
    renderSlots();
    renderClientAppointments();
    renderLastBookingPrompt();
    changeBarberLink?.addEventListener("click", handleChangeBarberClick);
    publicShopSearchInput?.addEventListener("input", () => {
      renderPublicShopPicker(getShops());
    });
    publicShopPickerList?.addEventListener("click", handlePublicShopPickerClick);

    shopSelect?.addEventListener("change", () => {
      selectedShopId = String(shopSelect.value ?? "").trim();
      if (isPublicBookingPage && selectedShopId) {
        const shop = getShops().find((item) => item.id === selectedShopId) || null;
        if (shop?.slug) {
          requestedShopSlug = shop.slug;
          replacePublicShopUrl(shop.slug);
          populateShops();
        }
      }
      handleSelectedShopChange();
    });
    barberSelect?.addEventListener("change", () => {
      clearStatus();
      selectedBarberUsername = String(barberSelect.value ?? "").trim();
      populateServices();
      renderBookingPolicyCard();
      updatePolicyHint();
      renderDepositPolicyNotice();
      updateChangeBarberHelp();
      renderSlots();
    });
    serviceSelect?.addEventListener("change", () => {
      clearStatus();
      renderDepositPolicyNotice();
      updateChangeBarberHelp();
      renderSlots();
    });
    bookingDate?.addEventListener("change", () => {
      clearStatus();
      updateChangeBarberHelp();
      syncBookingDateInputState({
        announceInvalid: Boolean(String(bookingDate?.value ?? "").trim()),
      });
      renderSlots();
    });
    depositAcknowledge?.addEventListener("change", () => {
      clearStatus();
      updateBookButtonState();
    });
    bookBtn?.addEventListener("click", handleBook);
    bindBookingSyncListeners();
    updateChangeBarberHelp();
    updateBookButtonState();
  }

  function findElement(selector) {
    if (rootEl?.matches?.(selector)) return rootEl;
    if (rootEl?.querySelector) {
      const scoped = rootEl.querySelector(selector);
      if (scoped) return scoped;
    }
    return document.querySelector(selector);
  }

  function findElementById(id) {
    if (rootEl?.id === id) return rootEl;
    if (rootEl?.querySelector) {
      const scoped = rootEl.querySelector(`#${id}`);
      if (scoped) return scoped;
    }
    return document.getElementById(id);
  }

  function normalizeBookingContext(context) {
    return context && typeof context === "object" ? context : {};
  }

  function resolveRequestedShopSlug() {
    return normalizeSlug(bookingContext?.requestedShopSlug ?? defaultRequestedShopSlug);
  }

  function resolveRequestedShopId() {
    return String(bookingContext?.requestedShopId ?? defaultRequestedShopId).trim();
  }

  function resolveCurrentUser() {
    const contextUser = bookingContext?.sessionUser;
    if (contextUser && typeof contextUser === "object") return contextUser;
    return dataStore.getSessionUser();
  }

  function getUsersSource() {
    return Array.isArray(bookingContext?.users)
      ? bookingContext.users
      : dataStore.getUsers();
  }

  function getProfilesSource() {
    return dataStore.getProfiles();
  }

  function getShopsSource() {
    return Array.isArray(bookingContext?.shops)
      ? bookingContext.shops
      : dataStore.getShops();
  }

  function getShopByIdSource(shopId) {
    if (typeof bookingContext?.getShopById === "function") {
      return bookingContext.getShopById(shopId);
    }
    const targetId = String(shopId ?? "").trim();
    if (!targetId) return null;
    return getShopsSource().find((shop) => String(shop?.id ?? "").trim() === targetId)
      || dataStore.getShopById(targetId);
  }

  function getLegacyShopSource() {
    if (typeof bookingContext?.getLegacyShop === "function") {
      return bookingContext.getLegacyShop();
    }
    if (bookingContext?.legacyShop && typeof bookingContext.legacyShop === "object") {
      return bookingContext.legacyShop;
    }
    return dataStore.getShop();
  }

  function getBarbersForShopSource(shopId, options = { includeOwners: true }) {
    if (typeof bookingContext?.getBarbersForShop === "function") {
      const rows = bookingContext.getBarbersForShop(shopId, options);
      return Array.isArray(rows) ? rows : [];
    }
    const targetId = String(shopId ?? "").trim();
    const byShop = bookingContext?.barbersByShop;
    if (targetId && byShop && typeof byShop === "object" && Array.isArray(byShop[targetId])) {
      return byShop[targetId];
    }
    return dataStore.getBarbersForShop(targetId, options);
  }

  function getServicesSource() {
    return Array.isArray(bookingContext?.services)
      ? bookingContext.services
      : dataStore.getServices();
  }

  function getBookingsSource() {
    if (typeof bookingContext?.getBookings === "function") {
      const rows = bookingContext.getBookings();
      return Array.isArray(rows) ? rows : [];
    }
    return Array.isArray(bookingContext?.bookings)
      ? bookingContext.bookings
      : dataStore.getBookings();
  }

  function saveBookingsSource(bookings) {
    if (typeof bookingContext?.saveBookings === "function") {
      bookingContext.saveBookings(bookings);
      if (Array.isArray(bookingContext.bookings)) {
        bookingContext.bookings = bookings;
      }
      return;
    }
    if (Array.isArray(bookingContext?.bookings)) {
      bookingContext.bookings = bookings;
    }
    dataStore.saveBookings(bookings);
  }

  function getAvailabilityForBarberSource(username) {
    if (typeof bookingContext?.getAvailabilityForBarber === "function") {
      return bookingContext.getAvailabilityForBarber(username);
    }
    const key = String(username ?? "").trim();
    const byBarber = bookingContext?.availabilityByBarber;
    if (key && byBarber && typeof byBarber === "object") {
      return byBarber[key] || null;
    }
    return dataStore.getAvailabilityForBarber(key);
  }

  function getLastBookingId() {
    return String(sessionStorage.getItem(LAST_BOOKING_KEY) ?? "").trim();
  }

  function setLastBookingId(id) {
    sessionStorage.setItem(LAST_BOOKING_KEY, String(id ?? "").trim());
  }

  function getBookingById(id) {
    const targetId = String(id ?? "").trim();
    if (!targetId) return null;
    return getBookings().find((booking) => String(booking?.id ?? "") === targetId) || null;
  }

  function renderLastBookingPrompt() {
    const existingRow = findElementById("last-booking-prompt");
    existingRow?.remove();
    if (!bookingStatus) return;
    if (!activeClientIdentity) return;

    const lastBooking = getBookingById(getLastBookingId());
    if (!lastBooking) return;
    if (!isBookingForActiveClient(lastBooking)) return;

    const row = document.createElement("div");
    row.id = "last-booking-prompt";
    row.className = "home-login-row";
    row.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btn-view-last-booking">
        View last booking confirmation
      </button>
    `;
    bookingStatus.insertAdjacentElement("afterend", row);
    row.querySelector("#btn-view-last-booking")?.addEventListener("click", () => {
      renderBookingReceipt(lastBooking);
    });
  }

  function ensureReceiptSection() {
    if (!dashboardMain) return null;
    if (receiptSection && dashboardMain.contains(receiptSection)) return receiptSection;

    const section = document.createElement("section");
    section.id = "booking-receipt-section";
    section.className = "card owner-panel booking-receipt hidden";
    dashboardMain.appendChild(section);
    receiptSection = section;
    return section;
  }

  function toggleReceiptMode(showReceipt) {
    if (!dashboardMain) return;
    const section = ensureReceiptSection();
    if (!section) return;

    Array.from(dashboardMain.children).forEach((child) => {
      if (child === section) return;
      child.classList.toggle("hidden", showReceipt);
    });
    section.classList.toggle("hidden", !showReceipt);
  }

  function renderBookingReceipt(booking) {
    const section = ensureReceiptSection();
    if (!section) return;

    const start = getBookingStartDate(booking);
    const end = getBookingEndDate(booking);
    const durationMinutes = Number(booking?.durationMinutes ?? 0);
    const price = Number(booking?.price ?? 0);
    const shopLabel = getBookingShopLabel(booking) || "N/A";
    const barberLabel = getBookingBarberLabel(booking) || "N/A";
    const clientLabel = String(booking?.clientName ?? "").trim() || "N/A";
    const clientContactLabel = String(booking?.clientContact ?? "").trim() || "No contact provided";
    const confirmationId = getConfirmationCode(String(booking?.id ?? ""));
    const depositDetails = getBookingDepositDetails(booking);
    const status = normalizeAppointmentStatus(booking?.status);
    const receiptState = getReceiptPresentation(status);
    const cancellation = getBookingCancellationState(booking);
    const canShowManageActions = isScheduledStatus(status);
    const cancellationHint = getManageCancellationHint(booking, cancellation);
    const reminderLine = getBookingReminderLine(booking);
    const summaryText = buildBookingConfirmationSummary(booking, confirmationId);
    const manageLinkUrl = isPublicBookingPage ? buildClientManageLink(booking, confirmationId) : "";
    if (manageLinkUrl) {
      setLastManageLink(manageLinkUrl);
    }
    section.dataset.bookingId = String(booking?.id ?? "").trim();

    section.innerHTML = `
      <div class="booking-receipt-shell booking-receipt-shell-${escapeHtml(receiptState.tone)}">
        <div class="booking-receipt-hero">
          <span class="booking-receipt-hero-icon" aria-hidden="true">${receiptState.icon}</span>
          <div class="booking-receipt-hero-copy">
            <p class="booking-receipt-kicker">${escapeHtml(receiptState.kicker)}</p>
            <h1 id="bookingReceiptTitle">${escapeHtml(receiptState.title)}</h1>
            <p class="lead">${escapeHtml(receiptState.message)}</p>
          </div>
        </div>

        <section class="booking-receipt-card" aria-label="Appointment details">
          <div class="booking-receipt-card-head">
            <div>
              <p id="bookingReceiptShop" class="booking-receipt-shop">${escapeHtml(shopLabel)}</p>
              <p id="bookingReceiptBarber" class="booking-receipt-barber">Barber: ${escapeHtml(barberLabel)}</p>
            </div>
            <span class="booking-receipt-status booking-receipt-status-${escapeHtml(receiptState.tone)}">${escapeHtml(getAppointmentStatusLabel(status))}</span>
          </div>

          <div class="booking-receipt-grid">
            <article class="booking-receipt-detail">
              <span class="booking-receipt-detail-label">Service</span>
              <strong>${escapeHtml(String(booking?.serviceName ?? "Service"))}</strong>
              <span>${escapeHtml(`${formatDurationLabel(durationMinutes)} | ${formatCurrency(price)}`)}</span>
            </article>
            <article class="booking-receipt-detail">
              <span class="booking-receipt-detail-label">Date & Time</span>
              <strong>${escapeHtml(start ? formatDateFriendly(start) : "Date unavailable")}</strong>
              <span>${escapeHtml(formatReceiptTimeRange(start, end))}</span>
            </article>
            <article class="booking-receipt-detail">
              <span class="booking-receipt-detail-label">Client</span>
              <strong>${escapeHtml(clientLabel)}</strong>
              <span>${escapeHtml(clientContactLabel)}</span>
            </article>
            <article class="booking-receipt-detail">
              <span class="booking-receipt-detail-label">Confirmation Code</span>
              <strong id="bookingReceiptConfirmationCode" class="booking-receipt-confirmation-code">${escapeHtml(confirmationId)}</strong>
              <span>Save this code for quick reference.</span>
            </article>
          </div>
        </section>

        ${depositDetails.required
          ? `
            <section id="bookingReceiptDepositNotice" class="booking-receipt-deposit" aria-label="Deposit details">
              <strong>Deposit required</strong>
              <span>${escapeHtml(getReceiptDepositMessage(depositDetails))}</span>
            </section>
          `
          : ""}

        ${reminderLine
          ? `
            <section class="booking-receipt-deposit" aria-label="Reminder schedule">
              <strong>Reminders</strong>
              <span>${escapeHtml(reminderLine)}</span>
            </section>
          `
          : ""}

        ${manageLinkUrl
          ? `
            <section class="booking-receipt-manage-link-panel" aria-label="Manage your appointment">
              <h2>Manage your appointment</h2>
              <p class="small muted">Use this manage link to view upcoming appointments and cancel or reschedule within the allowed window.</p>
              <div class="booking-receipt-manage-link-row">
                <a id="bookingReceiptManageLink" class="booking-receipt-manage-link" href="${escapeHtml(manageLinkUrl)}">${escapeHtml(manageLinkUrl)}</a>
                <button type="button" class="btn btn-ghost" id="btn-receipt-copy-manage-link">Copy Link</button>
              </div>
            </section>
          `
          : ""}

        <section class="booking-receipt-manage">
          <h2>Manage Appointment</h2>
          <p class="small muted">${escapeHtml(cancellationHint)}</p>
          <p id="booking-receipt-email-note" class="small booking-status" role="status" aria-live="polite" aria-atomic="true"></p>
          <p id="booking-receipt-error" class="small booking-status" aria-live="polite"></p>
          <div class="booking-receipt-actions">
            ${canShowManageActions
              ? `<button type="button" class="btn btn-ghost" id="btn-receipt-calendar">Add to Calendar</button>`
              : ""}
            <button type="button" class="btn btn-ghost" id="btn-receipt-copy-summary">Copy Confirmation Summary</button>
            ${canShowManageActions
              ? `<button type="button" class="btn btn-ghost" id="btn-receipt-cancel" ${cancellation.canCancel ? "" : "disabled"}>Cancel Appointment</button>`
              : ""}
            <button type="button" class="btn btn-primary" id="btn-book-another">Book Another</button>
          </div>
        </section>
      </div>
    `;

    toggleReceiptMode(true);
    clearReceiptNote();
    clearReceiptError();
    section.querySelector("#btn-book-another")?.addEventListener("click", () => {
      toggleReceiptMode(false);
      clearStatus();
      selectedSlotValue = "";
      updateBookButtonState();
      if (serviceSelect) serviceSelect.value = "";
      if (bookingDate) bookingDate.value = "";
      refreshBookingDateBounds({ defaultToMin: true });
      renderSlots();
      serviceSelect?.focus();
    });
    section.querySelector("#btn-receipt-calendar")?.addEventListener("click", () => {
      clearReceiptError();
      const errorMessage = downloadIcs(booking);
      if (errorMessage) setReceiptError(errorMessage);
    });
    section.querySelector("#btn-receipt-copy-summary")?.addEventListener("click", async () => {
      clearReceiptError();
      try {
        const copied = await copyText(summaryText);
        if (!copied) throw new Error("copy_failed");
        showToast?.("Confirmation summary copied.", "success", 2000);
      } catch {
        showToast?.("Could not copy confirmation summary.", "error");
      }
    });
    section.querySelector("#btn-receipt-copy-manage-link")?.addEventListener("click", async () => {
      clearReceiptError();
      try {
        const copied = await copyText(manageLinkUrl);
        if (!copied) throw new Error("copy_failed");
        showToast?.("Manage link copied.", "success", 2000);
      } catch {
        showToast?.("Could not copy manage link.", "error");
      }
    });
    section.querySelector("#btn-receipt-cancel")?.addEventListener("click", () => {
      clearReceiptError();
      const result = cancelBookingById(String(booking?.id ?? ""));
      if (!result.ok) {
        setReceiptError(result.message);
        return;
      }
      setStatus("Appointment cancelled.", true);
      showToast?.("Appointment cancelled.", "success");
      renderSlots();
      renderClientAppointments();
      renderLastBookingPrompt();
      if (result.booking) {
        renderBookingReceipt(result.booking);
        setReceiptSuccess("Appointment cancelled.");
        queueBookingNotification("cancel", {
          booking: result.booking,
          previousBooking: result.previousBooking,
          manageLink: buildClientManageLink(result.booking, getConfirmationCode(result.booking.id)),
        });
      }
    });
  }

  function getConfirmationCode(rawId) {
    const cleaned = String(rawId ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleaned) return "N/A";
    return cleaned.slice(-6);
  }

  function getReceiptPresentation(statusValue) {
    const status = normalizeAppointmentStatus(statusValue);
    if (status === "cancelled") {
      return {
        tone: "danger",
        icon: "!",
        kicker: "Appointment updated",
        title: "Cancelled",
        message: "This appointment is no longer active. You can book another visit any time.",
      };
    }
    if (status === "completed") {
      return {
        tone: "success",
        icon: "&#10003;",
        kicker: "Appointment complete",
        title: "Done",
        message: "This appointment has been marked complete.",
      };
    }
    if (status === "no-show") {
      return {
        tone: "neutral",
        icon: "!",
        kicker: "Appointment updated",
        title: "Marked as No-show",
        message: "This booking has been marked as a no-show.",
      };
    }
    return {
      tone: "success",
      icon: "&#10003;",
      kicker: "Appointment confirmed",
      title: "Booked!",
      message: "Your appointment is locked in. Everything you need is below.",
    };
  }

  function buildBookingConfirmationSummary(booking, confirmationId) {
    const serviceName = String(booking?.serviceName ?? "Appointment").trim() || "Appointment";
    const barberLabel = getBookingBarberLabel(booking) || "your barber";
    const start = getBookingStartDate(booking);
    const dateLabel = start ? formatSummaryDate(start) : "your selected date";
    const timeLabel = start ? formatDateLocalTime(start) : "your selected time";
    const status = normalizeAppointmentStatus(booking?.status);

    if (!isScheduledStatus(status)) {
      return `Slotzy booking update: ${serviceName} with ${barberLabel} on ${dateLabel} at ${timeLabel}. Status: ${getAppointmentStatusLabel(status)}. Confirmation: ${confirmationId}`;
    }

    return `Slotzy booking confirmed: ${serviceName} with ${barberLabel} on ${dateLabel} at ${timeLabel}. Confirmation: ${confirmationId}`;
  }

  function getBookingReminderLine(booking) {
    const policy = getShopBookingPolicy(booking?.shopId);
    return formatReminderSchedule(normalizeBookingPolicy(policy));
  }

  function formatReminderSchedule(policy) {
    const normalized = normalizeBookingPolicy(policy);
    const parts = [];
    if (normalized.reminder24Hours) parts.push("24 hours before");
    if (normalized.reminder2Hours) parts.push("2 hours before");
    if (normalized.reminderCustomEnabled) {
      parts.push(formatReminderLeadTime(normalized.reminderCustomMinutes));
    }
    return parts.join(" • ");
  }

  function formatReminderLeadTime(minutesValue) {
    const minutes = Math.max(5, Math.round(Number(minutesValue) || 0));
    if (minutes % 1440 === 0) {
      const days = minutes / 1440;
      return `${days} day${days === 1 ? "" : "s"} before`;
    }
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return `${hours} hour${hours === 1 ? "" : "s"} before`;
    }
    return `${minutes} minutes before`;
  }

  function buildClientManageLink(booking, confirmationId) {
    const shopSlug = getBookingShopSlug(booking);
    const contact = String(booking?.clientContact ?? "").trim();
    if (!shopSlug || !contact) return "";

    try {
      const url = new URL("./manage.html", window.location.href);
      url.searchParams.set("shop", shopSlug);
      url.searchParams.set("contact", contact);
      return url.toString();
    } catch {
      return "";
    }
  }

  function getBookingShopSlug(booking) {
    const shopId = String(booking?.shopId ?? "").trim();
    if (!shopId) return "";
    const shop = getShops().find((row) => String(row?.id ?? "").trim() === shopId) || null;
    return String(shop?.slug ?? "").trim();
  }

  function setLastManageLink(url) {
    try {
      sessionStorage.setItem(LAST_MANAGE_LINK_KEY, String(url ?? "").trim());
    } catch {
      // ignore storage failures
    }
  }

  function getReceiptNoteElement() {
    return findElementById("booking-receipt-email-note");
  }

  function setReceiptNote(message, success = false) {
    const el = getReceiptNoteElement();
    if (!el) return;
    const text = String(message ?? "").trim();
    el.textContent = text;
    el.classList.remove("status-success", "status-error");
    if (!text) return;
    el.classList.add(success ? "status-success" : "status-error");
  }

  function clearReceiptNote() {
    const el = getReceiptNoteElement();
    if (!el) return;
    el.textContent = "";
    el.classList.remove("status-success", "status-error");
  }

  function getCancellationPolicyNoteForBooking(booking) {
    const policy = getShopBookingPolicy(booking?.shopId);
    const cancelHours = normalizeBookingPolicy(policy).cancelHours;
    return `Cancellations must be made at least ${cancelHours} hours before.`;
  }

  function buildNotificationPayloadForBooking({
    booking,
    previousBooking = null,
    manageLink = "",
  } = {}) {
    const targetBooking = booking && typeof booking === "object" ? booking : null;
    if (!targetBooking) return null;
    const shop = getShopByIdSource(targetBooking.shopId) || getSelectedShop() || null;
    return buildBookingNotificationPayload({
      booking: targetBooking,
      previousBooking,
      shop,
      users: getUsersSource(),
      profiles: getProfilesSource(),
      manageLink,
      cancellationNote: getCancellationPolicyNoteForBooking(targetBooking),
      source: isPublicBookingPage ? "public-booking" : "customer-dashboard",
    });
  }

  function queueBookingNotification(kind, { booking, previousBooking = null, manageLink = "" } = {}) {
    const payload = buildNotificationPayloadForBooking({ booking, previousBooking, manageLink });
    if (!payload) return;

    void postBookingNotification(kind, payload).then((result) => {
      if (result?.ok) {
        clearReceiptNote();
        return;
      }
      const message = result?.offline
        ? "Email not sent (server offline)."
        : (String(result?.error ?? "").trim() || "Email not sent right now.");
      setReceiptNote(message, false);
    });
  }

  function getReceiptDepositMessage(depositDetails) {
    if (!depositDetails?.required) return "No deposit is required for this appointment.";
    return `A ${formatCurrency(depositDetails.amount)} deposit is required for this appointment. Status: ${formatDepositStatusLabel(depositDetails.status)}.`;
  }

  async function copyText(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.className = "ui-offscreen-control";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  function getReceiptErrorElement() {
    return findElementById("booking-receipt-error");
  }

  function setReceiptStatus(message, success) {
    const el = getReceiptErrorElement();
    if (!el) return;
    el.textContent = String(message ?? "").trim();
    el.setAttribute("role", success ? "status" : "alert");
    el.setAttribute("aria-live", success ? "polite" : "assertive");
    el.setAttribute("aria-atomic", "true");
    el.classList.remove("status-success", "status-error");
    el.classList.add(success ? "status-success" : "status-error");
  }

  function setReceiptError(message) {
    setReceiptStatus(message, false);
  }

  function setReceiptSuccess(message) {
    setReceiptStatus(message, true);
  }

  function clearReceiptError() {
    const el = getReceiptErrorElement();
    if (!el) return;
    el.textContent = "";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.classList.remove("status-success", "status-error");
  }

  function generateIcsForBooking(booking) {
    const dtStamp = toIcsUtcStamp(new Date());
    const dtStart = toIcsUtcStamp(booking.startISO);
    const dtEnd = toIcsUtcStamp(booking.endISO);
    const price = Number(booking.price ?? 0);
    const priceText = Number.isFinite(price) ? price.toFixed(2) : "0.00";
    const barberLabel = getBookingBarberLabel(booking) || String(booking.ownerUsername ?? "");
    const shopLabel = getBookingShopLabel(booking) || "";
    const summary = escapeIcsText(`Slotzy - ${String(booking.serviceName ?? "")}`);
    const description = escapeIcsText(
      `Client: ${String(booking.clientName ?? "")} (${String(booking.clientContact ?? "")})\n` +
      `Barber: ${barberLabel}\n` +
      `Shop: ${shopLabel}\n` +
      `Price: $${priceText}`
    );

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Slotzy//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${String(booking.id ?? "")}@slotzy.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return `${lines.join("\r\n")}\r\n`;
  }

  function downloadIcs(booking) {
    const errorMessage = validateCalendarBooking(booking);
    if (errorMessage) return errorMessage;

    const ics = generateIcsForBooking(booking);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const startDate = new Date(booking.startISO);
    const datePart = toYmd(startDate);
    const servicePart = toFileSlug(String(booking.serviceName ?? "")) || "appointment";
    const filename = `slotzy-${datePart}-${servicePart}.ics`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.className = "ui-offscreen-control";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return null;
  }

  function validateCalendarBooking(booking) {
    if (!booking || typeof booking !== "object") return "Booking details are missing.";

    const status = normalizeAppointmentStatus(booking?.status);
    if (!isScheduledStatus(status)) return "Only booked or confirmed appointments can be added to your calendar.";

    const requiredFields = [
      { key: "id", label: "Booking ID" },
      { key: "serviceName", label: "Service name" },
      { key: "clientName", label: "Client name" },
      { key: "clientContact", label: "Client contact" },
      { key: "ownerUsername", label: "Barber" },
      { key: "startISO", label: "Start time" },
      { key: "endISO", label: "End time" },
    ];

    const missing = requiredFields.find(({ key }) => !String(booking[key] ?? "").trim());
    if (missing) return `${missing.label} is missing, so we cannot create a calendar file yet.`;

    const start = new Date(String(booking.startISO));
    const end = new Date(String(booking.endISO));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return "Booking time details are invalid. Please refresh and try again.";
    }
    return null;
  }

  function toIcsUtcStamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
  }

  function escapeIcsText(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function toFileSlug(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getClientSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CLIENT_SESSION_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      const clientName = String(parsed.clientName ?? "").trim();
      const clientContact = String(parsed.clientContact ?? "").trim();
      if (!clientName || !clientContact) return null;
      return { clientName, clientContact };
    } catch {
      return null;
    }
  }

  function saveClientSession(clientName, clientContact) {
    const payload = {
      clientName: String(clientName ?? "").trim(),
      clientContact: String(clientContact ?? "").trim(),
    };
    sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(payload));
  }

  function getActiveClientIdentity() {
    if (isLoggedInCustomer) {
      return {
        mode: "username",
        username: currentUsername,
      };
    }

    const stored = getClientSession();
    if (!stored) return null;
    return {
      mode: "session",
      clientName: stored.clientName,
      clientContact: stored.clientContact,
    };
  }

  function normalizeSlug(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getPublicShopSlugError(shops) {
    if (!isPublicBookingPage) return "";
    const requestedShopId = resolveRequestedShopId();
    if (requestedShopId) return "";
    if (!requestedShopSlug) return "";
    const matched = shops.some((shop) => shop.slug === requestedShopSlug);
    if (!matched) {
      return `We could not find a shop for "${requestedShopSlug}". Please verify the booking link.`;
    }
    return "";
  }

  function shouldShowPublicShopPicker() {
    return Boolean(isPublicBookingPage && !requestedShopSlug && !resolveRequestedShopId() && !selectedShopId && !publicShopSlugError);
  }

  function updatePublicBookingScreenState() {
    if (!isPublicBookingPage) return;
    const showPicker = shouldShowPublicShopPicker();
    publicShopPickerSection?.classList.toggle("hidden", !showPicker);
    publicShopHero?.classList.toggle("hidden", showPicker);
    bookingPanel?.classList.toggle("hidden", showPicker);
  }

  function replacePublicShopUrl(slug) {
    if (!isPublicBookingPage) return;
    const nextSlug = normalizeSlug(slug);
    const nextUrl = new URL(window.location.href);
    if (nextSlug) nextUrl.searchParams.set("shop", nextSlug);
    else nextUrl.searchParams.delete("shop");
    window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  function renderPublicShopPicker(shops = getShops()) {
    if (!isPublicBookingPage || !publicShopPickerSection || !publicShopPickerList) return;

    const source = Array.isArray(shops) ? shops : [];
    const query = String(publicShopSearchInput?.value ?? "").trim().toLowerCase();
    const matches = source.filter((shop) => {
      const name = String(shop?.name ?? "").trim().toLowerCase();
      return !query || name.includes(query);
    });

    if (publicShopSearchInput) {
      publicShopSearchInput.disabled = source.length === 0;
    }

    if (source.length === 0) {
      publicShopPickerList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No shops found</h3>
          <p>No shops found. Ask your barber for a booking link.</p>
        </section>
      `;
      if (publicShopPickerStatus) {
        publicShopPickerStatus.textContent = "No shops found. Ask your barber for a booking link.";
      }
      updatePublicBookingScreenState();
      return;
    }

    if (matches.length === 0) {
      publicShopPickerList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No matching shops</h3>
          <p>Try another shop name or ask your barber for a direct booking link.</p>
        </section>
      `;
      if (publicShopPickerStatus) {
        publicShopPickerStatus.textContent = "";
      }
      updatePublicBookingScreenState();
      return;
    }

    publicShopPickerList.innerHTML = matches.map((shop) => {
      const logoSrc = getPublicShopLogoSource(shop);
      const alt = getCustomShopLogoDataUrl(shop)
        ? `${shop.name} logo`
        : "Slotzy logo";
      const meta = [
        String(shop?.branding ?? "").trim(),
        String(shop?.address ?? "").trim(),
      ].filter(Boolean)[0] || "Choose this shop to view barbers, services, and available times.";
      return `
        <button
          type="button"
          class="public-shop-directory-card"
          data-action="select-public-shop"
          data-shop-id="${escapeHtml(String(shop.id ?? ""))}"
        >
          <span class="public-shop-directory-logo-wrap">
            <img class="public-shop-directory-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(alt)}" />
          </span>
          <span class="public-shop-directory-card-copy">
            <strong>${escapeHtml(String(shop.name ?? "Shop"))}</strong>
            <span>${escapeHtml(meta)}</span>
          </span>
          <span class="public-shop-directory-card-action">Choose shop</span>
        </button>
      `;
    }).join("");

    if (publicShopPickerStatus) {
      publicShopPickerStatus.textContent = "";
    }
    updatePublicBookingScreenState();
  }

  function focusPublicBookingStart() {
    const nextField = (!barberSelect?.disabled && barberSelect)
      || (!serviceSelect?.disabled && serviceSelect)
      || bookingDate
      || bookBtn;
    if (!nextField) return;
    nextField.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      nextField.focus({ preventScroll: true });
    }, 120);
  }

  function handlePublicShopPickerClick(event) {
    const button = event?.target?.closest?.("button[data-action='select-public-shop'][data-shop-id]");
    if (!button) return;
    const shopId = String(button.getAttribute("data-shop-id") ?? "").trim();
    if (!shopId) return;
    const shop = getShops().find((item) => item.id === shopId) || null;
    if (!shop) return;

    clearStatus();
    requestedShopSlug = shop.slug;
    selectedShopId = shop.id;
    publicShopSlugError = "";
    replacePublicShopUrl(shop.slug);
    populateShops();
    handleSelectedShopChange({ focusBookingStart: true });
  }

  function formatShopAddress(address) {
    const source = address && typeof address === "object" ? address : {};
    const line1 = String(source.line1 ?? source.address1 ?? source.street ?? "").trim();
    const city = String(source.city ?? "").trim();
    const state = String(source.state ?? "").trim();
    const zip = String(source.zip ?? source.postalCode ?? "").trim();
    const cityState = [city, state].filter(Boolean).join(", ");
    const cityStateZip = [cityState, zip].filter(Boolean).join(" ");
    return [line1, cityStateZip].filter(Boolean).join(", ");
  }

  function getLegacyShopContact(shopId) {
    const legacyShop = getLegacyShopSource();
    if (!legacyShop || typeof legacyShop !== "object") {
      return { phone: "", address: "" };
    }

    if (!canUseLegacyShopData(shopId)) {
      return { phone: "", address: "" };
    }

    return {
      phone: String(legacyShop?.shopPhone ?? "").trim(),
      address: formatShopAddress(legacyShop?.address),
    };
  }

  function getLegacyShopLogoDataUrl(shopId) {
    const legacyShop = getLegacyShopSource();
    if (!legacyShop || typeof legacyShop !== "object") return "";
    if (!canUseLegacyShopData(shopId)) return "";
    return String(
      legacyShop?.logoDataUrl ??
      legacyShop?.logoUrl ??
      legacyShop?.logo ??
      ""
    ).trim();
  }

  function getLegacyShopCoverDataUrl(shopId) {
    const legacyShop = getLegacyShopSource();
    if (!legacyShop || typeof legacyShop !== "object") return "";
    if (!canUseLegacyShopData(shopId)) return "";
    return String(legacyShop?.coverDataUrl ?? "").trim();
  }

  function getCustomShopLogoDataUrl(shop) {
    const shopId = String(shop?.id ?? "").trim();
    const persistedShop = shopId ? getShopByIdSource(shopId) : null;
    return String(
      persistedShop?.logoDataUrl ??
      shop?.logoDataUrl ??
      getLegacyShopLogoDataUrl(shopId) ??
      ""
    ).trim();
  }

  function getCustomShopCoverDataUrl(shop) {
    const shopId = String(shop?.id ?? "").trim();
    const persistedShop = shopId ? getShopByIdSource(shopId) : null;
    return String(
      persistedShop?.coverDataUrl ??
      shop?.coverDataUrl ??
      getLegacyShopCoverDataUrl(shopId) ??
      ""
    ).trim();
  }

  function getPublicShopLogoSource(shop) {
    const customLogoDataUrl = getCustomShopLogoDataUrl(shop);
    return String(
      customLogoDataUrl ??
      shop?.logoUrl ??
      shop?.logo ??
      DEFAULT_PUBLIC_SHOP_LOGO_URL
    ).trim() || DEFAULT_PUBLIC_SHOP_LOGO_URL;
  }

  function canUseLegacyShopData(shopId) {
    const legacyShop = getLegacyShopSource();
    if (!legacyShop || typeof legacyShop !== "object") return false;

    const legacyShopId = String(legacyShop?.shopId ?? "").trim();
    const targetShopId = String(shopId ?? "").trim();
    if (!legacyShopId && getShopsSource().length > 1) {
      return false;
    }
    if (legacyShopId && targetShopId && legacyShopId !== targetShopId) {
      return false;
    }
    return true;
  }

  function setShopSelectVisibility(visible) {
    if (shopSelectLabel) {
      shopSelectLabel.classList.toggle("hidden", !visible);
      shopSelectLabel.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    if (shopSelect) {
      shopSelect.classList.toggle("hidden", !visible);
      shopSelect.setAttribute("aria-hidden", visible ? "false" : "true");
    }
  }

  function updatePublicShopHeader(shop, errorMessage = "") {
    if (!isPublicBookingPage) return;
    const hasError = Boolean(String(errorMessage ?? "").trim());

    if (publicShopName) {
      publicShopName.textContent = shop
        ? shop.name
        : (hasError ? "Shop not found" : "Choose your shop");
    }
    if (publicShopBranding) {
      if (shop && shop.branding) {
        publicShopBranding.textContent = shop.branding;
      } else if (shop) {
        publicShopBranding.textContent = "Book in 30 seconds. Choose your service, pick a time, and use your manage link later if plans change.";
      } else if (!hasError) {
        publicShopBranding.textContent = "Search for your shop first, then book in 30 seconds.";
      } else {
        publicShopBranding.textContent = "We could not load this shop's booking profile.";
      }
    }
    if (publicShopPhone) {
      const phone = String(shop?.phone ?? "").trim();
      publicShopPhone.textContent = phone ? `Phone: ${phone}` : "";
      publicShopPhone.classList.toggle("hidden", !phone);
    }
    if (publicShopAddress) {
      const address = String(shop?.address ?? "").trim();
      publicShopAddress.textContent = address ? `Address: ${address}` : "";
      publicShopAddress.classList.toggle("hidden", !address);
    }
    if (publicShopLogo) {
      const hasCustomLogo = Boolean(getCustomShopLogoDataUrl(shop));
      const logoSrc = getPublicShopLogoSource(shop);
      publicShopLogo.src = logoSrc;
      publicShopLogo.alt = hasCustomLogo
        ? `${shop?.name ?? "Shop"} logo`
        : "Slotzy logo";
      publicShopLogo.classList.remove("hidden");
    }
    if (publicShopHero) {
      const coverDataUrl = shop ? getCustomShopCoverDataUrl(shop) : "";
      if (coverDataUrl) {
        publicShopHero.style.setProperty("--shop-cover-image", `url("${coverDataUrl.replace(/"/g, '\\"')}")`);
      } else {
        publicShopHero.style.removeProperty("--shop-cover-image");
      }
      publicShopHero.classList.toggle("has-shop-cover", Boolean(coverDataUrl));
    }
    if (publicShopError) {
      const message = String(errorMessage ?? "").trim();
      publicShopError.textContent = message;
      publicShopError.classList.toggle("hidden", !message);
      publicShopError.classList.toggle("status-error", Boolean(message));
    }
  }

  function disableBookingFlow(message) {
    const disabled = true;
    [shopSelect, barberSelect, serviceSelect, bookingDate, clientNameInput, clientContactInput, depositAcknowledge, bookBtn]
      .forEach((field) => {
        if (!field) return;
        field.disabled = disabled;
      });

    if (slotList) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Booking unavailable</h3>
          <p>${escapeHtml(String(message ?? "This booking link is currently unavailable."))}</p>
          <a class="btn btn-ghost empty-state-cta" href="../index.html">Back to home</a>
        </section>
      `;
    }

    selectedSlotValue = "";
    if (changeBarberHelp) {
      changeBarberHelp.classList.add("hidden");
    }
    updateBookButtonState();
    setStatus(String(message ?? "This booking link is currently unavailable."), false);
  }

  function getShops() {
    return getShopsSource()
      .map((shop) => {
        const shopId = String(shop?.id ?? "").trim();
        const directPhone = String(shop?.shopPhone ?? shop?.phone ?? "").trim();
        const directAddress = formatShopAddress(shop?.address);
        const legacyContact = getLegacyShopContact(shopId);
        const legacyLogoDataUrl = getLegacyShopLogoDataUrl(shopId);
        const directPolicy = shop?.bookingPolicy && typeof shop.bookingPolicy === "object"
          ? shop.bookingPolicy
          : null;
        return {
          id: shopId,
          name: String(shop?.name ?? "Shop").trim() || "Shop",
          slug: normalizeSlug(shop?.slug ?? shop?.name ?? ""),
          active: Object.prototype.hasOwnProperty.call(shop ?? {}, "active")
            ? Boolean(shop?.active)
            : true,
          branding: String(shop?.tagline ?? shop?.description ?? "").trim(),
          shopEmail: String(shop?.shopEmail ?? "").trim(),
          logoDataUrl: String(shop?.logoDataUrl ?? legacyLogoDataUrl ?? "").trim() || null,
          coverDataUrl: String(shop?.coverDataUrl ?? getLegacyShopCoverDataUrl(shopId) ?? "").trim() || null,
          logoUrl: String(shop?.logoUrl ?? shop?.logo ?? legacyLogoDataUrl ?? "").trim(),
          phone: directPhone || legacyContact.phone,
          address: directAddress || legacyContact.address,
          bookingPolicy: normalizeBookingPolicy(directPolicy ?? getLegacyShopBookingPolicy(shopId)),
        };
      })
      .filter((shop) => Boolean(shop.id) && shop.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  function populateShops() {
    if (!shopSelect) return;

    const shops = getShops();
    const requestedShopId = resolveRequestedShopId();
    setShopSelectVisibility(!isPublicBookingPage);
    if (isPublicBookingPage) {
      publicShopSlugError = getPublicShopSlugError(shops);
      if (publicShopSlugError) {
        selectedShopId = "";
        shopSelect.innerHTML = '<option value="">Shop not found</option>';
        shopSelect.disabled = true;
        renderPublicShopPicker(shops);
        updatePublicShopHeader(null, publicShopSlugError);
        updatePublicBookingScreenState();
        return;
      }

      if (!requestedShopSlug && !requestedShopId) {
        selectedShopId = "";
        const defaultOption = shops.length > 0
          ? '<option value="">Select a shop</option>'
          : '<option value="">No shops available</option>';
        const optionsMarkup = shops.map((shop) => (
          `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.name)}</option>`
        )).join("");
        shopSelect.innerHTML = `${defaultOption}${optionsMarkup}`;
        shopSelect.value = "";
        shopSelect.disabled = shops.length === 0;
        renderPublicShopPicker(shops);
        updatePublicShopHeader(null, "");
        updatePublicBookingScreenState();
        return;
      }

      const matchedShop = requestedShopId
        ? (shops.find((shop) => shop.id === requestedShopId) || null)
        : (shops.find((shop) => shop.slug === requestedShopSlug) || null);
      if (!matchedShop) {
        selectedShopId = "";
        publicShopSlugError = "Shop not found.";
        shopSelect.innerHTML = '<option value="">Shop not found</option>';
        shopSelect.disabled = true;
        renderPublicShopPicker(shops);
        updatePublicShopHeader(null, publicShopSlugError);
        updatePublicBookingScreenState();
        return;
      }

      publicShopSlugError = "";
      selectedShopId = matchedShop.id;
      shopSelect.innerHTML = `<option value="${escapeHtml(matchedShop.id)}">${escapeHtml(matchedShop.name)}</option>`;
      shopSelect.value = matchedShop.id;
      shopSelect.disabled = true;
      renderPublicShopPicker(shops);
      updatePublicShopHeader(matchedShop, "");
      updatePublicBookingScreenState();
      return;
    }

    if (shops.length === 0) {
      selectedShopId = "";
      shopSelect.innerHTML = '<option value="">No shops available</option>';
      shopSelect.disabled = true;
      return;
    }

    const existing = shops.find((shop) => shop.id === selectedShopId);
    if (existing) {
      selectedShopId = existing.id;
    } else if (shops.length === 1) {
      selectedShopId = shops[0].id;
    } else {
      selectedShopId = "";
    }

    const defaultOption = shops.length > 1
      ? '<option value="">Select a shop</option>'
      : "";
    const optionsMarkup = shops.map((shop) => (
      `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.name)}</option>`
    )).join("");
    shopSelect.innerHTML = `${defaultOption}${optionsMarkup}`;

    if (selectedShopId) {
      shopSelect.value = selectedShopId;
    }
    shopSelect.disabled = shops.length <= 1;
  }

  function handleSelectedShopChange({ focusBookingStart = false } = {}) {
    clearStatus();
    if (!selectedShopId) {
      selectedShopId = String(shopSelect?.value ?? "").trim();
    }
    selectedBarberUsername = "";
    if (barberSelect) barberSelect.value = "";
    populateBarbers();
    populateServices();
    refreshBookingDateBounds({
      defaultToMin: !String(bookingDate?.value ?? "").trim(),
      announceInvalid: Boolean(String(bookingDate?.value ?? "").trim()),
    });
    renderBookingPolicyCard();
    updatePolicyHint();
    renderDepositPolicyNotice();
    updateChangeBarberHelp();
    renderSlots();
    updatePublicBookingScreenState();
    if (focusBookingStart) {
      focusPublicBookingStart();
    }
  }

  function getBarbersForSelectedShop() {
    if (!selectedShopId) return [];
    return getBarbersForShopSource(selectedShopId, { includeOwners: true })
      .map((barber) => ({
        username: String(barber?.username ?? "").trim(),
        displayName: String(barber?.displayName ?? barber?.username ?? "").trim() || String(barber?.username ?? ""),
      }))
      .filter((barber) => Boolean(barber.username));
  }

  function populateBarbers() {
    if (!barberSelect) return;

    if (!selectedShopId) {
      selectedBarberUsername = "";
      barberSelect.innerHTML = '<option value="">Select a shop first</option>';
      barberSelect.disabled = true;
      syncBarberFieldVisibility([]);
      return;
    }

    const barbers = getBarbersForSelectedShop();
    if (barbers.length === 0) {
      selectedBarberUsername = "";
      barberSelect.innerHTML = '<option value="">No barbers available</option>';
      barberSelect.disabled = true;
      syncBarberFieldVisibility(barbers);
      return;
    }

    const existing = barbers.find((barber) => barber.username === selectedBarberUsername);
    if (existing) {
      selectedBarberUsername = existing.username;
    } else if (barbers.length === 1) {
      selectedBarberUsername = barbers[0].username;
    } else {
      selectedBarberUsername = "";
    }

    const defaultOption = barbers.length > 1
      ? '<option value="">Select a barber</option>'
      : "";
    const optionsMarkup = barbers.map((barber) => (
      `<option value="${escapeHtml(barber.username)}">${escapeHtml(barber.displayName)}</option>`
    )).join("");
    barberSelect.innerHTML = `${defaultOption}${optionsMarkup}`;
    barberSelect.disabled = false;

    if (selectedBarberUsername) {
      barberSelect.value = selectedBarberUsername;
    }
    syncBarberFieldVisibility(barbers);
  }

  function syncBarberFieldVisibility(barbers = getBarbersForSelectedShop()) {
    if (!barberField) return;
    const count = Array.isArray(barbers) ? barbers.length : 0;
    const shouldHide = Boolean(selectedShopId) && count === 1;
    barberField.classList.toggle("hidden", shouldHide);
    barberField.setAttribute("aria-hidden", shouldHide ? "true" : "false");
  }

  function updateChangeBarberHelp() {
    if (!changeBarberHelp || !barberSelect) return;

    const optionCount = Number(barberSelect.options?.length ?? 0);
    const canChangeBarber = !barberSelect.disabled && optionCount > 1;
    changeBarberHelp.classList.toggle("hidden", !canChangeBarber);
  }

  function scrollToBarberSection() {
    if (!barberSelect) return;
    barberSelect.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      barberSelect.focus({ preventScroll: true });
    }, 120);
  }

  function handleChangeBarberClick(event) {
    event?.preventDefault();
    scrollToBarberSection();
  }

  function getSelectedShop() {
    const shopId = selectedShopId || String(shopSelect?.value ?? "").trim();
    if (!shopId) return null;
    return getShops().find((shop) => shop.id === shopId) || null;
  }

  function getSelectedBarber() {
    const username = selectedBarberUsername || String(barberSelect?.value ?? "").trim();
    if (!username) return null;
    return getBarbersForSelectedShop().find((barber) => barber.username === username) || null;
  }

  function resolveBarberDisplayName(username) {
    const target = String(username ?? "").trim();
    if (!target) return "";

    const fromShop = getBarbersForSelectedShop().find((barber) => barber.username === target);
    if (fromShop) return fromShop.displayName;

    const user = getUsersSource().find((item) => String(item?.username ?? "") === target);
    return String(user?.displayName ?? user?.username ?? target).trim() || target;
  }

  function updatePolicyHint() {
    if (!policyHint) return;

    if (!selectedShopId) {
      policyHint.textContent = "Choose a shop to continue.";
      return;
    }
    if (!selectedBarberUsername) {
      policyHint.textContent = "Choose a barber to load services and available time slots.";
      return;
    }

    const barberLabel = resolveBarberDisplayName(selectedBarberUsername) || selectedBarberUsername;
    const bookingPolicy = getActiveBookingPolicy();
    const bookingBounds = getBookingDateBounds(bookingPolicy);
    const depositPolicy = getActiveDepositPolicy();
    const bookingWindowText = ` Booking window: ${bookingBounds.minYmd} to ${bookingBounds.maxYmd}.`;
    const cancellationText = ` Cancellations require at least ${bookingPolicy.cancelHours} hours notice.`;
    const depositText = depositPolicy.requireDeposit
      ? ` A deposit of $${depositPolicy.depositAmount.toFixed(2)} is required to book.`
      : " No deposit is required.";
    policyHint.textContent = `Slots are generated from ${barberLabel}'s availability, time off, and existing scheduled appointments.${bookingWindowText}${cancellationText}${depositText}`;
  }

  function renderBookingPolicyCard() {
    if (!bookingPolicyCard || !bookingPolicyAdvance || !bookingPolicyCancel) return;

    if (!selectedShopId) {
      bookingPolicyCard.classList.add("hidden");
      if (bookingPolicySameDay) {
        bookingPolicySameDay.textContent = "";
        bookingPolicySameDay.classList.add("hidden");
      }
      bookingPolicyAdvance.textContent = "";
      bookingPolicyCancel.textContent = "";
      return;
    }

    const policy = getActiveBookingPolicy();
    bookingPolicyCard.classList.remove("hidden");
    if (bookingPolicySameDay) {
      if (policy.allowSameDay) {
        bookingPolicySameDay.textContent = "";
        bookingPolicySameDay.classList.add("hidden");
      } else {
        bookingPolicySameDay.textContent = "No same-day bookings";
        bookingPolicySameDay.classList.remove("hidden");
      }
    }
    bookingPolicyAdvance.textContent = `Book up to ${policy.maxDaysAdvance} day${policy.maxDaysAdvance === 1 ? "" : "s"} in advance`;
    bookingPolicyCancel.textContent = `Cancellations must be made ${policy.cancelHours} hour${policy.cancelHours === 1 ? "" : "s"} before`;
  }

  function getDefaultBookingPolicy() {
    return {
      allowSameDay: true,
      maxDaysAdvance: 30,
      cancelHours: 24,
      requireDeposit: false,
      depositAmount: 0,
      bufferMinutes: 0,
      lateGraceMinutes: 10,
      noShowStrikeLimit: 2,
      reminder24Hours: true,
      reminder2Hours: true,
      reminderCustomEnabled: false,
      reminderCustomMinutes: 60,
    };
  }

  function normalizeBookingPolicy(policy) {
    const defaults = getDefaultBookingPolicy();
    const source = policy && typeof policy === "object" ? policy : {};
    const allowSameDay = Object.prototype.hasOwnProperty.call(source, "allowSameDay")
      ? Boolean(source.allowSameDay)
      : defaults.allowSameDay;
    const maxDaysAdvanceRaw = Number(source.maxDaysAdvance ?? defaults.maxDaysAdvance);
    const cancelHoursRaw = Number(source.cancelHours ?? defaults.cancelHours);
    const depositAmountRaw = Number(source.depositAmount ?? defaults.depositAmount);
    const bufferMinutesRaw = Number(source.bufferMinutes ?? defaults.bufferMinutes);
    const lateGraceMinutesRaw = Number(source.lateGraceMinutes ?? defaults.lateGraceMinutes);
    const noShowStrikeLimitRaw = Number(source.noShowStrikeLimit ?? defaults.noShowStrikeLimit);
    const reminderCustomMinutesRaw = Number(source.reminderCustomMinutes ?? defaults.reminderCustomMinutes);

    return {
      ...defaults,
      ...source,
      allowSameDay,
      maxDaysAdvance: Number.isFinite(maxDaysAdvanceRaw)
        ? Math.max(1, Math.round(maxDaysAdvanceRaw))
        : defaults.maxDaysAdvance,
      cancelHours: Number.isFinite(cancelHoursRaw)
        ? Math.max(0, Math.round(cancelHoursRaw))
        : defaults.cancelHours,
      requireDeposit: Boolean(source.requireDeposit ?? defaults.requireDeposit),
      depositAmount: Number.isFinite(depositAmountRaw)
        ? Math.max(0, Number(depositAmountRaw.toFixed(2)))
        : defaults.depositAmount,
      bufferMinutes: Number.isFinite(bufferMinutesRaw)
        ? Math.max(0, Math.round(bufferMinutesRaw))
        : defaults.bufferMinutes,
      lateGraceMinutes: Number.isFinite(lateGraceMinutesRaw)
        ? Math.max(0, Math.round(lateGraceMinutesRaw))
        : defaults.lateGraceMinutes,
      noShowStrikeLimit: Number.isFinite(noShowStrikeLimitRaw)
        ? Math.max(0, Math.round(noShowStrikeLimitRaw))
        : defaults.noShowStrikeLimit,
      reminder24Hours: Boolean(source.reminder24Hours ?? defaults.reminder24Hours),
      reminder2Hours: Boolean(source.reminder2Hours ?? defaults.reminder2Hours),
      reminderCustomEnabled: Boolean(source.reminderCustomEnabled ?? defaults.reminderCustomEnabled),
      reminderCustomMinutes: Number.isFinite(reminderCustomMinutesRaw)
        ? Math.max(5, Math.round(reminderCustomMinutesRaw))
        : defaults.reminderCustomMinutes,
    };
  }

  function getLegacyShopBookingPolicy(shopId) {
    const defaults = getDefaultBookingPolicy();
    const legacyShop = getLegacyShopSource();
    if (!legacyShop || typeof legacyShop !== "object") return defaults;
    if (!canUseLegacyShopData(shopId)) return defaults;

    const policy = legacyShop?.bookingPolicy && typeof legacyShop.bookingPolicy === "object"
      ? legacyShop.bookingPolicy
      : {};
    return normalizeBookingPolicy(policy);
  }

  function getShopBookingPolicy(shopId) {
    const selectedId = String(shopId ?? "").trim();
    const selectedShop = selectedId ? getShopByIdSource(selectedId) : null;
    if (selectedShop?.bookingPolicy && typeof selectedShop.bookingPolicy === "object") {
      return normalizeBookingPolicy(selectedShop.bookingPolicy);
    }
    return getLegacyShopBookingPolicy(selectedId);
  }

  function getActiveBookingPolicy() {
    const shop = getSelectedShop();
    const shopId = String(shop?.id ?? "").trim();
    return getShopBookingPolicy(shopId);
  }

  function getActiveDepositPolicy() {
    return getActiveBookingPolicy();
  }

  function renderDepositPolicyNotice() {
    if (!depositNotice || !depositNoticeText || !depositAckWrap || !depositAcknowledge) return;

    const policy = getActiveDepositPolicy();
    if (!selectedShopId) {
      depositNotice.classList.add("hidden");
      depositAckWrap.classList.add("hidden");
      depositAcknowledge.checked = false;
      updateBookButtonState();
      return;
    }

    depositNotice.classList.remove("hidden");
    if (!policy.requireDeposit) {
      depositNoticeText.textContent = "No deposit required for this shop.";
      depositAckWrap.classList.add("hidden");
      depositAcknowledge.checked = false;
      updateBookButtonState();
      return;
    }

    depositNoticeText.textContent = `A $${policy.depositAmount.toFixed(2)} deposit is required to hold this booking.`;
    depositAckWrap.classList.remove("hidden");
    updateBookButtonState();
  }

  function isDepositAcknowledgementRequired() {
    const policy = getActiveDepositPolicy();
    if (!policy.requireDeposit) return false;
    return !(depositAcknowledge?.checked ?? false);
  }

  function getServices() {
    if (!selectedShopId || !selectedBarberUsername) return [];

    return getServicesSource()
      .map(normalizeService)
      .filter((service) => service.active !== false)
      .filter((service) => String(service?.shopId ?? "") === selectedShopId)
      .filter((service) => {
        const barberUsername = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim();
        return barberUsername === selectedBarberUsername;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  function getBookings() {
    return getBookingsSource();
  }

  function saveBookings(bookings) {
    saveBookingsSource(bookings);
  }

  function bindBookingSyncListeners() {
    if (bookingSyncBound) return;
    window.addEventListener("storage", handleStorageBookingSync);
    window.addEventListener(BOOKING_SYNC_EVENT, handleLocalBookingSync);
    bookingSyncBound = true;
  }

  function handleStorageBookingSync(event) {
    if (!event) return;
    if (event.key && event.key !== BOOKINGS_STORAGE_KEY && event.key !== AVAILABILITY_STORAGE_KEY) return;
    refreshAfterExternalBookingUpdate();
  }

  function handleLocalBookingSync() {
    refreshAfterExternalBookingUpdate();
  }

  function refreshAfterExternalBookingUpdate() {
    renderSlots();
    renderClientAppointments();
    renderLastBookingPrompt();

    if (!receiptSection || receiptSection.classList.contains("hidden")) return;
    const bookingId = String(receiptSection.dataset.bookingId ?? "").trim();
    if (!bookingId) return;
    const latest = getBookingById(bookingId);
    if (!latest || !isBookingForActiveClient(latest)) return;
    renderBookingReceipt(latest);
  }

  function normalizeService(service) {
    const name = String(service?.name ?? service?.title ?? "").trim() || "Service";
    const duration = Number(service?.durationMinutes ?? service?.duration ?? 0);
    const price = Number(service?.price ?? 0);
    return {
      ...service,
      id: String(service?.id ?? ""),
      name,
      durationMinutes: Number.isFinite(duration) ? Math.max(1, Math.round(duration)) : 30,
      price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
    };
  }

  function populateServices() {
    if (!serviceSelect) return;

    if (!selectedShopId || !selectedBarberUsername) {
      serviceSelect.innerHTML = '<option value="">Select shop and barber first</option>';
      serviceSelect.disabled = true;
      return;
    }

    const services = getServices();
    if (services.length === 0) {
      serviceSelect.innerHTML = '<option value="">No services for this barber</option>';
      serviceSelect.disabled = true;
      return;
    }

    serviceSelect.innerHTML = '<option value="">Select a service</option>';
    serviceSelect.disabled = false;

    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = `${service.name} - $${service.price.toFixed(2)} - ${service.durationMinutes} min`;
      option.dataset.serviceName = service.name;
      option.dataset.durationMinutes = String(service.durationMinutes);
      option.dataset.price = String(service.price);
      serviceSelect.appendChild(option);
    });
  }

  function initializeDate() {
    refreshBookingDateBounds({ defaultToMin: true });
  }

  function startOfDay(date = new Date()) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function getBookingDateBounds(policy = getActiveBookingPolicy()) {
    const normalizedPolicy = normalizeBookingPolicy(policy);
    const today = startOfDay(new Date());
    const minDate = addDays(today, normalizedPolicy.allowSameDay ? 0 : 1);
    const maxDate = addDays(today, normalizedPolicy.maxDaysAdvance);

    return {
      policy: normalizedPolicy,
      today,
      minDate,
      maxDate,
      minYmd: toYmd(minDate),
      maxYmd: toYmd(maxDate),
    };
  }

  function getBookingDateRangeMessage(bounds, reason) {
    const policy = bounds?.policy || getActiveBookingPolicy();
    const minYmd = String(bounds?.minYmd ?? "");
    const maxYmd = String(bounds?.maxYmd ?? "");
    if (!minYmd || !maxYmd) return "Choose a valid booking date.";

    if (reason === "before_min" && !policy.allowSameDay) {
      return minYmd === maxYmd
        ? `Same-day bookings are not available for this shop. Choose ${minYmd}.`
        : `Same-day bookings are not available for this shop. Choose a date between ${minYmd} and ${maxYmd}.`;
    }

    return minYmd === maxYmd
      ? `Choose ${minYmd} for this shop.`
      : `Choose a date between ${minYmd} and ${maxYmd}.`;
  }

  function getBookingDateValidation(dateValue = String(bookingDate?.value ?? ""), policy = getActiveBookingPolicy()) {
    const bounds = getBookingDateBounds(policy);
    const raw = String(dateValue ?? "").trim();
    if (!raw) {
      return {
        valid: true,
        message: "",
        reason: "",
        selectedDate: null,
        ...bounds,
      };
    }

    const selectedDate = parseYmd(raw);
    if (!selectedDate) {
      return {
        valid: false,
        message: "Choose a valid booking date.",
        reason: "invalid_date",
        selectedDate: null,
        ...bounds,
      };
    }

    if (selectedDate < bounds.minDate) {
      return {
        valid: false,
        message: getBookingDateRangeMessage(bounds, "before_min"),
        reason: "before_min",
        selectedDate,
        ...bounds,
      };
    }

    if (selectedDate > bounds.maxDate) {
      return {
        valid: false,
        message: getBookingDateRangeMessage(bounds, "after_max"),
        reason: "after_max",
        selectedDate,
        ...bounds,
      };
    }

    return {
      valid: true,
      message: "",
      reason: "",
      selectedDate,
      ...bounds,
    };
  }

  function syncBookingDateInputState({ announceInvalid = false } = {}) {
    if (!bookingDate) {
      return getBookingDateValidation("", getActiveBookingPolicy());
    }

    const validation = getBookingDateValidation();
    bookingDate.min = validation.minYmd;
    bookingDate.max = validation.maxYmd;
    bookingDate.setAttribute("aria-invalid", validation.valid ? "false" : "true");

    if (!validation.valid && announceInvalid && validation.message) {
      setStatus(validation.message, false);
    }

    return validation;
  }

  function refreshBookingDateBounds({ defaultToMin = false, announceInvalid = false } = {}) {
    if (!bookingDate) {
      return getBookingDateValidation("", getActiveBookingPolicy());
    }

    const validation = getBookingDateValidation();
    bookingDate.min = validation.minYmd;
    bookingDate.max = validation.maxYmd;

    if (!bookingDate.value && defaultToMin) {
      bookingDate.value = validation.minYmd;
    }

    return syncBookingDateInputState({ announceInvalid });
  }

  function getSelectedService() {
    const serviceId = String(serviceSelect?.value ?? "");
    if (!serviceId) return null;
    return getServices().find((service) => service.id === serviceId) || null;
  }

  function getAvailability(barberUsername = selectedBarberUsername) {
    const key = String(barberUsername ?? "").trim();
    if (!key) return null;

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

    const parsed = getAvailabilityForBarberSource(key) || {};
    const weekly = {};
    Object.keys(defaults.weekly).forEach((day) => {
      const source = parsed?.weekly?.[day] || {};
      weekly[day] = {
        enabled: Boolean(source.enabled ?? defaults.weekly[day].enabled),
        start: normalizeTime(String(source.start ?? defaults.weekly[day].start)),
        end: normalizeTime(String(source.end ?? defaults.weekly[day].end)),
      };
    });

    const bufferRaw = Number(parsed?.bufferMinutes ?? defaults.bufferMinutes);
    const bufferMinutes = [0, 5, 10, 15].includes(bufferRaw) ? bufferRaw : 0;
    const timeOff = Array.isArray(parsed?.timeOff)
      ? parsed.timeOff
        .map((block) => ({
          id: String(block?.id ?? ""),
          startISO: String(block?.startISO ?? ""),
          endISO: String(block?.endISO ?? ""),
          note: String(block?.note ?? ""),
        }))
        .filter((block) => Number.isFinite(new Date(block.startISO).getTime()) && Number.isFinite(new Date(block.endISO).getTime()))
      : [];

    return {
      timezone: String(parsed?.timezone ?? defaults.timezone),
      bufferMinutes,
      weekly,
      timeOff,
    };
  }

  function renderSlots() {
    if (!slotList) return;

    selectedSlotValue = "";
    updateBookButtonState();

    const shop = getSelectedShop();
    const barber = getSelectedBarber();
    const service = getSelectedService();
    const dateValue = String(bookingDate?.value ?? "");
    const dateValidation = syncBookingDateInputState({
      announceInvalid: Boolean(dateValue),
    });

    if (!shop) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Select a shop</h3>
          <p>Choose a shop to continue booking.</p>
        </section>
      `;
      return;
    }

    if (!barber) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Select a barber</h3>
          <p>Choose a barber to see available services and times.</p>
        </section>
      `;
      return;
    }

    if (dateValue && !dateValidation.valid) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Date unavailable</h3>
          <p>${escapeHtml(dateValidation.message)}</p>
        </section>
      `;
      return;
    }

    if (!service || !dateValue) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Select service and date</h3>
          <p>Choose a service and date to load available time slots.</p>
        </section>
      `;
      return;
    }

    const slotTimes = generateAvailableSlots({
      barberUsername: barber.username,
      dateYmd: dateValue,
      durationMinutes: service.durationMinutes,
    });

    if (slotTimes.length === 0) {
      slotList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No available times</h3>
          <p>Try picking another day.</p>
          <p>You can also choose another barber.</p>
          <button type="button" id="noTimesChangeBarberBtn" class="btn btn-ghost empty-state-cta">Choose another barber</button>
        </section>
      `;
      findElementById("noTimesChangeBarberBtn")?.addEventListener("click", scrollToBarberSection);
      return;
    }

    const slotOptions = slotTimes
      .map((slotTime) => {
        const start = parseLocalDateTime(dateValue, slotTime);
        if (!start) return null;
        const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
        const startISO = start.toISOString();
        return {
          startISO,
          label: `${formatDateLocalTime(start)} - ${formatDateLocalTime(end)}`,
        };
      })
      .filter(Boolean);

    slotList.innerHTML = `
      <select id="time-slot-select" class="booking-slot-select" aria-labelledby="slotListLabel">
        <option value="">Select a time...</option>
        ${slotOptions.map((slot) => `
          <option value="${escapeHtml(slot.startISO)}">${escapeHtml(slot.label)}</option>
        `).join("")}
      </select>
    `;

    findElementById("time-slot-select")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      selectedSlotValue = String(target.value ?? "");
      updateBookButtonState();
    });
  }

  function generateAvailableSlots({ barberUsername, dateYmd, durationMinutes }) {
    const availability = getAvailability(barberUsername);
    if (!availability) return [];

    const date = parseYmd(dateYmd);
    if (!date) return [];

    const dayKey = DAY_KEYS[date.getDay()];
    const day = availability.weekly[dayKey];
    if (!day || day.enabled !== true) return [];

    const dayStartMin = hhmmToMinutes(day.start);
    const dayEndMin = hhmmToMinutes(day.end);
    if (!Number.isFinite(dayStartMin) || !Number.isFinite(dayEndMin) || dayStartMin >= dayEndMin) return [];

    const bookedWindows = getBookedWindowsForBarber(barberUsername, availability.bufferMinutes);
    const timeOffWindows = getTimeOffWindows(availability);
    const nowTs = Date.now();
    const slots = [];

    for (let startMin = dayStartMin; startMin + durationMinutes <= dayEndMin; startMin += SLOT_INCREMENT_MINUTES) {
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, startMin, 0, 0);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      if (startDate.getTime() < nowTs) continue;
      if (overlapsAnyWindow(startDate, endDate, bookedWindows)) continue;
      if (overlapsAnyWindow(startDate, endDate, timeOffWindows)) continue;

      slots.push(minutesToHhmm(startMin));
    }

    return slots;
  }

  function getBookedWindowsForBarber(barberUsername, bufferMinutes) {
    return getBookings()
      .filter((booking) => isScheduledStatus(booking?.status))
      .filter((booking) => String(booking?.ownerUsername ?? "") === String(barberUsername ?? ""))
      .filter((booking) => {
        if (!selectedShopId) return true;
        return String(booking?.shopId ?? "") === selectedShopId;
      })
      .map((booking) => getBookingWindow(booking))
      .filter(Boolean)
      .map((window) => ({
        start: window.start,
        end: new Date(window.end.getTime() + bufferMinutes * 60 * 1000),
      }));
  }

  function getTimeOffWindows(availability) {
    if (!availability || !Array.isArray(availability.timeOff)) return [];
    return availability.timeOff
      .map((block) => {
        const start = new Date(block.startISO);
        const end = new Date(block.endISO);
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
      const duration = Number(booking?.durationMinutes ?? 0);
      const startFromLegacy = parseLocalDateTime(date, time);
      if (startFromLegacy && Number.isFinite(duration) && duration > 0) {
        start = startFromLegacy;
        end = new Date(startFromLegacy.getTime() + duration * 60 * 1000);
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

  function handleBook() {
    clearStatus();
    const shop = getSelectedShop();
    const barber = getSelectedBarber();
    const service = getSelectedService();
    const depositPolicy = getActiveDepositPolicy();
    const depositRequired = Boolean(depositPolicy.requireDeposit && depositPolicy.depositAmount > 0);
    const depositAmount = depositRequired ? Number(depositPolicy.depositAmount.toFixed(2)) : 0;
    const dateYmd = String(bookingDate?.value ?? "");
    const dateValidation = getBookingDateValidation(dateYmd);
    const clientName = String(clientNameInput?.value ?? "").trim();
    const clientContact = String(clientContactInput?.value ?? "").trim();

    if (!shop) {
      setStatus("Please select a shop.", false);
      return;
    }
    if (!barber) {
      setStatus("Please select a barber.", false);
      return;
    }
    if (!service) {
      setStatus("Please select a service.", false);
      return;
    }
    if (!dateYmd) {
      setStatus("Please select a date.", false);
      return;
    }
    if (!dateValidation.valid) {
      setStatus(dateValidation.message, false);
      renderSlots();
      return;
    }
    if (!selectedSlotValue) {
      setStatus("Please select a time slot.", false);
      return;
    }
    if (!clientName) {
      setStatus("Client name is required.", false);
      return;
    }
    if (!clientContact) {
      setStatus("Client contact is required.", false);
      return;
    }
    if (depositRequired && !depositAcknowledge?.checked) {
      setStatus("Please acknowledge the deposit policy before booking.", false);
      return;
    }

    if (!isLoggedInCustomer) {
      saveClientSession(clientName, clientContact);
      activeClientIdentity = getActiveClientIdentity();
    }

    const availableNow = generateAvailableSlots({
      barberUsername: barber.username,
      dateYmd,
      durationMinutes: service.durationMinutes,
    });
    const availableIsoNow = availableNow
      .map((slotTime) => parseLocalDateTime(dateYmd, slotTime))
      .filter((value) => value instanceof Date)
      .map((value) => value.toISOString());

    if (!availableIsoNow.includes(selectedSlotValue)) {
      setStatus("That slot is no longer available. Please choose another slot.", false);
      renderSlots();
      return;
    }

    const start = new Date(selectedSlotValue);
    if (!Number.isFinite(start.getTime())) {
      setStatus("Invalid slot selection.", false);
      return;
    }
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    const ownerUsername = barber.username;

    const booking = {
      id: createId(),
      shopId: shop.id,
      ownerUsername,
      barberUsername: ownerUsername,
      barberDisplayName: barber.displayName,
      shopName: shop.name,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      price: Number(service.price.toFixed(2)),
      clientName,
      clientContact,
      depositRequired,
      depositAmount,
      depositStatus: depositRequired ? "unpaid" : "not_required",
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      status: "booked",

      // Compatibility fields used by some existing pages/scripts.
      customerUsername: currentUsername || clientName,
      date: toYmd(start),
      time: minutesToHhmm(start.getHours() * 60 + start.getMinutes()),
      startAtISO: start.toISOString(),
      createdAtISO: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);
    setLastBookingId(booking.id);

    showToast?.("Booked!", "success");
    selectedSlotValue = "";
    if (depositAcknowledge) depositAcknowledge.checked = false;
    renderDepositPolicyNotice();
    renderSlots();
    renderClientAppointments();
    renderLastBookingPrompt();
    renderBookingReceipt(booking);
    queueBookingNotification("booking", {
      booking,
      manageLink: buildClientManageLink(booking, getConfirmationCode(booking.id)),
    });
  }

  function renderClientAppointments() {
    activeClientIdentity = getActiveClientIdentity();
    if (!activeClientIdentity) {
      renderNextAppointment(null);
      renderMissingIdentityState();
      return;
    }

    const nowTs = Date.now();
    const clientBookings = getBookings()
      .filter((booking) => isBookingForActiveClient(booking))
      .map((booking) => {
        const start = getBookingStartDate(booking);
        const end = getBookingEndDate(booking);
        return { ...booking, _start: start, _end: end };
      })
      .filter((booking) => booking._start instanceof Date && Number.isFinite(booking._start.getTime()));

    const upcoming = clientBookings
      .filter((booking) => isScheduledStatus(booking?.status))
      .filter((booking) => booking._start.getTime() >= nowTs)
      .sort((a, b) => a._start.getTime() - b._start.getTime());

    const past = clientBookings
      .filter((booking) => {
        const status = normalizeAppointmentStatus(booking?.status);
        if (status === "cancelled" || status === "completed" || status === "no-show") return true;
        if (isScheduledStatus(status)) return booking._start.getTime() < nowTs;
        return booking._start.getTime() < nowTs;
      })
      .sort((a, b) => b._start.getTime() - a._start.getTime());

    renderNextAppointment(upcoming[0] || null);
    renderAppointmentList(upcomingList, upcomingEmptyState, upcoming, true);
    renderAppointmentList(pastList, pastEmptyState, past, false);
  }

  function renderMissingIdentityState() {
    const promptMarkup = `
      <section class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">S</span>
        <h3>Book an appointment first</h3>
        <p>We could not find your client session yet.</p>
        <a href="#bookingPanel" class="btn btn-ghost empty-state-cta">Go to booking flow</a>
      </section>
    `;

    if (upcomingList) upcomingList.innerHTML = promptMarkup;
    if (pastList) pastList.innerHTML = "";
    upcomingEmptyState?.classList.add("hidden");
    pastEmptyState?.classList.add("hidden");
  }

  function isBookingForActiveClient(booking) {
    if (!activeClientIdentity) return false;

    if (activeClientIdentity.mode === "username") {
      return String(booking.customerUsername ?? "").trim() === activeClientIdentity.username;
    }

    const bookingContact = normalizeContact(String(booking.clientContact ?? ""));
    const bookingName = String(booking.clientName ?? "").trim().toLowerCase();
    const identityContact = normalizeContact(activeClientIdentity.clientContact);
    const identityName = String(activeClientIdentity.clientName ?? "").trim().toLowerCase();

    if (identityContact && bookingContact === identityContact) return true;
    if (identityName && bookingName && bookingName === identityName) return true;
    return false;
  }

  function normalizeContact(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function getBookingStartDate(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const start = new Date(startIso);
      if (Number.isFinite(start.getTime())) return start;
    }

    const date = String(booking?.date ?? "").trim();
    const time = normalizeTime(String(booking?.time ?? "").trim());
    return parseLocalDateTime(date, time);
  }

  function getBookingEndDate(booking) {
    const endIso = String(booking?.endISO ?? "").trim();
    if (endIso) {
      const end = new Date(endIso);
      if (Number.isFinite(end.getTime())) return end;
    }

    const start = getBookingStartDate(booking);
    const duration = Number(booking?.durationMinutes ?? 0);
    if (!(start instanceof Date) || !Number.isFinite(start.getTime()) || !Number.isFinite(duration)) return null;
    return new Date(start.getTime() + Math.max(1, Math.round(duration)) * 60 * 1000);
  }

  function renderNextAppointment(booking) {
    if (!nextAppointmentDetails || !nextAppointmentEmptyState) return;
    if (!booking) {
      nextAppointmentDetails.classList.add("hidden");
      nextAppointmentEmptyState.classList.remove("hidden");
      return;
    }

    nextAppointmentService.textContent = String(booking.serviceName ?? "Service");
    nextAppointmentDate.textContent = formatDateFriendly(booking._start);
    nextAppointmentTime.textContent = formatDateLocalTime(booking._start);
    if (nextAppointmentStatus) {
      const status = normalizeAppointmentStatus(booking?.status);
      nextAppointmentStatus.textContent = getAppointmentStatusLabel(status);
      nextAppointmentStatus.className = `badge ${getAppointmentStatusBadgeClass(status)}`;
    }
    nextAppointmentDetails.classList.remove("hidden");
    nextAppointmentEmptyState.classList.add("hidden");
  }

  function renderAppointmentList(container, emptyState, rows, allowCancel) {
    if (!container) return;
    container.innerHTML = "";
    emptyState?.classList.toggle("hidden", rows.length > 0);

    rows.forEach((booking) => {
      const start = booking._start;
      const end = booking._end instanceof Date ? booking._end : null;
      const card = document.createElement("article");
      card.className = "appointment-row";

      const startTime = formatDateLocalTime(start);
      const endTime = end && Number.isFinite(end.getTime())
        ? formatDateLocalTime(end)
        : "";
      const statusValue = normalizeAppointmentStatus(booking?.status);
      const statusLabel = getAppointmentStatusLabel(statusValue);
      const statusClass = getAppointmentStatusBadgeClass(statusValue);
      const cancellation = getBookingCancellationState(booking);
      const canCancel = allowCancel && isScheduledStatus(statusValue) && cancellation.canCancel;
      const canDownloadCalendar = allowCancel && isScheduledStatus(statusValue);
      const servicePrice = Number(booking.price ?? 0);
      const durationMinutes = Number(booking.durationMinutes ?? 0);

      card.innerHTML = `
        <div class="appointment-main">${escapeHtml(String(booking.serviceName ?? "Service"))}</div>
        <div class="appointment-datetime">
          <span>${escapeHtml(formatDateFriendly(start))}</span>
          <span>${escapeHtml(startTime)}${endTime ? ` - ${escapeHtml(endTime)}` : ""}</span>
          <span class="small">${escapeHtml(`$${servicePrice.toFixed(2)} | ${durationMinutes} min`)}</span>
          <span class="small">${escapeHtml(`Barber: ${getBookingBarberLabel(booking) || "N/A"}`)}</span>
          <span class="small">${escapeHtml(`Shop: ${getBookingShopLabel(booking) || "N/A"}`)}</span>
          <span class="small">${escapeHtml(`Contact: ${String(booking.clientContact ?? "")}`)}</span>
          ${allowCancel && isScheduledStatus(statusValue)
            ? `<span class="small">${escapeHtml(cancellation.message)}</span>`
            : ""}
        </div>
        <div class="appointment-actions">
          <span class="badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
          ${canDownloadCalendar ? `<button type="button" class="btn btn-ghost btn-compact" data-action="download-calendar" data-id="${escapeHtml(String(booking.id ?? ""))}">Add to Calendar</button>` : ""}
          ${allowCancel && isScheduledStatus(statusValue)
            ? `<button type="button" class="btn btn-ghost btn-compact" data-action="cancel-self" data-id="${escapeHtml(String(booking.id ?? ""))}" ${canCancel ? "" : "disabled"} title="${escapeHtml(cancellation.message)}">Cancel</button>`
            : ""}
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('button[data-action="download-calendar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = String(btn.getAttribute("data-id") ?? "");
        if (!id) return;
        const booking = getBookingById(id) || rows.find((row) => String(row?.id ?? "") === id) || null;
        const errorMessage = downloadIcs(booking);
        if (errorMessage) setStatus(errorMessage, false);
      });
    });

    container.querySelectorAll('button[data-action="cancel-self"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = String(btn.getAttribute("data-id") ?? "");
        if (!id) return;
        cancelSelfBooking(id);
      });
    });
  }

  function getBookingBarberLabel(booking) {
    const explicit = String(booking?.barberDisplayName ?? "").trim();
    if (explicit) return explicit;

    const username = String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
    if (!username) return "";

    const user = getUsersSource().find((item) => String(item?.username ?? "") === username);
    return String(user?.displayName ?? user?.username ?? username).trim() || username;
  }

  function getBookingShopLabel(booking) {
    const explicit = String(booking?.shopName ?? "").trim();
    if (explicit) return explicit;

    const shopId = String(booking?.shopId ?? "").trim();
    if (!shopId) return "";
    const shop = getShopByIdSource(shopId);
    return String(shop?.name ?? "").trim();
  }

  function cancelSelfBooking(id) {
    const result = cancelBookingById(id);
    if (!result.ok) {
      setStatus(result.message, false);
      return;
    }
    setStatus("Appointment cancelled.", true);
    showToast?.("Appointment cancelled.", "success");
    renderSlots();
    renderClientAppointments();
    renderLastBookingPrompt();

    if (receiptSection && !receiptSection.classList.contains("hidden")) {
      const visibleBookingId = String(receiptSection.dataset.bookingId ?? "").trim();
      if (visibleBookingId && visibleBookingId === String(result.booking?.id ?? "")) {
        renderBookingReceipt(result.booking);
        setReceiptSuccess("Appointment cancelled.");
      }
    }
  }

  function cancelBookingById(id) {
    const targetId = String(id ?? "").trim();
    if (!targetId) {
      return { ok: false, message: "Appointment not found." };
    }

    const targetBooking = getBookingById(targetId);
    if (!targetBooking) {
      return { ok: false, message: "Appointment not found." };
    }

    const cancellation = getBookingCancellationState(targetBooking);
    if (!cancellation.canCancel) {
      return { ok: false, message: cancellation.message };
    }

    let didCancel = false;
    let previousBooking = null;
    const bookings = getBookings().map((booking) => {
      if (String(booking?.id ?? "") !== targetId) return booking;
      const nextState = getBookingCancellationState(booking);
      if (!nextState.canCancel) return booking;
      didCancel = true;
      previousBooking = { ...booking };
      return {
        ...booking,
        status: "cancelled",
        updatedAtISO: new Date().toISOString(),
      };
    });

    if (!didCancel) {
      return {
        ok: false,
        message: cancellation.message,
      };
    }

    saveBookings(bookings);
    return {
      ok: true,
      message: "",
      previousBooking,
      booking: getBookingById(targetId) || { ...targetBooking, status: "cancelled" },
    };
  }

  function getBookingCancellationState(booking) {
    const bookingPolicy = getShopBookingPolicy(booking?.shopId);
    const cancellationHours = normalizeBookingPolicy(bookingPolicy).cancelHours;
    const fallback = {
      canCancel: false,
      cutoffHours: cancellationHours,
      cutoffDate: null,
      message: `Cancellations must be made at least ${cancellationHours} hours before.`,
    };

    if (!booking || typeof booking !== "object") return fallback;
    const status = normalizeAppointmentStatus(booking?.status);
    if (!isScheduledStatus(status)) {
      return {
        ...fallback,
        message: "Only booked or confirmed appointments can be cancelled.",
      };
    }

    const start = getBookingStartDate(booking);
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) {
      return {
        ...fallback,
        message: "Appointment start time is missing.",
      };
    }

    const cutoffDate = new Date(start.getTime() - cancellationHours * 60 * 60 * 1000);
    if (Date.now() >= cutoffDate.getTime()) {
      return {
        canCancel: false,
        cutoffHours: cancellationHours,
        cutoffDate,
        message: `Cancellations must be made at least ${cancellationHours} hours before.`,
      };
    }

    return {
      canCancel: true,
      cutoffHours: cancellationHours,
      cutoffDate,
      message: `You can cancel until ${formatDateFriendly(cutoffDate)} at ${formatDateLocalTime(cutoffDate)}.`,
    };
  }

  function getManageCancellationHint(booking, cancellation) {
    const status = normalizeAppointmentStatus(booking?.status);
    if (status === "cancelled") return "This appointment has been cancelled.";
    if (status === "completed") return "This appointment is completed.";
    if (status === "no-show") return "This appointment was marked no-show.";
    if (cancellation?.message) {
      return cancellation.message;
    }
    return "Cancellation policy unavailable.";
  }

  function parseYmd(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [yyyy, mm, dd] = raw.split("-").map(Number);
    const date = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
    if (
      date.getFullYear() !== yyyy ||
      date.getMonth() !== mm - 1 ||
      date.getDate() !== dd
    ) {
      return null;
    }
    return date;
  }

  function parseLocalDateTime(dateYmd, timeHhmm) {
    const date = parseYmd(dateYmd);
    const minuteOfDay = hhmmToMinutes(timeHhmm);
    if (!date || !Number.isFinite(minuteOfDay)) return null;
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  }

  function hhmmToMinutes(value) {
    const time = normalizeTime(String(value ?? ""));
    if (!/^\d{2}:\d{2}$/.test(time)) return NaN;
    const [hh, mm] = time.split(":").map(Number);
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
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    return "";
  }

  function formatTime(time24) {
    const minutes = hhmmToMinutes(time24);
    if (!Number.isFinite(minutes)) return "";
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    const suffix = hh >= 12 ? "PM" : "AM";
    const hour12 = ((hh + 11) % 12) + 1;
    return `${hour12}:${String(mm).padStart(2, "0")} ${suffix}`;
  }

  function toYmd(date) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `b_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function updateBookButtonState() {
    if (!bookBtn) return;
    bookBtn.disabled = !selectedSlotValue
      || isDepositAcknowledgementRequired()
      || !getBookingDateValidation().valid;
  }

  function normalizeAppointmentStatus(statusValue) {
    const status = String(statusValue ?? "booked").trim().toLowerCase();
    if (status === "confirmed") return "confirmed";
    if (status === "completed") return "completed";
    if (status === "cancelled") return "cancelled";
    if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
    return "booked";
  }

  function isScheduledStatus(statusValue) {
    const status = normalizeAppointmentStatus(statusValue);
    return status === "booked" || status === "confirmed";
  }

  function getAppointmentStatusLabel(statusValue) {
    const status = normalizeAppointmentStatus(statusValue);
    if (status === "confirmed") return "Confirmed";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "no-show") return "No-show";
    return "Booked";
  }

  function getAppointmentStatusBadgeClass(statusValue) {
    const status = normalizeAppointmentStatus(statusValue);
    if (status === "confirmed") return "badge-success";
    if (status === "completed") return "badge-success";
    if (status === "cancelled") return "badge-danger";
    if (status === "no-show") return "badge-danger";
    return "badge-warning";
  }

  function getBookingDepositDetails(booking) {
    const required = Boolean(booking?.depositRequired);
    const amountRaw = Number(booking?.depositAmount ?? 0);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0
      ? Number(amountRaw.toFixed(2))
      : 0;
    const status = required
      ? String(booking?.depositStatus ?? "unpaid").trim().toLowerCase() || "unpaid"
      : "not_required";

    return {
      required,
      amount,
      status,
    };
  }

  function formatDepositStatusLabel(status) {
    const normalized = String(status ?? "").trim().toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "waived") return "Waived";
    if (normalized === "not_required") return "Not required";
    return "Unpaid";
  }

  function formatCurrency(value) {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  function formatDurationLabel(durationMinutes) {
    const duration = Number(durationMinutes ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) return "Duration unavailable";
    return `${Math.round(duration)} min`;
  }

  function setStatus(message, success) {
    if (!bookingStatus) return;
    bookingStatus.textContent = String(message ?? "");
    bookingStatus.setAttribute("role", success ? "status" : "alert");
    bookingStatus.setAttribute("aria-live", success ? "polite" : "assertive");
    bookingStatus.setAttribute("aria-atomic", "true");
    bookingStatus.classList.remove("status-success", "status-error");
    bookingStatus.classList.add(success ? "status-success" : "status-error");
  }

  function clearStatus() {
    if (!bookingStatus) return;
    bookingStatus.textContent = "";
    bookingStatus.setAttribute("role", "status");
    bookingStatus.setAttribute("aria-live", "polite");
    bookingStatus.setAttribute("aria-atomic", "true");
    bookingStatus.classList.remove("status-success", "status-error");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateLocalTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatDateFriendly(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatSummaryDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatReceiptTimeRange(start, end) {
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return "Time unavailable";
    const startLabel = formatDateLocalTime(start);
    if (!(end instanceof Date) || !Number.isFinite(end.getTime())) return startLabel;
    return `${startLabel} - ${formatDateLocalTime(end)}`;
  }
}
