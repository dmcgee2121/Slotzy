import * as dataStore from "./dataStore.js";

(function () {
  let isInitialized = false;

  const listContainer = document.getElementById("appointment-list");
  const dateFilterEl = document.getElementById("date-filter");
  const statusFilterEl = document.getElementById("status-filter");
  const monthLabel = document.getElementById("calendar-month");
  const summaryLabel = document.getElementById("calendar-summary");

  let calendarInstance = null;

  document.addEventListener("DOMContentLoaded", initManageAppointments);

  function initManageAppointments() {
    if (isInitialized) return;
    isInitialized = true;

    const user = getSessionUser();
    if (!isOwner(user)) {
      renderOwnersOnlyState();
      return;
    }

    renderAll();
    bindEventsOnce();
  }

  function bindEventsOnce() {
    if (dateFilterEl && dateFilterEl.dataset.bound !== "true") {
      dateFilterEl.addEventListener("change", renderAll);
      dateFilterEl.dataset.bound = "true";
    }
    if (statusFilterEl && statusFilterEl.dataset.bound !== "true") {
      statusFilterEl.addEventListener("change", renderAll);
      statusFilterEl.dataset.bound = "true";
    }
    if (listContainer && listContainer.dataset.bound !== "true") {
      listContainer.addEventListener("click", handleListActionClick);
      listContainer.dataset.bound = "true";
    }
  }

  function getSessionUser() {
    return dataStore.getSessionUser();
  }

  function isOwner(user) {
    return Boolean(user && user.role === "owner");
  }

  function renderOwnersOnlyState() {
    const main = document.querySelector("main.owner-layout") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Owners only.</h1>
        <p class="small">Please log in as a business owner.</p>
        <a href="/index.html" class="btn btn-primary">Go to Home</a>
      </section>
    `;
  }

  function loadBookings() {
    return dataStore.getBookings();
  }

  function saveBookings(bookings) {
    dataStore.saveBookings(bookings);
  }

  function renderAll() {
    const bookings = loadBookings().map((booking) => ({
      ...booking,
      _timestamp: getBookingTimestamp(booking),
    }));
    renderSummary(bookings);
    renderCalendar(bookings);
    renderBookingTable(bookings);
  }

  function renderSummary(bookings) {
    if (!monthLabel || !summaryLabel) return;

    const now = new Date();
    const monthName = now.toLocaleString("default", { month: "long" });
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${year}-${month}`;
    const count = bookings.filter((b) => String(getBookingDateText(b)).startsWith(monthPrefix)).length;

    monthLabel.textContent = `${monthName} ${year}`;
    summaryLabel.textContent = `${count} bookings this month`;
  }

  function renderCalendar(bookings) {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl || !window.FullCalendar) return;

    const calendarEvents = bookings
      .filter((b) => Number.isFinite(b._timestamp))
      .map((b) => ({
        title: `${getStatusDot(getStatusValue(b))} ${getCustomerText(b)} - ${getServiceText(b)}`,
        start: getBookingDateText(b),
      }));

    if (calendarInstance) {
      calendarInstance.destroy();
    }

    calendarInstance = new window.FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      events: calendarEvents,
    });
    calendarInstance.render();
  }

  function renderBookingTable(bookings) {
    if (!listContainer) return;

    const dateFilter = String(dateFilterEl?.value ?? "");
    const statusFilter = String(statusFilterEl?.value ?? "all").toLowerCase();
    const nowTs = Date.now();

    const filtered = bookings
      .filter((b) => !dateFilter || getBookingDateText(b) === dateFilter)
      .filter((b) => {
        const status = getStatusValue(b);
        if (!statusFilter || statusFilter === "all") return true;
        if (statusFilter === "upcoming") return status === "booked" && Number.isFinite(b._timestamp) && b._timestamp >= nowTs;
        return status === statusFilter;
      })
      .sort((a, b) => b._timestamp - a._timestamp);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">📋</span>
          <h3>No bookings found</h3>
          <p>Try adjusting your filters or check back after new appointments are made.</p>
          <a href="#appointment-controls" class="btn btn-ghost empty-state-cta">Adjust filters</a>
        </section>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:0.5rem;">Customer</th>
              <th style="text-align:left; padding:0.5rem;">Service</th>
              <th style="text-align:left; padding:0.5rem;">Date</th>
              <th style="text-align:left; padding:0.5rem;">Time</th>
              <th style="text-align:left; padding:0.5rem;">Status</th>
              <th style="text-align:left; padding:0.5rem;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((booking) => {
              const id = escapeHtml(String(booking.id ?? ""));
              const status = getStatusValue(booking);
              const completeDisabled = status !== "booked" ? "disabled" : "";
              const cancelDisabled = status !== "booked" ? "disabled" : "";
              return `
                <tr>
                  <td style="padding:0.5rem;">${escapeHtml(getCustomerText(booking))}</td>
                  <td style="padding:0.5rem;">${escapeHtml(getServiceText(booking))}</td>
                  <td style="padding:0.5rem;">${escapeHtml(getBookingDateText(booking))}</td>
                  <td style="padding:0.5rem;">${escapeHtml(getBookingTimeText(booking))}</td>
                  <td style="padding:0.5rem;">${escapeHtml(status)}</td>
                  <td style="padding:0.5rem;">
                    <button class="btn btn-primary" data-action="complete" data-booking-id="${id}" ${completeDisabled}>Mark Completed</button>
                    <button class="btn btn-danger" data-action="cancel" data-booking-id="${id}" ${cancelDisabled}>Cancel</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function handleListActionClick(event) {
    const button = event.target.closest("button[data-action][data-booking-id]");
    if (!button) return;

    const bookingId = String(button.getAttribute("data-booking-id") ?? "");
    const action = String(button.getAttribute("data-action") ?? "");
    if (!bookingId || !action) return;

    let nextStatus = "";
    if (action === "complete") nextStatus = "completed";
    if (action === "cancel") nextStatus = "cancelled";
    if (!nextStatus) return;

    const updatedBookings = loadBookings().map((booking) => {
      if (String(booking.id ?? "") !== bookingId) return booking;
      return { ...booking, status: nextStatus };
    });
    saveBookings(updatedBookings);
    renderAll();
  }

  function getStatusValue(booking) {
    return String(booking?.status ?? "booked").toLowerCase();
  }

  function getCustomerText(booking) {
    return String(booking?.customerUsername ?? booking?.name ?? "Unknown");
  }

  function getBarberText(booking) {
    return String(booking?.barberName ?? "").trim() || "Any";
  }

  function getServiceText(booking) {
    return String(booking?.serviceName ?? booking?.serviceTitle ?? "Service");
  }

  function getBookingDateText(booking) {
    const dateText = String(booking?.date ?? "").trim();
    if (dateText) return dateText;
    if (booking?.datetime) {
      const parsed = new Date(booking.datetime);
      if (!Number.isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return "";
  }

  function getBookingTimeText(booking) {
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (time24) return formatTimeLabel(time24);

    if (booking?.datetime) {
      const parsed = new Date(booking.datetime);
      if (!Number.isNaN(parsed.getTime())) {
        const hh = String(parsed.getHours()).padStart(2, "0");
        const mm = String(parsed.getMinutes()).padStart(2, "0");
        return formatTimeLabel(`${hh}:${mm}`);
      }
    }
    return "";
  }

  function getBookingTimestamp(booking) {
    const dateText = getBookingDateText(booking);
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && time24) return new Date(`${dateText}T${time24}:00`).getTime();

    if (booking?.datetime) {
      const legacy = new Date(booking.datetime).getTime();
      if (Number.isFinite(legacy)) return legacy;
    }
    return NaN;
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

  function formatTimeLabel(time24) {
    const [h, m] = time24.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = ((h + 11) % 12) + 1;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function getStatusDot(status) {
    switch (status) {
      case "booked":
        return "B";
      case "completed":
        return "C";
      case "cancelled":
        return "X";
      default:
        return "-";
    }
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
