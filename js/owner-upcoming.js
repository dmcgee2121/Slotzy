import * as dataStore from "./dataStore.js";

(function () {
  const BOOKING_SYNC_EVENT = dataStore.EVENTS?.BOOKINGS_UPDATED || "slotzy:bookings-updated";
  const BOOKINGS_STORAGE_KEY = dataStore.KEYS?.BOOKINGS || "Slotzy_bookings";
  const container = document.getElementById("owner-upcoming-list");
  if (!container) return;

  renderUpcoming();
  container.addEventListener("click", handleActionClick);
  window.addEventListener("storage", handleBookingStorageSync);
  window.addEventListener(BOOKING_SYNC_EVENT, handleBookingEventSync);

  function renderUpcoming() {
    const user = dataStore.getSessionUser();
    const username = String(user?.username ?? "").trim();
    const role = String(user?.role ?? "").toLowerCase();
    const isStaff = role === "owner" || role === "barber";

    if (!username || !isStaff) {
      container.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>Staff sign-in required</h3>
          <p>Log in as an owner or barber to view upcoming appointments.</p>
        </section>
      `;
      return;
    }

    const ownerBookings = dataStore.getBookings()
      .filter((booking) => String(booking?.ownerUsername ?? "") === username);
    const clientNoShowCountByKey = buildClientNoShowCountMap(ownerBookings);

    const bookings = ownerBookings
      .filter((booking) => {
        const status = String(booking?.status ?? "").trim().toLowerCase();
        return status === "booked" || status === "confirmed";
      })
      .map((booking) => ({ ...booking, _start: new Date(String(booking.startISO ?? booking.startAtISO ?? "")) }))
      .filter((booking) => Number.isFinite(booking._start.getTime()))
      .filter((booking) => booking._start.getTime() >= Date.now())
      .sort((a, b) => a._start.getTime() - b._start.getTime());

    if (!bookings.length) {
      container.innerHTML = `
        <section class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">S</span>
          <h3>No upcoming appointments</h3>
          <p>New bookings will appear here automatically.</p>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <ul class="availability-timeoff-items">
        ${bookings.map((booking) => {
          const start = booking._start;
          const end = new Date(String(booking.endISO ?? ""));
          const startDate = toYmd(start);
          const startTime = toTimeLabel(start);
          const endTime = Number.isFinite(end.getTime()) ? toTimeLabel(end) : "";
          const depositRequired = Boolean(booking?.depositRequired);
          const depositAmountRaw = Number(booking?.depositAmount ?? 0);
          const depositAmount = Number.isFinite(depositAmountRaw) && depositAmountRaw > 0
            ? Number(depositAmountRaw.toFixed(2))
            : 0;
          const depositStatus = depositRequired
            ? String(booking?.depositStatus ?? "unpaid").trim().toLowerCase() || "unpaid"
            : "not_required";
          const depositMeta = depositRequired
            ? `Deposit: $${depositAmount.toFixed(2)} (${formatDepositStatusLabel(depositStatus)})`
            : "Deposit: Not required";
          const noShowCount = getClientNoShowCount(booking, clientNoShowCountByKey);
          return `
            <li class="availability-timeoff-item">
              <div>
                <strong>${escapeHtml(startDate)} ${escapeHtml(startTime)}${endTime ? ` - ${escapeHtml(endTime)}` : ""}</strong>
                <p class="small">${escapeHtml(String(booking.serviceName ?? "Service"))}</p>
                <p class="small">${escapeHtml(String(booking.clientName ?? "Client"))} | ${escapeHtml(String(booking.clientContact ?? ""))}</p>
                <p class="small">${escapeHtml(depositMeta)}</p>
                <p class="small">${escapeHtml(`No-shows: ${noShowCount}`)}</p>
              </div>
              <button class="btn btn-danger" type="button" data-action="cancel-owner-booking" data-id="${escapeHtml(String(booking.id ?? ""))}">Cancel</button>
            </li>
          `;
        }).join("")}
      </ul>
    `;
  }

  function handleActionClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-action");
    if (action !== "cancel-owner-booking") return;
    const id = String(target.getAttribute("data-id") ?? "");
    if (!id) return;

    if (!window.confirm("Cancel this booking?")) return;

    const bookings = dataStore.getBookings().map((booking) => {
      if (String(booking?.id ?? "") !== id) return booking;
      return { ...booking, status: "cancelled" };
    });
    dataStore.saveBookings(bookings);
    renderUpcoming();
  }

  function handleBookingStorageSync(event) {
    if (event?.key && event.key !== BOOKINGS_STORAGE_KEY) return;
    renderUpcoming();
  }

  function handleBookingEventSync() {
    renderUpcoming();
  }

  function buildClientNoShowCountMap(bookings) {
    const map = new Map();
    if (!Array.isArray(bookings)) return map;

    bookings.forEach((booking) => {
      const status = String(booking?.status ?? "").trim().toLowerCase();
      if (status !== "no-show" && status !== "no_show" && status !== "noshow") return;
      const key = getClientNoShowKey(booking);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }

  function getClientNoShowCount(booking, noShowCountByKey) {
    const key = getClientNoShowKey(booking);
    if (!key) return 0;
    return Number(noShowCountByKey?.get(key) ?? 0);
  }

  function getClientNoShowKey(booking) {
    const contact = String(booking?.clientContact ?? "").trim().toLowerCase();
    if (contact) return `contact:${contact}`;
    const name = String(booking?.clientName ?? booking?.customerUsername ?? booking?.name ?? "").trim().toLowerCase();
    if (name) return `name:${name}`;
    return "";
  }

  function formatDepositStatusLabel(status) {
    const normalized = String(status ?? "").trim().toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "waived") return "Waived";
    if (normalized === "not_required") return "Not required";
    return "Unpaid";
  }

  function toYmd(date) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toTimeLabel(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
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
