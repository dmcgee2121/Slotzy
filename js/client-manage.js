import * as dataStore from "./dataStore.js";
import { buildBookingNotificationPayload, postBookingNotification } from "./booking-notifications.js";

(function () {
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  const LAST_MANAGE_LINK_KEY = "Slotzy_lastManageLink";
  const SLOT_INCREMENT_MINUTES = 15;
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  const manageHeaderShopName = document.getElementById("manageHeaderShopName");
  const manageIdentitySummary = document.getElementById("manageIdentitySummary");
  const manageStatus = document.getElementById("manageStatus");
  const manageContinueCard = document.getElementById("manageContinueCard");
  const manageContinueLink = document.getElementById("manageContinueLink");
  const manageUpcomingSection = document.getElementById("manageUpcomingSection");
  const manageUpcomingList = document.getElementById("manageUpcomingList");
  const manageUpcomingEmpty = document.getElementById("manageUpcomingEmpty");
  const managePastSection = document.getElementById("managePastSection");
  const managePastList = document.getElementById("managePastList");
  const managePastEmpty = document.getElementById("managePastEmpty");
  const clientRescheduleModal = document.getElementById("clientRescheduleModal");
  const clientRescheduleSummary = document.getElementById("clientRescheduleSummary");
  const clientRescheduleDate = document.getElementById("clientRescheduleDate");
  const clientReschedulePolicyHint = document.getElementById("clientReschedulePolicyHint");
  const clientRescheduleSlot = document.getElementById("clientRescheduleSlot");
  const clientRescheduleEmpty = document.getElementById("clientRescheduleEmpty");
  const clientRescheduleStatus = document.getElementById("clientRescheduleStatus");
  const clientRescheduleConfirm = document.getElementById("clientRescheduleConfirm");
  const clientRescheduleClose = document.getElementById("clientRescheduleClose");
  const showToast = window.showToast;

  let currentQuery = {
    shopSlug: "",
    contact: "",
    code: "",
  };
  let currentShop = null;
  let userMapByUsername = new Map();
  let rescheduleBookingId = "";
  let rescheduleLoadToken = 0;
  let pendingCancelBookingId = "";

  document.addEventListener("DOMContentLoaded", initClientManagePage);

  function initClientManagePage() {
    bindEvents();
    renderClientManagePage();
  }

  function bindEvents() {
    manageContinueLink?.addEventListener("click", (event) => {
      const href = String(manageContinueLink.getAttribute("href") ?? "").trim();
      if (!href || href === "#") {
        event.preventDefault();
      }
    });

    manageUpcomingList?.addEventListener("click", handleAppointmentAction);
    managePastList?.addEventListener("click", handleAppointmentAction);
    clientRescheduleDate?.addEventListener("change", handleRescheduleDateChange);
    clientRescheduleSlot?.addEventListener("change", updateRescheduleConfirmState);
    clientRescheduleConfirm?.addEventListener("click", handleRescheduleConfirm);
    clientRescheduleClose?.addEventListener("click", closeRescheduleModal);
    clientRescheduleModal?.addEventListener("click", (event) => {
      if (event.target === clientRescheduleModal) {
        closeRescheduleModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (clientRescheduleModal?.classList.contains("hidden")) return;
      closeRescheduleModal();
    });
    window.addEventListener("storage", handleStorageSync);
    window.addEventListener(BOOKING_SYNC_EVENT, renderClientManagePage);
  }

  async function renderClientManagePage() {
    currentQuery = getManageQueryState();
    renderContinueCard();

    if (!currentQuery.shopSlug || !currentQuery.contact) {
      currentShop = null;
      closeRescheduleModal();
      setHeaderShopName("Slotzy");
      manageIdentitySummary.textContent = "Open your manage link from the booking receipt to see your appointments.";
      hideAppointmentSections();
      if (getStoredManageLink()) {
        clearStatus();
      } else {
        setStatus("A manage link is required to view appointments.", false);
      }
      return;
    }

    try {
      const [shops, users, bookings] = await Promise.all([
        dataStore.getShopsAsync(),
        dataStore.getUsersAsync(),
        dataStore.getBookingsAsync(),
      ]);

      const normalizedShops = Array.isArray(shops)
        ? shops.map((shop) => normalizeShop(shop))
        : [];
      userMapByUsername = new Map(
        (Array.isArray(users) ? users : []).map((user) => [
          String(user?.username ?? "").trim(),
          {
            username: String(user?.username ?? "").trim(),
            displayName: String(user?.displayName ?? user?.username ?? "").trim() || String(user?.username ?? "").trim(),
          },
        ])
      );

      currentShop = normalizedShops.find((shop) => shop.slug === currentQuery.shopSlug) || null;
      if (!currentShop) {
        closeRescheduleModal();
        setHeaderShopName("Shop not found");
        manageIdentitySummary.textContent = "";
        hideAppointmentSections();
        setStatus(`We could not find a shop for "${currentQuery.shopSlug}".`, false);
        return;
      }

      setHeaderShopName(currentShop.name);
      manageIdentitySummary.textContent = `Showing appointments for ${decodeURIComponentSafe(currentQuery.contact)} at ${currentShop.name}.`;
      storeCurrentManageLink();

      const rows = getAccessibleBookings(bookings)
        .map((booking) => decorateBooking(booking, currentShop))
        .sort((left, right) => left.start.getTime() - right.start.getTime());

      const now = Date.now();
      const upcoming = rows.filter((booking) => booking.start.getTime() >= now && isScheduledStatus(booking.status));
      const past = rows
        .filter((booking) => !(booking.start.getTime() >= now && isScheduledStatus(booking.status)))
        .sort((left, right) => right.start.getTime() - left.start.getTime());

      showAppointmentSections();
      renderAppointmentList({
        container: manageUpcomingList,
        emptyState: manageUpcomingEmpty,
        rows: upcoming,
      });
      renderAppointmentList({
        container: managePastList,
        emptyState: managePastEmpty,
        rows: past,
      });

      if (rescheduleBookingId && !rows.some((booking) => booking.id === rescheduleBookingId)) {
        closeRescheduleModal();
      }

      clearStatus();
    } catch (error) {
      console.error("[Slotzy:client-manage] Failed to load appointments.", error);
      currentShop = null;
      closeRescheduleModal();
      hideAppointmentSections();
      setHeaderShopName("Slotzy");
      manageIdentitySummary.textContent = "";
      setStatus("Appointments are unavailable right now. Please refresh and try again.", false);
    }
  }

  function getManageQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
      shopSlug: normalizeSlug(params.get("shop")),
      contact: String(params.get("contact") ?? "").trim(),
      code: String(params.get("code") ?? "").trim().toUpperCase(),
    };
  }

  function renderContinueCard() {
    const storedLink = getStoredManageLink();
    if (!manageContinueCard || !manageContinueLink) return;
    if (!storedLink || (currentQuery.shopSlug && currentQuery.contact)) {
      manageContinueCard.classList.add("hidden");
      manageContinueLink.setAttribute("href", "#");
      return;
    }
    manageContinueLink.setAttribute("href", storedLink);
    manageContinueCard.classList.remove("hidden");
  }

  function hideAppointmentSections() {
    manageUpcomingSection?.classList.add("hidden");
    managePastSection?.classList.add("hidden");
    if (manageUpcomingList) manageUpcomingList.innerHTML = "";
    if (managePastList) managePastList.innerHTML = "";
  }

  function showAppointmentSections() {
    manageUpcomingSection?.classList.remove("hidden");
    managePastSection?.classList.remove("hidden");
  }

  function renderAppointmentList({ container, emptyState, rows }) {
    if (!container || !emptyState) return;
    container.innerHTML = "";
    emptyState.classList.toggle("hidden", rows.length > 0);

    rows.forEach((booking) => {
      const card = document.createElement("article");
      const highlightClass = currentQuery.code && booking.confirmationCode === currentQuery.code
        ? " client-manage-card-highlight"
        : "";
      card.className = `appointment-row client-manage-card${highlightClass}`;

      const rescheduleControl = booking.showRescheduleControl
        ? `<button type="button" class="btn btn-ghost btn-compact" data-action="reschedule-appointment" data-id="${escapeHtml(booking.id)}" ${booking.canReschedule ? "" : `disabled title="${escapeHtml(booking.reschedule.message)}"`}>Reschedule</button>`
        : "";
      const cancelControl = booking.canCancel
        ? (pendingCancelBookingId === booking.id
          ? `
            <button type="button" class="btn btn-danger btn-compact" data-action="confirm-cancel-appointment" data-id="${escapeHtml(booking.id)}">Confirm Cancel</button>
            <button type="button" class="btn btn-ghost btn-compact" data-action="dismiss-cancel-appointment" data-id="${escapeHtml(booking.id)}">Keep Appointment</button>
          `
          : `<button type="button" class="btn btn-ghost btn-compact" data-action="cancel-appointment" data-id="${escapeHtml(booking.id)}">Cancel</button>`)
        : "";

      card.innerHTML = `
        <div class="appointment-main client-manage-card-main">
          <div class="client-manage-card-title-row">
            <strong>${escapeHtml(booking.serviceName)}</strong>
            ${currentQuery.code && booking.confirmationCode === currentQuery.code
              ? `<span class="client-manage-latest-chip">Latest</span>`
              : ""}
          </div>
          <span class="small client-manage-code">Confirmation: ${escapeHtml(booking.confirmationCode)}</span>
        </div>
        <div class="appointment-datetime client-manage-card-meta">
          <span>${escapeHtml(formatDateFriendly(booking.start))}</span>
          <span>${escapeHtml(formatTimeRange(booking.start, booking.end))}</span>
          <span class="small">${escapeHtml(`${booking.barberLabel} | ${formatCurrency(booking.price)} | ${formatDuration(booking.durationMinutes)}`)}</span>
          <span class="small">${escapeHtml(`Status: ${booking.statusLabel}`)}</span>
          ${booking.showCancellationHint
            ? `<span class="small">${escapeHtml(booking.cancellation.message)}</span>`
            : ""}
          ${booking.showRescheduleHint
            ? `<span class="small client-manage-policy-note">${escapeHtml(booking.reschedule.message)}</span>`
            : ""}
          ${pendingCancelBookingId === booking.id
            ? `<span class="small client-manage-policy-note">Click "Confirm Cancel" to cancel this appointment.</span>`
            : ""}
        </div>
        <p class="small client-manage-policy-note">${escapeHtml(booking.changeRuleText)}</p>
        ${booking.reminderLine
          ? `<p class="small client-manage-policy-note">${escapeHtml(`Reminders: ${booking.reminderLine}`)}</p>`
          : ""}
        <div class="appointment-actions">
          <span class="badge ${escapeHtml(booking.statusClass)}">${escapeHtml(booking.statusLabel)}</span>
          ${rescheduleControl}
          ${cancelControl}
        </div>
      `;

      container.appendChild(card);
    });
  }

  async function handleAppointmentAction(event) {
    const actionButton = event.target.closest("button[data-action][data-id]");
    if (!actionButton) return;

    const action = String(actionButton.getAttribute("data-action") ?? "").trim();
    const bookingId = String(actionButton.getAttribute("data-id") ?? "").trim();
    if (!bookingId) return;

    if (action === "cancel-appointment") {
      pendingCancelBookingId = bookingId;
      clearRescheduleStatus();
      await renderClientManagePage();
      setStatus('Click "Confirm Cancel" to cancel this appointment.', false);
      return;
    }

    if (action === "dismiss-cancel-appointment") {
      if (pendingCancelBookingId === bookingId) {
        pendingCancelBookingId = "";
      }
      clearStatus();
      await renderClientManagePage();
      return;
    }

    if (action === "confirm-cancel-appointment") {
      await handleCancelAppointment(bookingId);
      return;
    }

    if (action === "reschedule-appointment") {
      await openRescheduleModal(bookingId);
    }
  }

  async function handleCancelAppointment(bookingId) {
    const currentRows = await dataStore.getBookingsAsync();
    const targetBooking = findAccessibleBooking(currentRows, bookingId);
    if (!targetBooking) {
      pendingCancelBookingId = "";
      await renderClientManagePage();
      setStatus("Appointment not found.", false);
      return;
    }

    const cancellation = getCancellationState(targetBooking, currentShop);
    if (!cancellation.canCancel) {
      pendingCancelBookingId = "";
      await renderClientManagePage();
      setStatus(cancellation.message, false);
      return;
    }

    const previousBooking = { ...targetBooking };

    const nextBookings = (Array.isArray(currentRows) ? currentRows : []).map((booking) => {
      if (String(booking?.id ?? "").trim() !== bookingId) return booking;
      if (!isBookingAccessibleToCurrentClient(booking)) return booking;
      return {
        ...booking,
        status: "cancelled",
        updatedAtISO: new Date().toISOString(),
      };
    });

    try {
      await dataStore.saveBookingsAsync(nextBookings, { manualNotify: true });
      pendingCancelBookingId = "";
      const nextBooking = findAccessibleBooking(nextBookings, bookingId) || { ...previousBooking, status: "cancelled" };
      const notifyResult = await notifyManageBooking("cancel", {
        booking: nextBooking,
        previousBooking,
      });
      await renderClientManagePage();
      const statusMessage = notifyResult?.ok
        ? "Appointment cancelled."
        : `Appointment cancelled. ${notifyResult?.offline ? "Email not sent (server offline)." : (String(notifyResult?.error ?? "").trim() || "Email not sent right now.")}`;
      setStatus(statusMessage, true);
      showToast?.("Appointment cancelled.", "success", 2000);
    } catch (error) {
      console.error("[Slotzy:client-manage] Could not cancel appointment.", error);
      setStatus("Could not cancel this appointment. Please try again.", false);
    }
  }

  async function openRescheduleModal(bookingId) {
    if (!clientRescheduleModal || !clientRescheduleDate || !clientRescheduleSlot) return;

    clearRescheduleStatus();
    resetRescheduleSlotState();

    try {
      const bookings = await dataStore.getBookingsAsync();
      const booking = findAccessibleBooking(bookings, bookingId);
      if (!booking) {
        setStatus("Appointment not found.", false);
        return;
      }

      const status = normalizeStatus(booking?.status);
      if (!isScheduledStatus(status)) {
        setStatus("Only booked or confirmed appointments can be rescheduled.", false);
        return;
      }

      const start = getBookingStartDate(booking);
      const end = getBookingEndDate(booking);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || Date.now() >= start.getTime()) {
        setStatus("Only future booked or confirmed appointments can be rescheduled.", false);
        return;
      }

      const reschedule = getRescheduleState(booking, currentShop);
      if (!reschedule.canReschedule) {
        setStatus(reschedule.message, false);
        return;
      }

      rescheduleBookingId = String(booking.id ?? "");
      const bounds = getBookingDateBounds(currentShop?.bookingPolicy);
      const currentDateYmd = toYmdLocal(start);
      const currentDateValidation = getBookingDateValidation(currentDateYmd, currentShop?.bookingPolicy);
      const initialDate = currentDateValidation.valid ? currentDateYmd : bounds.minYmd;

      if (clientRescheduleSummary) {
        clientRescheduleSummary.textContent = [
          `Current: ${formatDateFriendly(start)} ${formatTimeRange(start, end)}`,
          `Barber: ${getBarberLabel(booking)}`,
          `Service: ${String(booking?.serviceName ?? "Service")}`,
        ].join(" | ");
      }
      if (clientReschedulePolicyHint) {
        clientReschedulePolicyHint.textContent = getBookingDateHint(bounds);
      }

      clientRescheduleDate.min = bounds.minYmd;
      clientRescheduleDate.max = bounds.maxYmd;
      clientRescheduleDate.value = initialDate;
      clientRescheduleDate.setAttribute("aria-invalid", "false");

      showRescheduleModal();
      await populateRescheduleSlots();

      window.setTimeout(() => {
        clientRescheduleDate.focus();
      }, 0);
    } catch (error) {
      console.error("[Slotzy:client-manage] Could not open reschedule modal.", error);
      setStatus("Could not load reschedule options. Please try again.", false);
    }
  }

  function showRescheduleModal() {
    if (!clientRescheduleModal) return;
    clientRescheduleModal.classList.remove("hidden");
    clientRescheduleModal.classList.add("show");
    clientRescheduleModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeRescheduleModal() {
    if (!clientRescheduleModal) return;
    clientRescheduleModal.classList.remove("show");
    clientRescheduleModal.classList.add("hidden");
    clientRescheduleModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    rescheduleBookingId = "";
    rescheduleLoadToken += 1;
    clearRescheduleStatus();
    resetRescheduleSlotState();
  }

  function handleRescheduleDateChange() {
    clearRescheduleStatus();
    populateRescheduleSlots();
  }

  async function populateRescheduleSlots() {
    if (!clientRescheduleSlot || !clientRescheduleDate) return;

    const loadToken = ++rescheduleLoadToken;
    resetRescheduleSlotState();

    if (!rescheduleBookingId) {
      updateRescheduleConfirmState();
      return;
    }

    const dateYmd = String(clientRescheduleDate.value ?? "").trim();
    if (!dateYmd) {
      updateRescheduleConfirmState();
      return;
    }

    const validation = getBookingDateValidation(dateYmd, currentShop?.bookingPolicy);
    if (!validation.valid) {
      clientRescheduleDate.setAttribute("aria-invalid", "true");
      setRescheduleStatus(validation.message, false);
      updateRescheduleConfirmState();
      return;
    }
    clientRescheduleDate.setAttribute("aria-invalid", "false");

    try {
      const bookings = await dataStore.getBookingsAsync();
      if (loadToken !== rescheduleLoadToken) return;

      const booking = findAccessibleBooking(bookings, rescheduleBookingId);
      if (!booking) {
        setRescheduleStatus("Could not load this appointment for rescheduling.", false);
        updateRescheduleConfirmState();
        return;
      }

      const reschedule = getRescheduleState(booking, currentShop);
      if (!reschedule.canReschedule) {
        setRescheduleStatus(reschedule.message, false);
        updateRescheduleConfirmState();
        return;
      }

      const slotOptions = await buildRescheduleSlotOptions({
        booking,
        dateYmd,
        ignoreBookingId: booking.id,
        bookingsSource: bookings,
      });
      if (loadToken !== rescheduleLoadToken) return;

      if (slotOptions.length === 0) {
        clientRescheduleEmpty?.classList.remove("hidden");
        updateRescheduleConfirmState();
        return;
      }

      slotOptions.forEach((slot) => {
        const option = document.createElement("option");
        option.value = slot.startISO;
        option.textContent = slot.label;
        clientRescheduleSlot.appendChild(option);
      });
      clientRescheduleSlot.disabled = false;
      updateRescheduleConfirmState();
    } catch (error) {
      console.error("[Slotzy:client-manage] Could not load reschedule slots.", error);
      setRescheduleStatus("Available time slots are unavailable right now. Please try again.", false);
      updateRescheduleConfirmState();
    }
  }

  function resetRescheduleSlotState() {
    if (clientRescheduleSlot) {
      clientRescheduleSlot.innerHTML = '<option value="">Select a time...</option>';
      clientRescheduleSlot.value = "";
      clientRescheduleSlot.disabled = true;
    }
    clientRescheduleEmpty?.classList.add("hidden");
    updateRescheduleConfirmState();
  }

  function updateRescheduleConfirmState() {
    if (!clientRescheduleConfirm || !clientRescheduleSlot) return;
    const hasSlot = Boolean(String(clientRescheduleSlot.value ?? "").trim());
    clientRescheduleConfirm.disabled = !rescheduleBookingId || !hasSlot || clientRescheduleSlot.disabled;
  }

  async function handleRescheduleConfirm() {
    clearRescheduleStatus();

    if (!rescheduleBookingId) {
      setRescheduleStatus("No appointment selected.", false);
      return;
    }

    const dateYmd = String(clientRescheduleDate?.value ?? "").trim();
    const requestedStartISO = String(clientRescheduleSlot?.value ?? "").trim();
    if (!dateYmd) {
      setRescheduleStatus("Please choose a date.", false);
      return;
    }
    if (!requestedStartISO) {
      setRescheduleStatus("Please choose a time slot.", false);
      return;
    }

    const validation = getBookingDateValidation(dateYmd, currentShop?.bookingPolicy);
    if (!validation.valid) {
      setRescheduleStatus(validation.message, false);
      return;
    }

    try {
      const bookings = await dataStore.getBookingsAsync();
      const booking = findAccessibleBooking(bookings, rescheduleBookingId);
      if (!booking) {
        setRescheduleStatus("Appointment not found. Please refresh and try again.", false);
        return;
      }

      const reschedule = getRescheduleState(booking, currentShop);
      if (!reschedule.canReschedule) {
        setRescheduleStatus(reschedule.message, false);
        return;
      }

      const slotOptions = await buildRescheduleSlotOptions({
        booking,
        dateYmd,
        ignoreBookingId: booking.id,
        bookingsSource: bookings,
      });
      const selectedSlot = slotOptions.find((slot) => isSameInstant(slot.startISO, requestedStartISO));
      if (!selectedSlot) {
        setRescheduleStatus("That time is no longer available. Please choose another slot.", false);
        await populateRescheduleSlots();
        return;
      }

      const start = new Date(selectedSlot.startISO);
      const durationMinutes = getDurationMinutes(booking);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
        setRescheduleStatus("Invalid appointment time range.", false);
        return;
      }

      const nextBookings = (Array.isArray(bookings) ? bookings : []).map((entry) => {
        if (String(entry?.id ?? "").trim() !== rescheduleBookingId) return entry;
        if (!isBookingAccessibleToCurrentClient(entry)) return entry;
        return {
          ...entry,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          startAtISO: start.toISOString(),
          date: toYmdLocal(start),
          time: minutesToHhmm(start.getHours() * 60 + start.getMinutes()),
          durationMinutes,
        };
      });

      await dataStore.saveBookingsAsync(nextBookings, { manualNotify: true });
      const nextBooking = findAccessibleBooking(nextBookings, rescheduleBookingId) || {
        ...booking,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      };
      const notifyResult = await notifyManageBooking("reschedule", {
        booking: nextBooking,
        previousBooking: booking,
      });
      closeRescheduleModal();
      await renderClientManagePage();
      const statusMessage = notifyResult?.ok
        ? "Appointment rescheduled."
        : `Appointment rescheduled. ${notifyResult?.offline ? "Email not sent (server offline)." : (String(notifyResult?.error ?? "").trim() || "Email not sent right now.")}`;
      setStatus(statusMessage, true);
      showToast?.("Appointment rescheduled", "success", 2000);
    } catch (error) {
      console.error("[Slotzy:client-manage] Could not reschedule appointment.", error);
      setRescheduleStatus("Could not reschedule this appointment. Please try again.", false);
    }
  }

  function handleStorageSync(event) {
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderClientManagePage();
  }

  function getAccessibleBookings(bookings) {
    return (Array.isArray(bookings) ? bookings : []).filter((booking) => isBookingAccessibleToCurrentClient(booking));
  }

  function findAccessibleBooking(bookings, bookingId) {
    const targetId = String(bookingId ?? "").trim();
    return getAccessibleBookings(bookings).find((booking) => String(booking?.id ?? "").trim() === targetId) || null;
  }

  function isBookingAccessibleToCurrentClient(booking) {
    if (!currentShop) return false;
    const shopId = String(booking?.shopId ?? "").trim();
    if (shopId !== currentShop.id) return false;

    const currentContact = normalizeContact(currentQuery.contact);
    const bookingContact = normalizeContact(String(booking?.clientContact ?? ""));
    return Boolean(currentContact) && bookingContact === currentContact;
  }

  function decorateBooking(booking, shop) {
    const start = getBookingStartDate(booking);
    const end = getBookingEndDate(booking);
    const status = normalizeStatus(booking?.status);
    const cancellation = getCancellationState(booking, shop);
    const reschedule = getRescheduleState(booking, shop);
    const policy = normalizeBookingPolicy(shop?.bookingPolicy);
    const isFuture = Number.isFinite(start.getTime()) && start.getTime() > Date.now();
    const showRescheduleControl = isFuture && isScheduledStatus(status);
    return {
      id: String(booking?.id ?? "").trim(),
      serviceName: String(booking?.serviceName ?? "Service").trim() || "Service",
      durationMinutes: getDurationMinutes(booking),
      price: Number(booking?.price ?? 0),
      start,
      end,
      status,
      statusLabel: getStatusLabel(status),
      statusClass: getStatusBadgeClass(status),
      barberLabel: getBarberLabel(booking),
      confirmationCode: getConfirmationCode(String(booking?.id ?? "")),
      canCancel: isScheduledStatus(status) && cancellation.canCancel,
      showCancellationHint: true,
      cancellation,
      canReschedule: showRescheduleControl && reschedule.canReschedule,
      showRescheduleControl,
      showRescheduleHint: showRescheduleControl && !reschedule.canReschedule,
      reschedule,
      changeRuleText: `Changes must be made at least ${policy.cancelHours} hour${policy.cancelHours === 1 ? "" : "s"} before.`,
      reminderLine: isFuture && isScheduledStatus(status) ? formatReminderSchedule(policy) : "",
    };
  }

  function getBookingStartDate(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const parsed = new Date(startIso);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }

    const dateText = String(booking?.date ?? "").trim();
    const timeText = normalizeTime(String(booking?.time ?? "").trim());
    const parsed = parseLocalDateTime(dateText, timeText);
    return parsed || new Date(NaN);
  }

  function getBookingEndDate(booking) {
    const endIso = String(booking?.endISO ?? "").trim();
    if (endIso) {
      const parsed = new Date(endIso);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    const start = getBookingStartDate(booking);
    const duration = getDurationMinutes(booking);
    if (!Number.isFinite(start.getTime()) || duration <= 0) {
      return new Date(NaN);
    }
    return new Date(start.getTime() + duration * 60 * 1000);
  }

  function getCancellationState(booking, shop) {
    const policy = normalizeBookingPolicy(shop?.bookingPolicy);
    const cancellationHours = policy.cancelHours;
    const fallback = {
      canCancel: false,
      message: `Cancellations must be made at least ${cancellationHours} hours before.`,
    };

    const status = normalizeStatus(booking?.status);
    if (!isScheduledStatus(status)) {
      return {
        canCancel: false,
        message: "Only booked or confirmed appointments can be cancelled.",
      };
    }

    const start = getBookingStartDate(booking);
    if (!Number.isFinite(start.getTime())) return fallback;

    const cutoffDate = new Date(start.getTime() - cancellationHours * 60 * 60 * 1000);
    if (Date.now() >= cutoffDate.getTime()) {
      return fallback;
    }

    return {
      canCancel: true,
      message: `You can cancel until ${formatDateFriendly(cutoffDate)} at ${formatTimeLabel(cutoffDate)}.`,
    };
  }

  function getRescheduleState(booking, shop) {
    const policy = normalizeBookingPolicy(shop?.bookingPolicy);
    const cancellationHours = policy.cancelHours;
    const fallback = {
      canReschedule: false,
      message: `Rescheduling must be at least ${cancellationHours} hours before.`,
    };

    const status = normalizeStatus(booking?.status);
    if (!isScheduledStatus(status)) {
      return {
        canReschedule: false,
        message: "Only booked or confirmed appointments can be rescheduled.",
      };
    }

    const start = getBookingStartDate(booking);
    if (!Number.isFinite(start.getTime())) return fallback;
    if (Date.now() >= start.getTime()) {
      return {
        canReschedule: false,
        message: "Only future booked or confirmed appointments can be rescheduled.",
      };
    }

    const cutoffDate = new Date(start.getTime() - cancellationHours * 60 * 60 * 1000);
    if (Date.now() >= cutoffDate.getTime()) {
      return fallback;
    }

    return {
      canReschedule: true,
      message: `You can reschedule until ${formatDateFriendly(cutoffDate)} at ${formatTimeLabel(cutoffDate)}.`,
    };
  }

  async function buildRescheduleSlotOptions({ booking, dateYmd, ignoreBookingId, bookingsSource }) {
    const targetBooking = booking && typeof booking === "object" ? booking : null;
    if (!targetBooking) return [];

    const date = parseYmd(dateYmd);
    const durationMinutes = getDurationMinutes(targetBooking);
    const barberUsername = getSchedulingUsername(targetBooking);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !barberUsername || durationMinutes <= 0) {
      return [];
    }

    const availability = await getAvailability(barberUsername);
    if (!availability) return [];

    const dayKey = DAY_KEYS[date.getDay()];
    const day = availability.weekly[dayKey];
    if (!day || day.enabled !== true) return [];

    const dayStartMin = hhmmToMinutes(day.start);
    const dayEndMin = hhmmToMinutes(day.end);
    if (!Number.isFinite(dayStartMin) || !Number.isFinite(dayEndMin) || dayStartMin >= dayEndMin) {
      return [];
    }

    const bookedWindows = await getBookedWindowsForBarber({
      barberUsername,
      bufferMinutes: availability.bufferMinutes,
      ignoreBookingId,
      bookingsSource,
      shopId: String(targetBooking?.shopId ?? currentShop?.id ?? "").trim(),
    });
    const timeOffWindows = getTimeOffWindows(availability);
    const nowTs = Date.now();
    const options = [];

    for (let startMin = dayStartMin; startMin + durationMinutes <= dayEndMin; startMin += SLOT_INCREMENT_MINUTES) {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, startMin, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      if (start.getTime() < nowTs) continue;
      if (overlapsAnyWindow(start, end, bookedWindows)) continue;
      if (overlapsAnyWindow(start, end, timeOffWindows)) continue;

      options.push({
        startISO: start.toISOString(),
        label: `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      });
    }

    return options;
  }

  async function getAvailability(barberUsername) {
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

    const parsed = await dataStore.getAvailabilityForBarberAsync(key);
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

  async function getBookedWindowsForBarber({
    barberUsername,
    bufferMinutes,
    ignoreBookingId,
    bookingsSource,
    shopId,
  }) {
    const bookings = Array.isArray(bookingsSource) ? bookingsSource : await dataStore.getBookingsAsync();
    const targetBarber = String(barberUsername ?? "").trim();
    const ignoredId = String(ignoreBookingId ?? "").trim();
    const targetShopId = String(shopId ?? "").trim();

    return (Array.isArray(bookings) ? bookings : [])
      .filter((booking) => isScheduledStatus(booking?.status))
      .filter((booking) => String(getSchedulingUsername(booking) ?? "") === targetBarber)
      .filter((booking) => {
        if (!targetShopId) return true;
        return String(booking?.shopId ?? "").trim() === targetShopId;
      })
      .filter((booking) => String(booking?.id ?? "").trim() !== ignoredId)
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
    const start = getBookingStartDate(booking);
    const end = getBookingEndDate(booking);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return null;
    }
    return { start, end };
  }

  function overlapsAnyWindow(start, end, windows) {
    return Array.isArray(windows) && windows.some((window) => start < window.end && end > window.start);
  }

  function isSameInstant(leftIso, rightIso) {
    const left = new Date(String(leftIso ?? ""));
    const right = new Date(String(rightIso ?? ""));
    if (!Number.isFinite(left.getTime()) || !Number.isFinite(right.getTime())) return false;
    return left.getTime() === right.getTime();
  }

  function getBarberLabel(booking) {
    const explicit = String(booking?.barberDisplayName ?? "").trim();
    if (explicit) return explicit;
    const username = getSchedulingUsername(booking);
    if (!username) return "Barber unavailable";
    const user = userMapByUsername.get(username);
    return String(user?.displayName ?? username).trim() || username;
  }

  function getSchedulingUsername(booking) {
    return String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
  }

  function getDurationMinutes(booking) {
    const duration = Number(booking?.durationMinutes ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) return 30;
    return Math.max(1, Math.round(duration));
  }

  function normalizeShop(shop) {
    const source = shop && typeof shop === "object" && !Array.isArray(shop) ? shop : {};
    return {
      id: String(source.id ?? "").trim(),
      name: String(source.name ?? source.businessName ?? "Shop").trim() || "Shop",
      slug: normalizeSlug(source.slug ?? source.name ?? source.businessName ?? ""),
      shopEmail: String(source.shopEmail ?? "").trim(),
      bookingPolicy: normalizeBookingPolicy(source.bookingPolicy),
    };
  }

  function getDefaultBookingPolicy() {
    return {
      allowSameDay: true,
      maxDaysAdvance: 30,
      cancelHours: 24,
      reminder24Hours: true,
      reminder2Hours: true,
      reminderCustomEnabled: false,
      reminderCustomMinutes: 60,
    };
  }

  function normalizeBookingPolicy(policy) {
    const defaults = getDefaultBookingPolicy();
    const source = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
    const allowSameDay = Object.prototype.hasOwnProperty.call(source, "allowSameDay")
      ? Boolean(source.allowSameDay)
      : defaults.allowSameDay;
    const maxDaysAdvanceRaw = Number(source.maxDaysAdvance ?? defaults.maxDaysAdvance);
    const cancelHoursRaw = Number(source.cancelHours ?? defaults.cancelHours);
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
      reminder24Hours: Boolean(source.reminder24Hours ?? defaults.reminder24Hours),
      reminder2Hours: Boolean(source.reminder2Hours ?? defaults.reminder2Hours),
      reminderCustomEnabled: Boolean(source.reminderCustomEnabled ?? defaults.reminderCustomEnabled),
      reminderCustomMinutes: Number.isFinite(reminderCustomMinutesRaw)
        ? Math.max(5, Math.round(reminderCustomMinutesRaw))
        : defaults.reminderCustomMinutes,
    };
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

  function getBookingDateBounds(policy = currentShop?.bookingPolicy) {
    const normalizedPolicy = normalizeBookingPolicy(policy);
    const today = startOfDay(new Date());
    const minDate = addDays(today, normalizedPolicy.allowSameDay ? 0 : 1);
    const maxDate = addDays(today, normalizedPolicy.maxDaysAdvance);

    return {
      policy: normalizedPolicy,
      today,
      minDate,
      maxDate,
      minYmd: toYmdLocal(minDate),
      maxYmd: toYmdLocal(maxDate),
    };
  }

  function getBookingDateRangeMessage(bounds, reason) {
    const policy = bounds?.policy || normalizeBookingPolicy(currentShop?.bookingPolicy);
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

  function getBookingDateValidation(dateValue, policy = currentShop?.bookingPolicy) {
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

  function getBookingDateHint(bounds) {
    const normalizedBounds = bounds && typeof bounds === "object"
      ? bounds
      : getBookingDateBounds(currentShop?.bookingPolicy);
    const reason = normalizedBounds?.policy?.allowSameDay ? "" : "before_min";
    return getBookingDateRangeMessage(normalizedBounds, reason);
  }

  function normalizeSlug(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeContact(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function normalizeTime(value) {
    const raw = String(value ?? "").trim();
    return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
  }

  function normalizeStatus(value) {
    const raw = String(value ?? "booked").trim().toLowerCase();
    if (raw === "confirmed") return "confirmed";
    if (raw === "completed") return "completed";
    if (raw === "cancelled") return "cancelled";
    if (raw === "no-show" || raw === "no_show" || raw === "noshow") return "no-show";
    return "booked";
  }

  function isScheduledStatus(statusValue) {
    const status = normalizeStatus(statusValue);
    return status === "booked" || status === "confirmed";
  }

  function getStatusLabel(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "confirmed") return "Confirmed";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    if (status === "no-show") return "No-show";
    return "Booked";
  }

  function getStatusBadgeClass(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "confirmed") return "badge-success";
    if (status === "completed") return "badge-success";
    if (status === "cancelled") return "badge-danger";
    if (status === "no-show") return "badge-danger";
    return "badge-warning";
  }

  function getConfirmationCode(rawId) {
    const cleaned = String(rawId ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleaned) return "N/A";
    return cleaned.slice(-6);
  }

  function storeCurrentManageLink() {
    try {
      sessionStorage.setItem(LAST_MANAGE_LINK_KEY, window.location.href);
    } catch {
      // ignore storage failures
    }
  }

  function getStoredManageLink() {
    try {
      const raw = String(sessionStorage.getItem(LAST_MANAGE_LINK_KEY) ?? "").trim();
      if (!raw) return "";
      const parsed = new URL(raw, window.location.href);
      if (parsed.origin !== window.location.origin) return "";
      if (!parsed.pathname.endsWith("/pages/manage.html")) return "";
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function getCancellationPolicyNote(shop = currentShop) {
    const cancelHours = Number(shop?.bookingPolicy?.cancelHours);
    const hours = Number.isFinite(cancelHours) ? Math.max(0, Math.round(cancelHours)) : 24;
    return `Cancellations must be made at least ${hours} hours before.`;
  }

  function buildManageNotificationPayload({ booking, previousBooking = null } = {}) {
    if (!booking || typeof booking !== "object") return null;
    return buildBookingNotificationPayload({
      booking,
      previousBooking,
      shop: currentShop,
      users: dataStore.getUsers(),
      profiles: dataStore.getProfiles(),
      manageLink: window.location.href,
      cancellationNote: getCancellationPolicyNote(currentShop),
      source: "client-manage",
    });
  }

  async function notifyManageBooking(kind, { booking, previousBooking = null } = {}) {
    const payload = buildManageNotificationPayload({ booking, previousBooking });
    if (!payload) {
      return {
        ok: false,
        offline: false,
        error: "Email not sent right now.",
      };
    }
    return postBookingNotification(kind, payload);
  }

  function setHeaderShopName(value) {
    if (manageHeaderShopName) {
      manageHeaderShopName.textContent = String(value ?? "Slotzy");
    }
    document.title = `${String(value ?? "Slotzy").trim() || "Slotzy"} | Manage Appointments`;
  }

  function setStatus(message, isSuccess) {
    if (!manageStatus) return;
    manageStatus.textContent = String(message ?? "").trim();
    manageStatus.setAttribute("role", isSuccess ? "status" : "alert");
    manageStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    manageStatus.setAttribute("aria-atomic", "true");
    manageStatus.classList.remove("status-success", "status-error");
    manageStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearStatus() {
    if (!manageStatus) return;
    manageStatus.textContent = "";
    manageStatus.setAttribute("role", "status");
    manageStatus.setAttribute("aria-live", "polite");
    manageStatus.setAttribute("aria-atomic", "true");
    manageStatus.classList.remove("status-success", "status-error");
  }

  function setRescheduleStatus(message, isSuccess) {
    if (!clientRescheduleStatus) return;
    clientRescheduleStatus.textContent = String(message ?? "").trim();
    clientRescheduleStatus.setAttribute("role", isSuccess ? "status" : "alert");
    clientRescheduleStatus.setAttribute("aria-live", isSuccess ? "polite" : "assertive");
    clientRescheduleStatus.setAttribute("aria-atomic", "true");
    clientRescheduleStatus.classList.remove("status-success", "status-error");
    clientRescheduleStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearRescheduleStatus() {
    if (!clientRescheduleStatus) return;
    clientRescheduleStatus.textContent = "";
    clientRescheduleStatus.setAttribute("role", "status");
    clientRescheduleStatus.setAttribute("aria-live", "polite");
    clientRescheduleStatus.setAttribute("aria-atomic", "true");
    clientRescheduleStatus.classList.remove("status-success", "status-error");
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

  function formatTimeRange(start, end) {
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return "Time unavailable";
    const startLabel = formatTimeLabel(start);
    if (!(end instanceof Date) || !Number.isFinite(end.getTime())) return startLabel;
    return `${startLabel} - ${formatTimeLabel(end)}`;
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

  function formatDuration(value) {
    const minutes = Number(value ?? 0);
    if (!Number.isFinite(minutes) || minutes <= 0) return "Duration unavailable";
    return `${Math.round(minutes)} min`;
  }

  function decodeURIComponentSafe(value) {
    try {
      return decodeURIComponent(String(value ?? ""));
    } catch {
      return String(value ?? "");
    }
  }

  function parseYmd(value) {
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

  function parseLocalDateTime(dateYmd, timeHhmm) {
    const date = parseYmd(dateYmd);
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

  function toYmdLocal(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
