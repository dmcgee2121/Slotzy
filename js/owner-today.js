import * as dataStore from "./dataStore.js";
import { buildBookingNotificationPayload, postBookingNotification } from "./booking-notifications.js";

(function () {
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const MIN_GAP_MINUTES = 10;

  const countdownEl = document.getElementById("todayNextCountdown");
  const countdownMetaEl = document.getElementById("todayNextMeta");
  const statusEl = document.getElementById("todayStatus");
  const agendaListEl = document.getElementById("todayAgendaList");
  const scopeWrapEl = document.getElementById("todayScopeWrap");
  const scopeSelectEl = document.getElementById("todayScope");
  const printBtnEl = document.getElementById("todayPrintBtn");

  let isInitialized = false;
  let currentUsername = "";
  let currentRole = "";
  let currentShopId = "";
  let scopeMode = "all";
  let barbersInShop = [];
  let clientNoShowCountByKey = new Map();
  let minuteRefreshTimer = null;

  document.addEventListener("DOMContentLoaded", initTodayAgenda);

  function initTodayAgenda() {
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
    barbersInShop = getBarbersForCurrentScope();
    configureScopeControls();
    bindEvents();
    renderTodayAgenda();

    minuteRefreshTimer = window.setInterval(() => {
      renderTodayAgenda();
    }, 60 * 1000);
  }

  function isStaff(user) {
    const role = String(user?.role ?? "").trim().toLowerCase();
    return role === "owner" || role === "barber";
  }

  function renderStaffOnlyState() {
    const main = document.querySelector("main.owner-layout") || document.querySelector("main");
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
    const user = users.find((item) => String(item?.username ?? "") === String(username ?? ""));
    const direct = String(user?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShopForUser(username);
    return String(fallback?.id ?? "").trim();
  }

  function getBarbersForCurrentScope() {
    if (!currentShopId) {
      return [{
        username: currentUsername,
        displayName: currentUsername,
      }];
    }

    const rows = dataStore.getBarbersForShop(currentShopId, { includeOwners: true })
      .map((barber) => ({
        username: String(barber?.username ?? "").trim(),
        displayName: String(barber?.displayName ?? barber?.username ?? "").trim() || String(barber?.username ?? ""),
      }))
      .filter((barber) => Boolean(barber.username));

    if (rows.length > 0) return rows;
    return [{
      username: currentUsername,
      displayName: currentUsername,
    }];
  }

  function configureScopeControls() {
    if (!scopeWrapEl || !scopeSelectEl) return;
    const hasTeamScope = barbersInShop.length > 1;

    if (currentRole !== "owner" || !hasTeamScope) {
      scopeMode = "my";
      scopeWrapEl.classList.add("hidden");
      scopeSelectEl.value = "my";
      scopeSelectEl.disabled = true;
      return;
    }

    scopeWrapEl.classList.remove("hidden");
    scopeSelectEl.disabled = false;
    scopeMode = normalizeScopeMode(String(scopeSelectEl.value ?? "all"));
    scopeSelectEl.value = scopeMode;
  }

  function normalizeScopeMode(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "my") return "my";
    return "all";
  }

  function bindEvents() {
    if (scopeSelectEl && scopeSelectEl.dataset.bound !== "true") {
      scopeSelectEl.addEventListener("change", () => {
        scopeMode = normalizeScopeMode(scopeSelectEl.value);
        renderTodayAgenda();
      });
      scopeSelectEl.dataset.bound = "true";
    }

    if (printBtnEl && printBtnEl.dataset.bound !== "true") {
      printBtnEl.addEventListener("click", () => {
        window.print();
      });
      printBtnEl.dataset.bound = "true";
    }

    if (agendaListEl && agendaListEl.dataset.bound !== "true") {
      agendaListEl.addEventListener("click", handleAgendaActionClick);
      agendaListEl.dataset.bound = "true";
    }

    window.addEventListener("storage", handleBookingStorageSync);
    window.addEventListener(BOOKING_SYNC_EVENT, handleBookingEventSync);

    window.addEventListener("beforeunload", () => {
      if (minuteRefreshTimer) {
        window.clearInterval(minuteRefreshTimer);
        minuteRefreshTimer = null;
      }
    });
  }

  function handleBookingStorageSync(event) {
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderTodayAgenda();
  }

  function handleBookingEventSync() {
    renderTodayAgenda();
  }

  function handleAgendaActionClick(event) {
    const actionBtn = event.target.closest("button[data-action][data-booking-id]");
    if (!actionBtn) return;

    const action = String(actionBtn.getAttribute("data-action") ?? "").trim();
    const bookingId = String(actionBtn.getAttribute("data-booking-id") ?? "").trim();
    if (!action || !bookingId) return;

    const booking = findManagedBookingById(bookingId);
    if (!booking) {
      setInlineStatus("Appointment not found.", false);
      return;
    }

    if (action === "confirm") {
      if (booking.status !== "booked") {
        setInlineStatus("Only booked appointments can be confirmed.", false);
        return;
      }
      if (booking.start.getTime() < Date.now()) {
        setInlineStatus("Past appointments cannot be confirmed.", false);
        return;
      }
      if (!updateBookingStatus(booking.id, "confirmed")) {
        setInlineStatus("Could not confirm this appointment.", false);
        return;
      }
      queueTodayBookingNotification("booking", {
        previousBooking: booking,
        booking: findManagedBookingById(booking.id),
      });
      setInlineStatus("Appointment confirmed.", true);
      renderTodayAgenda();
      return;
    }

    if (action === "cancel") {
      if (!isScheduledStatus(booking.status)) {
        setInlineStatus("Only booked or confirmed appointments can be cancelled.", false);
        return;
      }
      if (booking.start.getTime() < Date.now()) {
        setInlineStatus("Past appointments cannot be cancelled.", false);
        return;
      }
      if (!window.confirm("Cancel this appointment?")) return;
      if (!updateBookingStatus(booking.id, "cancelled")) {
        setInlineStatus("Could not cancel this appointment.", false);
        return;
      }
      queueTodayBookingNotification("cancel", {
        previousBooking: booking,
        booking: findManagedBookingById(booking.id),
      });
      setInlineStatus("Appointment cancelled.", true);
      renderTodayAgenda();
      return;
    }

    if (action === "complete") {
      if (!isScheduledStatus(booking.status)) {
        setInlineStatus("Only booked or confirmed appointments can be marked completed.", false);
        return;
      }
      if (booking.start.getTime() > Date.now()) {
        setInlineStatus("You can mark completed only after the appointment start time.", false);
        return;
      }
      if (!updateBookingStatus(booking.id, "completed")) {
        setInlineStatus("Could not complete this appointment.", false);
        return;
      }
      setInlineStatus("Appointment marked completed.", true);
      renderTodayAgenda();
      return;
    }

    if (action === "no-show") {
      if (!isScheduledStatus(booking.status)) {
        setInlineStatus("Only booked or confirmed appointments can be marked no-show.", false);
        return;
      }
      if (booking.start.getTime() > Date.now()) {
        setInlineStatus("You can mark no-show only after the appointment start time.", false);
        return;
      }
      if (!updateBookingStatus(booking.id, "no-show")) {
        setInlineStatus("Could not mark this appointment no-show.", false);
        return;
      }
      setInlineStatus("Appointment marked no-show.", true);
      renderTodayAgenda();
    }
  }

  function renderTodayAgenda() {
    barbersInShop = getBarbersForCurrentScope();
    const managedBookings = loadManagedBookings();
    clientNoShowCountByKey = buildClientNoShowCountMap(managedBookings);
    const todayBookings = loadTodayScheduledBookings(managedBookings);
    const timeline = buildTimelineItems(todayBookings);

    renderNextCountdown(todayBookings);
    renderTimeline(timeline);
    renderSummaryStatus(todayBookings, timeline);
  }

  function loadManagedBookings() {
    const managedOwners = getManagedOwnerSet();
    return dataStore.getBookings()
      .filter((booking) => canViewRawBooking(booking, managedOwners))
      .map(normalizeBooking)
      .filter(Boolean);
  }

  function loadTodayScheduledBookings(managedBookings) {
    const todayYmd = toYmdLocal(new Date());
    const source = Array.isArray(managedBookings) ? managedBookings : [];

    return source
      .filter((booking) => toYmdLocal(booking.start) === todayYmd)
      .filter((booking) => isScheduledStatus(booking.status))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  function getManagedOwnerSet() {
    const set = new Set([currentUsername]);
    if (currentRole !== "owner") return set;
    if (scopeMode === "my") return set;

    barbersInShop.forEach((barber) => {
      const username = String(barber?.username ?? "").trim();
      if (username) set.add(username);
    });
    return set;
  }

  function canViewRawBooking(booking, managedOwners) {
    const bookingOwner = String(booking?.ownerUsername ?? "").trim();
    if (!bookingOwner) return false;

    if (currentRole !== "owner") {
      return bookingOwner === currentUsername;
    }

    if (scopeMode === "my") {
      return bookingOwner === currentUsername;
    }

    if (currentShopId) {
      const bookingShopId = String(booking?.shopId ?? "").trim();
      if (bookingShopId) return bookingShopId === currentShopId;
    }
    return managedOwners.has(bookingOwner);
  }

  function normalizeBooking(booking) {
    const id = String(booking?.id ?? "").trim();
    if (!id) return null;

    const start = getBookingStartDate(booking);
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) return null;

    const durationMinutes = resolveDurationMinutes(booking);
    const end = getBookingEndDate(booking, start, durationMinutes);
    if (!(end instanceof Date) || !Number.isFinite(end.getTime()) || end <= start) return null;

    const ownerUsername = String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
    const clientName = String(booking?.clientName ?? booking?.customerUsername ?? booking?.name ?? "Unknown").trim() || "Unknown";
    const clientContact = String(booking?.clientContact ?? booking?.contact ?? "").trim();
    const serviceName = String(booking?.serviceName ?? booking?.serviceTitle ?? "Service").trim() || "Service";
    const barberDisplayName = resolveBarberDisplayName(ownerUsername);
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
      ownerUsername,
      barberDisplayName,
      shopId: String(booking?.shopId ?? "").trim(),
      serviceName,
      clientName,
      clientContact,
      status: normalizeStatus(booking?.status),
      start,
      end,
      durationMinutes,
      depositRequired,
      depositAmount,
      depositStatus,
    };
  }

  function findManagedBookingById(id) {
    const targetId = String(id ?? "").trim();
    if (!targetId) return null;

    const managedOwners = getManagedOwnerSet();
    const raw = dataStore.getBookings().find((booking) => {
      const bookingId = String(booking?.id ?? "").trim();
      if (bookingId !== targetId) return false;
      return canManageRawBooking(booking, managedOwners);
    });
    return raw ? normalizeBooking(raw) : null;
  }

  function canManageRawBooking(booking, managedOwners) {
    const owner = String(booking?.ownerUsername ?? "").trim();
    if (!owner) return false;

    if (currentRole !== "owner") {
      return owner === currentUsername;
    }

    if (scopeMode === "my") {
      return owner === currentUsername;
    }

    if (currentShopId) {
      const bookingShopId = String(booking?.shopId ?? "").trim();
      if (bookingShopId) return bookingShopId === currentShopId;
    }
    return managedOwners.has(owner);
  }

  function updateBookingStatus(bookingId, nextStatus) {
    const targetId = String(bookingId ?? "").trim();
    if (!targetId) return false;

    const managedOwners = getManagedOwnerSet();
    let didUpdate = false;
    const updated = dataStore.getBookings().map((booking) => {
      const id = String(booking?.id ?? "").trim();
      if (id !== targetId) return booking;
      if (!canManageRawBooking(booking, managedOwners)) return booking;
      didUpdate = true;
      return { ...booking, status: nextStatus };
    });

    if (didUpdate) {
      dataStore.saveBookings(updated);
    }
    return didUpdate;
  }

  function buildTodayNotificationPayload({ booking, previousBooking = null } = {}) {
    if (!booking || typeof booking !== "object") return null;
    const shop = dataStore.getShopById(String(booking?.shopId ?? "").trim()) || dataStore.getShopForUser(currentUsername) || null;
    return buildBookingNotificationPayload({
      booking,
      previousBooking,
      shop,
      users: dataStore.getUsers(),
      profiles: dataStore.getProfiles(),
      manageLink: window.location.href,
      source: "owner-today",
    });
  }

  function queueTodayBookingNotification(kind, { booking, previousBooking = null } = {}) {
    const payload = buildTodayNotificationPayload({ booking, previousBooking });
    if (!payload) return;

    void postBookingNotification(kind, payload).then((notifyResult) => {
      if (notifyResult?.ok) return;
      const message = notifyResult?.offline
        ? "Email not sent (server offline)."
        : (String(notifyResult?.error ?? "").trim() || "Email not sent right now.");
      setInlineStatus(message, false);
    });
  }

  function buildTimelineItems(todayBookings) {
    const timeline = [];
    todayBookings.forEach((booking) => {
      timeline.push({
        kind: "booking",
        start: booking.start,
        end: booking.end,
        booking,
      });
    });

    const gapItems = buildGapItems(todayBookings);
    gapItems.forEach((gap) => timeline.push(gap));

    timeline.sort((a, b) => {
      const aTs = a.start.getTime();
      const bTs = b.start.getTime();
      if (aTs !== bTs) return aTs - bTs;
      if (a.kind === b.kind) return 0;
      return a.kind === "gap" ? -1 : 1;
    });
    return timeline;
  }

  function buildGapItems(todayBookings) {
    const byOwner = new Map();
    todayBookings.forEach((booking) => {
      const key = booking.ownerUsername;
      const list = byOwner.get(key) || [];
      list.push(booking);
      byOwner.set(key, list);
    });

    const ownersToTrack = getOwnersForGapTracking();
    const gaps = [];

    ownersToTrack.forEach((ownerUsername) => {
      const workingWindow = getTodayWorkingWindow(ownerUsername);
      if (!workingWindow) return;

      const ownerBookings = (byOwner.get(ownerUsername) || [])
        .slice()
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let cursor = workingWindow.start;
      if (!ownerBookings.length) {
        addGap(gaps, {
          ownerUsername,
          ownerDisplayName: resolveBarberDisplayName(ownerUsername),
          start: workingWindow.start,
          end: workingWindow.end,
        });
        return;
      }

      ownerBookings.forEach((booking) => {
        const busyStart = clampDate(booking.start, workingWindow.start, workingWindow.end);
        const busyEndRaw = new Date(booking.end.getTime() + workingWindow.bufferMinutes * 60 * 1000);
        const busyEnd = clampDate(busyEndRaw, workingWindow.start, workingWindow.end);

        if (busyStart > cursor) {
          addGap(gaps, {
            ownerUsername,
            ownerDisplayName: resolveBarberDisplayName(ownerUsername),
            start: cursor,
            end: busyStart,
          });
        }

        if (busyEnd > cursor) {
          cursor = busyEnd;
        }
      });

      if (cursor < workingWindow.end) {
        addGap(gaps, {
          ownerUsername,
          ownerDisplayName: resolveBarberDisplayName(ownerUsername),
          start: cursor,
          end: workingWindow.end,
        });
      }
    });

    return gaps;
  }

  function addGap(target, gap) {
    const durationMinutes = Math.round((gap.end.getTime() - gap.start.getTime()) / (60 * 1000));
    if (durationMinutes < MIN_GAP_MINUTES) return;
    target.push({
      kind: "gap",
      start: gap.start,
      end: gap.end,
      ownerUsername: gap.ownerUsername,
      ownerDisplayName: gap.ownerDisplayName,
      durationMinutes,
    });
  }

  function clampDate(value, minValue, maxValue) {
    const ts = value.getTime();
    const minTs = minValue.getTime();
    const maxTs = maxValue.getTime();
    const safeTs = Math.max(minTs, Math.min(maxTs, ts));
    return new Date(safeTs);
  }

  function getOwnersForGapTracking() {
    if (currentRole !== "owner") return [currentUsername];
    if (scopeMode === "my") return [currentUsername];

    const usernames = barbersInShop
      .map((barber) => String(barber?.username ?? "").trim())
      .filter(Boolean);

    if (usernames.length) return usernames;
    return [currentUsername];
  }

  function getTodayWorkingWindow(ownerUsername) {
    const availability = dataStore.getAvailabilityForBarber(ownerUsername);
    if (!availability || typeof availability !== "object") return null;

    const today = new Date();
    const dayKey = DAY_KEYS[today.getDay()];
    const day = availability?.weekly?.[dayKey];
    if (!day || day.enabled !== true) return null;

    const startMin = hhmmToMinutes(String(day.start ?? ""));
    const endMin = hhmmToMinutes(String(day.end ?? ""));
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin >= endMin) return null;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, startMin, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, endMin, 0, 0);
    const bufferRaw = Number(availability?.bufferMinutes ?? 0);
    const bufferMinutes = [0, 5, 10, 15].includes(bufferRaw) ? bufferRaw : 0;

    return { start, end, bufferMinutes };
  }

  function renderNextCountdown(todayBookings) {
    if (!countdownEl || !countdownMetaEl) return;

    const nowTs = Date.now();
    const next = todayBookings.find((booking) => booking.start.getTime() > nowTs) || null;
    if (!next) {
      countdownEl.textContent = "No more appointments today";
      countdownMetaEl.textContent = "Your schedule is clear for the rest of the day.";
      return;
    }

    countdownEl.textContent = `Next: ${formatRelativeCountdown(next.start)}`;
    const providerMeta = currentRole === "owner" && scopeMode === "all"
      ? ` | Barber: ${next.barberDisplayName || next.ownerUsername}`
      : "";
    countdownMetaEl.textContent = `${formatTimeRange(next.start, next.end)} | ${next.clientName} | ${next.serviceName}${providerMeta}`;
  }

  function renderTimeline(items) {
    if (!agendaListEl) return;

    if (!items.length) {
      agendaListEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No appointments today</h3>
          <p>Booked and confirmed appointments for today will appear here.</p>
        </section>
      `;
      return;
    }

    agendaListEl.innerHTML = items.map((item) => {
      if (item.kind === "gap") {
        return renderGapRow(item);
      }
      return renderBookingRow(item.booking);
    }).join("");
  }

  function renderGapRow(gap) {
    const ownerMeta = currentRole === "owner" && scopeMode === "all"
      ? `${gap.ownerDisplayName || gap.ownerUsername} | `
      : "";

    return `
      <article class="today-item today-item-gap">
        <div class="today-time">${escapeHtml(formatTimeRange(gap.start, gap.end))}</div>
        <div class="today-main">
          <h3>Free Time</h3>
          <p class="small today-gap-copy">${escapeHtml(`${ownerMeta}${gap.durationMinutes} min open`)}</p>
        </div>
        <div class="today-actions"></div>
      </article>
    `;
  }

  function renderBookingRow(booking) {
    const statusLabel = formatStatusLabel(booking.status);
    const statusClass = getStatusBadgeClass(booking.status);
    const isFuture = booking.start.getTime() > Date.now();
    const canConfirm = booking.status === "booked" && isFuture;
    const canCancel = isScheduledStatus(booking.status) && isFuture;
    const canComplete = isScheduledStatus(booking.status) && !isFuture;
    const canNoShow = isScheduledStatus(booking.status) && !isFuture;
    const noShowCount = getClientNoShowCount(booking);
    const depositMeta = booking.depositRequired
      ? `Deposit: $${booking.depositAmount.toFixed(2)} (${formatDepositStatusLabel(booking.depositStatus)})`
      : "Deposit: Not required";
    const providerMeta = currentRole === "owner" && scopeMode === "all"
      ? `<span class="small">${escapeHtml(`Barber: ${booking.barberDisplayName || booking.ownerUsername}`)}</span>`
      : "";

    return `
      <article class="today-item">
        <div class="today-time">${escapeHtml(formatTimeRange(booking.start, booking.end))}</div>
        <div class="today-main">
          <h3>${escapeHtml(booking.clientName)} | ${escapeHtml(booking.serviceName)}</h3>
          <p class="small">${escapeHtml(booking.clientContact || "No contact provided")}</p>
          <p class="small">${escapeHtml(depositMeta)}</p>
          <p class="small">${escapeHtml(`No-shows: ${noShowCount}`)}</p>
          ${providerMeta}
        </div>
        <div class="today-actions">
          <span class="badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
          <button type="button" class="btn btn-primary btn-compact" data-action="confirm" data-booking-id="${escapeHtml(booking.id)}" ${canConfirm ? "" : "disabled"}>Confirm</button>
          <button type="button" class="btn btn-ghost btn-compact" data-action="cancel" data-booking-id="${escapeHtml(booking.id)}" ${canCancel ? "" : "disabled"}>Cancel</button>
          <button type="button" class="btn btn-ghost btn-compact" data-action="complete" data-booking-id="${escapeHtml(booking.id)}" ${canComplete ? "" : "disabled"}>Complete</button>
          <button type="button" class="btn btn-ghost btn-compact" data-action="no-show" data-booking-id="${escapeHtml(booking.id)}" ${canNoShow ? "" : "disabled"}>Mark No-show</button>
        </div>
      </article>
    `;
  }

  function renderSummaryStatus(todayBookings, timelineItems) {
    const gapCount = timelineItems.filter((item) => item.kind === "gap").length;
    const appointmentCount = todayBookings.length;
    const gapMessage = gapCount > 0
      ? `${gapCount} free time block${gapCount === 1 ? "" : "s"}`
      : "no free blocks";
    setInlineStatus(`${appointmentCount} scheduled appointment${appointmentCount === 1 ? "" : "s"} today, ${gapMessage}.`, true);
  }

  function setInlineStatus(message, success) {
    if (!statusEl) return;
    statusEl.textContent = String(message ?? "");
    statusEl.setAttribute("role", success ? "status" : "alert");
    statusEl.setAttribute("aria-live", success ? "polite" : "assertive");
    statusEl.setAttribute("aria-atomic", "true");
    statusEl.classList.remove("status-success", "status-error");
    statusEl.classList.add(success ? "status-success" : "status-error");
  }

  function resolveBarberDisplayName(username) {
    const target = String(username ?? "").trim();
    if (!target) return "";

    const fromScope = barbersInShop.find((barber) => barber.username === target);
    if (fromScope) return fromScope.displayName;

    const user = dataStore.getUsers().find((item) => String(item?.username ?? "").trim() === target);
    return String(user?.displayName ?? user?.username ?? target).trim() || target;
  }

  function getBookingStartDate(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const parsed = new Date(startIso);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }

    const dateText = String(booking?.date ?? "").trim();
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && time24) {
      const parsedLegacy = new Date(`${dateText}T${time24}:00`);
      if (Number.isFinite(parsedLegacy.getTime())) return parsedLegacy;
    }

    const datetime = String(booking?.datetime ?? "").trim();
    if (datetime) {
      const parsedDatetime = new Date(datetime);
      if (Number.isFinite(parsedDatetime.getTime())) return parsedDatetime;
    }
    return null;
  }

  function getBookingEndDate(booking, start, durationMinutes) {
    const endIso = String(booking?.endISO ?? "").trim();
    if (endIso) {
      const parsed = new Date(endIso);
      if (Number.isFinite(parsed.getTime()) && parsed > start) return parsed;
    }
    return new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  function resolveDurationMinutes(booking) {
    const duration = Number(booking?.durationMinutes ?? 0);
    if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
    return 30;
  }

  function normalizeStatus(statusValue) {
    const status = String(statusValue ?? "booked").trim().toLowerCase();
    if (status === "confirmed") return "confirmed";
    if (status === "cancelled") return "cancelled";
    if (status === "completed") return "completed";
    if (status === "no-show" || status === "no_show" || status === "noshow") return "no-show";
    return "booked";
  }

  function isScheduledStatus(statusValue) {
    const status = normalizeStatus(statusValue);
    return status === "booked" || status === "confirmed";
  }

  function formatStatusLabel(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "confirmed") return "Confirmed";
    if (status === "cancelled") return "Cancelled";
    if (status === "completed") return "Completed";
    if (status === "no-show") return "No-show";
    return "Booked";
  }

  function getStatusBadgeClass(statusValue) {
    const status = normalizeStatus(statusValue);
    if (status === "confirmed") return "badge-success";
    if (status === "cancelled") return "badge-danger";
    if (status === "completed") return "badge-success";
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

  function formatRelativeCountdown(targetDate) {
    const diffMs = targetDate.getTime() - Date.now();
    if (diffMs <= 0) return "Now";
    const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!minutes) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  }

  function formatTimeRange(start, end) {
    return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
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

  function hhmmToMinutes(value) {
    const normalized = normalizeTime(String(value ?? ""));
    if (!/^\d{2}:\d{2}$/.test(normalized)) return NaN;
    const [hh, mm] = normalized.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
    return hh * 60 + mm;
  }

  function normalizeTime(value) {
    const raw = String(value ?? "").trim();
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    return normalizeTimeTo24(raw);
  }

  function normalizeTimeTo24(timeValue) {
    const raw = String(timeValue || "").trim();
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
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
