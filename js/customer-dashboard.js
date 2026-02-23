import { wireLogoutButton } from "./logout.js";
import * as dataStore from "./dataStore.js";

(function () {
  const barberSelect = document.getElementById("barberSelect");
  const barberLabel = document.querySelector('label[for="barberSelect"]');
  const serviceSelect = document.getElementById("serviceSelect");
  const bookingDate = document.getElementById("bookingDate");
  const bookingTime = document.getElementById("bookingTime");
  const bookBtn = document.getElementById("bookBtn");
  const policyHint = document.getElementById("policyHint");
  const bookingStatus = document.getElementById("bookingStatus");
  const nextAppointmentCard = document.getElementById("nextAppointmentCard");
  const nextAppointmentDetails = document.getElementById("nextAppointmentDetails");
  const nextAppointmentService = document.getElementById("nextAppointmentService");
  const nextAppointmentDate = document.getElementById("nextAppointmentDate");
  const nextAppointmentTime = document.getElementById("nextAppointmentTime");
  const nextAppointmentEmptyState = document.getElementById("nextAppointmentEmptyState");
  const upcomingAppointments = document.getElementById("upcomingList")
    || document.getElementById("upcomingAppointments");
  const upcomingEmptyState = document.getElementById("upcomingEmptyState");
  const pastAppointments = document.getElementById("pastList")
    || document.getElementById("pastAppointments");
  const pastEmptyState = document.getElementById("pastEmptyState");
  const showToast = window.showToast;

  const currentUser = getCurrentUser();
  const currentUsername = getUsername(currentUser);
  wireLogoutButton({ redirectPath: "../index.html" });

  // Keep users on the page with an inline access message instead of redirecting.
  if (!isAuthorizedCustomer(currentUser)) {
    renderLoggedOutState();
    return;
  }

  init();

  function init() {
    populateBarbers();
    populateServices();
    populateTimes();
    initializeBookingDate();
    renderPolicyHint();
    refreshDateTimeConstraints(false);
    renderNextAppointment();
    renderUpcomingAppointments();
    renderPastAppointments();
    bookBtn?.addEventListener("click", handleBookClick);
    bookingDate?.addEventListener("change", () => {
      refreshDateTimeConstraints(true);
    });
    bookingTime?.addEventListener("change", () => {
      validateSelectedTime(true);
    });
  }

  function renderLoggedOutState() {
    const appRoot = document.getElementById("app");
    const mainContainer = document.querySelector("main.owner-layout");
    const target = appRoot || mainContainer;
    if (!target) return;

    target.innerHTML = `
      <section class="card owner-panel" style="max-width: 520px; margin: 2rem auto; text-align: center;">
        <h1>Please log in as a customer to view your dashboard.</h1>
        <p class="small">Sign in with a customer account to manage bookings.</p>
        <a href="/index.html" class="btn btn-primary owner-action-btn">Go to Home</a>
      </section>
    `;
  }

  function getCurrentUser() {
    return dataStore.getSessionUser();
  }

  function isAuthorizedCustomer(user) {
    if (!user || typeof user !== "object") return false;
    const role = String(user.role ?? "").trim().toLowerCase();
    const username = getUsername(user);
    return role === "customer" && Boolean(username);
  }

  function getUsername(user) {
    if (!user || typeof user !== "object") return "";
    return String(user.username ?? "").trim();
  }

  function getServices() {
    return dataStore.getServices();
  }

  function getStaff() {
    return dataStore.getStaff();
  }

  function getBookings() {
    return dataStore.getBookings();
  }

  function saveBookings(bookings) {
    dataStore.saveBookings(bookings);
  }

  function getShopSettings() {
    return dataStore.getShop() || {};
  }

  function getShopBookingPolicy() {
    const defaults = {
      allowSameDay: true,
      maxDaysAdvance: 30,
      cancelHours: 24,
      bufferMinutes: 0,
    };
    const shop = getShopSettings();
    const policy = shop && typeof shop.bookingPolicy === "object" && shop.bookingPolicy
      ? shop.bookingPolicy
      : shop;

    const allowSameDayRaw = policy.allowSameDay ?? defaults.allowSameDay;
    const allowSameDay = allowSameDayRaw === undefined
      ? defaults.allowSameDay
      : String(allowSameDayRaw).toLowerCase() === "true" || allowSameDayRaw === true;
    const maxDaysAdvance = toPositiveInt(policy.maxDaysAdvance, defaults.maxDaysAdvance);
    const cancelHours = toNonNegativeInt(
      policy.cancelHours ?? policy.cancellationHours,
      defaults.cancelHours
    );
    const bufferMinutes = toNonNegativeInt(policy.bufferMinutes, defaults.bufferMinutes);

    return { allowSameDay, maxDaysAdvance, cancelHours, bufferMinutes };
  }

  function renderPolicyHint() {
    if (!policyHint) return;
    const policy = getShopBookingPolicy();
    const parts = [];

    if (policy.allowSameDay === false) {
      parts.push("No same-day bookings");
    }
    if (Number.isFinite(policy.cancelHours) && policy.cancelHours > 0) {
      parts.push(`Cancel ${policy.cancelHours}h+ notice`);
    }
    if (Number.isFinite(policy.bufferMinutes) && policy.bufferMinutes > 0) {
      parts.push(`Buffer ${policy.bufferMinutes}m`);
    }
    if (Number.isFinite(policy.maxDaysAdvance) && policy.maxDaysAdvance > 0) {
      parts.push(`Book up to ${policy.maxDaysAdvance} days ahead`);
    }

    policyHint.textContent = parts.join(" • ");
  }

  function toPositiveInt(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized >= 1 ? normalized : fallback;
  }

  function toNonNegativeInt(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized >= 0 ? normalized : fallback;
  }

  function populateBarbers() {
    if (!barberSelect) return;
    barberSelect.innerHTML = '<option value="">Any barber</option>';

    const staff = getStaff().filter((barber) => barber && barber.active !== false);
    if (staff.length === 0) {
      barberSelect.disabled = true;
      if (barberLabel) barberLabel.classList.add("hidden");
      barberSelect.classList.add("hidden");
      return;
    }

    if (barberLabel) barberLabel.classList.remove("hidden");
    barberSelect.classList.remove("hidden");
    barberSelect.disabled = false;
    staff.forEach((barber) => {
      const option = document.createElement("option");
      const barberId = String(barber.id ?? "");
      const barberName = String(barber.name ?? "Barber");
      option.value = barberId;
      option.textContent = barberName;
      option.dataset.barberName = barberName;
      barberSelect.appendChild(option);
    });
  }

  function populateServices() {
    if (!serviceSelect) return;
    serviceSelect.innerHTML = '<option value="">Select a service</option>';

    const services = getServices().filter((service) => service && service.active !== false);
    setServicesDebugText(services.length);
    if (services.length === 0) {
      serviceSelect.innerHTML = '<option value="">No services available</option>';
      setBookingEnabled(false);
      setStatus("No services are available right now. Please check back in a bit.", false);
      return;
    }

    services.forEach((service) => {
      const option = document.createElement("option");
      const serviceId = String(service.id ?? "");
      const serviceName = String(service.name ?? service.title ?? "Service");
      option.value = serviceId;
      option.textContent = serviceName;
      option.dataset.serviceName = serviceName;
      serviceSelect.appendChild(option);
    });

    setBookingEnabled(true);
    clearStatus();
  }

  function setServicesDebugText(count) {
    if (!serviceSelect) return;
    let debugEl = document.getElementById("servicesDebug");
    if (!debugEl) {
      debugEl = document.createElement("p");
      debugEl.id = "servicesDebug";
      debugEl.className = "small";
      debugEl.style.color = "#64748b";
      serviceSelect.insertAdjacentElement("afterend", debugEl);
    }
    debugEl.textContent = count === 0
      ? "(0 services found in Slotzy_services)"
      : `(${count} services available)`;
  }

  function populateTimes() {
    if (!bookingTime) return;
    bookingTime.innerHTML = '<option value="">Select a time</option>';

    // Generate 30-minute slots from 09:00 through 17:00.
    for (let minutes = 9 * 60; minutes <= 17 * 60; minutes += 30) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = formatTimeLabel(value);
      bookingTime.appendChild(option);
    }
  }

  function formatTimeLabel(time24) {
    const [h, m] = time24.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = ((h + 11) % 12) + 1;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function handleBookClick() {
    clearStatus();

    const serviceId = serviceSelect?.value?.trim() || "";
    const serviceName = serviceSelect?.selectedOptions?.[0]?.dataset?.serviceName
      || serviceSelect?.selectedOptions?.[0]?.textContent
      || "";
    const date = bookingDate?.value || "";
    const time = bookingTime?.value || "";

    if (!serviceId) {
      setStatus("Please choose a service before booking.", false);
      return;
    }
    if (!date) {
      setStatus("Please choose a date for your appointment.", false);
      return;
    }
    if (isPastDate(date)) {
      setStatus("Please choose today or a future date for your booking.", false);
      return;
    }
    const bookingPolicyError = getBookingPolicyDateError(date);
    if (bookingPolicyError) {
      setStatus(bookingPolicyError, false);
      return;
    }
    if (!time) {
      setStatus("Please select an available time slot to continue.", false);
      return;
    }
    if (!validateSelectedTime(true)) {
      return;
    }
    const bufferError = getBufferPolicyError(date, time);
    if (bufferError) {
      setStatus(bufferError, false);
      return;
    }

    const bookings = getBookings();
    // Prevent booking the exact same service/date/time twice for the same customer.
    const hasDuplicate = bookings.some((existing) => {
      const existingCustomer = String(existing.customerUsername ?? "");
      const existingService = String(existing.serviceId ?? "");
      const existingDate = String(existing.date ?? "");
      const existingTime = normalizeTimeTo24(String(existing.time ?? ""));
      const selectedTime = normalizeTimeTo24(time);
      const existingStatus = String(existing.status ?? "").trim().toLowerCase();
      return (
        existingCustomer === currentUsername &&
        existingService === serviceId &&
        existingDate === date &&
        existingTime === selectedTime &&
        existingStatus === "booked"
      );
    });
    if (hasDuplicate) {
      setStatus("You already have this service booked for that date and time. Please pick a different slot.", false);
      return;
    }

    const booking = {
      id: createId(),
      customerUsername: currentUsername,
      serviceId,
      serviceName,
      date,
      time,
      createdAt: new Date().toISOString(),
      status: "booked",
    };

    bookings.push(booking);
    saveBookings(bookings);

    setStatus("Booking confirmed!", true);
    showToast?.("Booking confirmed!", "success");
    if (bookingTime) {
      bookingTime.value = "";
    }
    renderUpcomingAppointments();
    renderPastAppointments();
  }

  function handleCancelBooking(bookingId) {
    const target = getBookings().find((booking) => {
      const id = String(booking.id ?? "");
      const owner = String(booking.customerUsername ?? "");
      return id === String(bookingId) && owner === currentUsername;
    });
    if (!target) return;

    const status = String(target.status ?? "").toLowerCase();
    if (status !== "booked") return;

    const cancellationError = getCancellationPolicyError(target);
    if (cancellationError) {
      setStatus(cancellationError, false);
      return;
    }

    const bookings = getBookings().map((booking) => {
      const id = String(booking.id ?? "");
      const owner = String(booking.customerUsername ?? "");
      if (id !== String(bookingId) || owner !== currentUsername) return booking;
      if (String(booking.status ?? "").toLowerCase() !== "booked") return booking;
      return { ...booking, status: "cancelled" };
    });
    saveBookings(bookings);
    setStatus("Booking cancelled.", true);
    showToast?.("Booking cancelled.", "success");
    renderUpcomingAppointments();
    renderPastAppointments();
  }

  function getBookingTimestamp(booking) {
    const startAtIso = String(booking.startAtISO ?? "").trim();
    if (startAtIso) {
      const startAtTs = new Date(startAtIso).getTime();
      if (Number.isFinite(startAtTs)) return startAtTs;
    }

    const datePart = String(booking.date ?? "");
    const timePart = normalizeTimeTo24(String(booking.time ?? ""));
    if (datePart && timePart) {
      const localDateTime = parseLocalDateTime(datePart, timePart);
      if (localDateTime) return localDateTime.getTime();
    }

    const legacyDatetime = String(booking.datetime ?? "").trim();
    if (legacyDatetime) {
      const legacyTs = new Date(legacyDatetime).getTime();
      if (Number.isFinite(legacyTs)) return legacyTs;
    }
    return NaN;
  }

  function renderUpcomingAppointments() {
    if (!upcomingAppointments) return;
    const nowTs = Date.now();

    const upcoming = getBookings()
      .filter((b) => String(b.customerUsername ?? "") === currentUsername)
      .map((b) => ({ ...b, _timestamp: getBookingTimestamp(b) }))
      .filter((b) => Number.isFinite(b._timestamp))
      .filter((b) => String(b.status ?? "booked").toLowerCase() === "booked")
      .filter((b) => b._timestamp >= nowTs)
      .sort((a, b) => {
        return a._timestamp - b._timestamp;
      })
      .slice(0, 5);

    upcomingAppointments.innerHTML = "";
    upcomingEmptyState?.classList.toggle("hidden", upcoming.length > 0);

    upcoming.forEach((booking) => {
      const card = document.createElement("article");
      const statusValue = normalizeStatus(booking.status);
      const statusLabel = formatStatusLabel(statusValue);
      card.className = "appointment-row";
      card.innerHTML = `
        <div class="appointment-main">${escapeHtml(booking.serviceName || "Service")}</div>
        <div class="appointment-datetime">
          <span>${escapeHtml(booking.date)}</span>
          <span>${escapeHtml(formatTimeLabel(normalizeTimeTo24(String(booking.time))))}</span>
        </div>
        <div class="appointment-actions">
          <span class="badge ${escapeHtml(getBadgeClass(statusValue))}">${escapeHtml(statusLabel)}</span>
          <button type="button" class="btn btn-ghost btn-compact" data-action="cancel" data-booking-id="${escapeHtml(String(booking.id ?? ""))}">Cancel</button>
        </div>
      `;
      upcomingAppointments.appendChild(card);
    });

    upcomingAppointments.querySelectorAll('button[data-action="cancel"]').forEach((button) => {
      button.addEventListener("click", () => {
        const bookingId = String(button.getAttribute("data-booking-id") ?? "");
        if (!bookingId) return;
        handleCancelBooking(bookingId);
      });
    });
  }

  function renderNextAppointment() {
    if (!nextAppointmentCard) return;
    const nowTs = Date.now();
    const nextBooking = getBookings()
      .filter((booking) => String(booking.customerUsername ?? "") === currentUsername)
      .map((booking) => ({ ...booking, _timestamp: getBookingTimestamp(booking) }))
      .filter((booking) => Number.isFinite(booking._timestamp))
      .filter((booking) => String(booking.status ?? "booked").toLowerCase() === "booked")
      .filter((booking) => booking._timestamp > nowTs)
      .sort((a, b) => a._timestamp - b._timestamp)[0];

    if (!nextBooking) {
      nextAppointmentDetails?.classList.add("hidden");
      nextAppointmentEmptyState?.classList.remove("hidden");
      return;
    }

    const displayTime = normalizeTimeTo24(String(nextBooking.time ?? ""));
    if (nextAppointmentService) {
      nextAppointmentService.textContent = String(nextBooking.serviceName || "Service");
    }
    if (nextAppointmentDate) {
      nextAppointmentDate.textContent = String(nextBooking.date || "");
    }
    if (nextAppointmentTime) {
      nextAppointmentTime.textContent = displayTime ? formatTimeLabel(displayTime) : "";
    }

    nextAppointmentEmptyState?.classList.add("hidden");
    nextAppointmentDetails?.classList.remove("hidden");
  }

  function renderPastAppointments() {
    if (!pastAppointments) return;
    const nowTs = Date.now();

    const past = getBookings()
      .filter((b) => String(b.customerUsername ?? "") === currentUsername)
      .map((b) => ({ ...b, _timestamp: getBookingTimestamp(b) }))
      .filter((b) => Number.isFinite(b._timestamp))
      .filter((b) => {
        const status = String(b.status ?? "booked").toLowerCase();
        return status === "completed" || status === "cancelled" || b._timestamp < nowTs;
      })
      .sort((a, b) => {
        return b._timestamp - a._timestamp;
      })
      .slice(0, 10);

    pastAppointments.innerHTML = "";
    pastEmptyState?.classList.toggle("hidden", past.length > 0);

    past.forEach((booking) => {
      const card = document.createElement("article");
      const statusValue = normalizeStatus(booking.status);
      const statusLabel = formatStatusLabel(statusValue);
      card.className = "appointment-row";
      card.innerHTML = `
        <div class="appointment-main">${escapeHtml(booking.serviceName || "Service")}</div>
        <div class="appointment-datetime">
          <span>${escapeHtml(booking.date)}</span>
          <span>${escapeHtml(formatTimeLabel(normalizeTimeTo24(String(booking.time))))}</span>
        </div>
        <div class="appointment-actions">
          <span class="badge ${escapeHtml(getBadgeClass(statusValue))}">${escapeHtml(statusLabel)}</span>
        </div>
      `;
      pastAppointments.appendChild(card);
    });
  }

  function normalizeStatus(statusValue) {
    return String(statusValue || "booked").trim().toLowerCase();
  }

  function formatStatusLabel(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return "Booked";
  }

  function getBadgeClass(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "completed") return "badge-completed";
    if (status === "cancelled") return "badge-cancelled";
    return "badge-booked";
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

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `b_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function setBookingEnabled(enabled) {
    if (barberSelect) {
      const hasStaffOptions = barberSelect.options.length > 1;
      barberSelect.disabled = !enabled || !hasStaffOptions;
    }
    if (serviceSelect) serviceSelect.disabled = !enabled;
    if (bookingDate) bookingDate.disabled = !enabled;
    if (bookingTime) bookingTime.disabled = !enabled;
    if (bookBtn) bookBtn.disabled = !enabled;
    refreshDateTimeConstraints(false);
  }

  function initializeBookingDate() {
    if (!bookingDate) return;
    bookingDate.min = getTodayDateString();
    const policy = getShopBookingPolicy();
    const maxDate = Number.isFinite(policy.maxDaysAdvance)
      ? getMaxBookableDateString(policy.maxDaysAdvance)
      : "";
    if (maxDate) {
      bookingDate.max = maxDate;
    } else {
      bookingDate.removeAttribute("max");
    }
  }

  function refreshDateTimeConstraints(showFeedback) {
    if (!bookingDate || !bookingTime) return;

    initializeBookingDate();
    renderPolicyHint();
    const dateValue = String(bookingDate.value || "");
    const today = getTodayDateString();
    const isToday = dateValue === today;
    const nowTime = getCurrentTime24();
    let clearedInvalidTime = false;

    Array.from(bookingTime.options).forEach((option) => {
      const value = normalizeTimeTo24(String(option.value || ""));
      if (!value) {
        option.disabled = false;
        return;
      }
      option.disabled = isToday && value < nowTime;
    });

    if (bookingTime.value) {
      const selected = bookingTime.selectedOptions?.[0];
      if (selected?.disabled) {
        bookingTime.value = "";
        clearedInvalidTime = true;
      }
    }

    syncBookButtonState();

    if (!showFeedback) return;

    if (isPastDate(dateValue)) {
      setStatus("Please choose today or a future date for your booking.", false);
      return;
    }
    const policyError = getBookingPolicyDateError(dateValue);
    if (policyError) {
      setStatus(policyError, false);
      return;
    }
    if (clearedInvalidTime) {
      setStatus("That time has already passed today. Please choose a later time.", false);
      return;
    }
    clearStatus();
  }

  function validateSelectedTime(showFeedback) {
    const dateValue = String(bookingDate?.value || "");
    const selectedTime = normalizeTimeTo24(String(bookingTime?.value || ""));
    if (!selectedTime) return true;
    const invalidForToday = dateValue === getTodayDateString() && selectedTime < getCurrentTime24();
    if (invalidForToday) {
      if (bookingTime) bookingTime.value = "";
      syncBookButtonState();
      if (showFeedback) {
        setStatus("That time has already passed today. Please choose a later time.", false);
      }
      return false;
    }
    return true;
  }

  function syncBookButtonState() {
    if (!bookBtn) return;
    const baseDisabled = Boolean(
      serviceSelect?.disabled
      || bookingDate?.disabled
      || bookingTime?.disabled
    );
    if (baseDisabled) {
      bookBtn.disabled = true;
      return;
    }
    const dateValue = String(bookingDate?.value || "");
    const hasPolicyError = Boolean(getBookingPolicyDateError(dateValue));
    bookBtn.disabled = isPastDate(dateValue) || hasPolicyError;
  }

  function getTodayDateString() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getCurrentTime24() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isPastDate(dateValue) {
    const date = String(dateValue || "");
    if (!date) return false;
    return date < getTodayDateString();
  }

  function getMaxBookableDateString(maxDaysAdvance) {
    if (!Number.isFinite(maxDaysAdvance) || maxDaysAdvance < 1) return "";
    const today = parseLocalYMD(getTodayDateString());
    if (!today) return "";
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + maxDaysAdvance);
    const yyyy = String(maxDate.getFullYear());
    const mm = String(maxDate.getMonth() + 1).padStart(2, "0");
    const dd = String(maxDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getBookingPolicyDateError(dateValue) {
    const date = String(dateValue || "");
    if (!date) return "";

    const policy = getShopBookingPolicy();
    const selectedDate = parseLocalYMD(date);
    const today = parseLocalYMD(getTodayDateString());
    if (!selectedDate || !today) return "";

    if (policy.allowSameDay === false && selectedDate.getTime() === today.getTime()) {
      return "Same-day bookings are not allowed. Please choose a future date.";
    }

    if (Number.isFinite(policy.maxDaysAdvance)) {
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + policy.maxDaysAdvance);
      if (selectedDate.getTime() > maxDate.getTime()) {
        return `Bookings can only be made up to ${policy.maxDaysAdvance} days in advance.`;
      }
    }
    return "";
  }

  function getCancellationPolicyError(booking) {
    const policy = getShopBookingPolicy();
    if (!Number.isFinite(policy.cancelHours) || policy.cancelHours <= 0) return "";

    const appointmentTs = getBookingTimestamp(booking);
    if (!Number.isFinite(appointmentTs)) return "";

    const hoursUntil = (appointmentTs - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < policy.cancelHours) {
      return `Cancellations must be made at least ${policy.cancelHours} hours in advance.`;
    }
    return "";
  }

  function getBufferPolicyError(dateValue, timeValue) {
    const policy = getShopBookingPolicy();
    if (!Number.isFinite(policy.bufferMinutes) || policy.bufferMinutes <= 0) return "";

    const selectedTime = normalizeTimeTo24(String(timeValue || ""));
    const selectedDateTime = parseLocalDateTime(String(dateValue || ""), selectedTime);
    if (!selectedDateTime) return "";

    const hasConflict = getBookings().some((booking) => {
      const status = String(booking.status ?? "").trim().toLowerCase();
      if (status !== "booked") return false;
      if (String(booking.date ?? "") !== String(dateValue)) return false;
      const existingTime = normalizeTimeTo24(String(booking.time ?? ""));
      const existingDateTime = parseLocalDateTime(String(booking.date ?? ""), existingTime);
      if (!existingDateTime) return false;
      return absMinutesBetween(selectedDateTime, existingDateTime) < policy.bufferMinutes;
    });

    if (!hasConflict) return "";
    return `Please choose a time at least ${policy.bufferMinutes} minutes away from another appointment.`;
  }

  function parseLocalYMD(dateStr) {
    const raw = String(dateStr || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [yyyy, mm, dd] = raw.split("-").map(Number);
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    const date = new Date(yyyy, mm - 1, dd);
    if (
      date.getFullYear() !== yyyy
      || date.getMonth() !== mm - 1
      || date.getDate() !== dd
    ) return null;
    return date;
  }

  function parseLocalDateTime(dateStr, timeStr) {
    const date = parseLocalYMD(dateStr);
    const time = String(timeStr || "").trim();
    if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hh, mm] = time.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
  }

  function absMinutesBetween(a, b) {
    if (!(a instanceof Date) || !(b instanceof Date)) return NaN;
    const at = a.getTime();
    const bt = b.getTime();
    if (!Number.isFinite(at) || !Number.isFinite(bt)) return NaN;
    return Math.abs(at - bt) / (1000 * 60);
  }

  function setStatus(message, isSuccess) {
    if (!bookingStatus) return;
    bookingStatus.textContent = message;
    bookingStatus.classList.remove("status-success", "status-error");
    bookingStatus.classList.add(isSuccess ? "status-success" : "status-error");
  }

  function clearStatus() {
    if (!bookingStatus) return;
    bookingStatus.textContent = "";
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
})();
