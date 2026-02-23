export function renderOwnerBookingsSection(bookings, escapeHtml) {
  const sourceBookings = getOwnerBookings(bookings);
  const recentBookings = sourceBookings
    .map((booking) => ({ ...booking, _timestamp: getBookingTimestamp(booking) }))
    .filter((booking) => Number.isFinite(booking._timestamp))
    .sort((a, b) => b._timestamp - a._timestamp)
    .slice(0, 10);

  return `
    <section class="card">
      <h2>Recent Bookings</h2>
      ${recentBookings.length === 0
        ? `<p class="muted">No bookings yet</p>`
        : `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:0.5rem;">Customer</th>
                  <th style="text-align:left; padding:0.5rem;">Service</th>
                  <th style="text-align:left; padding:0.5rem;">Date</th>
                  <th style="text-align:left; padding:0.5rem;">Time</th>
                  <th style="text-align:left; padding:0.5rem;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentBookings.map((booking) => `
                  <tr>
                    <td style="padding:0.5rem;">${escapeHtml(getCustomerName(booking))}</td>
                    <td style="padding:0.5rem;">${escapeHtml(getServiceName(booking))}</td>
                    <td style="padding:0.5rem;">${escapeHtml(getBookingDateLabel(booking))}</td>
                    <td style="padding:0.5rem;">${escapeHtml(getBookingTimeLabel(booking))}</td>
                    <td style="padding:0.5rem;">${escapeHtml(String(booking.status ?? "booked"))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
    </section>
  `;
}

function getOwnerBookings(fallback) {
  try {
    const raw = localStorage.getItem("Slotzy_bookings");
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall back to the provided value if localStorage parse fails.
  }
  return Array.isArray(fallback) ? fallback : [];
}

function getBookingTimestamp(booking) {
  if (booking?.datetime) {
    const legacyTime = new Date(booking.datetime).getTime();
    if (Number.isFinite(legacyTime)) return legacyTime;
  }

  const datePart = String(booking?.date ?? "").trim();
  const timePart = normalizeTimeTo24(String(booking?.time ?? "").trim());
  if (!datePart || !timePart) return NaN;

  return new Date(`${datePart}T${timePart}:00`).getTime();
}

function getCustomerName(booking) {
  return String(booking?.customerUsername ?? booking?.name ?? "Unknown");
}

function getServiceName(booking) {
  return String(booking?.serviceName ?? booking?.serviceTitle ?? "Service");
}

function getBookingDateLabel(booking) {
  const datePart = String(booking?.date ?? "").trim();
  if (datePart) return datePart;

  if (booking?.datetime) {
    const parsed = new Date(booking.datetime);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return "Unknown";
}

function getBookingTimeLabel(booking) {
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
  return "Unknown";
}

function normalizeTimeTo24(timeValue) {
  if (!timeValue) return "";
  if (/^\d{2}:\d{2}$/.test(timeValue)) return timeValue;

  const match = timeValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
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

export function renderCustomerDashboard({ app, getUser, getBookings, escapeHtml, renderHome }) {
  const u = getUser();
  const bookings = getBookings().filter((b) => b.name === u.username);

  app.innerHTML = `
    <div class="customer-dashboard">
      <h1>My Bookings</h1>
      <p>Signed in as <strong>${escapeHtml(u.username)}</strong></p>
      <button id="btn-cust-home" class="btn btn-ghost">Home</button>

      <ul class="list">
        ${bookings.length === 0
          ? `<li class="muted">No bookings found</li>`
          : bookings.map((b) => `
            <li class="list-row">
              <div>
                <strong>${escapeHtml(b.serviceTitle)}</strong>
                <div class="muted">${new Date(b.datetime).toLocaleString()}</div>
              </div>
            </li>
          `).join("")}
      </ul>
    </div>
  `;

  document.getElementById("btn-cust-home")?.addEventListener("click", renderHome);
}
