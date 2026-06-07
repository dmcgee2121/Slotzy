import { wireLogoutButton } from "./logout.js";
import * as dataStore from "./dataStore.js";

(function () {
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  let didRender = false;
  let didBindListeners = false;
  let currentContext = null;
  let minuteRefreshTimer = null;

  document.addEventListener("DOMContentLoaded", initOwnerInsights);

  function initOwnerInsights() {
    if (didRender) return;
    didRender = true;

    const root = document.getElementById("ownerTodayGlanceCard") || document.getElementById("insightTodayList");
    if (!root) return;

    wireLogoutButton({ redirectPath: "../index.html" });
    bindDashboardEvents();

    const user = dataStore.getSessionUser();
    const username = String(user?.username ?? "").trim();
    const role = String(user?.role ?? "").toLowerCase();
    const isStaff = role === "owner" || role === "barber";
    if (!username || !isStaff) {
      currentContext = null;
      renderSignedOutState();
      return;
    }

    const shopId = resolveShopId(username);
    renderBusinessName(shopId);
    renderOwnerOnlyControls({ role, shopId });
    currentContext = { username, role, shopId };
    renderInsights(currentContext);
  }

  function bindDashboardEvents() {
    if (didBindListeners) return;
    didBindListeners = true;

    const viewBtn = document.getElementById("ownerTodayViewBtn");
    const shareBtn = document.getElementById("ownerTodayShareBtn");
    const pilotSettingsBtn = document.getElementById("pilotSettingsBtn");
    const pilotOpenBookingBtn = document.getElementById("pilotOpenBookingBtn");
    const pilotCopyBookingBtn = document.getElementById("pilotCopyBookingBtn");
    const pilotResetDemoBtn = document.getElementById("pilotResetDemoBtn");

    viewBtn?.addEventListener("click", () => {
      window.location.assign("manage-appointments.html");
    });

    shareBtn?.addEventListener("click", () => {
      window.location.assign("settings.html#public-booking-link-section");
    });
    pilotSettingsBtn?.addEventListener("click", () => {
      window.location.assign("settings.html#public-booking-link-section");
    });
    pilotOpenBookingBtn?.addEventListener("click", () => {
      const link = String(document.getElementById("pilotBookingLink")?.value ?? "").trim();
      if (!link) return;
      window.open(link, "_blank", "noopener,noreferrer");
    });
    pilotCopyBookingBtn?.addEventListener("click", async () => {
      const link = String(document.getElementById("pilotBookingLink")?.value ?? "").trim();
      if (!link) return;
      const copied = await copyText(link);
      if (copied) {
        window.showToast?.("Link copied", "success", 2000);
      }
    });
    pilotResetDemoBtn?.addEventListener("click", () => {
      window.location.assign("../index.html?reset=1&demo=1");
    });

    window.addEventListener("storage", handleBookingStorageSync);
    window.addEventListener(BOOKING_SYNC_EVENT, handleBookingEventSync);
    window.addEventListener("beforeunload", () => {
      if (minuteRefreshTimer) {
        window.clearInterval(minuteRefreshTimer);
        minuteRefreshTimer = null;
      }
    });

    minuteRefreshTimer = window.setInterval(() => {
      renderInsightsFromState();
    }, 60 * 1000);
  }

  function handleBookingStorageSync(event) {
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderInsightsFromState();
  }

  function handleBookingEventSync() {
    renderInsightsFromState();
  }

  function renderInsightsFromState() {
    if (!currentContext) return;
    renderInsights(currentContext);
  }

  function resolveShopId(username) {
    const users = dataStore.getUsers();
    const user = users.find((item) => String(item?.username ?? "") === username);
    const direct = String(user?.shopId ?? "").trim();
    if (direct) return direct;
    const fallback = dataStore.getShopForUser(username);
    return String(fallback?.id ?? "");
  }

  function renderSignedOutState() {
    const glanceCount = document.getElementById("ownerTodayGlanceCount");
    const glanceTitle = document.getElementById("ownerTodayNextTitle");
    const glanceMeta = document.getElementById("ownerTodayNextMeta");
    const todayCount = document.getElementById("insightTodayCount");
    const todayList = document.getElementById("insightTodayList");
    if (glanceCount) glanceCount.textContent = "0 booked or confirmed today";
    if (glanceTitle) glanceTitle.textContent = "Staff sign-in required";
    if (glanceMeta) glanceMeta.textContent = "Log in as an owner or barber to view your schedule.";
    if (todayCount) todayCount.textContent = "0 scheduled today";
    if (todayList) {
      todayList.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Staff sign-in required</h3>
          <p>Log in as an owner or barber to view insights.</p>
        </section>
      `;
    }
  }

  function renderInsights({ username, role, shopId }) {
    const bookings = getManagedBookings({ username, role, shopId });

    const services = dataStore.getServices().filter((service) => {
      if (role === "owner") {
        return String(service?.shopId ?? "") === shopId;
      }
      return String(service?.barberUsername ?? service?.ownerUsername ?? "") === username;
    });

    const servicePriceById = buildServicePriceMap(services);
    const serviceNameById = buildServiceNameMap(services);

    renderTodayGlance(bookings);
    renderTodayBookings(bookings);
    renderTodaySchedule(bookings);
    renderWeekRevenue(bookings, servicePriceById);
    renderMostPopularService(bookings, serviceNameById);
  }

  function getManagedBookings({ username, role, shopId }) {
    return dataStore.getBookings().filter((booking) => {
      if (role === "owner") {
        if (shopId) {
          return String(booking?.shopId ?? "").trim() === shopId;
        }
        const bookingOwner = String(booking?.ownerUsername ?? booking?.barberUsername ?? "").trim();
        return bookingOwner === username;
      }

      const bookingStaffUsername = String(booking?.barberUsername ?? booking?.ownerUsername ?? "").trim();
      return bookingStaffUsername === username;
    });
  }

  function renderTodayGlance(bookings) {
    const countEl = document.getElementById("ownerTodayGlanceCount");
    const titleEl = document.getElementById("ownerTodayNextTitle");
    const metaEl = document.getElementById("ownerTodayNextMeta");
    if (!countEl || !titleEl || !metaEl) return;

    const todayBookings = getTodayScheduledBookings(bookings);
    countEl.textContent = `${todayBookings.length} booked or confirmed today`;

    if (todayBookings.length === 0) {
      titleEl.textContent = "No appointments today";
      metaEl.textContent = "Booked and confirmed appointments will appear here as soon as they are scheduled.";
      return;
    }

    const now = Date.now();
    const nextBooking = todayBookings.find((booking) => booking._start.getTime() >= now) || null;
    if (!nextBooking) {
      titleEl.textContent = "No more appointments today";
      metaEl.textContent = `${todayBookings.length} booked or confirmed appointment${todayBookings.length === 1 ? "" : "s"} are already on today’s schedule.`;
      return;
    }

    const clientName = String(nextBooking?.clientName ?? nextBooking?.customerUsername ?? "Client").trim() || "Client";
    const serviceName = String(nextBooking?.serviceName ?? "Service").trim() || "Service";
    titleEl.textContent = formatTimeLabelFromDate(nextBooking._start);
    metaEl.textContent = `${clientName} | ${serviceName}`;
  }

  function renderTodaySchedule(bookings) {
    const scheduleEl = document.getElementById("insightTodaySchedule");
    if (!scheduleEl) return;

    const todaysBooked = getTodayScheduledBookings(bookings);

    if (todaysBooked.length === 0) {
      scheduleEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">&#128467;</span>
          <h3>Schedule is clear</h3>
          <p>No booked or confirmed appointments for today yet.</p>
        </section>
      `;
      return;
    }

    const topEight = todaysBooked.slice(0, 8);
    scheduleEl.innerHTML = `
      <div class="owner-insight-list">
        ${topEight.map((booking) => {
          const serviceName = String(booking?.serviceName ?? "Service");
          const customer = String(booking?.clientName ?? booking?.customerUsername ?? "Customer");
          const timeLabel = Number.isFinite(booking?._start?.getTime?.())
            ? formatTimeLabelFromDate(booking._start)
            : "Time TBD";
          return `
            <div class="owner-insight-item">
              <span class="owner-insight-time">${escapeHtml(timeLabel)}</span>
              <span class="owner-insight-service">${escapeHtml(serviceName)}</span>
              <span class="owner-insight-customer">${escapeHtml(customer)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderTodayBookings(bookings) {
    const countEl = document.getElementById("insightTodayCount");
    const listEl = document.getElementById("insightTodayList");
    if (!countEl || !listEl) return;

    const todaysBooked = getTodayScheduledBookings(bookings);

    countEl.textContent = `${todaysBooked.length} scheduled today`;

    if (todaysBooked.length === 0) {
      listEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">&#128197;</span>
          <h3>No bookings for today</h3>
          <p>New booked or confirmed appointments for today will appear here.</p>
        </section>
      `;
      return;
    }

    const topFive = todaysBooked.slice(0, 5);
    listEl.innerHTML = `
      <div class="owner-insight-list">
        ${topFive.map((booking) => {
          const serviceName = String(booking?.serviceName ?? "Service");
          const customer = String(booking?.clientName ?? booking?.customerUsername ?? "Customer");
          const timeLabel = Number.isFinite(booking?._start?.getTime?.())
            ? formatTimeLabelFromDate(booking._start)
            : "Time TBD";
          return `
            <div class="owner-insight-item">
              <span class="owner-insight-time">${escapeHtml(timeLabel)}</span>
              <span class="owner-insight-service">${escapeHtml(serviceName)}</span>
              <span class="owner-insight-customer">${escapeHtml(customer)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderWeekRevenue(bookings, servicePriceById) {
    const revenueEl = document.getElementById("insightWeekRevenue");
    const metaEl = document.getElementById("insightWeekMeta");
    const noteEl = document.getElementById("insightWeekNote");
    if (!revenueEl || !metaEl || !noteEl) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartTs = weekStart.getTime();
    const weekEndTs = now.getTime();

    let revenue = 0;
    let completedCount = 0;
    let missingPriceCount = 0;

    bookings.forEach((booking) => {
      if (normalizeStatus(booking?.status) !== "completed") return;
      const ts = getBookingTimestamp(booking);
      if (!Number.isFinite(ts) || ts < weekStartTs || ts > weekEndTs) return;

      completedCount += 1;
      const serviceId = String(booking?.serviceId ?? "");
      const explicitPrice = Number(booking?.price ?? NaN);
      if (Number.isFinite(explicitPrice)) {
        revenue += explicitPrice;
        return;
      }

      const mappedPrice = servicePriceById.get(serviceId);
      if (!Number.isFinite(mappedPrice)) {
        missingPriceCount += 1;
        return;
      }
      revenue += mappedPrice;
    });

    revenueEl.textContent = formatMoney(revenue);
    metaEl.textContent = `${completedCount} completed booking${completedCount === 1 ? "" : "s"} in the last 7 days`;
    if (missingPriceCount > 0) {
      noteEl.classList.remove("hidden");
      noteEl.textContent = `${missingPriceCount} booking${missingPriceCount === 1 ? "" : "s"} had no price mapping and were counted as $0.`;
    } else {
      noteEl.classList.add("hidden");
      noteEl.textContent = "";
    }
  }

  function renderMostPopularService(bookings, serviceNameById) {
    const nameEl = document.getElementById("insightPopularName");
    const countEl = document.getElementById("insightPopularCount");
    const breakdownEl = document.getElementById("insightPopularBreakdown");
    const emptyEl = document.getElementById("insightPopularEmpty");
    if (!nameEl || !countEl || !breakdownEl || !emptyEl) return;

    const grouped = new Map();

    bookings.forEach((booking) => {
      const status = normalizeStatus(booking?.status);
      if (!isScheduledStatus(status) && status !== "completed") return;

      const serviceId = String(booking?.serviceId ?? "").trim();
      const fallbackName = String(booking?.serviceName ?? "Service").trim() || "Service";
      const key = serviceId
        ? `id:${serviceId}`
        : `name:${fallbackName.toLowerCase()}`;
      const resolvedName = serviceId
        ? String(serviceNameById.get(serviceId) || fallbackName)
        : fallbackName;

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: resolvedName,
          total: 0,
          booked: 0,
          completed: 0,
        });
      }

      const item = grouped.get(key);
      item.total += 1;
      if (isScheduledStatus(status)) item.booked += 1;
      if (status === "completed") item.completed += 1;
      if (item.name === "Service" && fallbackName) {
        item.name = fallbackName;
      }
    });

    const popular = Array.from(grouped.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.completed !== a.completed) return b.completed - a.completed;
        return a.name.localeCompare(b.name);
      })[0];

    if (!popular) {
      nameEl.textContent = "No popular service yet";
      countEl.textContent = "";
      breakdownEl.textContent = "";
      emptyEl.classList.remove("hidden");
      emptyEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No qualifying bookings</h3>
          <p>Scheduled and completed services will appear here once activity starts.</p>
        </section>
      `;
      return;
    }

    emptyEl.classList.add("hidden");
    emptyEl.innerHTML = "";
    nameEl.textContent = popular.name;
    countEl.textContent = `${popular.total} booking${popular.total === 1 ? "" : "s"}`;
    breakdownEl.textContent = `Scheduled: ${popular.booked} | Completed: ${popular.completed}`;
  }

  function renderBusinessName(shopId) {
    const heroTitleEl = document.getElementById("ownerHeroTitle");
    if (!heroTitleEl) return;

    const shop = dataStore.getShopById(shopId) || dataStore.getShops()[0] || null;
    const businessName = String(shop?.name ?? "").trim();
    heroTitleEl.textContent = `Welcome, ${businessName || "Your Shop"}`;
  }

  function renderOwnerOnlyControls({ role, shopId }) {
    const teamCard = document.getElementById("ownerTeamCard");
    const pilotModeBanner = document.getElementById("pilotModeBanner");
    const pilotBookingLink = document.getElementById("pilotBookingLink");
    const pilotBookingQr = document.getElementById("pilotBookingQr");
    const pilotBookingQrEmpty = document.getElementById("pilotBookingQrEmpty");
    const pilotResetDemoBtn = document.getElementById("pilotResetDemoBtn");

    const isOwner = role === "owner";
    teamCard?.classList.toggle("hidden", !isOwner);
    if (!pilotModeBanner) return;

    if (!isOwner) {
      pilotModeBanner.classList.add("hidden");
      return;
    }

    const shop = dataStore.getShopById(shopId) || dataStore.getShops()[0] || null;
    const slug = String(shop?.slug ?? "").trim();
    if (!slug) {
      pilotModeBanner.classList.add("hidden");
      return;
    }

    const bookingLink = `${window.location.origin}/pages/book.html?shop=${encodeURIComponent(slug)}`;
    if (pilotBookingLink) pilotBookingLink.value = bookingLink;
    if (pilotResetDemoBtn) {
      pilotResetDemoBtn.classList.toggle("hidden", !dataStore.isDemoMode());
    }

    renderPilotQr(bookingLink, pilotBookingQr, pilotBookingQrEmpty);
    pilotModeBanner.classList.remove("hidden");
  }

  async function renderPilotQr(bookingLink, imageEl, emptyEl) {
    if (!imageEl || !emptyEl) return;
    if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
      imageEl.classList.add("hidden");
      emptyEl.textContent = "QR quick access is available when the QR helper loads.";
      emptyEl.classList.remove("hidden");
      return;
    }

    try {
      const dataUrl = await window.QRCode.toDataURL(bookingLink, {
        margin: 1,
        width: 220,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      imageEl.src = String(dataUrl ?? "");
      imageEl.classList.remove("hidden");
      emptyEl.classList.add("hidden");
    } catch {
      imageEl.classList.add("hidden");
      emptyEl.textContent = "QR quick access is unavailable right now.";
      emptyEl.classList.remove("hidden");
    }
  }

  async function copyText(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  function buildServicePriceMap(services) {
    const map = new Map();
    services.forEach((service) => {
      const id = String(service?.id ?? "");
      const price = Number(service?.price ?? NaN);
      if (!id) return;
      map.set(id, Number.isFinite(price) && price >= 0 ? price : NaN);
    });
    return map;
  }

  function buildServiceNameMap(services) {
    const map = new Map();
    services.forEach((service) => {
      const id = String(service?.id ?? "");
      const name = String(service?.name ?? service?.title ?? "").trim();
      if (!id || !name) return;
      map.set(id, name);
    });
    return map;
  }

  function getTodayDateString() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getTodayScheduledBookings(bookings) {
    const today = getTodayDateString();
    return bookings
      .filter((booking) => isScheduledStatus(booking?.status))
      .map((booking) => ({
        ...booking,
        _start: getBookingStartDate(booking),
      }))
      .filter((booking) => Number.isFinite(booking?._start?.getTime?.()))
      .filter((booking) => toYmdLocal(booking._start) === today)
      .sort((a, b) => a._start.getTime() - b._start.getTime());
  }

  function getBookingDateText(booking) {
    const dateText = String(booking?.date ?? "").trim();
    if (dateText) return dateText;

    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const parsed = new Date(startIso);
      if (Number.isFinite(parsed.getTime())) {
        const yyyy = String(parsed.getFullYear());
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    if (booking?.datetime) {
      const parsed = new Date(booking.datetime);
      if (Number.isFinite(parsed.getTime())) {
        const yyyy = String(parsed.getFullYear());
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return "";
  }

  function getBookingStartDate(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? booking?.datetime ?? "").trim();
    if (startIso) {
      const parsed = new Date(startIso);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }

    const dateText = getBookingDateText(booking);
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && time24) {
      const parsed = new Date(`${dateText}T${time24}:00`);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    if (dateText) {
      const parsed = new Date(`${dateText}T00:00:00`);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return new Date(NaN);
  }

  function getBookingTimestamp(booking) {
    const startIso = String(booking?.startISO ?? booking?.startAtISO ?? "").trim();
    if (startIso) {
      const isoTs = new Date(startIso).getTime();
      if (Number.isFinite(isoTs)) return isoTs;
    }

    const dateText = getBookingDateText(booking);
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && time24) return new Date(`${dateText}T${time24}:00`).getTime();
    if (dateText) return new Date(`${dateText}T00:00:00`).getTime();
    return NaN;
  }

  function normalizeStatus(statusValue) {
    const status = String(statusValue ?? "").trim().toLowerCase();
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

  function formatTimeLabelFromDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "Time TBD";
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = ((hours + 11) % 12) + 1;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
  }

  function toYmdLocal(date) {
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
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
