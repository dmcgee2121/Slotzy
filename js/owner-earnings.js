import * as dataStore from "./dataStore.js";

(function () {
  let currentUser = null;
  let currentRole = "";
  let currentUsername = "";
  let currentShopId = "";
  let scopeMode = "my";
  let scopeBarberUsername = "";
  let barbersInShop = [];
  let usersByUsername = new Map();

  const periodFilter = document.getElementById("period-filter");
  const dateStartInput = document.getElementById("date-start");
  const dateEndInput = document.getElementById("date-end");
  const scopeFilter = document.getElementById("scope-filter");
  const providerFilter = document.getElementById("provider-filter");
  const includeProjectedCheckbox = document.getElementById("include-projected");
  const clearFiltersBtn = document.getElementById("clear-earnings-filters");
  const statusEl = document.getElementById("earnings-status");

  const totalEarningsEl = document.getElementById("total-earnings");
  const summaryBreakdownEl = document.getElementById("earnings-breakdown");
  const serviceBreakdownEl = document.getElementById("earnings-service-breakdown");
  const barberBreakdownEl = document.getElementById("earnings-barber-breakdown");

  document.addEventListener("DOMContentLoaded", initEarnings);

  function initEarnings() {
    currentUser = dataStore.getSessionUser();
    currentUsername = String(currentUser?.username ?? "").trim();
    currentRole = String(currentUser?.role ?? "").toLowerCase();

    if (!isStaffUser(currentUser)) {
      renderSignedOutState();
      return;
    }

    currentShopId = resolveCurrentShopId(currentUsername);
    barbersInShop = getBarbersForCurrentShop();
    usersByUsername = buildUsersMap();

    configureScopeFilter();
    applyPeriodPreset(String(periodFilter?.value ?? "this_month"));
    bindEvents();
    renderEarnings();
  }

  function bindEvents() {
    if (periodFilter && periodFilter.dataset.bound !== "true") {
      periodFilter.addEventListener("change", () => {
        applyPeriodPreset(String(periodFilter.value ?? "this_month"));
        renderEarnings();
      });
      periodFilter.dataset.bound = "true";
    }

    if (dateStartInput && dateStartInput.dataset.bound !== "true") {
      dateStartInput.addEventListener("change", renderEarnings);
      dateStartInput.dataset.bound = "true";
    }

    if (dateEndInput && dateEndInput.dataset.bound !== "true") {
      dateEndInput.addEventListener("change", renderEarnings);
      dateEndInput.dataset.bound = "true";
    }

    if (scopeFilter && scopeFilter.dataset.bound !== "true") {
      scopeFilter.addEventListener("change", () => {
        scopeMode = normalizeScopeMode(scopeFilter.value);
        syncScopeState();
        renderEarnings();
      });
      scopeFilter.dataset.bound = "true";
    }

    if (providerFilter && providerFilter.dataset.bound !== "true") {
      providerFilter.addEventListener("change", renderEarnings);
      providerFilter.dataset.bound = "true";
    }

    if (includeProjectedCheckbox && includeProjectedCheckbox.dataset.bound !== "true") {
      includeProjectedCheckbox.addEventListener("change", renderEarnings);
      includeProjectedCheckbox.dataset.bound = "true";
    }

    if (clearFiltersBtn && clearFiltersBtn.dataset.bound !== "true") {
      clearFiltersBtn.addEventListener("click", clearFilters);
      clearFiltersBtn.dataset.bound = "true";
    }
  }

  function isStaffUser(user) {
    if (!user || typeof user !== "object") return false;
    const role = String(user.role ?? "").toLowerCase();
    return role === "owner" || role === "barber";
  }

  function renderSignedOutState() {
    const main = document.querySelector("main.owner-dashboard") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="card owner-panel" style="max-width: 560px; margin: 2rem auto; text-align: center;">
        <h1>Staff sign-in required.</h1>
        <p class="small">Please log in as an owner or barber.</p>
        <a href="/index.html" class="btn btn-primary">Go to Home</a>
      </section>
    `;
  }

  function resolveCurrentShopId(username) {
    const users = dataStore.getUsers();
    const user = users.find((item) => String(item?.username ?? "").trim() === String(username ?? "").trim());
    const direct = String(user?.shopId ?? "").trim();
    if (direct) return direct;
    const fallbackShop = dataStore.getShopForUser(username);
    return String(fallbackShop?.id ?? "").trim();
  }

  function getBarbersForCurrentShop() {
    if (!currentShopId) {
      return [{ username: currentUsername, displayName: currentUsername }];
    }

    const rows = dataStore.getBarbersForShop(currentShopId, { includeOwners: true })
      .map((row) => ({
        username: String(row?.username ?? "").trim(),
        displayName: String(row?.displayName ?? row?.username ?? "").trim() || String(row?.username ?? "").trim(),
      }))
      .filter((row) => Boolean(row.username));

    if (!rows.some((row) => row.username === currentUsername)) {
      rows.push({ username: currentUsername, displayName: currentUsername });
    }

    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
  }

  function buildUsersMap() {
    const map = new Map();
    dataStore.getUsers().forEach((user) => {
      const username = String(user?.username ?? "").trim();
      if (!username) return;
      map.set(username, {
        username,
        displayName: String(user?.displayName ?? username).trim() || username,
      });
    });
    return map;
  }

  function configureScopeFilter() {
    if (!scopeFilter) return;
    const hasTeamScope = barbersInShop.length > 1;

    if (currentRole !== "owner" || !hasTeamScope) {
      scopeMode = "my";
      scopeBarberUsername = currentUsername;
      scopeFilter.innerHTML = `<option value="my">My earnings</option>`;
      scopeFilter.value = "my";
      scopeFilter.disabled = true;
    } else {
      scopeMode = normalizeScopeMode(String(scopeFilter.value ?? "all"));
      scopeFilter.value = scopeMode;
      scopeFilter.disabled = false;
      const defaultSpecific = barbersInShop.find((row) => row.username === currentUsername) || barbersInShop[0] || null;
      scopeBarberUsername = defaultSpecific ? defaultSpecific.username : currentUsername;
    }

    syncScopeState();
  }

  function normalizeScopeMode(value) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized === "all") return "all";
    if (normalized === "specific") return "specific";
    return "my";
  }

  function syncScopeState() {
    if (!providerFilter) return;

    if (currentRole !== "owner") {
      providerFilter.innerHTML = `<option value="${escapeHtml(currentUsername)}">My bookings</option>`;
      providerFilter.value = currentUsername;
      providerFilter.disabled = true;
      scopeBarberUsername = currentUsername;
      return;
    }

    if (scopeMode === "my") {
      providerFilter.innerHTML = `<option value="${escapeHtml(currentUsername)}">My bookings</option>`;
      providerFilter.value = currentUsername;
      providerFilter.disabled = true;
      scopeBarberUsername = currentUsername;
      return;
    }

    if (scopeMode === "specific") {
      const options = barbersInShop.map((barber) => `
        <option value="${escapeHtml(barber.username)}">${escapeHtml(barber.displayName)}</option>
      `).join("");
      providerFilter.innerHTML = options || `<option value="">No providers</option>`;
      if (!barbersInShop.some((barber) => barber.username === scopeBarberUsername)) {
        scopeBarberUsername = barbersInShop[0]?.username ?? "";
      }
      providerFilter.value = scopeBarberUsername;
      providerFilter.disabled = barbersInShop.length === 0;
      return;
    }

    providerFilter.innerHTML = `
      <option value="">All providers</option>
      ${barbersInShop.map((barber) => `
        <option value="${escapeHtml(barber.username)}">${escapeHtml(barber.displayName)}</option>
      `).join("")}
    `;
    providerFilter.value = "";
    providerFilter.disabled = false;
  }

  function clearFilters() {
    if (periodFilter) periodFilter.value = "this_month";
    applyPeriodPreset("this_month");

    if (includeProjectedCheckbox) includeProjectedCheckbox.checked = true;

    if (currentRole === "owner") {
      if (scopeFilter) scopeFilter.value = "all";
      scopeMode = "all";
      syncScopeState();
    } else {
      scopeMode = "my";
      syncScopeState();
    }

    renderEarnings();
  }

  function applyPeriodPreset(periodValue) {
    const period = String(periodValue ?? "").toLowerCase();
    if (!dateStartInput || !dateEndInput) return;

    if (period === "custom") {
      dateStartInput.disabled = false;
      dateEndInput.disabled = false;
      return;
    }

    const range = getPresetRange(period);
    dateStartInput.value = toYmd(range.start);
    dateEndInput.value = toYmd(range.end);
    dateStartInput.disabled = true;
    dateEndInput.disabled = true;
  }

  function getPresetRange(period) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    if (period === "today") {
      return { start: todayStart, end: todayEnd };
    }

    if (period === "this_week") {
      const weekStart = new Date(todayStart);
      const mondayOffset = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - mondayOffset);
      const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
      return { start: weekStart, end: weekEnd };
    }

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const monthEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0));
    return { start: monthStart, end: monthEnd };
  }

  function renderEarnings() {
    const bookings = getFilteredBookings();
    const servicesById = buildServicesByIdMap();
    const includeProjected = Boolean(includeProjectedCheckbox?.checked);
    const countNoShowAsRevenue = shouldCountNoShowAsRevenue();
    const nowTs = Date.now();

    const metrics = {
      trackedCount: 0,
      completedCount: 0,
      completedRevenue: 0,
      bookedCount: 0,
      bookedRevenue: 0,
      projectedCount: 0,
      projectedRevenue: 0,
      noShowCount: 0,
      missingPriceCount: 0,
    };

    const byService = new Map();
    const byBarber = new Map();

    bookings.forEach((booking) => {
      const status = normalizeStatus(booking?.status);
      if (!isScheduledStatus(status) && status !== "completed" && status !== "no-show") return;
      metrics.trackedCount += 1;

      const timestamp = getBookingTimestamp(booking);
      const amount = resolveBookingPrice(booking, servicesById);
      if (amount === 0 && !hasExplicitOrMappedPrice(booking, servicesById)) {
        metrics.missingPriceCount += 1;
      }

      if (status === "completed") {
        metrics.completedCount += 1;
        metrics.completedRevenue += amount;
      }

      if (isScheduledStatus(status)) {
        metrics.bookedCount += 1;
        metrics.bookedRevenue += amount;
        if (Number.isFinite(timestamp) && timestamp >= nowTs) {
          metrics.projectedCount += 1;
          metrics.projectedRevenue += amount;
        }
      }

      if (status === "no-show") {
        metrics.noShowCount += 1;
        if (countNoShowAsRevenue) {
          metrics.completedCount += 1;
          metrics.completedRevenue += amount;
          addBreakdownRow(byService, getServiceLabel(booking, servicesById), "completed", amount);
          addBreakdownRow(byBarber, getBarberLabel(booking), "completed", amount);
        }
        return;
      }

      const breakdownStatus = status === "confirmed" ? "booked" : status;
      addBreakdownRow(byService, getServiceLabel(booking, servicesById), breakdownStatus, amount);
      addBreakdownRow(byBarber, getBarberLabel(booking), breakdownStatus, amount);
    });

    const displayTotal = metrics.completedRevenue + (includeProjected ? metrics.projectedRevenue : 0);
    const breakdownRows = buildSummaryRows(metrics, includeProjected, displayTotal);
    totalEarningsEl.textContent = formatMoney(displayTotal);
    summaryBreakdownEl.innerHTML = breakdownRows.join("");

    renderBreakdownList(serviceBreakdownEl, byService, "No service earnings in this range.");
    renderBreakdownList(barberBreakdownEl, byBarber, "No barber earnings in this range.");
    renderStatus(metrics, bookings.length, includeProjected, countNoShowAsRevenue);
  }

  function getFilteredBookings() {
    const allBookings = dataStore.getBookings();
    const filteredByScope = allBookings.filter(isBookingInScope);

    const providerUsername = String(providerFilter?.value ?? "").trim();
    const withProvider = providerUsername
      ? filteredByScope.filter((booking) => getBookingOwnerUsername(booking) === providerUsername)
      : filteredByScope;

    const range = getActiveDateRange();
    return withProvider.filter((booking) => {
      const timestamp = getBookingTimestamp(booking);
      if (!Number.isFinite(timestamp)) return false;
      if (range.start && timestamp < range.start.getTime()) return false;
      if (range.end && timestamp > range.end.getTime()) return false;
      return true;
    });
  }

  function isBookingInScope(booking) {
    const bookingOwner = getBookingOwnerUsername(booking);
    if (!bookingOwner) return false;

    if (currentRole !== "owner") {
      return bookingOwner === currentUsername;
    }

    if (scopeMode === "my") {
      return bookingOwner === currentUsername;
    }

    if (scopeMode === "specific") {
      scopeBarberUsername = String(providerFilter?.value ?? scopeBarberUsername ?? "").trim();
      return bookingOwner === scopeBarberUsername;
    }

    const bookingShopId = String(booking?.shopId ?? "").trim();
    if (currentShopId && bookingShopId) {
      return bookingShopId === currentShopId;
    }

    const barberSet = new Set(barbersInShop.map((barber) => barber.username));
    if (barberSet.size > 0) {
      return barberSet.has(bookingOwner);
    }

    return true;
  }

  function getActiveDateRange() {
    const startValue = String(dateStartInput?.value ?? "").trim();
    const endValue = String(dateEndInput?.value ?? "").trim();

    const start = startValue ? startOfDay(new Date(`${startValue}T00:00:00`)) : null;
    const end = endValue ? endOfDay(new Date(`${endValue}T00:00:00`)) : null;
    return { start, end };
  }

  function buildServicesByIdMap() {
    const map = new Map();
    dataStore.getServices().forEach((service) => {
      const id = String(service?.id ?? "").trim();
      if (!id) return;
      map.set(id, {
        name: String(service?.name ?? service?.title ?? "Service").trim() || "Service",
        price: Number(service?.price ?? NaN),
      });
    });
    return map;
  }

  function resolveBookingPrice(booking, servicesById) {
    const explicit = Number(booking?.price ?? NaN);
    if (Number.isFinite(explicit) && explicit >= 0) return Number(explicit.toFixed(2));

    const serviceId = String(booking?.serviceId ?? "").trim();
    const mapped = Number(servicesById.get(serviceId)?.price ?? NaN);
    if (Number.isFinite(mapped) && mapped >= 0) return Number(mapped.toFixed(2));
    return 0;
  }

  function hasExplicitOrMappedPrice(booking, servicesById) {
    const explicit = Number(booking?.price ?? NaN);
    if (Number.isFinite(explicit) && explicit >= 0) return true;
    const serviceId = String(booking?.serviceId ?? "").trim();
    const mapped = Number(servicesById.get(serviceId)?.price ?? NaN);
    return Number.isFinite(mapped) && mapped >= 0;
  }

  function addBreakdownRow(map, label, status, amount) {
    const key = String(label ?? "").trim() || "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        label: key,
        completedCount: 0,
        completedRevenue: 0,
        bookedCount: 0,
        bookedRevenue: 0,
      });
    }

    const row = map.get(key);
    if (status === "completed") {
      row.completedCount += 1;
      row.completedRevenue += amount;
    } else if (status === "booked") {
      row.bookedCount += 1;
      row.bookedRevenue += amount;
    }
  }

  function buildSummaryRows(metrics, includeProjected, displayTotal) {
    return [
      renderMetricItem("Completed Revenue", formatMoney(metrics.completedRevenue), `${metrics.completedCount} completed`),
      renderMetricItem("Booked + Confirmed Total", formatMoney(metrics.bookedRevenue), `${metrics.bookedCount} scheduled`),
      renderMetricItem(
        "Projected Revenue (Future Booked/Confirmed)",
        formatMoney(metrics.projectedRevenue),
        `${metrics.projectedCount} upcoming scheduled`
      ),
      renderMetricItem(
        `Displayed Total ${includeProjected ? "(completed + projected)" : "(completed only)"}`,
        formatMoney(displayTotal),
        `${metrics.trackedCount} tracked bookings`
      ),
    ];
  }

  function renderMetricItem(label, value, subtext) {
    return `
      <div class="breakdown-item">
        <strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}
        <div class="small">${escapeHtml(subtext)}</div>
      </div>
    `;
  }

  function renderBreakdownList(container, map, emptyText) {
    if (!container) return;
    const rows = Array.from(map.values())
      .sort((a, b) => {
        const aTotal = a.completedRevenue + a.bookedRevenue;
        const bTotal = b.completedRevenue + b.bookedRevenue;
        if (bTotal !== aTotal) return bTotal - aTotal;
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      });

    if (rows.length === 0) {
      container.innerHTML = `
        <section class="empty-state empty-state-compact">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No earnings data</h3>
          <p>${escapeHtml(emptyText)}</p>
        </section>
      `;
      return;
    }

    container.innerHTML = rows.map((row) => `
      <div class="breakdown-item">
        <strong>${escapeHtml(row.label)}</strong>
        <div class="small">Completed: ${escapeHtml(formatMoney(row.completedRevenue))} (${row.completedCount})</div>
        <div class="small">Booked: ${escapeHtml(formatMoney(row.bookedRevenue))} (${row.bookedCount})</div>
      </div>
    `).join("");
  }

  function renderStatus(metrics, totalBookingsInRange, includeProjected, countNoShowAsRevenue) {
    if (!statusEl) return;

    const parts = [
      `${totalBookingsInRange} booking${totalBookingsInRange === 1 ? "" : "s"} in range.`,
      `Completed revenue: ${formatMoney(metrics.completedRevenue)}.`,
      includeProjected
        ? `Projected (future booked/confirmed): ${formatMoney(metrics.projectedRevenue)}.`
        : "Projected revenue excluded from displayed total.",
    ];

    if (metrics.noShowCount > 0) {
      parts.push(
        countNoShowAsRevenue
          ? `${metrics.noShowCount} no-show booking${metrics.noShowCount === 1 ? "" : "s"} counted toward realized revenue by policy.`
          : `${metrics.noShowCount} no-show booking${metrics.noShowCount === 1 ? "" : "s"} excluded from revenue.`
      );
    }

    if (metrics.missingPriceCount > 0) {
      parts.push(`${metrics.missingPriceCount} booking${metrics.missingPriceCount === 1 ? "" : "s"} had no price mapping and counted as $0.`);
    }

    statusEl.textContent = parts.join(" ");
  }

  function getServiceLabel(booking, servicesById) {
    const explicitName = String(booking?.serviceName ?? "").trim();
    if (explicitName) return explicitName;
    const serviceId = String(booking?.serviceId ?? "").trim();
    const mappedName = String(servicesById.get(serviceId)?.name ?? "").trim();
    return mappedName || "Service";
  }

  function getBarberLabel(booking) {
    const username = getBookingOwnerUsername(booking);
    if (!username) return "Unknown barber";
    return usersByUsername.get(username)?.displayName || username;
  }

  function getBookingOwnerUsername(booking) {
    return String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
  }

  function getBookingTimestamp(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const isoTs = new Date(startIso).getTime();
      if (Number.isFinite(isoTs)) return isoTs;
    }

    if (booking?.datetime) {
      const dtTs = new Date(booking.datetime).getTime();
      if (Number.isFinite(dtTs)) return dtTs;
    }

    const dateText = String(booking?.date ?? "").trim();
    const timeText = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && timeText) return new Date(`${dateText}T${timeText}:00`).getTime();
    if (dateText) return new Date(`${dateText}T00:00:00`).getTime();
    return NaN;
  }

  function normalizeStatus(statusValue) {
    const status = String(statusValue ?? "booked").trim().toLowerCase();
    if (status === "confirmed") return "confirmed";
    if (status === "completed") return "completed";
    if (status === "cancelled") return "cancelled";
    if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
    return "booked";
  }

  function isScheduledStatus(statusValue) {
    const status = normalizeStatus(statusValue);
    return status === "booked" || status === "confirmed";
  }

  function shouldCountNoShowAsRevenue() {
    const policy = dataStore.getShop()?.bookingPolicy;
    if (!policy || typeof policy !== "object") return false;
    if (Object.prototype.hasOwnProperty.call(policy, "noShowCountsAsRevenue")) {
      return Boolean(policy.noShowCountsAsRevenue);
    }
    if (Object.prototype.hasOwnProperty.call(policy, "countNoShowAsRevenue")) {
      return Boolean(policy.countNoShowAsRevenue);
    }
    return false;
  }

  function normalizeTimeTo24(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;

    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "";

    let hour = Number(match[1]);
    const minute = String(match[2]);
    const meridiem = String(match[3]).toUpperCase();

    if (meridiem === "AM" && hour === 12) hour = 0;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function toYmd(date) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
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
