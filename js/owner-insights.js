import { wireLogoutButton } from "./logout.js";
import * as dataStore from "./dataStore.js";

(function () {
  let didRender = false;

  document.addEventListener("DOMContentLoaded", initOwnerInsights);

  function initOwnerInsights() {
    if (didRender) return;
    didRender = true;

    const root = document.getElementById("insightTodayList");
    if (!root) return;

    wireLogoutButton({ redirectPath: "../index.html" });
    renderBusinessName();
    renderInsights();
  }

  function renderInsights() {
    const bookings = dataStore.getBookings();
    const services = dataStore.getServices();
    const servicePriceById = buildServicePriceMap(services);
    const serviceNameById = buildServiceNameMap(services);

    renderTodayBookings(bookings);
    renderTodaySchedule(bookings);
    renderWeekRevenue(bookings, servicePriceById);
    renderMostPopularService(bookings, serviceNameById);
  }

  function renderTodaySchedule(bookings) {
    const scheduleEl = document.getElementById("insightTodaySchedule");
    if (!scheduleEl) return;

    const today = getTodayDateString();
    const todaysBooked = bookings
      .filter((booking) => normalizeStatus(booking?.status) === "booked")
      .filter((booking) => getBookingDateText(booking) === today)
      .sort((a, b) => {
        const left = normalizeTimeTo24(String(a?.time ?? ""));
        const right = normalizeTimeTo24(String(b?.time ?? ""));
        return left.localeCompare(right);
      });

    if (todaysBooked.length === 0) {
      scheduleEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">&#128467;</span>
          <h3>Schedule is clear</h3>
          <p>No booked appointments for today yet.</p>
        </section>
      `;
      return;
    }

    const topEight = todaysBooked.slice(0, 8);
    scheduleEl.innerHTML = `
      <div class="owner-insight-list">
        ${topEight.map((booking) => {
          const serviceName = String(booking?.serviceName ?? "Service");
          const customer = String(booking?.customerUsername ?? "Customer");
          const time = normalizeTimeTo24(String(booking?.time ?? ""));
          const timeLabel = time ? formatTimeLabel(time) : "Time TBD";
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

    const today = getTodayDateString();
    const todaysBooked = bookings
      .filter((booking) => normalizeStatus(booking?.status) === "booked")
      .filter((booking) => getBookingDateText(booking) === today)
      .sort((a, b) => {
        const left = normalizeTimeTo24(String(a?.time ?? ""));
        const right = normalizeTimeTo24(String(b?.time ?? ""));
        return left.localeCompare(right);
      });

    countEl.textContent = `${todaysBooked.length} booked today`;

    if (todaysBooked.length === 0) {
      listEl.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">📅</span>
          <h3>No bookings for today</h3>
          <p>New appointments booked for today will appear here.</p>
        </section>
      `;
      return;
    }

    const topFive = todaysBooked.slice(0, 5);
    listEl.innerHTML = `
      <div class="owner-insight-list">
        ${topFive.map((booking) => {
          const serviceName = String(booking?.serviceName ?? "Service");
          const customer = String(booking?.customerUsername ?? "Customer");
          const time = normalizeTimeTo24(String(booking?.time ?? ""));
          const timeLabel = time ? formatTimeLabel(time) : "Time TBD";
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
      if (status !== "booked" && status !== "completed") return;

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
      if (status === "booked") item.booked += 1;
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
          <span class="empty-state-icon" aria-hidden="true">⭐</span>
          <h3>No qualifying bookings</h3>
          <p>Booked and completed services will appear here once activity starts.</p>
        </section>
      `;
      return;
    }

    emptyEl.classList.add("hidden");
    emptyEl.innerHTML = "";
    nameEl.textContent = popular.name;
    countEl.textContent = `${popular.total} booking${popular.total === 1 ? "" : "s"}`;
    breakdownEl.textContent = `Booked: ${popular.booked}  Completed: ${popular.completed}`;
  }

  function renderBusinessName() {
    const heroTitleEl = document.getElementById("ownerHeroTitle");
    if (!heroTitleEl) return;

    const shop = dataStore.getShop() || {};
    const businessName = String(shop?.businessName ?? "").trim();
    heroTitleEl.textContent = `Welcome, ${businessName || "Your Shop"}`;
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

  function getBookingDateText(booking) {
    const dateText = String(booking?.date ?? "").trim();
    if (dateText) return dateText;

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

  function getBookingTimestamp(booking) {
    const dateText = getBookingDateText(booking);
    const time24 = normalizeTimeTo24(String(booking?.time ?? "").trim());
    if (dateText && time24) return new Date(`${dateText}T${time24}:00`).getTime();
    if (dateText) return new Date(`${dateText}T00:00:00`).getTime();

    if (booking?.datetime) {
      const legacy = new Date(booking.datetime).getTime();
      if (Number.isFinite(legacy)) return legacy;
    }
    return NaN;
  }

  function normalizeStatus(statusValue) {
    return String(statusValue ?? "").trim().toLowerCase();
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
