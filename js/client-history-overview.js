// ---------- MOCK DATA ----------
const appointmentHistory = [
  {
    id: "a1001",
    client: "Jasmine Carter",
    service: "Fade & Beard Trim",
    category: "hair",
    date: "2025-11-03",
    time: "2:00 PM",
    provider: "Jay the Barber",
    notes: "Prefers low fade, no razor",
    feedback: "Loved the fade! Will book again.",
    tags: ["low fade", "no razor", "repeat client"]
  },
  {
    id: "a1002",
    client: "Marcus Lee",
    service: "Tattoo Consultation",
    category: "tattoo",
    date: "2025-10-20",
    time: "11:30 AM",
    provider: "Ink by Marcus",
    notes: "Discussed forearm piece, likes geometric style",
    feedback: "Excited to start the design!",
    tags: ["geometric", "forearm", "new client"]
  }
];

function renderHistory() {
  const list = document.getElementById("client-history-list");
  const serviceFilter = document.getElementById("service-filter").value.toLowerCase();
  const dateFilter = document.getElementById("date-filter").value;
  const clientSearch = document.getElementById("client-search").value.trim().toLowerCase();
  const tagFilter = document.getElementById("tag-filter").value.toLowerCase();

  let filtered = appointmentHistory;

  if (serviceFilter) {
    filtered = filtered.filter(a => a.category === serviceFilter);
  }

  if (dateFilter) {
    filtered = filtered.filter(a => a.date === dateFilter);
  }

  if (clientSearch) {
    filtered = filtered.filter(a => a.client.toLowerCase().includes(clientSearch));
  }

  if (tagFilter) {
    filtered = filtered.filter(a => a.tags.map(t => t.toLowerCase()).includes(tagFilter));
  }

  list.innerHTML = filtered.length
    ? filtered.map(a => `
      <div class="card">
        <h3>${a.service}</h3>
        <p><strong>Client:</strong> ${a.client}</p>
        <p><strong>Date:</strong> ${a.date} at ${a.time}</p>
        <p><strong>Provider:</strong> ${a.provider}</p>
        <p><strong>Notes:</strong> ${a.notes}</p>
        <p><strong>Feedback:</strong> ${a.feedback}</p>
        <p><strong>Tags:</strong> ${a.tags.map(t => `<span class="tag">${t}</span>`).join(" ")}</p>
      </div>
    `).join("")
    : `<p>No matching appointments found.</p>`;
}

function clearFilters() {
  document.getElementById("client-search").value = "";
  document.getElementById("service-filter").value = "";
  document.getElementById("date-filter").value = "";
  document.getElementById("tag-filter").value = "";
  renderHistory();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  document.getElementById("client-search").addEventListener("input", renderHistory);
  document.getElementById("service-filter").addEventListener("change", renderHistory);
  document.getElementById("date-filter").addEventListener("change", renderHistory);
  document.getElementById("tag-filter").addEventListener("change", renderHistory);
  document.getElementById("clear-filters").addEventListener("click", clearFilters);
});
