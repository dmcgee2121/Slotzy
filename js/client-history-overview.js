import * as dataStore from "./dataStore.js";
import { buildCsvFilename, downloadCsvFile, formatCsvDate } from "./csv-utils.js";

(function () {
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";

  const summaryEl = document.getElementById("clientsSummary");
  const searchInput = document.getElementById("client-search");
  const repeatOnlyToggle = document.getElementById("repeat-only-toggle");
  const clearFiltersBtn = document.getElementById("clear-filters");
  const exportClientsCsvBtn = document.getElementById("exportClientsCsvBtn");
  const statusEl = document.getElementById("client-history-status");
  const listEl = document.getElementById("client-list");
  const historyHeadingEl = document.getElementById("selected-client-heading");
  const historySummaryEl = document.getElementById("selected-client-summary");
  const historyListEl = document.getElementById("client-history-list");

  let isInitialized = false;
  let currentUsername = "";
  let currentRole = "";
  let currentShopId = "";
  let scopeBarberSet = new Set();
  let clientRows = [];
  let selectedClientKey = "";

  document.addEventListener("DOMContentLoaded", initClientsPage);

  function initClientsPage() {
    if (isInitialized) return;
    isInitialized = true;

    const user = dataStore.getSessionUser();
    if (!isStaff(user)) {
      renderStaffOnlyState();
      return;
    }

    currentUsername = String(user?.username ?? "").trim();
    currentRole = String(user?.role ?? "").trim().toLowerCase();
    if (!currentUsername) {
      renderStaffOnlyState();
      return;
    }

    currentShopId = resolveCurrentShopId(currentUsername);
    scopeBarberSet = new Set(getScopeBarberUsernames());
    bindEvents();
    renderClients();
  }

  function bindEvents() {
    if (searchInput && searchInput.dataset.bound !== "true") {
      searchInput.addEventListener("input", renderClients);
      searchInput.dataset.bound = "true";
    }
    if (repeatOnlyToggle && repeatOnlyToggle.dataset.bound !== "true") {
      repeatOnlyToggle.addEventListener("change", renderClients);
      repeatOnlyToggle.dataset.bound = "true";
    }
    if (clearFiltersBtn && clearFiltersBtn.dataset.bound !== "true") {
      clearFiltersBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (repeatOnlyToggle) repeatOnlyToggle.checked = false;
        renderClients();
      });
      clearFiltersBtn.dataset.bound = "true";
    }
    if (exportClientsCsvBtn && exportClientsCsvBtn.dataset.bound !== "true") {
      exportClientsCsvBtn.addEventListener("click", handleExportClientsCsv);
      exportClientsCsvBtn.dataset.bound = "true";
    }
    if (listEl && listEl.dataset.bound !== "true") {
      listEl.addEventListener("click", handleClientListClick);
      listEl.addEventListener("keydown", handleClientListKeydown);
      listEl.dataset.bound = "true";
    }

    window.addEventListener("storage", handleBookingStorageSync);
    window.addEventListener(BOOKING_SYNC_EVENT, handleBookingSyncEvent);
  }

  function handleBookingStorageSync(event) {
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderClients();
  }

  function handleBookingSyncEvent() {
    renderClients();
  }

  function isStaff(user) {
    const role = String(user?.role ?? "").trim().toLowerCase();
    return role === "owner" || role === "barber";
  }

  function resolveCurrentShopId(username) {
    const users = dataStore.getUsers();
    const user = users.find((item) => String(item?.username ?? "").trim() === String(username ?? "").trim());
    const fromUser = String(user?.shopId ?? "").trim();
    if (fromUser) return fromUser;
    const fallback = dataStore.getShopForUser(username);
    return String(fallback?.id ?? "").trim();
  }

  function getScopeBarberUsernames() {
    if (!currentShopId) return [currentUsername];
    const barbers = dataStore.getBarbersForShop(currentShopId, { includeOwners: true })
      .map((barber) => String(barber?.username ?? "").trim())
      .filter(Boolean);
    if (barbers.length) return barbers;
    return [currentUsername];
  }

  function canViewBooking(booking) {
    const owner = String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
    if (!owner) return false;

    if (currentRole === "barber") {
      return owner === currentUsername;
    }

    if (currentShopId) {
      const bookingShopId = String(booking?.shopId ?? "").trim();
      if (bookingShopId) return bookingShopId === currentShopId;
    }

    if (scopeBarberSet.size > 0) {
      return scopeBarberSet.has(owner);
    }
    return owner === currentUsername;
  }

  function renderClients() {
    const bookings = dataStore.getBookings()
      .filter(canViewBooking)
      .map(normalizeBooking)
      .filter(Boolean);

    const rows = buildClientRows(bookings);
    const filtered = filterClientRows(rows);
    clientRows = filtered;
    syncClientsExportButton(filtered.length);

    if (!selectedClientKey && filtered.length > 0) {
      selectedClientKey = filtered[0].key;
    }
    if (selectedClientKey && !filtered.some((row) => row.key === selectedClientKey)) {
      selectedClientKey = filtered[0]?.key || "";
    }

    renderSummary(rows, filtered);
    renderClientList(filtered);
    renderClientHistory(filtered.find((row) => row.key === selectedClientKey) || null);
  }

  function buildClientRows(bookings) {
    const map = new Map();
    const nowTs = Date.now();

    bookings.forEach((booking) => {
      const key = getClientKey(booking);
      if (!key) return;

      const existing = map.get(key) || {
        key,
        name: String(booking.clientName ?? "Client").trim() || "Client",
        contact: String(booking.clientContact ?? "").trim(),
        bookings: [],
        totalVisits: 0,
        noShowCount: 0,
        cancelledCount: 0,
        lastVisitTs: NaN,
      };

      if (String(booking.clientName ?? "").trim()) {
        existing.name = String(booking.clientName).trim();
      }
      if (String(booking.clientContact ?? "").trim()) {
        existing.contact = String(booking.clientContact).trim();
      }

      existing.bookings.push(booking);
      existing.totalVisits += 1;
      if (booking.status === "no-show") {
        existing.noShowCount += 1;
      }
      if (booking.status === "cancelled") {
        existing.cancelledCount += 1;
      }

      const bookingTs = booking.start.getTime();
      const isPastOrNow = bookingTs <= nowTs;
      if (isPastOrNow && (!Number.isFinite(existing.lastVisitTs) || bookingTs > existing.lastVisitTs)) {
        existing.lastVisitTs = bookingTs;
      }

      map.set(key, existing);
    });

    return Array.from(map.values())
      .map((row) => {
        const fallbackLastTs = row.bookings.length
          ? Math.max(...row.bookings.map((booking) => booking.start.getTime()))
          : NaN;
        if (!Number.isFinite(row.lastVisitTs)) {
          row.lastVisitTs = fallbackLastTs;
        }
        row.bookings.sort((a, b) => b.start.getTime() - a.start.getTime());
        return row;
      })
      .sort((a, b) => {
        if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
        const aLast = Number.isFinite(a.lastVisitTs) ? a.lastVisitTs : -Infinity;
        const bLast = Number.isFinite(b.lastVisitTs) ? b.lastVisitTs : -Infinity;
        if (bLast !== aLast) return bLast - aLast;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  function filterClientRows(rows) {
    const query = String(searchInput?.value ?? "").trim().toLowerCase();
    const repeatOnly = Boolean(repeatOnlyToggle?.checked);

    return rows
      .filter((row) => {
        if (!repeatOnly) return true;
        return row.totalVisits >= 2;
      })
      .filter((row) => {
        if (!query) return true;
        const haystack = `${row.name} ${row.contact}`.toLowerCase();
        return haystack.includes(query);
      });
  }

  function renderSummary(allRows, filteredRows) {
    if (summaryEl) {
      const total = allRows.length;
      const repeats = allRows.filter((row) => row.totalVisits >= 2).length;
      const showing = filteredRows.length;
      summaryEl.textContent = `${showing} shown | ${total} total clients | ${repeats} repeat clients`;
    }

    if (statusEl) {
      const hasFilters = Boolean(String(searchInput?.value ?? "").trim()) || Boolean(repeatOnlyToggle?.checked);
      if (!hasFilters) {
        setStatus(`${filteredRows.length} clients loaded from bookings.`, true);
        return;
      }
      setStatus(`${filteredRows.length} clients match your filters.`, true);
    }
  }

  function renderClientList(rows) {
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = `
        <section class="empty-state empty-state-compact">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No clients found</h3>
          <p>Try adjusting your filters or add more bookings.</p>
        </section>
      `;
      return;
    }

    listEl.innerHTML = rows.map((row) => {
      const isActive = row.key === selectedClientKey;
      const lastVisitText = Number.isFinite(row.lastVisitTs)
        ? formatDateFriendly(new Date(row.lastVisitTs))
        : "N/A";
      const repeatTag = row.totalVisits >= 2
        ? '<span class="badge badge-muted">Repeat</span>'
        : "";

      return `
        <article class="client-list-row ${isActive ? "active" : ""}" data-client-key="${escapeHtml(row.key)}" role="button" tabindex="0" aria-pressed="${isActive ? "true" : "false"}">
          <div class="client-list-main">
            <h3>${escapeHtml(row.name)}</h3>
            <p class="small">${escapeHtml(row.contact || "No contact on file")}</p>
          </div>
          <div class="client-list-meta">
            ${repeatTag}
            <span class="small">${escapeHtml(`Visits: ${row.totalVisits}`)}</span>
            <span class="small">${escapeHtml(`Last visit: ${lastVisitText}`)}</span>
            <span class="small">${escapeHtml(`No-shows: ${row.noShowCount}`)}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function handleClientListClick(event) {
    const row = event.target.closest("[data-client-key]");
    if (!row) return;
    const key = String(row.getAttribute("data-client-key") ?? "").trim();
    if (!key) return;
    selectedClientKey = key;
    renderClientList(clientRows);
    renderClientHistory(clientRows.find((entry) => entry.key === key) || null);
  }

  function handleClientListKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-client-key]");
    if (!row) return;
    event.preventDefault();
    row.click();
  }

  function renderClientHistory(client) {
    if (!historyHeadingEl || !historySummaryEl || !historyListEl) return;

    if (!client) {
      historyHeadingEl.textContent = "Select a client";
      historySummaryEl.textContent = "Choose a client to see appointment history.";
      historyListEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No client selected</h3>
          <p>Pick a client from the list to view their history.</p>
        </section>
      `;
      return;
    }

    const lastVisitText = Number.isFinite(client.lastVisitTs)
      ? formatDateFriendly(new Date(client.lastVisitTs))
      : "N/A";
    historyHeadingEl.textContent = client.name;
    historySummaryEl.textContent = `${client.totalVisits} visit${client.totalVisits === 1 ? "" : "s"} | Last visit: ${lastVisitText} | No-shows: ${client.noShowCount}`;

    if (!client.bookings.length) {
      historyListEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No appointment history</h3>
          <p>This client does not have any bookings yet.</p>
        </section>
      `;
      return;
    }

    historyListEl.innerHTML = client.bookings.map((booking) => {
      const statusLabel = formatStatusLabel(booking.status);
      const statusClass = getStatusBadgeClass(booking.status);
      const depositMeta = booking.depositRequired
        ? `Deposit: $${booking.depositAmount.toFixed(2)} (${formatDepositStatusLabel(booking.depositStatus)})`
        : "Deposit: Not required";

      return `
        <article class="appointment-row">
          <div class="appointment-main">${escapeHtml(booking.serviceName)}</div>
          <div class="appointment-datetime">
            <span>${escapeHtml(formatDateFriendly(booking.start))}</span>
            <span>${escapeHtml(formatTimeRange(booking.start, booking.end))}</span>
            <span class="small">${escapeHtml(`Barber: ${booking.barberDisplayName || booking.ownerUsername}`)}</span>
            <span class="small">${escapeHtml(`Contact: ${booking.clientContact || "N/A"}`)}</span>
            <span class="small">${escapeHtml(depositMeta)}</span>
          </div>
          <div class="appointment-actions">
            <span class="badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function syncClientsExportButton(totalVisible) {
    if (!exportClientsCsvBtn) return;
    exportClientsCsvBtn.disabled = Number(totalVisible ?? 0) <= 0;
  }

  function handleExportClientsCsv() {
    if (!clientRows.length) {
      setStatus("No clients to export.", false);
      return;
    }

    const columns = [
      "clientName",
      "clientContact",
      "totalVisits",
      "lastVisitDate",
      "noShowCount",
      "cancelledCount",
    ];
    const rows = clientRows.map((client) => ({
      clientName: client.name,
      clientContact: client.contact || "",
      totalVisits: String(client.totalVisits ?? ""),
      lastVisitDate: Number.isFinite(client.lastVisitTs)
        ? formatCsvDate(new Date(client.lastVisitTs))
        : "",
      noShowCount: String(client.noShowCount ?? 0),
      cancelledCount: String(client.cancelledCount ?? 0),
    }));

    downloadCsvFile({
      filename: buildCsvFilename("clients"),
      columns,
      rows,
    });
    setStatus(`Exported ${rows.length} client${rows.length === 1 ? "" : "s"} to CSV.`, true);
  }

  function setStatus(message, success) {
    if (!statusEl) return;
    statusEl.textContent = String(message ?? "");
    statusEl.setAttribute("role", success ? "status" : "alert");
    statusEl.setAttribute("aria-live", success ? "polite" : "assertive");
    statusEl.setAttribute("aria-atomic", "true");
    statusEl.classList.remove("status-success", "status-error");
    statusEl.classList.add(success ? "status-success" : "status-error");
  }

  function getClientKey(booking) {
    const contact = normalizeContact(booking?.clientContact);
    if (contact) return `contact:${contact}`;
    const name = String(booking?.clientName ?? "").trim().toLowerCase();
    if (name) return `name:${name}`;
    return "";
  }

  function normalizeContact(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function normalizeBooking(booking) {
    const start = getBookingStartDate(booking);
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return null;

    const durationMinutes = resolveDurationMinutes(booking);
    const end = getBookingEndDate(booking, start, durationMinutes);
    if (!(end instanceof Date) || !Number.isFinite(end.getTime()) || end <= start) return null;

    const ownerUsername = String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
    const depositRequired = Boolean(booking?.depositRequired);
    const depositAmountRaw = Number(booking?.depositAmount ?? 0);
    const depositAmount = Number.isFinite(depositAmountRaw) && depositAmountRaw > 0
      ? Number(depositAmountRaw.toFixed(2))
      : 0;
    const depositStatus = depositRequired
      ? String(booking?.depositStatus ?? "unpaid").trim().toLowerCase() || "unpaid"
      : "not_required";

    return {
      id: String(booking?.id ?? "").trim(),
      ownerUsername,
      barberDisplayName: resolveBarberDisplayName(ownerUsername),
      clientName: String(booking?.clientName ?? booking?.customerUsername ?? booking?.name ?? "Client").trim() || "Client",
      clientContact: String(booking?.clientContact ?? booking?.contact ?? "").trim(),
      serviceName: String(booking?.serviceName ?? booking?.serviceTitle ?? "Service").trim() || "Service",
      status: normalizeStatus(booking?.status),
      start,
      end,
      durationMinutes,
      depositRequired,
      depositAmount,
      depositStatus,
    };
  }

  function resolveBarberDisplayName(username) {
    const key = String(username ?? "").trim();
    if (!key) return "";
    const user = dataStore.getUsers().find((item) => String(item?.username ?? "").trim() === key);
    return String(user?.displayName ?? user?.username ?? key).trim() || key;
  }

  function getBookingStartDate(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const parsed = new Date(startIso);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }

    const dateText = String(booking?.date ?? "").trim();
    const timeText = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && timeText) {
      const parsedLegacy = new Date(`${dateText}T${timeText}:00`);
      if (Number.isFinite(parsedLegacy.getTime())) return parsedLegacy;
    }

    const datetime = String(booking?.datetime ?? "").trim();
    if (datetime) {
      const parsedDatetime = new Date(datetime);
      if (Number.isFinite(parsedDatetime.getTime())) return parsedDatetime;
    }
    return null;
  }

  function resolveDurationMinutes(booking) {
    const duration = Number(booking?.durationMinutes ?? 0);
    if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
    return 30;
  }

  function getBookingEndDate(booking, start, durationMinutes) {
    const endIso = String(booking?.endISO ?? "").trim();
    if (endIso) {
      const parsed = new Date(endIso);
      if (Number.isFinite(parsed.getTime()) && parsed > start) return parsed;
    }
    return new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  function normalizeStatus(statusValue) {
    const status = String(statusValue ?? "booked").trim().toLowerCase();
    if (status === "confirmed") return "confirmed";
    if (status === "completed") return "completed";
    if (status === "cancelled") return "cancelled";
    if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
    return "booked";
  }

  function formatStatusLabel(statusValue) {
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

  function formatDepositStatusLabel(status) {
    const normalized = String(status ?? "").trim().toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "waived") return "Waived";
    if (normalized === "not_required") return "Not required";
    return "Unpaid";
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
    return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
  }

  function normalizeTimeTo24(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "";
    let hour = Number(match[1]);
    const minute = match[2];
    const period = String(match[3]).toUpperCase();
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderStaffOnlyState() {
    const main = document.querySelector("main.owner-layout") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Staff sign-in required.</h1>
        <p class="small">Please log in as an owner or barber to view client records.</p>
        <a href="/index.html" class="btn btn-primary">Go to Home</a>
      </section>
    `;
  }
})();
