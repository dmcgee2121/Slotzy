// ---------- MOCK DATA ----------
const earningsData = [
  {
    id: "e001",
    service: "Fade & Beard Trim",
    category: "hair",
    provider: "Jay the Barber",
    date: "2025-11-03",
    amount: 45.00
  },
  {
    id: "e002",
    service: "Tattoo Consultation",
    category: "tattoo",
    provider: "Ink by Marcus",
    date: "2025-10-20",
    amount: 60.00
  },
  {
    id: "e003",
    service: "Nail Art - Custom",
    category: "nails",
    provider: "Tasha Green",
    date: "2025-10-05",
    amount: 75.00
  },
  {
    id: "e004",
    service: "Fade & Beard Trim",
    category: "hair",
    provider: "Jay the Barber",
    date: "2025-10-01",
    amount: 45.00
  }
];

// ---------- RENDER SUMMARY ----------
function renderEarnings() {
  const startDate = document.getElementById("date-start").value;
  const endDate = document.getElementById("date-end").value;
  const providerFilter = document.getElementById("provider-filter").value;

  let filtered = earningsData;

  if (startDate) {
    filtered = filtered.filter(e => e.date >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter(e => e.date <= endDate);
  }

  if (providerFilter) {
    filtered = filtered.filter(e => e.provider === providerFilter);
  }

  // Calculate total
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById("total-earnings").textContent = `$${total.toFixed(2)}`;

  // Breakdown by category
  const breakdownMap = {};
  filtered.forEach(e => {
    breakdownMap[e.category] = (breakdownMap[e.category] || 0) + e.amount;
  });

  const breakdownEl = document.getElementById("earnings-breakdown");
  breakdownEl.innerHTML = Object.entries(breakdownMap).map(([category, amount]) => `
    <div class="breakdown-item">
      <strong>${capitalize(category)}:</strong> $${amount.toFixed(2)}
    </div>
  `).join("");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ---------- CLEAR FILTERS ----------
function clearEarningsFilters() {
  document.getElementById("date-start").value = "";
  document.getElementById("date-end").value = "";
  document.getElementById("provider-filter").value = "";
  renderEarnings();
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  renderEarnings();
  document.getElementById("date-start").addEventListener("change", renderEarnings);
  document.getElementById("date-end").addEventListener("change", renderEarnings);
  document.getElementById("provider-filter").addEventListener("change", renderEarnings);
  document.getElementById("clear-earnings-filters").addEventListener("click", clearEarningsFilters);
});
